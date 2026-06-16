import { describe, expect, it, beforeEach } from "bun:test";
import bunway from "../../src";
import { jwt, jwtSign } from "../../src/middleware/jwt";
import { errorHandler } from "../../src/middleware/error-handler";

const SECRET = "acceptance-jwt-secret-32chars-!!";

const revokedTokens = new Set<string>();

function createApp() {
  const app = bunway();
  app.use(bunway.json());
  // Register JWT before routes so it lands in middlewares (not postMiddlewares).
  // credentialsRequired: false lets public routes (/auth/login) pass without a token.
  app.use(jwt({
    secret: SECRET,
    isRevoked: async (_payload, token) => revokedTokens.has(token),
    credentialsRequired: false,
  }));

  app.post("/auth/login", (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (username === "alice" && password === "pass") {
      const token = jwtSign({ sub: "alice", role: "admin", scope: "read write" }, SECRET, { expiresIn: 3600 });
      return res.json({ token });
    }
    if (username === "bob" && password === "pass") {
      const token = jwtSign({ sub: "bob", role: "user", scope: "read" }, SECRET, { expiresIn: 3600 });
      return res.json({ token });
    }
    res.status(401).json({ error: "Invalid credentials" });
  });

  app.get("/profile", (req, res) => {
    if (!(req as any).user) return res.status(401).json({ error: "Unauthorized" });
    res.json({ sub: (req as any).user.sub });
  });

  app.get("/admin/dashboard",
    jwt({ secret: SECRET, role: "admin" }),
    (req, res) => res.json({ ok: true })
  );

  app.get("/api/orders",
    jwt({ secret: SECRET, scope: ["read", "write"] }),
    (req, res) => res.json({ orders: [] })
  );

  app.post("/auth/logout", (req, res) => {
    const authHeader = req.get("authorization");
    const token = authHeader?.slice(7);
    if (token) revokedTokens.add(token);
    res.json({ ok: true });
  });

  app.use(errorHandler());
  return app;
}

describe("JWT Auth Flow (Acceptance)", () => {
  beforeEach(() => revokedTokens.clear());

  describe("login → access protected route", () => {
    it("full happy path: login, access profile, logout, token rejected", async () => {
      const app = createApp();

      const loginRes = await app.handle(new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "pass" }),
      }));
      expect(loginRes.status).toBe(200);
      const { token } = await loginRes.json<{ token: string }>();

      const profileRes = await app.handle(new Request("http://localhost/profile", {
        headers: { authorization: `Bearer ${token}` },
      }));
      expect(profileRes.status).toBe(200);
      expect((await profileRes.json<any>()).sub).toBe("alice");

      await app.handle(new Request("http://localhost/auth/logout", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }));

      const afterLogout = await app.handle(new Request("http://localhost/profile", {
        headers: { authorization: `Bearer ${token}` },
      }));
      expect(afterLogout.status).toBe(401);
    });

    it("rejects access without token", async () => {
      const app = createApp();
      const res = await app.handle(new Request("http://localhost/profile"));
      expect(res.status).toBe(401);
    });

    it("rejects expired token", async () => {
      const app = createApp();
      const token = jwtSign({ sub: "u", exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
      const res = await app.handle(new Request("http://localhost/profile", {
        headers: { authorization: `Bearer ${token}` },
      }));
      expect(res.status).toBe(401);
    });
  });

  describe("role-gated route", () => {
    it("admin accesses admin dashboard", async () => {
      const app = createApp();
      const loginRes = await app.handle(new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "pass" }),
      }));
      const { token } = await loginRes.json<{ token: string }>();

      const res = await app.handle(new Request("http://localhost/admin/dashboard", {
        headers: { authorization: `Bearer ${token}` },
      }));
      expect(res.status).toBe(200);
    });

    it("non-admin gets 403 on admin dashboard", async () => {
      const app = createApp();
      const loginRes = await app.handle(new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "bob", password: "pass" }),
      }));
      const { token } = await loginRes.json<{ token: string }>();

      const res = await app.handle(new Request("http://localhost/admin/dashboard", {
        headers: { authorization: `Bearer ${token}` },
      }));
      expect(res.status).toBe(403);
    });
  });

  describe("scope-gated route", () => {
    it("user with read+write scope accesses orders", async () => {
      const app = createApp();
      const loginRes = await app.handle(new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "pass" }),
      }));
      const { token } = await loginRes.json<{ token: string }>();
      const res = await app.handle(new Request("http://localhost/api/orders", {
        headers: { authorization: `Bearer ${token}` },
      }));
      expect(res.status).toBe(200);
    });

    it("user with read-only scope gets 403 on write-scoped route", async () => {
      const app = createApp();
      const loginRes = await app.handle(new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "bob", password: "pass" }),
      }));
      const { token } = await loginRes.json<{ token: string }>();
      const res = await app.handle(new Request("http://localhost/api/orders", {
        headers: { authorization: `Bearer ${token}` },
      }));
      expect(res.status).toBe(403);
    });
  });

  describe("invalid credentials", () => {
    it("returns 401 for wrong password", async () => {
      const app = createApp();
      const res = await app.handle(new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "wrong" }),
      }));
      expect(res.status).toBe(401);
    });

    it("returns 401 for unknown user", async () => {
      const app = createApp();
      const res = await app.handle(new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "nobody", password: "pass" }),
      }));
      expect(res.status).toBe(401);
    });
  });
});
