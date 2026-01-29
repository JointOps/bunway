import { describe, expect, it } from "bun:test";
import { Router, session, passport, Passport } from "../../../src";
import type { Strategy, AuthenticateOptions } from "../../../src";
import type { BunRequest } from "../../../src";

function buildRequest(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Request {
  return new Request(`http://localhost${path}`, {
    method: options.method || "GET",
    headers: options.headers,
    body: options.body,
  });
}

function getSessionCookie(response: Response, cookieName = "connect.sid"): string | undefined {
  const cookies = response.headers.getSetCookie();
  for (const cookie of cookies) {
    if (cookie.startsWith(`${cookieName}=`)) {
      const value = cookie.split(";")[0].split("=")[1];
      return decodeURIComponent(value);
    }
  }
  return undefined;
}

class LocalStrategy implements Strategy {
  name = "local";
  private users: Map<string, { id: string; username: string; password: string }>;

  constructor(users: Array<{ id: string; username: string; password: string }>) {
    this.users = new Map(users.map((u) => [u.username, u]));
  }

  authenticate(this: any, req: BunRequest, _options?: AuthenticateOptions): void {
    const body = (req as any).body;

    if (!body || !body.username || !body.password) {
      return this.fail("Missing credentials", 400);
    }

    const user = this.users.get(body.username);

    if (!user) {
      return this.fail("Unknown user", 401);
    }

    if (user.password !== body.password) {
      return this.fail("Invalid password", 401);
    }

    this.success({ id: user.id, username: user.username });
  }
}

describe("Passport Middleware", () => {
  const SECRET = "test-secret-key";
  const testUsers = [
    { id: "1", username: "john", password: "secret123" },
    { id: "2", username: "jane", password: "password456" },
  ];

  describe("initialize()", () => {
    it("attaches passport methods to request", async () => {
      const myPassport = new Passport();
      const router = new Router();

      router.use(myPassport.initialize());
      router.get("/test", (req, res) => {
        const request = req as any;
        res.json({
          hasLogin: typeof request.login === "function",
          hasLogout: typeof request.logout === "function",
          hasIsAuthenticated: typeof request.isAuthenticated === "function",
          hasIsUnauthenticated: typeof request.isUnauthenticated === "function",
        });
      });

      const response = await router.handle(buildRequest("/test"));
      const data = await response.json();

      expect(data.hasLogin).toBe(true);
      expect(data.hasLogout).toBe(true);
      expect(data.hasIsAuthenticated).toBe(true);
      expect(data.hasIsUnauthenticated).toBe(true);
    });

    it("isAuthenticated returns false initially", async () => {
      const myPassport = new Passport();
      const router = new Router();

      router.use(myPassport.initialize());
      router.get("/test", (req, res) => {
        res.json({ authenticated: (req as any).isAuthenticated() });
      });

      const response = await router.handle(buildRequest("/test"));
      const data = await response.json();

      expect(data.authenticated).toBe(false);
    });
  });

  describe("authenticate()", () => {
    it("authenticates with valid credentials", async () => {
      const myPassport = new Passport();
      const localStrategy = new LocalStrategy(testUsers);
      myPassport.use(localStrategy);

      const router = new Router();

      router.use(async (req, _res, next) => {
        if (req.get("content-type")?.includes("application/json")) {
          (req as any).body = await req.parseJson();
        }
        next();
      });

      router.use(myPassport.initialize());

      router.post(
        "/login",
        myPassport.authenticate("local", { session: false }),
        (req, res) => {
          res.json({ user: (req as any).user });
        }
      );

      const response = await router.handle(
        buildRequest("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "secret123" }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).toEqual({ id: "1", username: "john" });
    });

    it("fails with invalid credentials", async () => {
      const myPassport = new Passport();
      const localStrategy = new LocalStrategy(testUsers);
      myPassport.use(localStrategy);

      const router = new Router();

      router.use(async (req, _res, next) => {
        if (req.get("content-type")?.includes("application/json")) {
          (req as any).body = await req.parseJson();
        }
        next();
      });

      router.use(myPassport.initialize());

      router.post("/login", myPassport.authenticate("local", { session: false }));

      const response = await router.handle(
        buildRequest("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "wrong" }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("redirects on failure when failureRedirect is set", async () => {
      const myPassport = new Passport();
      const localStrategy = new LocalStrategy(testUsers);
      myPassport.use(localStrategy);

      const router = new Router();

      router.use(async (req, _res, next) => {
        if (req.get("content-type")?.includes("application/json")) {
          (req as any).body = await req.parseJson();
        }
        next();
      });

      router.use(myPassport.initialize());

      router.post(
        "/login",
        myPassport.authenticate("local", { failureRedirect: "/login-failed" })
      );

      const response = await router.handle(
        buildRequest("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "wrong" }),
        })
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login-failed");
    });

    it("redirects on success when successRedirect is set", async () => {
      const myPassport = new Passport();
      const localStrategy = new LocalStrategy(testUsers);
      myPassport.use(localStrategy);

      const router = new Router();

      router.use(async (req, _res, next) => {
        if (req.get("content-type")?.includes("application/json")) {
          (req as any).body = await req.parseJson();
        }
        next();
      });

      router.use(myPassport.initialize());

      router.post(
        "/login",
        myPassport.authenticate("local", { successRedirect: "/dashboard", session: false })
      );

      const response = await router.handle(
        buildRequest("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "secret123" }),
        })
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard");
    });
  });

  describe("session integration", () => {
    it("persists user across requests with session", async () => {
      const myPassport = new Passport();
      const localStrategy = new LocalStrategy(testUsers);
      myPassport.use(localStrategy);

      myPassport.serializeUser((user: any, done) => {
        done(null, user.id);
      });

      myPassport.deserializeUser((id: string, done) => {
        const user = testUsers.find((u) => u.id === id);
        done(null, user ? { id: user.id, username: user.username } : null);
      });

      const router = new Router();

      router.use(async (req, _res, next) => {
        if (req.get("content-type")?.includes("application/json")) {
          (req as any).body = await req.parseJson();
        }
        next();
      });

      router.use(session({ secret: SECRET }));
      router.use(myPassport.initialize());
      router.use(myPassport.session());

      router.post(
        "/login",
        myPassport.authenticate("local"),
        (req, res) => {
          res.json({ user: (req as any).user });
        }
      );

      router.get("/profile", (req, res) => {
        if ((req as any).isAuthenticated()) {
          res.json({ user: (req as any).user });
        } else {
          res.status(401).json({ error: "Not authenticated" });
        }
      });

      // Login
      const loginRes = await router.handle(
        buildRequest("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "secret123" }),
        })
      );

      expect(loginRes.status).toBe(200);
      const cookie = getSessionCookie(loginRes);
      expect(cookie).toBeDefined();

      // Access protected route
      const profileRes = await router.handle(
        buildRequest("/profile", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );

      expect(profileRes.status).toBe(200);
      const profileData = await profileRes.json();
      expect(profileData.user).toEqual({ id: "1", username: "john" });
    });

    it("logout clears session", async () => {
      const myPassport = new Passport();
      const localStrategy = new LocalStrategy(testUsers);
      myPassport.use(localStrategy);

      myPassport.serializeUser((user: any, done) => {
        done(null, user.id);
      });

      myPassport.deserializeUser((id: string, done) => {
        const user = testUsers.find((u) => u.id === id);
        done(null, user ? { id: user.id, username: user.username } : null);
      });

      const router = new Router();

      router.use(async (req, _res, next) => {
        if (req.get("content-type")?.includes("application/json")) {
          (req as any).body = await req.parseJson();
        }
        next();
      });

      router.use(session({ secret: SECRET }));
      router.use(myPassport.initialize());
      router.use(myPassport.session());

      router.post(
        "/login",
        myPassport.authenticate("local"),
        (req, res) => {
          res.json({ user: (req as any).user });
        }
      );

      router.get("/logout", (req, res) => {
        (req as any).logout(() => {
          res.json({ loggedOut: true });
        });
      });

      router.get("/profile", (req, res) => {
        if ((req as any).isAuthenticated()) {
          res.json({ user: (req as any).user });
        } else {
          res.status(401).json({ error: "Not authenticated" });
        }
      });

      // Login
      const loginRes = await router.handle(
        buildRequest("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "secret123" }),
        })
      );

      const cookie = getSessionCookie(loginRes);

      // Logout - need to await properly
      const logoutRes = await router.handle(
        buildRequest("/logout", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );

      expect(logoutRes.status).toBe(200);

      // Try accessing profile after logout
      const profileRes = await router.handle(
        buildRequest("/profile", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );

      expect(profileRes.status).toBe(401);
    });
  });

  describe("strategy management", () => {
    it("allows registering strategies", () => {
      const myPassport = new Passport();
      const strategy = new LocalStrategy(testUsers);

      myPassport.use(strategy);
      myPassport.use("custom", strategy);

      // Should not throw
      expect(true).toBe(true);
    });

    it("allows unregistering strategies", () => {
      const myPassport = new Passport();
      const strategy = new LocalStrategy(testUsers);

      myPassport.use(strategy);
      myPassport.unuse("local");

      // Should not throw
      expect(true).toBe(true);
    });

    it("returns error for unknown strategy", async () => {
      const myPassport = new Passport();
      const router = new Router();

      router.use(myPassport.initialize());
      router.post("/login", myPassport.authenticate("nonexistent"));

      const response = await router.handle(
        buildRequest("/login", { method: "POST" })
      );

      expect(response.status).toBe(500);
    });
  });
});
