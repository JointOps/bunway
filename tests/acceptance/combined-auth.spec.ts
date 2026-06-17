import { describe, expect, it } from "bun:test";
import bunway from "../../src";
import { jwt, jwtSign } from "../../src/middleware/jwt";
import { errorHandler } from "../../src/middleware/error-handler";

const JWT_SECRET = "combined-auth-jwt-secret-32chars";
const CSRF_SECRET = "combined-auth-csrf-secret-32char";

function createApp() {
  const app = bunway();
  app.use(bunway.json());
  app.use(bunway.cookieParser());
  app.use(bunway.csrf({ secret: CSRF_SECRET }));
  // JWT registered before any routes so it lands in middlewares (not postMiddlewares).
  // credentialsRequired: false lets the public /csrf-token GET through without auth.
  app.use(jwt({ secret: JWT_SECRET, credentialsRequired: false }));

  app.get("/csrf-token", (req, res) => res.json({ token: (req as any).csrfToken() }));

  app.post("/api/action", (req, res) => {
    // Route-level auth gate: JWT middleware set req.user only for valid tokens.
    if (!(req as any).user) return res.status(401).json({ error: "Unauthorized" });
    res.json({ done: true, user: (req as any).user?.sub });
  });

  app.use(errorHandler());
  return app;
}

async function getCsrfPair(app: ReturnType<typeof bunway>): Promise<{ rawToken: string; signedToken: string }> {
  const res = await app.handle(new Request("http://localhost/csrf-token"));
  const rawToken = res.headers.getSetCookie()
    .find(c => c.startsWith("_csrf="))!
    .split(";")[0].split("=")[1];
  const { token: signedToken } = await res.json<{ token: string }>();
  return { rawToken, signedToken };
}

describe("Combined JWT + CSRF Auth (Acceptance)", () => {
  it("valid JWT + valid CSRF → 200", async () => {
    const app = createApp();
    const { rawToken, signedToken } = await getCsrfPair(app);
    const jwtToken = jwtSign({ sub: "alice" }, JWT_SECRET, { expiresIn: 3600 });

    const res = await app.handle(new Request("http://localhost/api/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `_csrf=${rawToken}`,
        "x-csrf-token": signedToken,
        authorization: `Bearer ${jwtToken}`,
      },
      body: "{}",
    }));
    expect(res.status).toBe(200);
    expect((await res.json<any>()).done).toBe(true);
  });

  it("valid JWT + missing CSRF → 403 (CSRF runs first)", async () => {
    const app = createApp();
    const { rawToken } = await getCsrfPair(app);
    const jwtToken = jwtSign({ sub: "alice" }, JWT_SECRET, { expiresIn: 3600 });

    const res = await app.handle(new Request("http://localhost/api/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `_csrf=${rawToken}`,
        authorization: `Bearer ${jwtToken}`,
      },
      body: "{}",
    }));
    expect(res.status).toBe(403);
  });

  it("missing JWT + valid CSRF → 401 (JWT check fails)", async () => {
    const app = createApp();
    const { rawToken, signedToken } = await getCsrfPair(app);

    const res = await app.handle(new Request("http://localhost/api/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `_csrf=${rawToken}`,
        "x-csrf-token": signedToken,
      },
      body: "{}",
    }));
    expect(res.status).toBe(401);
  });

  it("GET /csrf-token does not require JWT or CSRF", async () => {
    const app = createApp();
    const res = await app.handle(new Request("http://localhost/csrf-token"));
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(typeof body.token).toBe("string");
    expect(body.token).toContain(".");
  });

  it("CSRF cookie is set on first GET and reused correctly", async () => {
    const app = createApp();
    const { rawToken, signedToken } = await getCsrfPair(app);

    // Second GET with cookie — should NOT re-issue cookie
    const res2 = await app.handle(new Request("http://localhost/csrf-token", {
      headers: { Cookie: `_csrf=${rawToken}` },
    }));
    expect(res2.headers.getSetCookie().find(c => c.startsWith("_csrf="))).toBeUndefined();

    // Token from second request is valid for POST
    const { token: signedToken2 } = await res2.json<{ token: string }>();
    const jwtToken = jwtSign({ sub: "bob" }, JWT_SECRET, { expiresIn: 3600 });

    const postRes = await app.handle(new Request("http://localhost/api/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `_csrf=${rawToken}`,
        "x-csrf-token": signedToken2,
        authorization: `Bearer ${jwtToken}`,
      },
      body: "{}",
    }));
    expect(postRes.status).toBe(200);

    // Also confirm original signed token is equivalent
    const postRes2 = await app.handle(new Request("http://localhost/api/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `_csrf=${rawToken}`,
        "x-csrf-token": signedToken,
        authorization: `Bearer ${jwtToken}`,
      },
      body: "{}",
    }));
    expect(postRes2.status).toBe(200);
  });
});
