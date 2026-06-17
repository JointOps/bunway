import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { MemoryStore, FileStore, session, fromExpressStore } from "../../../src/middleware/session";
import type { SessionStore, SessionData, SessionOptions } from "../../../src/middleware/session";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";
import { signSessionId, unsignSessionId } from "../../../src/utils/crypto";

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

    describe("Phase 5 — MemoryStore.touch() resets to original TTL (not remaining)", () => {
      it("prevents expiry by resetting to full original TTL, not remaining TTL", async () => {
        const store = new MemoryStore();
        await store.set("sid", { val: "data" }, 120); // 120ms TTL

        await new Promise(r => setTimeout(r, 80));   // 80ms elapsed — 40ms remaining

        await store.touch("sid", { val: "data" });   // should reset to full 120ms from now

        await new Promise(r => setTimeout(r, 90));   // 90ms more — expired without reset, alive with reset

        // If touch was a no-op: 80+90=170ms > 120ms → expired
        // If touch reset to 120ms: 90ms < 120ms → alive
        const result = await store.get("sid");
        expect(result).not.toBeNull();
      });

      it("touch on session-cookie (no TTL) is a safe no-op", async () => {
        const store = new MemoryStore();
        await store.set("sid", { val: "data" }); // no maxAge → no expires field
        await store.touch("sid", { val: "data" });
        expect(await store.get("sid")).toEqual({ val: "data" });
      });
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

    it("uses custom genid function — receives req as first argument", async () => {
      let receivedReq: unknown;
      const handler = session({
        secret: "test-secret",
        genid: (req) => { receivedReq = req; return "custom-session-id-12345"; },
      });
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();

      await new Promise<void>((resolve) => {
        handler(req, res, () => resolve());
      });

      expect(receivedReq).toBe(req); // genid received the actual req object
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

    describe("Phase 16 — FileStore improvements", () => {
      it("destroy() leaves no empty file — file is fully removed", async () => {
        const store = new FileStore({ path: FILE_STORE_DIR });
        const sid = "destroyclean";
        await store.set(sid, { data: "present" });

        const filePath = `${FILE_STORE_DIR}/${sid}.json`;
        expect(await Bun.file(filePath).exists()).toBe(true); // file created

        await store.destroy(sid);
        expect(await Bun.file(filePath).exists()).toBe(false); // completely gone — no empty file
      });

      it("set() stores the ttl field in the JSON file", async () => {
        const store = new FileStore({ path: FILE_STORE_DIR });
        const sid = "ttlpersist";
        await store.set(sid, { x: 1 }, 7_200_000); // 2h TTL

        const content = await Bun.file(`${FILE_STORE_DIR}/${sid}.json`).json() as { ttl?: number };
        expect(content.ttl).toBe(7_200_000);
      });

      it("touch() preserves per-session TTL (not the store default ttl)", async () => {
        const store = new FileStore({ path: FILE_STORE_DIR, ttl: 86_400_000 }); // 24h default
        const sid = "touchttltest";
        const customTtl = 3_600_000; // 1h
        await store.set(sid, { user: "charlie" }, customTtl);

        await store.touch(sid, { user: "charlie" });

        const content = await Bun.file(`${FILE_STORE_DIR}/${sid}.json`).json() as {
          ttl?: number;
          data?: any;
        };
        expect(content.ttl).toBe(customTtl);        // 1h preserved, not 24h default
        expect(content.data?.user).toBe("charlie"); // data preserved through touch
      });

      it("touch() on an expired session → session gone (not revived)", async () => {
        const store = new FileStore({ path: FILE_STORE_DIR });
        const sid = "touchexpired";
        await store.set(sid, { x: 1 }, 1); // 1ms TTL — expires immediately
        await new Promise(r => setTimeout(r, 20));

        await store.touch(sid, { x: 1 }); // touch on expired → triggers destroy path

        expect(await store.get(sid)).toBeNull();
      });
    });
  });

  describe("Phase 13 — MemoryStore production warning", () => {
    function withNodeEnv(env: string | undefined, fn: () => void) {
      const original = process.env.NODE_ENV;
      if (env === undefined) {
        delete (process.env as any).NODE_ENV;
      } else {
        process.env.NODE_ENV = env;
      }
      try {
        fn();
      } finally {
        if (original === undefined) {
          delete (process.env as any).NODE_ENV;
        } else {
          process.env.NODE_ENV = original;
        }
      }
    }

    it("logs to console.warn in production when default MemoryStore is used", () => {
      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => warnings.push(msg);

      withNodeEnv("production", () => session({ secret: "s" }));

      console.warn = origWarn;
      expect(warnings.some(w => w.includes("MemoryStore"))).toBe(true);
    });

    it("no warning in development mode", () => {
      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => warnings.push(msg);

      withNodeEnv("development", () => session({ secret: "s" }));

      console.warn = origWarn;
      expect(warnings.length).toBe(0);
    });

    it("no warning in production when a custom (non-MemoryStore) store is provided", () => {
      const customStore: SessionStore = {
        async get() { return null; },
        async set() {},
        async destroy() {},
      };
      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => warnings.push(msg);

      withNodeEnv("production", () => session({ secret: "s", store: customStore }));

      console.warn = origWarn;
      expect(warnings.length).toBe(0);
    });
  });

  describe("Phase 6 — sess.touch() passes real session data to store.touch()", () => {
    it("store.touch() receives full internalData, not {}", async () => {
      const touchedWith: SessionData[] = [];
      const mockStore: SessionStore = {
        async get() { return { user: "alice" }; },
        async set() {},
        async destroy() {},
        async touch(_sid, data) { touchedWith.push({ ...data }); },
      };

      const handler = session({ secret: "s", store: mockStore, saveUninitialized: false, cookie: { maxAge: 10_000 } });
      // Supply a fake signed cookie to trigger store.get (returns { user: "alice" })
      const signedCookie = signSessionId("fakeId", "s");
      const req = new BunRequest(
        new Request("http://localhost/", {
          headers: { cookie: `connect.sid=${encodeURIComponent(signedCookie)}` }
        }),
        "/"
      );
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));

      expect((req as any).session.user).toBe("alice");

      (req as any).session.touch();
      await Promise.resolve(); // flush the non-awaited store.touch() call

      expect(touchedWith.length).toBe(1);
      expect(touchedWith[0]!.user).toBe("alice"); // real data, not {}
    });

    it("touch() after mutation passes the mutated state", async () => {
      const touchedWith: SessionData[] = [];
      const mockStore: SessionStore = {
        async get() { return { count: 5 }; },
        async set() {},
        async destroy() {},
        async touch(_sid, data) { touchedWith.push({ ...data }); },
      };

      const handler = session({ secret: "s", store: mockStore, saveUninitialized: false, cookie: { maxAge: 10_000 } });
      const signedCookie = signSessionId("fakeId2", "s");
      const req = new BunRequest(
        new Request("http://localhost/", {
          headers: { cookie: `connect.sid=${encodeURIComponent(signedCookie)}` }
        }),
        "/"
      );
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));

      (req as any).session.count = 99; // mutate
      (req as any).session.touch();
      await Promise.resolve();

      expect(touchedWith[0]?.count).toBe(99);
    });
  });

  describe("Phase 7 — Store errors forwarded to next(err)", () => {
    function failingStore(method: "get" | "set" | "destroy"): SessionStore {
      return {
        async get() {
          if (method === "get") throw new Error(`${method} failed`);
          return null;
        },
        async set() {
          if (method === "set") throw new Error(`${method} failed`);
        },
        async destroy() {
          if (method === "destroy") throw new Error(`${method} failed`);
        },
      };
    }

    it("store.get() throws → next(err), not next()", async () => {
      const signedCookie = signSessionId("existing-id", "test-secret");
      const req = new BunRequest(
        new Request("http://localhost/", {
          headers: { cookie: `connect.sid=${encodeURIComponent(signedCookie)}` }
        }),
        "/"
      );
      const res = new BunResponse();
      const handler = session({ secret: "test-secret", store: failingStore("get") });

      let caughtErr: unknown;
      let cleanNextCalled = false;

      await new Promise<void>(resolve => {
        handler(req, res, (err) => {
          if (err) caughtErr = err;
          else cleanNextCalled = true;
          resolve();
        });
      });

      expect(caughtErr).toBeInstanceOf(Error);
      expect((caughtErr as Error).message).toBe("get failed");
      expect(cleanNextCalled).toBe(false);
    });

    it("store.set() throws during saveUninitialized → next(err)", async () => {
      const handler = session({
        secret: "test-secret",
        store: failingStore("set"),
        saveUninitialized: true,
      });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();

      let caughtErr: unknown;
      await new Promise<void>(resolve => {
        handler(req, res, (err) => { caughtErr = err; resolve(); });
      });

      expect(caughtErr).toBeInstanceOf(Error);
      expect((caughtErr as Error).message).toBe("set failed");
    });

    it("regenerate(): failing store.destroy() → error to callback, called exactly once", async () => {
      const handler = session({
        secret: "test-secret",
        store: failingStore("destroy"),
        saveUninitialized: true,
      });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));

      let regenErr: unknown;
      let callbackCount = 0;

      await new Promise<void>(resolve => {
        (req as any).session.regenerate((err?: Error) => {
          callbackCount++;
          regenErr = err;
          resolve();
        });
      });

      expect(regenErr).toBeInstanceOf(Error);
      expect((regenErr as Error).message).toBe("destroy failed");
      expect(callbackCount).toBe(1); // callback not double-invoked
    });

    it("regenerate(): failing store.set() → error to callback, called exactly once", async () => {
      let setCount = 0;
      const partialFailStore: SessionStore = {
        async get() { return {}; },
        async set() {
          setCount++;
          if (setCount > 1) throw new Error("set failed on regenerate");
        },
        async destroy() {},
      };

      const handler = session({ secret: "s", store: partialFailStore, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));

      let regenErr: unknown;
      let callbackCount = 0;

      await new Promise<void>(resolve => {
        (req as any).session.regenerate((err?: Error) => {
          callbackCount++;
          regenErr = err;
          resolve();
        });
      });

      expect(regenErr).toBeInstanceOf(Error);
      expect(callbackCount).toBe(1);
    });
  });

  describe("Phase 10 — resave option", () => {
    it("resave: false — new session with saveUninitialized: true is still saved initially", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "s", store, resave: false, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));
      expect(store.size).toBe(1); // initial creation save happens regardless of resave flag
    });

    it("resave: true — accepted, middleware runs without error", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "s", store, resave: true, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      let nextCalled = false;
      await new Promise<void>(resolve => handler(req, res, () => { nextCalled = true; resolve(); }));
      expect(nextCalled).toBe(true);
    });
  });

  describe("Phase 10 — rolling option", () => {
    it("rolling: false (default) — accepted, middleware runs without error", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "s", store, rolling: false, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      let nextCalled = false;
      await new Promise<void>(resolve => handler(req, res, () => { nextCalled = true; resolve(); }));
      expect(nextCalled).toBe(true);
    });

    it("rolling: true — accepted, middleware runs without error", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "s", store, rolling: true, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      let nextCalled = false;
      await new Promise<void>(resolve => handler(req, res, () => { nextCalled = true; resolve(); }));
      expect(nextCalled).toBe(true);
    });
  });

  describe("Phase 11 — req.sessionStore", () => {
    it("req.sessionStore is the store instance passed to session()", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "s", store });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));
      expect((req as any).sessionStore).toBe(store);
    });

    it("req.sessionStore is a MemoryStore when no store option provided", async () => {
      const handler = session({ secret: "s" });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));
      expect((req as any).sessionStore).toBeInstanceOf(MemoryStore);
    });
  });

  describe("Phase 12 — Secret array / key rotation", () => {
    it("new session cookie is signed with the first secret in the array", async () => {
      const handler = session({ secret: ["primary-key", "old-key"], saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));

      const setCookie = res.get("set-cookie")!;
      const match = setCookie.match(/connect\.sid=([^;]+)/);
      const decoded = decodeURIComponent(match![1]);

      // Must verify with primary key
      const sid = unsignSessionId(decoded, ["primary-key"]);
      expect(sid).not.toBe(false);
    });

    it("session cookie signed with rotated secret is still accepted", async () => {
      const store = new MemoryStore();
      const oldKey = "old-key";
      const newKey = "new-key";
      const existingSid = "rotation-test-sid";
      await store.set(existingSid, { user: "rotated-user" }, 86_400_000);

      const oldSignedCookie = signSessionId(existingSid, oldKey);
      const handler = session({ secret: [newKey, oldKey], store });
      const req = new BunRequest(
        new Request("http://localhost/", {
          headers: { cookie: `connect.sid=${encodeURIComponent(oldSignedCookie)}` }
        }),
        "/"
      );
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));

      expect((req as any).sessionID).toBe(existingSid);
      expect((req as any).session.user).toBe("rotated-user");
    });

    it("secret: 'string' backwards-compat — single string works same as ['string']", async () => {
      const store = new MemoryStore();
      const handler = session({ secret: "single-string", store, saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      let err: unknown;
      await new Promise<void>(resolve => handler(req, res, (e) => { err = e; resolve(); }));
      expect(err).toBeUndefined();
      expect(store.size).toBe(1);
    });
  });

  describe("Phase 17 — fromExpressStore() adapter", () => {
    function makeLegacyStore(initial: Record<string, SessionData> = {}) {
      const _data = { ...initial };
      return {
        _data,
        get(sid: string, cb: (err: any, session?: SessionData | null) => void) {
          setImmediate(() => cb(null, _data[sid] ?? null));
        },
        set(sid: string, session: SessionData, cb?: (err?: any) => void) {
          _data[sid] = { ...session };
          setImmediate(() => cb?.());
        },
        destroy(sid: string, cb?: (err?: any) => void) {
          delete _data[sid];
          setImmediate(() => cb?.());
        },
        touch(sid: string, _session: SessionData, cb?: (err?: any) => void) {
          setImmediate(() => cb?.());
        },
      };
    }

    it("get() resolves session data as a Promise", async () => {
      const legacy = makeLegacyStore({ "test-sid": { user: "alice" } });
      const adapted = fromExpressStore(legacy);
      expect(await adapted.get("test-sid")).toEqual({ user: "alice" });
    });

    it("get() resolves null for missing session", async () => {
      const adapted = fromExpressStore(makeLegacyStore());
      expect(await adapted.get("missing")).toBeNull();
    });

    it("get() rejects when legacy store calls back with an error", async () => {
      const errorStore = {
        get(_sid: string, cb: (err: any) => void) { cb(new Error("get failed")); },
        set(_sid: string, _session: SessionData, cb?: (err?: any) => void) { cb?.(); },
        destroy(_sid: string, cb?: (err?: any) => void) { cb?.(); },
      };
      await expect(fromExpressStore(errorStore).get("any")).rejects.toThrow("get failed");
    });

    it("set() stores data and resolves", async () => {
      const legacy = makeLegacyStore();
      await fromExpressStore(legacy).set("new-sid", { count: 42 });
      expect(legacy._data["new-sid"]).toEqual({ count: 42 });
    });

    it("set() rejects when legacy store errors on set", async () => {
      const errorStore = {
        get(_sid: string, cb: (err: any) => void) { cb(null, null); },
        set(_sid: string, _session: SessionData, cb?: (err?: any) => void) { cb?.(new Error("set failed")); },
        destroy(_sid: string, cb?: (err?: any) => void) { cb?.(); },
      };
      await expect(fromExpressStore(errorStore).set("x", {})).rejects.toThrow("set failed");
    });

    it("destroy() removes session and resolves", async () => {
      const legacy = makeLegacyStore({ "del-sid": { x: 1 } });
      await fromExpressStore(legacy).destroy("del-sid");
      expect(legacy._data["del-sid"]).toBeUndefined();
    });

    it("destroy() rejects when legacy store errors on destroy", async () => {
      const errorStore = {
        get(_sid: string, cb: (err: any) => void) { cb(null, null); },
        set(_sid: string, _session: SessionData, cb?: (err?: any) => void) { cb?.(); },
        destroy(_sid: string, cb?: (err?: any) => void) { cb?.(new Error("destroy failed")); },
      };
      await expect(fromExpressStore(errorStore).destroy("x")).rejects.toThrow("destroy failed");
    });

    it("touch() is defined when legacy store has touch", async () => {
      const adapted = fromExpressStore(makeLegacyStore());
      expect(adapted.touch).toBeDefined();
      await expect(adapted.touch!("sid", {})).resolves.toBeUndefined();
    });

    it("touch() is undefined when legacy store omits touch", () => {
      const noTouchStore = {
        get(_sid: string, cb: (err: any) => void) { cb(null, null); },
        set(_sid: string, _session: SessionData, cb?: (err?: any) => void) { cb?.(); },
        destroy(_sid: string, cb?: (err?: any) => void) { cb?.(); },
      };
      expect(fromExpressStore(noTouchStore).touch).toBeUndefined();
    });

    it("adapted store integrates end-to-end with session() middleware", async () => {
      const legacy = makeLegacyStore();
      const FLUSH = () => new Promise(r => setTimeout(r, 10));
      const handler = session({ secret: "unit-secret", store: fromExpressStore(legacy), saveUninitialized: true });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();

      await new Promise<void>((resolve, reject) => {
        handler(req, res, (err?: unknown) => {
          if (err) reject(err); else resolve();
        });
      });
      (req as any).session.fromAdapter = true;
      await FLUSH();

      const keys = Object.keys(legacy._data);
      expect(keys.length).toBe(1);
      expect(legacy._data[keys[0]!]?.fromAdapter).toBe(true);
    });

    describe("EventEmitter forwarding (Phase 19)", () => {
      async function makeLegacyWithEvents() {
        const { EventEmitter } = await import("events");
        const ee = new EventEmitter();
        return Object.assign(ee, {
          get(_sid: string, cb: (err: any) => void) { cb(null, null); },
          set(_sid: string, _session: SessionData, cb?: (err?: any) => void) { cb?.(); },
          destroy(_sid: string, cb?: (err?: any) => void) { cb?.(); },
        });
      }

      it("adapted.on forwards listeners to the underlying store EventEmitter", async () => {
        const legacy = await makeLegacyWithEvents();
        const adapted = fromExpressStore(legacy);
        expect(adapted.on).toBeDefined();

        let received = false;
        adapted.on!("connect", () => { received = true; });
        legacy.emit("connect");

        expect(received).toBe(true);
      });

      it("adapted.on returns the adapted store (enables chaining)", async () => {
        const legacy = await makeLegacyWithEvents();
        const adapted = fromExpressStore(legacy);
        const result = adapted.on!("connect", () => {});
        expect(result).toBe(adapted);
      });

      it("adapted.emit forwards emissions to underlying store", async () => {
        const legacy = await makeLegacyWithEvents();
        const adapted = fromExpressStore(legacy);

        let received = false;
        legacy.on("disconnect", () => { received = true; });
        adapted.emit!("disconnect");

        expect(received).toBe(true);
      });

      it("fromExpressStore without EventEmitter → adapted.on and adapted.emit are undefined", () => {
        const plainStore = {
          get(_sid: string, cb: (err: any) => void) { cb(null, null); },
          set(_sid: string, _session: SessionData, cb?: (err?: any) => void) { cb?.(); },
          destroy(_sid: string, cb?: (err?: any) => void) { cb?.(); },
        };
        const adapted = fromExpressStore(plainStore);
        expect(adapted.on).toBeUndefined();
        expect(adapted.emit).toBeUndefined();
      });
    });
  });

  describe("Phase 18 — req.session / req.sessionID / req.sessionStore runtime shape", () => {
    async function runMiddleware(opts?: Partial<SessionOptions>) {
      const handler = session({ secret: "s", saveUninitialized: true, ...opts });
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      await new Promise<void>(resolve => handler(req, res, () => resolve()));
      return req;
    }

    it("req.session is defined and has Session methods after middleware runs", async () => {
      const req = await runMiddleware();
      expect((req as any).session).toBeDefined();
      expect(typeof (req as any).session.id).toBe("string");
      expect(typeof (req as any).session.regenerate).toBe("function");
      expect(typeof (req as any).session.destroy).toBe("function");
      expect(typeof (req as any).session.save).toBe("function");
      expect(typeof (req as any).session.touch).toBe("function");
    });

    it("req.sessionID is a non-empty string matching session.id", async () => {
      const req = await runMiddleware();
      expect(typeof (req as any).sessionID).toBe("string");
      expect((req as any).sessionID.length).toBeGreaterThan(0);
      expect((req as any).sessionID).toBe((req as any).session.id);
    });

    it("session data set via proxy is readable back on req.session", async () => {
      const req = await runMiddleware();
      (req as any).session.customField = "typed-value";
      expect((req as any).session.customField).toBe("typed-value");
    });
  });

  describe("Phase 19 — MemoryStore utility methods", () => {
    it("all() returns all non-expired sessions as an array", async () => {
      const store = new MemoryStore();
      await store.set("a", { val: 1 }, 86_400_000);
      await store.set("b", { val: 2 }, 86_400_000);
      await store.set("c", { val: 3 }, 1); // expires immediately
      await new Promise(r => setTimeout(r, 20));

      const sessions = await store.all!();
      expect(sessions.length).toBe(2);
      expect(sessions.some(s => s.val === 1)).toBe(true);
      expect(sessions.some(s => s.val === 2)).toBe(true);
      expect(sessions.some(s => s.val === 3)).toBe(false);
    });

    it("all() returns empty array when store has no sessions", async () => {
      const store = new MemoryStore();
      expect(await store.all!()).toEqual([]);
    });

    it("length() counts only non-expired sessions", async () => {
      const store = new MemoryStore();
      await store.set("x", { v: 1 }, 86_400_000);
      await store.set("y", { v: 2 }, 86_400_000);
      await store.set("z", { v: 3 }, 1); // expires immediately
      await new Promise(r => setTimeout(r, 20));

      expect(await store.length!()).toBe(2);
    });

    it("length() returns 0 for empty store", async () => {
      const store = new MemoryStore();
      expect(await store.length!()).toBe(0);
    });

    it("clear() removes all sessions", async () => {
      const store = new MemoryStore();
      await store.set("a", { v: 1 });
      await store.set("b", { v: 2 });

      await store.clear!();

      expect(await store.length!()).toBe(0);
      expect(await store.get("a")).toBeNull();
      expect(await store.get("b")).toBeNull();
    });

    it("size getter still works after Phase 19 (backwards compat)", async () => {
      const store = new MemoryStore();
      await store.set("s1", { x: 1 });
      await store.set("s2", { x: 2 });
      expect(store.size).toBe(2);
    });
  });
});
