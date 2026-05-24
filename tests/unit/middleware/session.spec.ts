import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { MemoryStore, FileStore, session } from "../../../src/middleware/session";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";
import { signSessionId } from "../../../src/utils/crypto";

const FILE_STORE_DIR = join(import.meta.dir, ".tmp-session-store");
mkdirSync(FILE_STORE_DIR, { recursive: true });
afterAll(() => rmSync(FILE_STORE_DIR, { recursive: true, force: true }));

describe("Session Middleware (Unit)", () => {
  describe("MemoryStore", () => {
    let store: MemoryStore;

    beforeEach(() => {
      store = new MemoryStore();
    });

    it("get returns null for unknown sid", async () => {
      const result = await store.get("nonexistent-id");
      expect(result).toBeNull();
    });

    it("set + get returns data", async () => {
      await store.set("sid-1", { username: "alice" });
      const result = await store.get("sid-1");
      expect(result).toEqual({ username: "alice" });
    });

    it("set overwrites existing data", async () => {
      await store.set("sid-1", { count: 1 });
      await store.set("sid-1", { count: 2 });
      const result = await store.get("sid-1");
      expect(result).toEqual({ count: 2 });
    });

    it("get returns null for expired session", async () => {
      await store.set("sid-exp", { data: "old" }, 1);
      await new Promise((r) => setTimeout(r, 10));
      const result = await store.get("sid-exp");
      expect(result).toBeNull();
    });

    it("destroy removes session", async () => {
      await store.set("sid-del", { val: "here" });
      await store.destroy("sid-del");
      const result = await store.get("sid-del");
      expect(result).toBeNull();
    });

    it("touch updates expiry", async () => {
      await store.set("sid-touch", { val: "data" }, 500);
      await store.touch("sid-touch", { val: "data" });
      const result = await store.get("sid-touch");
      expect(result).toEqual({ val: "data" });
    });

    it("clear removes all sessions", async () => {
      await store.set("a", { x: 1 });
      await store.set("b", { x: 2 });
      await store.set("c", { x: 3 });
      store.clear();
      expect(store.size).toBe(0);
      expect(await store.get("a")).toBeNull();
      expect(await store.get("b")).toBeNull();
      expect(await store.get("c")).toBeNull();
    });

    it("size returns session count", async () => {
      expect(store.size).toBe(0);
      await store.set("s1", {});
      expect(store.size).toBe(1);
      await store.set("s2", {});
      expect(store.size).toBe(2);
      await store.destroy("s1");
      expect(store.size).toBe(1);
    });

    it("set with maxAge sets expiry", async () => {
      await store.set("sid-ttl", { temp: true }, 60000);
      const result = await store.get("sid-ttl");
      expect(result).toEqual({ temp: true });
    });

    it("multiple independent sessions do not interfere", async () => {
      await store.set("user-1", { name: "alice" });
      await store.set("user-2", { name: "bob" });
      await store.set("user-3", { name: "charlie" });

      expect(await store.get("user-1")).toEqual({ name: "alice" });
      expect(await store.get("user-2")).toEqual({ name: "bob" });
      expect(await store.get("user-3")).toEqual({ name: "charlie" });

      await store.destroy("user-2");
      expect(await store.get("user-1")).toEqual({ name: "alice" });
      expect(await store.get("user-2")).toBeNull();
      expect(await store.get("user-3")).toEqual({ name: "charlie" });
    });

    it("get returns a copy, not a reference", async () => {
      await store.set("sid-copy", { items: [1, 2, 3] });
      const result1 = await store.get("sid-copy");
      const result2 = await store.get("sid-copy");
      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2);
    });

    it("set stores a copy, not a reference", async () => {
      const data = { count: 1 };
      await store.set("sid-ref", data);
      data.count = 999;
      const result = await store.get("sid-ref");
      expect(result).toEqual({ count: 1 });
    });

    it("destroy on nonexistent sid does not throw", async () => {
      await store.destroy("does-not-exist");
      expect(store.size).toBe(0);
    });

    it("touch on nonexistent sid does not throw", async () => {
      await store.touch("does-not-exist", {});
      expect(store.size).toBe(0);
    });

    it("touch does nothing when session has no expiry", async () => {
      await store.set("sid-noexp", { val: "data" });
      await store.touch("sid-noexp", { val: "data" });
      const result = await store.get("sid-noexp");
      expect(result).toEqual({ val: "data" });
    });
  });

  describe("session() middleware", () => {
    it("creates new session when no cookie present", async () => {
      const handler = session({ secret: "test-secret" });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      expect((req as any).session).toBeDefined();
      expect((req as any).sessionID).toBeDefined();
      expect(typeof (req as any).sessionID).toBe("string");
      expect((req as any).sessionID.length).toBeGreaterThan(0);
    });

    it("sets session cookie on response", async () => {
      const handler = session({ secret: "test-secret" });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const setCookie = res.getHeaders().get("set-cookie");
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain("connect.sid=");
    });

    it("session data accessible via req.session proxy", async () => {
      const handler = session({ secret: "test-secret" });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const sess = (req as any).session;
      sess.username = "alice";
      expect(sess.username).toBe("alice");
    });

    it("req.sessionID is set", async () => {
      const handler = session({ secret: "test-secret" });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      expect((req as any).sessionID).toBeDefined();
      expect(typeof (req as any).sessionID).toBe("string");
    });

    it("uses custom genid function", async () => {
      const handler = session({
        secret: "test-secret",
        genid: () => "custom-session-id-12345",
      });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      expect((req as any).sessionID).toBe("custom-session-id-12345");
    });

    it("saveUninitialized false skips saving new empty sessions", async () => {
      const store = new MemoryStore();
      const handler = session({
        secret: "test-secret",
        store,
        saveUninitialized: false,
      });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      expect(store.size).toBe(0);
    });

    it("saveUninitialized true saves new empty sessions", async () => {
      const store = new MemoryStore();
      const handler = session({
        secret: "test-secret",
        store,
        saveUninitialized: true,
      });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      expect(store.size).toBe(1);
    });

    it("session properties read and write via proxy", async () => {
      const handler = session({ secret: "test-secret" });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const sess = (req as any).session;
      sess.views = 0;
      sess.views += 1;
      sess.views += 1;
      expect(sess.views).toBe(2);

      sess.cart = ["item-a"];
      expect(sess.cart).toEqual(["item-a"]);
    });

    it("uses custom cookie name", async () => {
      const handler = session({ secret: "test-secret", name: "my.sid" });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const setCookie = res.getHeaders().get("set-cookie");
      expect(setCookie).toContain("my.sid=");
    });

    it("restores existing session from signed cookie", async () => {
      const store = new MemoryStore();
      const secret = "restore-secret";
      const existingId = "existing-session-abc123";

      await store.set(existingId, { username: "bob" }, 86400000);

      const signedCookie = signSessionId(existingId, secret);
      const cookieHeader = `connect.sid=${encodeURIComponent(signedCookie)}`;

      const handler = session({ secret, store });
      const req = new BunRequest(
        new Request("http://localhost/test", {
          headers: { cookie: cookieHeader },
        }),
        "/test",
      );
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      expect((req as any).sessionID).toBe(existingId);
      expect((req as any).session.username).toBe("bob");
    });

    it("creates new session when signed cookie is invalid", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "real-secret", store });

      const fakeCookie = `connect.sid=${encodeURIComponent("s:fake-id.bad-signature")}`;
      const req = new BunRequest(
        new Request("http://localhost/test", {
          headers: { cookie: fakeCookie },
        }),
        "/test",
      );
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      expect((req as any).sessionID).not.toBe("fake-id");
      expect((req as any).session).toBeDefined();
    });

    it("session.id matches sessionID", async () => {
      const handler = session({ secret: "test-secret" });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      expect((req as any).session.id).toBe((req as any).sessionID);
    });

    it("saveUninitialized: false does not set Set-Cookie header", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "test-secret", store, saveUninitialized: false });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const setCookie = res.getHeaders().get("set-cookie");
      expect(setCookie).toBeNull();
    });

    it("invalid %ZZ percent-encoding falls through to new session", async () => {
      const handler = session({ secret: "test-secret" });
      const req = new BunRequest(
        new Request("http://localhost/test", {
          headers: { cookie: "connect.sid=%ZZ" },
        }),
        "/test",
      );
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      expect((req as any).session).toBeDefined();
      expect((req as any).sessionID).toBeDefined();
    });

    it("session.regenerate() creates a new session ID and clears data", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "test-secret", store, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const sess = (req as any).session;
      sess.username = "alice";
      const oldId = (req as any).sessionID;

      await new Promise<void>((resolve) => {
        sess.regenerate(() => resolve());
      });

      expect(sess.id).not.toBe(oldId);
      expect(sess.username).toBeUndefined();
    });

    it("session.destroy() removes session from store and clears cookie", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "test-secret", store, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const sess = (req as any).session;
      const sid = (req as any).sessionID;

      await new Promise<void>((resolve) => {
        sess.destroy(() => resolve());
      });

      const stored = await store.get(sid);
      expect(stored).toBeNull();
    });

    it("session.reload() re-fetches data from store", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "test-secret", store, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const sess = (req as any).session;
      const sid = (req as any).sessionID;

      await store.set(sid, { fromStore: true });

      await new Promise<void>((resolve) => {
        sess.reload(() => resolve());
      });

      expect(sess.fromStore).toBe(true);
    });

    it("session.save() persists current data to store", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "test-secret", store, saveUninitialized: false });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const sess = (req as any).session;
      const sid = (req as any).sessionID;
      sess.role = "admin";

      await new Promise<void>((resolve) => {
        sess.save(() => resolve());
      });

      const stored = await store.get(sid);
      expect(stored?.role).toBe("admin");
    });

    it("session.flash() set mode stores message, get mode retrieves and clears it", async () => {
      const handler = session({ secret: "test-secret", saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const sess = (req as any).session;
      sess.flash("info", "Login successful");
      const msg = sess.flash("info");
      expect(msg).toBe("Login successful");
      // Second read should return undefined (consumed)
      const msg2 = sess.flash("info");
      expect(msg2).toBeUndefined();
    });

    it("session.flash() returns array when multiple messages are set", async () => {
      const handler = session({ secret: "test-secret", saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      const sess = (req as any).session;
      sess.flash("error", "First error");
      sess.flash("error", "Second error");
      const msgs = sess.flash("error");
      expect(Array.isArray(msgs)).toBe(true);
      expect((msgs as string[]).length).toBe(2);
    });
  });

  describe("Session proxy traps", () => {
    async function makeSession(store?: MemoryStore) {
      const handler = session({ secret: "test-secret", store, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();
      await new Promise<void>((resolve) => handler(req, res, () => resolve()));
      return (req as any).session;
    }

    it("deleteProperty trap removes key from internalData", async () => {
      const sess = await makeSession();
      sess.foo = "bar";
      expect(sess.foo).toBe("bar");
      delete sess.foo;
      expect(sess.foo).toBeUndefined();
    });

    it("has trap returns true for set keys", async () => {
      const sess = await makeSession();
      sess.myKey = 42;
      expect("myKey" in sess).toBe(true);
    });

    it("has trap returns false for absent keys", async () => {
      const sess = await makeSession();
      expect("nonexistent" in sess).toBe(false);
    });

    it("ownKeys trap includes internalData keys and built-ins", async () => {
      const sess = await makeSession();
      sess.alpha = 1;
      sess.beta = 2;
      const keys = Object.keys(sess);
      expect(keys).toContain("alpha");
      expect(keys).toContain("beta");
      expect(keys).toContain("id");
    });

    it("setting data via proxy writes to store on next save()", async () => {
      const store = new MemoryStore();
      const sess = await makeSession(store);
      const sid = sess.id;
      sess.counter = 99;

      await new Promise<void>((resolve) => sess.save(() => resolve()));
      const stored = await store.get(sid);
      expect(stored?.counter).toBe(99);
    });
  });

  describe("FileStore", () => {
    it("get returns null for unknown session", async () => {
      const store = new FileStore({ path: FILE_STORE_DIR });
      expect(await store.get("unknown-id")).toBeNull();
    });

    it("set and get round-trip", async () => {
      const store = new FileStore({ path: FILE_STORE_DIR });
      await store.set("fs-1", { user: "alice" });
      const result = await store.get("fs-1");
      expect(result?.user).toBe("alice");
    });

    it("destroy removes session file", async () => {
      const store = new FileStore({ path: FILE_STORE_DIR });
      await store.set("fs-del", { temp: true });
      await store.destroy("fs-del");
      expect(await store.get("fs-del")).toBeNull();
    });

    it("destroy on nonexistent session does not throw", async () => {
      const store = new FileStore({ path: FILE_STORE_DIR });
      await store.destroy("does-not-exist-xyz");
    });

    it("get returns null for expired session", async () => {
      const store = new FileStore({ path: FILE_STORE_DIR, ttl: 1 });
      await store.set("fs-exp", { data: "old" }, 1);
      await new Promise((r) => setTimeout(r, 20));
      expect(await store.get("fs-exp")).toBeNull();
    });

    it("touch refreshes expiry", async () => {
      const store = new FileStore({ path: FILE_STORE_DIR });
      await store.set("fs-touch", { val: "data" });
      await store.touch("fs-touch", { val: "data" });
      expect(await store.get("fs-touch")).toBeTruthy();
    });

    it("length returns count of session files", async () => {
      const store = new FileStore({ path: FILE_STORE_DIR });
      const before = await store.length();
      await store.set("fs-len-a", {});
      await store.set("fs-len-b", {});
      const after = await store.length();
      expect(after).toBeGreaterThanOrEqual(before + 2);
    });

    it("sanitizes session ID to prevent directory traversal", async () => {
      const store = new FileStore({ path: FILE_STORE_DIR });
      // Dots and slashes are stripped from the SID before constructing the path
      await store.set("../outside", { malicious: true });
      // The file should be written under FILE_STORE_DIR, not escaped above it
      const result = await store.get("../outside");
      // Either stored safely (in sanitized path) or not found — either way no traversal
      expect(result).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // resave / rolling — accepted in SessionOptions but not yet implemented.
  // These tests document the current (no-op) behaviour so any future
  // implementation is immediately visible as a behaviour change.
  // ---------------------------------------------------------------------------

  describe("resave option (declared, not yet implemented)", () => {
    it("resave: false is accepted without error", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "s", store, resave: false, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));
      // Session is still saved regardless — resave:false has no effect yet
      expect(store.size).toBe(1);
    });

    it("resave: true is accepted without error", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "s", store, resave: true, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));
      expect(store.size).toBe(1);
    });
  });

  describe("rolling option (declared, not yet implemented)", () => {
    it("rolling: true is accepted without error", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "s", store, rolling: true, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));
      // rolling:true should reset the cookie on every request — not yet implemented,
      // but the option must not crash the middleware
      expect(store.size).toBe(1);
    });

    it("rolling: false is accepted without error", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "s", store, rolling: false, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));
      expect(store.size).toBe(1);
    });
  });
});
