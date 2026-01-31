/**
 * Authentication Flow Acceptance Tests
 *
 * End-to-end tests for complete authentication scenarios.
 * Tests full user journeys through login, protected routes, and logout.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import bunway, { Router } from "../../src";
import type { BunRequest, BunResponse, NextFunction } from "../../src";

// Simple in-memory session store for testing
const sessions = new Map<string, { userId: string; username: string }>();
const users = new Map([
  ["user1", { id: "user1", username: "john", password: "secret123" }],
  ["user2", { id: "user2", username: "jane", password: "password456" }],
]);

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function createAuthApp() {
  const app = bunway();

  // Auth middleware - checks for valid session
  const requireAuth = (req: BunRequest, res: BunResponse, next: NextFunction) => {
    const authHeader = req.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    }

    const token = authHeader.substring(7);
    const session = sessions.get(token);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    }

    req.locals.user = session;
    next();
  };

  // Public routes
  app.post("/auth/login", async (req: BunRequest, res: BunResponse) => {
    const { username, password } = req.body as { username: string; password: string };

    if (!username || !password) {
      return res.status(400).json({ error: "Bad Request", message: "Username and password required" });
    }

    // Find user
    let foundUser = null;
    for (const user of users.values()) {
      if (user.username === username && user.password === password) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    }

    // Create session
    const token = generateToken();
    sessions.set(token, { userId: foundUser.id, username: foundUser.username });

    res.status(200).json({
      message: "Login successful",
      token,
      user: { id: foundUser.id, username: foundUser.username },
    });
  });

  app.post("/auth/register", async (req: BunRequest, res: BunResponse) => {
    const { username, password } = req.body as { username: string; password: string };

    if (!username || !password) {
      return res.status(400).json({ error: "Bad Request", message: "Username and password required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Bad Request", message: "Password must be at least 6 characters" });
    }

    // Check if username exists
    for (const user of users.values()) {
      if (user.username === username) {
        return res.status(409).json({ error: "Conflict", message: "Username already exists" });
      }
    }

    const id = `user${users.size + 1}`;
    users.set(id, { id, username, password });

    res.status(201).json({
      message: "Registration successful",
      user: { id, username },
    });
  });

  // Protected routes
  app.get("/profile", requireAuth, (req: BunRequest, res: BunResponse) => {
    const user = req.locals.user as { userId: string; username: string };
    res.json({
      id: user.userId,
      username: user.username,
    });
  });

  app.post("/auth/logout", requireAuth, (req: BunRequest, res: BunResponse) => {
    const authHeader = req.get("Authorization");
    const token = authHeader!.substring(7);
    sessions.delete(token);
    res.json({ message: "Logout successful" });
  });

  app.put("/profile", requireAuth, async (req: BunRequest, res: BunResponse) => {
    const user = req.locals.user as { userId: string; username: string };
    const { username } = req.body as { username?: string };

    if (username) {
      // Check if new username is taken
      for (const u of users.values()) {
        if (u.username === username && u.id !== user.userId) {
          return res.status(409).json({ error: "Conflict", message: "Username already taken" });
        }
      }

      const existingUser = users.get(user.userId);
      if (existingUser) {
        existingUser.username = username;
        // Update session
        const authHeader = req.get("Authorization");
        const token = authHeader!.substring(7);
        sessions.set(token, { ...user, username });
      }
    }

    res.json({ message: "Profile updated", username: username || user.username });
  });

  // Admin protected route
  const adminRouter = new Router();
  // Add auth middleware to the router itself since bunway doesn't apply parent middleware to mounted routers
  adminRouter.use(requireAuth);
  adminRouter.get("/stats", (req: BunRequest, res: BunResponse) => {
    res.json({ totalUsers: users.size, activeSessions: sessions.size });
  });

  app.use("/admin", adminRouter);

  return app;
}

describe("Authentication Flow (Acceptance)", () => {
  beforeEach(() => {
    // Reset sessions before each test
    sessions.clear();
    // Reset users to initial state
    users.clear();
    users.set("user1", { id: "user1", username: "john", password: "secret123" });
    users.set("user2", { id: "user2", username: "jane", password: "password456" });
  });

  describe("Complete Login Flow", () => {
    it("should complete full login and access protected resource", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      // Step 1: Try to access protected route without auth
      const unauthorizedRes = await app.handle(
        new Request("http://localhost/profile")
      );
      expect(unauthorizedRes.status).toBe(401);

      // Step 2: Login with valid credentials
      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "secret123" }),
        })
      );
      expect(loginRes.status).toBe(200);
      const loginBody = await loginRes.json();
      expect(loginBody.token).toBeDefined();
      expect(loginBody.user.username).toBe("john");

      // Step 3: Access protected route with token
      const profileRes = await app.handle(
        new Request("http://localhost/profile", {
          headers: { Authorization: `Bearer ${loginBody.token}` },
        })
      );
      expect(profileRes.status).toBe(200);
      const profileBody = await profileRes.json();
      expect(profileBody.username).toBe("john");
    });

    it("should reject login with invalid credentials", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      // Wrong password
      const wrongPassRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "wrongpassword" }),
        })
      );
      expect(wrongPassRes.status).toBe(401);
      const wrongPassBody = await wrongPassRes.json();
      expect(wrongPassBody.message).toContain("Invalid credentials");

      // Non-existent user
      const noUserRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "nobody", password: "secret123" }),
        })
      );
      expect(noUserRes.status).toBe(401);
    });

    it("should reject login with missing fields", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      // Missing password
      const missingPassRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john" }),
        })
      );
      expect(missingPassRes.status).toBe(400);

      // Missing username
      const missingUserRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "secret123" }),
        })
      );
      expect(missingUserRes.status).toBe(400);
    });
  });

  describe("Registration Flow", () => {
    it("should register a new user and allow login", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      // Step 1: Register new user
      const registerRes = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "newuser", password: "newpass123" }),
        })
      );
      expect(registerRes.status).toBe(201);
      const registerBody = await registerRes.json();
      expect(registerBody.user.username).toBe("newuser");

      // Step 2: Login with new user
      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "newuser", password: "newpass123" }),
        })
      );
      expect(loginRes.status).toBe(200);
      const loginBody = await loginRes.json();
      expect(loginBody.token).toBeDefined();
    });

    it("should reject registration with existing username", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      const registerRes = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "newpass123" }),
        })
      );
      expect(registerRes.status).toBe(409);
      const body = await registerRes.json();
      expect(body.message).toContain("Username already exists");
    });

    it("should reject registration with weak password", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      const registerRes = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "newuser", password: "123" }),
        })
      );
      expect(registerRes.status).toBe(400);
      const body = await registerRes.json();
      expect(body.message).toContain("at least 6 characters");
    });
  });

  describe("Protected Routes", () => {
    it("should reject unauthenticated access to protected routes", async () => {
      const app = createAuthApp();

      // No Authorization header
      const noHeaderRes = await app.handle(
        new Request("http://localhost/profile")
      );
      expect(noHeaderRes.status).toBe(401);

      // Invalid token format
      const badFormatRes = await app.handle(
        new Request("http://localhost/profile", {
          headers: { Authorization: "InvalidFormat" },
        })
      );
      expect(badFormatRes.status).toBe(401);

      // Invalid token
      const invalidTokenRes = await app.handle(
        new Request("http://localhost/profile", {
          headers: { Authorization: "Bearer invalidtoken123" },
        })
      );
      expect(invalidTokenRes.status).toBe(401);
    });

    it("should allow access to nested protected routes", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      // Login first
      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "secret123" }),
        })
      );
      const { token } = await loginRes.json();

      // Access admin stats
      const adminRes = await app.handle(
        new Request("http://localhost/admin/stats", {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      expect(adminRes.status).toBe(200);
      const stats = await adminRes.json();
      expect(stats.totalUsers).toBeDefined();
      expect(stats.activeSessions).toBeDefined();
    });
  });

  describe("Logout Flow", () => {
    it("should logout and invalidate session", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      // Step 1: Login
      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "secret123" }),
        })
      );
      const { token } = await loginRes.json();

      // Step 2: Verify token works
      const profileRes = await app.handle(
        new Request("http://localhost/profile", {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      expect(profileRes.status).toBe(200);

      // Step 3: Logout
      const logoutRes = await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      expect(logoutRes.status).toBe(200);

      // Step 4: Verify token no longer works
      const afterLogoutRes = await app.handle(
        new Request("http://localhost/profile", {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      expect(afterLogoutRes.status).toBe(401);
    });
  });

  describe("Profile Update Flow", () => {
    it("should update user profile", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      // Login
      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "secret123" }),
        })
      );
      const { token } = await loginRes.json();

      // Update username
      const updateRes = await app.handle(
        new Request("http://localhost/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ username: "johnny" }),
        })
      );
      expect(updateRes.status).toBe(200);
      const updateBody = await updateRes.json();
      expect(updateBody.username).toBe("johnny");

      // Verify update persists
      const profileRes = await app.handle(
        new Request("http://localhost/profile", {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      const profile = await profileRes.json();
      expect(profile.username).toBe("johnny");
    });

    it("should reject profile update with taken username", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      // Login as john
      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "secret123" }),
        })
      );
      const { token } = await loginRes.json();

      // Try to change username to jane (already exists)
      const updateRes = await app.handle(
        new Request("http://localhost/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ username: "jane" }),
        })
      );
      expect(updateRes.status).toBe(409);
    });
  });

  describe("Multi-User Session Isolation", () => {
    it("should maintain separate sessions for different users", async () => {
      const app = createAuthApp();
      app.use(bunway.json());

      // Login as john
      const johnLoginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "john", password: "secret123" }),
        })
      );
      const johnToken = (await johnLoginRes.json()).token;

      // Login as jane
      const janeLoginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "jane", password: "password456" }),
        })
      );
      const janeToken = (await janeLoginRes.json()).token;

      // Verify john's session
      const johnProfile = await app.handle(
        new Request("http://localhost/profile", {
          headers: { Authorization: `Bearer ${johnToken}` },
        })
      );
      expect((await johnProfile.json()).username).toBe("john");

      // Verify jane's session
      const janeProfile = await app.handle(
        new Request("http://localhost/profile", {
          headers: { Authorization: `Bearer ${janeToken}` },
        })
      );
      expect((await janeProfile.json()).username).toBe("jane");

      // Logout john
      await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${johnToken}` },
        })
      );

      // Verify john is logged out but jane still works
      const johnAfterLogout = await app.handle(
        new Request("http://localhost/profile", {
          headers: { Authorization: `Bearer ${johnToken}` },
        })
      );
      expect(johnAfterLogout.status).toBe(401);

      const janeStillValid = await app.handle(
        new Request("http://localhost/profile", {
          headers: { Authorization: `Bearer ${janeToken}` },
        })
      );
      expect(janeStillValid.status).toBe(200);
    });
  });
});
