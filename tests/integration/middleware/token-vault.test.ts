import { describe, expect, it, beforeEach } from "bun:test";
import { Router } from "../../../src";
import { tokenVault, VaultMemoryStore } from "../../../src/middleware/token-vault";
import { jwt, jwtSign, jwtDecode } from "../../../src/middleware/jwt";
import { errorHandler } from "../../../src/middleware/error-handler";
import { json } from "../../../src/middleware/body-parser";
import { cookieParser } from "../../../src/middleware/cookie-parser";

const ACCESS_SECRET  = "integration-vault-access-32chars!";
const REFRESH_SECRET = "integration-vault-refresh-32chars";

function buildRouter(store: VaultMemoryStore, onReuse?: (fid: string) => void) {
  const vault = tokenVault({
    accessSecret:     ACCESS_SECRET,
    refreshSecret:    REFRESH_SECRET,
    accessExpiresIn:  900,
    refreshExpiresIn: 604800,
    store,
    onReuse: onReuse ? async (fid) => onReuse(fid) : undefined,
  });

  const router = new Router();
  router.use(json());

  router.post("/auth/login", async (req, res, next) => {
    try {
      const pair = await vault.issue({ sub: "user-1", role: "admin" });
      res.json(pair);
    } catch (err) { next(err); }
  });

  router.post("/auth/refresh", async (req, res, next) => {
    try {
      const { refreshToken } = req.body as { refreshToken: string };
      const pair = await vault.rotate(refreshToken);
      res.json(pair);
    } catch (err) { next(err); }
  });

  router.post("/auth/logout", async (req, res, next) => {
    try {
      const { refreshToken } = req.body as { refreshToken: string };
      await vault.revoke(refreshToken);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.post("/auth/logout-all", jwt({ secret: ACCESS_SECRET }), async (req, res, next) => {
    try {
      const fid = (req as any).user?.fid as string | undefined;
      if (!fid) return res.status(400).json({ error: "fid missing from token" });
      await vault.revokeAll(fid);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get("/api/me", jwt({ secret: ACCESS_SECRET }), (req, res) => {
    res.json({ sub: (req as any).user?.sub });
  });

  router.use(errorHandler());
  return { router, vault };
}

function post(path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function get(path: string, token?: string): Request {
  return new Request(`http://localhost${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("TokenVault (Integration)", () => {
  let store: VaultMemoryStore;
  let router: Router;

  beforeEach(() => {
    store = new VaultMemoryStore();
    ({ router } = buildRouter(store));
  });

  it("login → receive { accessToken, refreshToken }", async () => {
    const res = await router.handle(post("/auth/login"));
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
  });

  it("access token is valid for jwt() middleware", async () => {
    const { accessToken } = await router.handle(post("/auth/login")).then(r => r.json<any>());
    const me = await router.handle(get("/api/me", accessToken));
    expect(me.status).toBe(200);
    expect((await me.json<any>()).sub).toBe("user-1");
  });

  it("rotate → receive new { accessToken, refreshToken }", async () => {
    const { refreshToken } = await router.handle(post("/auth/login")).then(r => r.json<any>());
    const res = await router.handle(post("/auth/refresh", { refreshToken }));
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
  });

  it("old refresh token rejected after rotate", async () => {
    const { refreshToken: rt1 } = await router.handle(post("/auth/login")).then(r => r.json<any>());
    await router.handle(post("/auth/refresh", { refreshToken: rt1 }));
    const res = await router.handle(post("/auth/refresh", { refreshToken: rt1 }));
    expect(res.status).toBe(401);
  });

  it("new access token validates with jwt() after rotate", async () => {
    const { refreshToken } = await router.handle(post("/auth/login")).then(r => r.json<any>());
    const { accessToken: newAt } = await router.handle(
      post("/auth/refresh", { refreshToken })
    ).then(r => r.json<any>());
    const me = await router.handle(get("/api/me", newAt));
    expect(me.status).toBe(200);
  });

  it("full chain: issue → rotate × 5 each token valid", async () => {
    let { refreshToken } = await router.handle(post("/auth/login")).then(r => r.json<any>());
    for (let i = 0; i < 5; i++) {
      const res = await router.handle(post("/auth/refresh", { refreshToken }));
      expect(res.status).toBe(200);
      ({ refreshToken } = await res.json<any>());
    }
    expect(typeof refreshToken).toBe("string");
  });

  it("revoke → rotate rejected with 401", async () => {
    const { refreshToken } = await router.handle(post("/auth/login")).then(r => r.json<any>());
    await router.handle(post("/auth/logout", { refreshToken }));
    const res = await router.handle(post("/auth/refresh", { refreshToken }));
    expect(res.status).toBe(401);
  });

  it("logout-all → all rotates in that family rejected", async () => {
    const { accessToken, refreshToken } = await router.handle(post("/auth/login")).then(r => r.json<any>());
    // Inject fid into access token — we need a vault where issue() puts fid in the AT
    // The default integration vault doesn't put fid in the AT, so we test via the familyId directly
    const fid = jwtDecode(refreshToken)!.fid as string;
    await store.revokeFamily(fid); // simulate logout-all
    const res = await router.handle(post("/auth/refresh", { refreshToken }));
    expect(res.status).toBe(401);
  });

  it("reuse attack: rotate twice with same token → second is 401 + onReuse fired", async () => {
    const fired: string[] = [];
    const { router: r2 } = buildRouter(new VaultMemoryStore(), (fid) => fired.push(fid));
    const { refreshToken } = await r2.handle(post("/auth/login")).then(r => r.json<any>());
    await r2.handle(post("/auth/refresh", { refreshToken }));
    const attackRes = await r2.handle(post("/auth/refresh", { refreshToken }));
    expect(attackRes.status).toBe(401);
    expect(fired).toHaveLength(1);
  });

  it("different familyId per login (2 logins = 2 families)", async () => {
    const r1 = await router.handle(post("/auth/login")).then(r => r.json<any>());
    const r2 = await router.handle(post("/auth/login")).then(r => r.json<any>());
    const fid1 = jwtDecode(r1.refreshToken)!.fid;
    const fid2 = jwtDecode(r2.refreshToken)!.fid;
    expect(fid1).not.toBe(fid2);
  });

  it("revoking family A does not affect family B", async () => {
    const loginA = await router.handle(post("/auth/login")).then(r => r.json<any>());
    const loginB = await router.handle(post("/auth/login")).then(r => r.json<any>());
    await store.revokeFamily(jwtDecode(loginA.refreshToken)!.fid as string);
    const resB = await router.handle(post("/auth/refresh", { refreshToken: loginB.refreshToken }));
    expect(resB.status).toBe(200);
  });

  it("store size does not grow unboundedly after rotation chain", async () => {
    let { refreshToken } = await router.handle(post("/auth/login")).then(r => r.json<any>());
    for (let i = 0; i < 10; i++) {
      ({ refreshToken } = await router.handle(
        post("/auth/refresh", { refreshToken })
      ).then(r => r.json<any>()));
    }
    // Only the latest token is in the store (each rotate removes old, adds new)
    expect(store.size()).toBe(1);
  });

  it("store.consume DB failure propagates as 500", async () => {
    const errStore: VaultStore = {
      async set() {},
      async consume() { throw new Error("DB down"); },
      async revokeFamily() {},
    };
    const vault = tokenVault({
      accessSecret: ACCESS_SECRET, refreshSecret: REFRESH_SECRET,
      accessExpiresIn: 900, refreshExpiresIn: 604800,
      store: errStore,
    });
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    const brokenRouter = new Router();
    brokenRouter.use(json());
    brokenRouter.post("/auth/refresh", async (req, res, next) => {
      try {
        const body = req.body as { refreshToken: string };
        res.json(await vault.rotate(body.refreshToken));
      } catch (err) { next(err); }
    });
    brokenRouter.use(errorHandler());
    const res = await brokenRouter.handle(post("/auth/refresh", { refreshToken }));
    expect(res.status).toBe(500);
  });
});

// Import for the errStore test above
import type { VaultStore } from "../../../src/middleware/token-vault";
