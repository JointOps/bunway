import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { Router, session, MemoryStore, FileStore, json } from "../../../src";
import { rmdir, mkdir } from "fs/promises";

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

describe("Session Middleware", () => {
  const SECRET = "test-secret-key";

  describe("basic session", () => {
    it("creates a new session on first request", async () => {
      const router = new Router();
      router.use(session({ secret: SECRET }));
      router.get("/", (req, res) => {
        const sess = (req as any).session;
        res.json({ sessionId: sess.id });
      });

      const response = await router.handle(buildRequest("/"));
      expect(response.status).toBe(200);

      const cookie = getSessionCookie(response);
      expect(cookie).toBeDefined();
      expect(cookie).toContain("s:");
    });

    it("stores and retrieves session data", async () => {
      const store = new MemoryStore();
      const router = new Router();

      router.use(session({ secret: SECRET, store }));
      router.get("/set", (req, res) => {
        (req as any).session.user = { name: "John" };
        res.json({ ok: true });
      });
      router.get("/get", (req, res) => {
        res.json({ user: (req as any).session.user });
      });

      const setRes = await router.handle(buildRequest("/set"));
      expect(setRes.status).toBe(200);

      const cookie = getSessionCookie(setRes);
      expect(cookie).toBeDefined();

      const getRes = await router.handle(
        buildRequest("/get", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );

      const data = await getRes.json();
      expect(data).toEqual({ user: { name: "John" } });
    });

    it("maintains session across requests", async () => {
      const store = new MemoryStore();
      const router = new Router();

      router.use(session({ secret: SECRET, store }));
      router.get("/inc", (req, res) => {
        const sess = (req as any).session;
        sess.count = (sess.count || 0) + 1;
        res.json({ count: sess.count });
      });

      const res1 = await router.handle(buildRequest("/inc"));
      expect((await res1.json()).count).toBe(1);

      const cookie = getSessionCookie(res1);

      const res2 = await router.handle(
        buildRequest("/inc", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );
      expect((await res2.json()).count).toBe(2);

      const res3 = await router.handle(
        buildRequest("/inc", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );
      expect((await res3.json()).count).toBe(3);
    });
  });

  describe("session.destroy()", () => {
    it("destroys the session", async () => {
      const store = new MemoryStore();
      const router = new Router();

      router.use(session({ secret: SECRET, store }));
      router.get("/set", (req, res) => {
        (req as any).session.user = "test";
        res.json({ ok: true });
      });
      router.get("/destroy", async (req, res) => {
        await (req as any).session.destroy();
        res.json({ destroyed: true });
      });
      router.get("/check", (req, res) => {
        res.json({ user: (req as any).session.user });
      });

      const setRes = await router.handle(buildRequest("/set"));
      const cookie = getSessionCookie(setRes);

      await router.handle(
        buildRequest("/destroy", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );

      expect(store.size).toBe(0);
    });
  });

  describe("flash messages", () => {
    it("sets and retrieves flash messages", async () => {
      const store = new MemoryStore();
      const router = new Router();

      router.use(session({ secret: SECRET, store }));
      router.get("/set-flash", (req, res) => {
        (req as any).session.flash("info", "Hello!");
        res.json({ ok: true });
      });
      router.get("/get-flash", (req, res) => {
        const msg = (req as any).session.flash("info");
        res.json({ message: msg });
      });

      const setRes = await router.handle(buildRequest("/set-flash"));
      const cookie = getSessionCookie(setRes);

      const getRes = await router.handle(
        buildRequest("/get-flash", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );

      expect((await getRes.json()).message).toBe("Hello!");

      const getRes2 = await router.handle(
        buildRequest("/get-flash", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );

      expect((await getRes2.json()).message).toBeUndefined();
    });

    it("handles multiple flash messages", async () => {
      const store = new MemoryStore();
      const router = new Router();

      router.use(session({ secret: SECRET, store }));
      router.get("/set", (req, res) => {
        (req as any).session.flash("error", "Error 1");
        (req as any).session.flash("error", "Error 2");
        res.json({ ok: true });
      });
      router.get("/get", (req, res) => {
        const msgs = (req as any).session.flash("error");
        res.json({ messages: msgs });
      });

      const setRes = await router.handle(buildRequest("/set"));
      const cookie = getSessionCookie(setRes);

      const getRes = await router.handle(
        buildRequest("/get", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );

      expect((await getRes.json()).messages).toEqual(["Error 1", "Error 2"]);
    });
  });

  describe("custom options", () => {
    it("uses custom cookie name", async () => {
      const router = new Router();
      router.use(session({ secret: SECRET, name: "my-session" }));
      router.get("/", (req, res) => res.json({ ok: true }));

      const response = await router.handle(buildRequest("/"));
      const cookie = getSessionCookie(response, "my-session");
      expect(cookie).toBeDefined();
    });

    it("uses custom genid function", async () => {
      const router = new Router();
      router.use(
        session({
          secret: SECRET,
          genid: () => "custom-session-id-12345",
        })
      );
      router.get("/", (req, res) => {
        res.json({ sessionId: (req as any).session.id });
      });

      const response = await router.handle(buildRequest("/"));
      const data = await response.json();
      expect(data.sessionId).toBe("custom-session-id-12345");
    });
  });

  describe("MemoryStore", () => {
    it("stores and retrieves sessions", async () => {
      const store = new MemoryStore();

      await store.set("test-id", { user: "John" });
      const data = await store.get("test-id");
      expect(data).toEqual({ user: "John" });
    });

    it("returns null for non-existent sessions", async () => {
      const store = new MemoryStore();
      const data = await store.get("non-existent");
      expect(data).toBeNull();
    });

    it("destroys sessions", async () => {
      const store = new MemoryStore();

      await store.set("test-id", { user: "John" });
      expect(await store.get("test-id")).not.toBeNull();

      await store.destroy("test-id");
      expect(await store.get("test-id")).toBeNull();
    });

    it("clears all sessions", async () => {
      const store = new MemoryStore();

      await store.set("id1", { a: 1 });
      await store.set("id2", { b: 2 });
      expect(store.size).toBe(2);

      store.clear();
      expect(store.size).toBe(0);
    });
  });

  describe("FileStore", () => {
    const testPath = "./test-sessions";

    beforeEach(async () => {
      await mkdir(testPath, { recursive: true });
    });

    afterEach(async () => {
      await rmdir(testPath, { recursive: true });
    });

    it("stores and retrieves sessions", async () => {
      const store = new FileStore({ path: testPath });

      await store.set("test-id", { user: "John" });
      const data = await store.get("test-id");
      expect(data).toEqual({ user: "John" });
    });

    it("returns null for non-existent sessions", async () => {
      const store = new FileStore({ path: testPath });
      const data = await store.get("non-existent");
      expect(data).toBeNull();
    });

    it("destroys sessions", async () => {
      const store = new FileStore({ path: testPath });

      await store.set("test-id", { user: "John" });
      expect(await store.get("test-id")).not.toBeNull();

      await store.destroy("test-id");
      expect(await store.get("test-id")).toBeNull();
    });

    it("clears all sessions", async () => {
      const store = new FileStore({ path: testPath });

      await store.set("id1", { a: 1 });
      await store.set("id2", { b: 2 });
      expect(await store.length()).toBe(2);

      await store.clear();
      expect(await store.length()).toBe(0);
    });

    it("handles session expiry", async () => {
      const store = new FileStore({ path: testPath, ttl: 100 });

      await store.set("test-id", { user: "John" }, 100);

      // Wait for session to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const data = await store.get("test-id");
      expect(data).toBeNull();
    });

    it("works with session middleware", async () => {
      const store = new FileStore({ path: testPath });
      const router = new Router();

      router.use(session({ secret: SECRET, store }));
      router.get("/set", (req, res) => {
        (req as any).session.user = { name: "FileUser" };
        res.json({ ok: true });
      });
      router.get("/get", (req, res) => {
        res.json({ user: (req as any).session.user });
      });

      const setRes = await router.handle(buildRequest("/set"));
      expect(setRes.status).toBe(200);

      const cookie = getSessionCookie(setRes);
      expect(cookie).toBeDefined();

      const getRes = await router.handle(
        buildRequest("/get", {
          headers: { Cookie: `connect.sid=${cookie}` },
        })
      );

      const data = await getRes.json();
      expect(data).toEqual({ user: { name: "FileUser" } });
    });
  });
});
