import { describe, expect, it } from "bun:test";
import { Router } from "../../../src";
import { jwt, jwtSign } from "../../../src/middleware/jwt";
import { errorHandler } from "../../../src/middleware/error-handler";

const SECRET = "integration-jwt-secret-32chars-!";

function buildRequest(
  path: string,
  headers: Record<string, string> = {}
): Request {
  return new Request(`http://localhost${path}`, { headers });
}

function buildRouter(opts: Parameters<typeof jwt>[0]): Router {
  const router = new Router();
  router.use(jwt(opts));
  router.get("/protected", (req, res) => res.json({ sub: (req as any).user?.sub }));
  router.use(errorHandler());
  return router;
}

describe("JWT Middleware (Integration)", () => {
  it("allows valid HS256 token", async () => {
    const token = jwtSign({ sub: "user-1" }, SECRET);
    const res = await buildRouter({ secret: SECRET }).handle(
      buildRequest("/protected", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sub: "user-1" });
  });

  it("returns 401 when no token", async () => {
    const res = await buildRouter({ secret: SECRET }).handle(buildRequest("/protected"));
    expect(res.status).toBe(401);
  });

  it("WWW-Authenticate header present on 401", async () => {
    const res = await buildRouter({ secret: SECRET }).handle(buildRequest("/protected"));
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("returns 401 for expired token", async () => {
    const token = jwtSign({ sub: "u", exp: Math.floor(Date.now() / 1000) - 100 }, SECRET);
    const res = await buildRouter({ secret: SECRET }).handle(
      buildRequest("/protected", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid signature", async () => {
    const token = jwtSign({ sub: "u" }, "different-secret-32-chars-long!!");
    const res = await buildRouter({ secret: SECRET }).handle(
      buildRequest("/protected", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when role does not match", async () => {
    const token = jwtSign({ sub: "u", role: "user" }, SECRET);
    const res = await buildRouter({ secret: SECRET, role: "admin" }).handle(
      buildRequest("/protected", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 when role matches", async () => {
    const token = jwtSign({ sub: "u", role: "admin" }, SECRET);
    const res = await buildRouter({ secret: SECRET, role: "admin" }).handle(
      buildRequest("/protected", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when required scope missing", async () => {
    const token = jwtSign({ sub: "u", scope: "read" }, SECRET);
    const res = await buildRouter({ secret: SECRET, scope: ["read", "write"] }).handle(
      buildRequest("/protected", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 when all required scopes present", async () => {
    const token = jwtSign({ sub: "u", scope: "read write" }, SECRET);
    const res = await buildRouter({ secret: SECRET, scope: ["read", "write"] }).handle(
      buildRequest("/protected", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(200);
  });

  it("credentialsRequired: false — allows missing token", async () => {
    const router = new Router();
    router.use(jwt({ secret: SECRET, credentialsRequired: false }));
    router.get("/optional", (req, res) => res.json({ authed: !!(req as any).user }));

    const res = await router.handle(buildRequest("/optional"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authed: false });
  });

  it("credentialsRequired: false — still rejects invalid token", async () => {
    const router = new Router();
    router.use(jwt({ secret: SECRET, credentialsRequired: false }));
    router.get("/optional", (req, res) => res.json({ authed: !!(req as any).user }));
    router.use(errorHandler());

    const badToken = jwtSign({ sub: "u" }, "wrong-secret-32-chars-padding!!");
    const res = await router.handle(buildRequest("/optional", { authorization: `Bearer ${badToken}` }));
    expect(res.status).toBe(401);
  });

  it("onVerified transforms req.user before setting it", async () => {
    const token = jwtSign({ sub: "db-id" }, SECRET);
    const router = new Router();
    router.use(jwt({
      secret: SECRET,
      onVerified: async (payload) => ({ id: payload.sub, role: "member" }),
    }));
    router.get("/me", (req, res) => res.json((req as any).user));

    const res = await router.handle(
      buildRequest("/me", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "db-id", role: "member" });
  });

  it("isRevoked returns 401 for revoked token", async () => {
    const token = jwtSign({ sub: "u", jti: "revoked-jti" }, SECRET);
    const router = new Router();
    router.use(jwt({
      secret: SECRET,
      isRevoked: async (payload) => payload.jti === "revoked-jti",
    }));
    router.get("/p", (req, res) => res.json({ ok: true }));
    router.use(errorHandler());

    const res = await router.handle(
      buildRequest("/p", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(401);
  });

  it("issuer mismatch returns 401", async () => {
    const token = jwtSign({ sub: "u" }, SECRET, { issuer: "https://other.io" });
    const res = await buildRouter({ secret: SECRET, issuer: "https://expected.io" }).handle(
      buildRequest("/protected", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(401);
  });

  it("audience mismatch returns 401", async () => {
    const token = jwtSign({ sub: "u" }, SECRET, { audience: "api-b" });
    const res = await buildRouter({ secret: SECRET, audience: "api-a" }).handle(
      buildRequest("/protected", { authorization: `Bearer ${token}` })
    );
    expect(res.status).toBe(401);
  });

  it("route-level jwt guard — only applies to that route", async () => {
    const router = new Router();
    router.get("/public", (req, res) => res.json({ ok: true }));
    router.get(
      "/private",
      jwt({ secret: SECRET }),
      (req, res) => res.json({ sub: (req as any).user?.sub })
    );
    router.use(errorHandler());

    const pubRes = await router.handle(buildRequest("/public"));
    expect(pubRes.status).toBe(200);

    const privUnauthed = await router.handle(buildRequest("/private"));
    expect(privUnauthed.status).toBe(401);

    const token = jwtSign({ sub: "alice" }, SECRET);
    const privAuthed = await router.handle(
      buildRequest("/private", { authorization: `Bearer ${token}` })
    );
    expect(privAuthed.status).toBe(200);
    expect(await privAuthed.json()).toEqual({ sub: "alice" });
  });
});
