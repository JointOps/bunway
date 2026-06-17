import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { Router, session, MemoryStore, FileStore, json } from "../../../src";
import { cookieParser } from "../../../src/middleware/cookie-parser";
import { sign, signSessionId } from "../../../src/utils/crypto";
import type { SessionStore } from "../../../src/middleware/session";
import { SpyStore } from "../../utils/test-helpers";
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

    it("uses custom genid function — receives req", async () => {
      let capturedReq: unknown;
      const router = new Router();
      router.use(
        session({
          secret: SECRET,
          genid: (req) => { capturedReq = req; return "custom-session-id-12345"; },
        })
      );
      router.get("/", (req, res) => {
        res.json({ sessionId: (req as any).session.id });
      });

      const response = await router.handle(buildRequest("/"));
      const data = await response.json();
      expect(data.sessionId).toBe("custom-session-id-12345");
      expect(capturedReq).toBeDefined(); // req was passed to genid
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

  describe("Phase 3 — res.cookie({ signed: true }) integration", () => {
    const SIGNED_SECRET = "signed-cookie-secret";

    it("res.cookie({ signed: true }) emits s: prefixed encoded value", async () => {
      const router = new Router();
      router.use(cookieParser(SIGNED_SECRET));
      router.get("/set", (req, res) => {
        res.cookie("tok", "hello", { signed: true });
        res.json({ ok: true });
      });

      const response = await router.handle(buildRequest("/set"));
      const setCookie = response.headers.get("set-cookie")!;
      const match = setCookie.match(/tok=([^;]+)/);
      const decoded = decodeURIComponent(match![1]);
      expect(decoded).toMatch(/^s:hello\./); // s:value.signature format
    });

    it("signed cookie round-trip: emitted on /set, verified on /get via req.signedCookies", async () => {
      const router = new Router();
      router.use(cookieParser(SIGNED_SECRET));
      router.get("/set", (req, res) => {
        res.cookie("tok", "alice", { signed: true });
        res.json({ ok: true });
      });
      router.get("/get", (req, res) => {
        res.json({ val: req.signedCookies.tok });
      });

      const setRes = await router.handle(buildRequest("/set"));
      const rawCookiePair = setRes.headers.get("set-cookie")!.split(";")[0]; // "tok=s%3A..."

      const getRes = await router.handle(
        buildRequest("/get", { headers: { Cookie: rawCookiePair } })
      );
      const data = await getRes.json();
      expect(data.val).toBe("alice");
    });

    it("res.cookie({ signed: true }) without cookieParser → throws at cookie() call", async () => {
      const router = new Router();
      // No cookieParser — res._req.secret is undefined
      let threwExpected = false;
      router.get("/", (req, res) => {
        try {
          res.cookie("tok", "v", { signed: true });
        } catch (e: any) {
          threwExpected = /cookieParser/i.test(e.message);
        }
        res.json({ threw: threwExpected });
      });

      const response = await router.handle(buildRequest("/"));
      const data = await response.json();
      expect(data.threw).toBe(true);
    });
  });

  describe("Phase 8 — Post-response hook: TTL drift prevention", () => {
    const FLUSH = () => new Promise(r => setTimeout(r, 10)); // drain fire-and-forget postResponse

    it("read-only request → store.touch() called with full session data", async () => {
      const spy = new SpyStore();
      spy.seed("ro-sid", { user: "alice" }, 86_400_000);

      const router = new Router();
      router.use(session({ secret: SECRET, store: spy }));
      router.get("/read", (req, res) => {
        void (req as any).session.user; // read only
        res.json({ ok: true });
      });

      const signedCookie = signSessionId("ro-sid", SECRET);
      spy.reset();

      await router.handle(buildRequest("/read", {
        headers: { Cookie: `connect.sid=${encodeURIComponent(signedCookie)}` }
      }));
      await FLUSH();

      const touchCall = spy.calls.find(c => c.method === "touch");
      expect(touchCall).toBeDefined();
      expect(touchCall!.data!.user).toBe("alice"); // real data, not {}
    });

    it("mutating request → store.set() called, store.touch() NOT called", async () => {
      const spy = new SpyStore();
      spy.seed("mut-sid", { count: 0 }, 86_400_000);

      const router = new Router();
      router.use(session({ secret: SECRET, store: spy }));
      router.get("/write", (req, res) => {
        (req as any).session.count = 1; // mutation → queueWrite → dirty = true
        res.json({ ok: true });
      });

      const signedCookie = signSessionId("mut-sid", SECRET);
      spy.reset();

      await router.handle(buildRequest("/write", {
        headers: { Cookie: `connect.sid=${encodeURIComponent(signedCookie)}` }
      }));
      await FLUSH();

      expect(spy.calls.find(c => c.method === "set")).toBeDefined();     // set via queueWrite
      expect(spy.calls.find(c => c.method === "touch")).toBeUndefined(); // dirty flag suppresses touch
    });

    it("destroyed session → postResponse calls neither set nor touch", async () => {
      const spy = new SpyStore();
      spy.seed("del-sid", { val: "x" }, 86_400_000);

      const router = new Router();
      router.use(session({ secret: SECRET, store: spy }));
      router.delete("/logout", async (req, res) => {
        await (req as any).session.destroy();
        res.json({ ok: true });
      });

      const signedCookie = signSessionId("del-sid", SECRET);
      spy.reset();

      await router.handle(buildRequest("/logout", {
        method: "DELETE",
        headers: { Cookie: `connect.sid=${encodeURIComponent(signedCookie)}` }
      }));
      await FLUSH();

      const postCalls = spy.calls.filter(c => c.method === "set" || c.method === "touch");
      expect(postCalls.length).toBe(0);
    });

    it("store without touch() → postResponse completes silently (no error)", async () => {
      const noTouchStore: SessionStore = {
        async get(sid) { return sid === "notouchsid" ? { x: 1 } : null; },
        async set() {},
        async destroy() {},
        // touch intentionally absent
      };

      const router = new Router();
      router.use(session({ secret: SECRET, store: noTouchStore }));
      router.get("/", (req, res) => res.json({ ok: true }));

      const signedCookie = signSessionId("notouchsid", SECRET);
      const response = await router.handle(buildRequest("/", {
        headers: { Cookie: `connect.sid=${encodeURIComponent(signedCookie)}` }
      }));
      await FLUSH();

      expect(response.status).toBe(200); // no uncaught error
    });
  });

  describe("Phase 9 — Conditional Set-Cookie", () => {
    it("existing session + rolling: false → no Set-Cookie on 2nd request", async () => {
      const store = new MemoryStore();
      const router = new Router();
      router.use(session({ secret: SECRET, store, rolling: false }));
      router.get("/ping", (req, res) => res.json({ ok: true }));

      const res1 = await router.handle(buildRequest("/ping"));
      const cookie = getSessionCookie(res1);
      expect(cookie).toBeDefined(); // cookie emitted on creation

      const res2 = await router.handle(buildRequest("/ping", {
        headers: { Cookie: `connect.sid=${cookie}` }
      }));
      expect(res2.headers.get("set-cookie")).toBeNull(); // no re-send with rolling: false
    });

    it("new session + saveUninitialized: true → Set-Cookie on first request", async () => {
      const router = new Router();
      router.use(session({ secret: SECRET, saveUninitialized: true }));
      router.get("/", (req, res) => res.json({ ok: true }));

      const response = await router.handle(buildRequest("/"));
      expect(response.headers.get("set-cookie")).not.toBeNull();
    });

    it("new session + saveUninitialized: false + no mutation → no Set-Cookie", async () => {
      const router = new Router();
      router.use(session({ secret: SECRET, saveUninitialized: false }));
      router.get("/", (req, res) => res.json({ ok: true }));

      const response = await router.handle(buildRequest("/"));
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("new session + saveUninitialized: false + mutation → Set-Cookie IS sent + session saved", async () => {
      const spy = new SpyStore();
      const router = new Router();
      router.use(session({ secret: SECRET, store: spy, saveUninitialized: false }));
      router.get("/login", async (req, res) => {
        (req as any).session.user = "alice"; // mutation triggers queueWrite
        res.json({ ok: true });
      });

      const FLUSH = () => new Promise(r => setTimeout(r, 10));
      const response = await router.handle(buildRequest("/login"));
      await FLUSH();

      // Cookie must be present so the client can reconnect
      expect(response.headers.get("set-cookie")).not.toBeNull();
      // Session data must have been persisted
      const setCalls = spy.calls.filter(c => c.method === "set");
      expect(setCalls.length).toBeGreaterThanOrEqual(1);
      expect(setCalls[0]!.data).toMatchObject({ user: "alice" });
    });

    it("after regenerate() → new Set-Cookie with different session ID", async () => {
      const store = new MemoryStore();
      const router = new Router();
      router.use(session({ secret: SECRET, store, saveUninitialized: true }));
      router.get("/regen", (req, res) => {
        const oldId = (req as any).sessionID;
        (req as any).session.regenerate(() => {
          res.json({ oldId, newId: (req as any).sessionID });
        });
      });

      const response = await router.handle(buildRequest("/regen"));
      const data = await response.json();
      const setCookie = response.headers.get("set-cookie");

      expect(data.newId).not.toBe(data.oldId);
      expect(setCookie).not.toBeNull();
      expect(setCookie).toContain("connect.sid=");
    });
  });

  describe("Phase 10 — resave + rolling integration", () => {
    const FLUSH = () => new Promise(r => setTimeout(r, 10));

    it("rolling: true → Set-Cookie header re-sent on every response", async () => {
      const store = new MemoryStore();
      const router = new Router();
      router.use(session({ secret: SECRET, store, rolling: true }));
      router.get("/ping", (req, res) => res.json({ ok: true }));

      const res1 = await router.handle(buildRequest("/ping"));
      const cookie = getSessionCookie(res1);
      expect(cookie).toBeDefined();

      const res2 = await router.handle(buildRequest("/ping", {
        headers: { Cookie: `connect.sid=${cookie}` }
      }));
      expect(res2.headers.get("set-cookie")).not.toBeNull(); // re-sent with rolling: true
    });

    it("rolling omitted entirely (default false) → Set-Cookie absent on 2nd request", async () => {
      const store = new MemoryStore();
      const router = new Router();
      router.use(session({ secret: SECRET, store })); // no rolling option — must default to false
      router.get("/ping", (req, res) => res.json({ ok: true }));

      const res1 = await router.handle(buildRequest("/ping"));
      const cookie = getSessionCookie(res1);

      const res2 = await router.handle(buildRequest("/ping", {
        headers: { Cookie: `connect.sid=${cookie}` }
      }));
      expect(res2.headers.get("set-cookie")).toBeNull();
    });

    it("resave: false → read-only request does NOT call store.set() again", async () => {
      const spy = new SpyStore();

      const router = new Router();
      router.use(session({ secret: SECRET, store: spy, resave: false, saveUninitialized: true }));
      router.get("/read", (req, res) => {
        void (req as any).session.someKey; // read-only
        res.json({ ok: true });
      });

      const res1 = await router.handle(buildRequest("/read"));
      const cookie = getSessionCookie(res1);
      spy.reset();

      await router.handle(buildRequest("/read", {
        headers: { Cookie: `connect.sid=${cookie}` }
      }));
      await FLUSH();

      const setCalls = spy.calls.filter(c => c.method === "set");
      expect(setCalls.length).toBe(0); // no store.set() on read-only with resave: false
    });

    it("resave: true + no store.touch() → read-only request calls store.set() to refresh TTL", async () => {
      const setCalls: string[] = [];
      const noTouchStore: SessionStore = {
        async get(sid) { return sid === "resave-sid" ? { x: 1 } : null; },
        async set(sid) { setCalls.push(sid); },
        async destroy() {},
        // no touch method
      };

      const router = new Router();
      router.use(session({ secret: SECRET, store: noTouchStore, resave: true }));
      router.get("/read", (req, res) => {
        void (req as any).session.x;
        res.json({ ok: true });
      });

      const signedCookie = signSessionId("resave-sid", SECRET);
      await router.handle(buildRequest("/read", {
        headers: { Cookie: `connect.sid=${encodeURIComponent(signedCookie)}` }
      }));
      await FLUSH();

      expect(setCalls.length).toBeGreaterThan(0); // store.set() called to refresh TTL
    });
  });
});
