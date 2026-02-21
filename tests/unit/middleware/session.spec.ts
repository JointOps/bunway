import { describe, expect, it, beforeEach } from "bun:test";
import { MemoryStore, session } from "../../../src/middleware/session";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";
import { signSessionId } from "../../../src/utils/crypto";

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
  });
});
