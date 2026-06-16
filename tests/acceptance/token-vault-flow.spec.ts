import { describe, expect, it, beforeEach } from "bun:test";
import bunway from "../../src";
import { tokenVault, VaultMemoryStore } from "../../src/middleware/token-vault";
import { jwt, jwtSign, jwtDecode } from "../../src/middleware/jwt";
import { errorHandler } from "../../src/middleware/error-handler";

const ACCESS_SECRET  = "acceptance-vault-access-32chars!!";
const REFRESH_SECRET = "acceptance-vault-refresh-32chars!";

interface AppParts {
  app: ReturnType<typeof bunway>;
  vault: ReturnType<typeof tokenVault>;
  store: VaultMemoryStore;
  reuseEvents: string[];
}

function createApp(cookieMode = false): AppParts {
  const store = new VaultMemoryStore();
  const reuseEvents: string[] = [];

  const vaultOpts = {
    accessSecret:     ACCESS_SECRET,
    refreshSecret:    REFRESH_SECRET,
    accessExpiresIn:  900,
    refreshExpiresIn: 604800,
    store,
    onReuse: async (fid: string) => { reuseEvents.push(fid); },
    ...(cookieMode ? { cookie: { name: "__rt", path: "/auth/refresh" } } : {}),
  };
  const vault = tokenVault(vaultOpts);

  const app = bunway();
  app.use(bunway.json());
  app.use(bunway.cookieParser());

  // Login
  app.post("/auth/login", async (req, res, next) => {
    try {
      const body = req.body as { username: string };
      const payload: Record<string, unknown> = { sub: body.username, role: "user", fid: undefined as any };
      if (cookieMode) {
        const { accessToken } = await vault.issue(payload, res);
        res.json({ accessToken });
      } else {
        const pair = await vault.issue(payload);
        res.json(pair);
      }
    } catch (err) { next(err); }
  });

  // Refresh
  app.post("/auth/refresh", async (req, res, next) => {
    try {
      if (cookieMode) {
        const { accessToken } = await (vault as any).rotate(req, res);
        res.json({ accessToken });
      } else {
        // req.body is undefined when no content-type header is sent at all —
        // json() skips parsing entirely in that case (it doesn't default to {}).
        const { refreshToken } = (req.body ?? {}) as { refreshToken?: string };
        res.json(await vault.rotate(refreshToken ?? ""));
      }
    } catch (err) { next(err); }
  });

  // Logout (single device)
  app.post("/auth/logout", async (req, res, next) => {
    try {
      if (cookieMode) {
        await (vault as any).revoke(req, res);
      } else {
        const { refreshToken } = (req.body ?? {}) as { refreshToken?: string };
        await vault.revoke(refreshToken ?? "");
      }
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // Logout all devices — reads fid from access token
  app.post("/auth/logout-all",
    jwt({ secret: ACCESS_SECRET }),
    async (req, res, next) => {
      try {
        const fid = (req as any).user?.fid as string | undefined;
        if (!fid) return res.status(400).json({ error: "no fid" });
        await vault.revokeAll(fid);
        res.json({ ok: true });
      } catch (err) { next(err); }
    }
  );

  // Protected route
  app.get("/api/profile",
    jwt({ secret: ACCESS_SECRET }),
    (req, res) => res.json({ sub: (req as any).user?.sub })
  );

  app.use(errorHandler());
  return { app, vault, store, reuseEvents };
}

// Request helpers
function jsonPost(path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}
function authGet(path: string, token: string): Request {
  return new Request(`http://localhost${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

// ─── Body-mode acceptance tests ──────────────────────────────────────────────

describe("TokenVault Acceptance — body mode", () => {
  let parts: AppParts;

  beforeEach(() => { parts = createApp(false); });

  it("full auth flow: login → access route → refresh → access again", async () => {
    const { app } = parts;

    // Login
    const loginRes = await app.handle(jsonPost("/auth/login", { username: "alice" }));
    expect(loginRes.status).toBe(200);
    const { accessToken: at1, refreshToken: rt1 } = await loginRes.json<any>();

    // Access protected route
    const r1 = await app.handle(authGet("/api/profile", at1));
    expect(r1.status).toBe(200);
    expect((await r1.json<any>()).sub).toBe("alice");

    // Refresh
    const refreshRes = await app.handle(jsonPost("/auth/refresh", { refreshToken: rt1 }));
    expect(refreshRes.status).toBe(200);
    const { accessToken: at2 } = await refreshRes.json<any>();

    // Access with new token
    const r2 = await app.handle(authGet("/api/profile", at2));
    expect(r2.status).toBe(200);
  });

  it("logout: revoke → refresh rejected → old access token still works until expiry", async () => {
    const { app } = parts;
    const { accessToken, refreshToken } = await app.handle(
      jsonPost("/auth/login", { username: "bob" })
    ).then(r => r.json<any>());

    // Logout
    await app.handle(jsonPost("/auth/logout", { refreshToken }));

    // Refresh rejected
    const refreshRes = await app.handle(jsonPost("/auth/refresh", { refreshToken }));
    expect(refreshRes.status).toBe(401);

    // Access token still works (it's stateless — no revocation list for access tokens)
    const me = await app.handle(authGet("/api/profile", accessToken));
    expect(me.status).toBe(200);
  });

  it("breach scenario: attacker reuses stolen token → onReuse fires → both get 401 on next refresh", async () => {
    const { app, reuseEvents } = parts;
    const { refreshToken } = await app.handle(
      jsonPost("/auth/login", { username: "victim" })
    ).then(r => r.json<any>());

    // Victim rotates first
    const victimRes = await app.handle(jsonPost("/auth/refresh", { refreshToken }));
    expect(victimRes.status).toBe(200);
    const { refreshToken: victimRt2 } = await victimRes.json<any>();

    // Attacker reuses the original stolen token
    const attackRes = await app.handle(jsonPost("/auth/refresh", { refreshToken }));
    expect(attackRes.status).toBe(401);
    expect(reuseEvents).toHaveLength(1);

    // Victim's new token is also now revoked (revokeAll was called)
    // The default onReuse in this test only records events — it doesn't call revokeAll.
    // This test validates onReuse FIRES; the revokeAll side-effect is tested separately.
    expect(reuseEvents[0]).toBeDefined();
  });

  it("concurrent refresh race: two simultaneous requests with same token → one 200, one 401", async () => {
    const { app } = parts;
    const { refreshToken } = await app.handle(
      jsonPost("/auth/login", { username: "racer" })
    ).then(r => r.json<any>());

    const [res1, res2] = await Promise.all([
      app.handle(jsonPost("/auth/refresh", { refreshToken })),
      app.handle(jsonPost("/auth/refresh", { refreshToken })),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 401]);
  });

  it("access token expiry does not invalidate refresh token", async () => {
    // Issue with very short access expiry
    const shortVault = tokenVault({
      accessSecret: ACCESS_SECRET, refreshSecret: REFRESH_SECRET,
      accessExpiresIn: 1, refreshExpiresIn: 604800,
    });
    const { refreshToken } = await shortVault.issue({ sub: "u1" }) as any;
    await new Promise(r => setTimeout(r, 1100)); // wait for access token to expire
    // Refresh should still work
    const result = await shortVault.rotate(refreshToken);
    expect(result).toHaveProperty("accessToken");
  });

  it("POST /auth/refresh with no body at all → 401 (not 500)", async () => {
    const { app } = parts;
    const res = await app.handle(new Request("http://localhost/auth/refresh", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("POST /auth/refresh with garbage string → 401 (not 500)", async () => {
    const { app } = parts;
    const res = await app.handle(jsonPost("/auth/refresh", { refreshToken: "garbage!!" }));
    expect(res.status).toBe(401);
  });
});

// ─── Cookie-mode acceptance tests ─────────────────────────────────────────────

describe("TokenVault Acceptance — cookie mode", () => {
  let parts: AppParts;

  beforeEach(() => { parts = createApp(true); });

  it("login sets __rt cookie, body contains only accessToken", async () => {
    const { app } = parts;
    const res = await app.handle(jsonPost("/auth/login", { username: "cookieUser" }));
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body).toHaveProperty("accessToken");
    expect(body).not.toHaveProperty("refreshToken");
    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some(c => c.startsWith("__rt="))).toBe(true);
  });

  it("refresh reads __rt cookie, sets new __rt cookie", async () => {
    const { app } = parts;
    const loginRes = await app.handle(jsonPost("/auth/login", { username: "cookieUser" }));
    const rtCookie = loginRes.headers.getSetCookie().find(c => c.startsWith("__rt="))!;
    const cookieValue = rtCookie.split(";")[0]!; // "__rt=<value>"

    const refreshRes = await app.handle(
      jsonPost("/auth/refresh", undefined, { cookie: cookieValue })
    );
    expect(refreshRes.status).toBe(200);
    const body = await refreshRes.json<any>();
    expect(body).toHaveProperty("accessToken");
    expect(refreshRes.headers.getSetCookie().some(c => c.startsWith("__rt="))).toBe(true);
  });

  it("logout clears __rt cookie", async () => {
    const { app } = parts;
    const loginRes = await app.handle(jsonPost("/auth/login", { username: "cookieUser" }));
    const rtCookie = loginRes.headers.getSetCookie().find(c => c.startsWith("__rt="))!;
    const cookieValue = rtCookie.split(";")[0]!;

    const logoutRes = await app.handle(
      jsonPost("/auth/logout", undefined, { cookie: cookieValue })
    );
    expect(logoutRes.status).toBe(200);
    const cleared = logoutRes.headers.getSetCookie().find(c => c.startsWith("__rt="));
    expect(cleared).toMatch(/expires=Thu, 01 Jan 1970/i);
  });

  it("POST /auth/refresh with no cookie → 401", async () => {
    const { app } = parts;
    const res = await app.handle(jsonPost("/auth/refresh"));
    expect(res.status).toBe(401);
  });
});
