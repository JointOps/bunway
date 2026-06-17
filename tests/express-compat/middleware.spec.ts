import { describe, test, expect } from "bun:test";
import bunway, { Router } from "../../src";
import { buildRequest } from "../utils/test-helpers";

describe("Express Compatibility: Middleware Chain", () => {
  test("middleware executes in order like Express", async () => {
    const app = bunway();
    const order: number[] = [];

    app.use((req, res, next) => {
      order.push(1);
      next();
    });
    app.use((req, res, next) => {
      order.push(2);
      next();
    });
    app.get("/test", (req, res) => {
      order.push(3);
      res.json({ order });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({ order: [1, 2, 3] });
  });

  test("next() propagates to next middleware like Express", async () => {
    const app = bunway();
    let step1 = false;
    let step2 = false;

    app.use((req, res, next) => {
      step1 = true;
      next();
    });
    app.use((req, res, next) => {
      step2 = true;
      next();
    });
    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(buildRequest("/test"));
    expect(step1).toBe(true);
    expect(step2).toBe(true);
  });

  test("middleware can modify request like Express", async () => {
    const app = bunway();

    app.use((req, res, next) => {
      req.locals.userId = "123";
      next();
    });
    app.get("/test", (req, res) => {
      res.json({ userId: req.locals.userId });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({ userId: "123" });
  });

  test("middleware can modify response headers like Express", async () => {
    const app = bunway();

    app.use((req, res, next) => {
      res.set("X-Custom-Header", "test-value");
      next();
    });
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));
    expect(response.headers.get("X-Custom-Header")).toBe("test-value");
  });

  test("middleware without next() stops chain like Express", async () => {
    const app = bunway();
    let reachedRoute = false;

    app.use((req, res) => {
      res.json({ stopped: true });
    });
    app.get("/test", (req, res) => {
      reachedRoute = true;
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({ stopped: true });
    expect(reachedRoute).toBe(false);
  });

  test("async middleware with await works like Express", async () => {
    const app = bunway();

    app.use(async (req, res, next) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      req.locals.async = true;
      next();
    });
    app.get("/test", (req, res) => {
      res.json({ async: req.locals.async });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({ async: true });
  });

  test("route-specific middleware works like Express", async () => {
    const app = bunway();
    let authCalled = false;

    const auth = (req: any, res: any, next: any) => {
      authCalled = true;
      next();
    };

    app.get("/protected", auth, (req, res) => res.json({ ok: true }));
    app.get("/public", (req, res) => res.json({ ok: true }));

    const response1 = await app.handle(buildRequest("/protected"));
    expect(authCalled).toBe(true);

    authCalled = false;
    const response2 = await app.handle(buildRequest("/public"));
    expect(authCalled).toBe(false);
  });

  test("error propagates through middleware like Express", async () => {
    const app = bunway();

    app.use((req, res, next) => {
      next(new Error("test error"));
    });
    app.use(((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: (err as Error).message });
    }) as any);
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "test error" });
  });

  test("middleware on mounted router works like Express", async () => {
    const app = bunway();
    const router = new Router();
    let routerMiddlewareCalled = false;

    router.use((req, res, next) => {
      routerMiddlewareCalled = true;
      next();
    });
    router.get("/test", (req, res) => res.json({ ok: true }));

    app.use("/api", router);

    const response = await app.handle(buildRequest("/api/test"));
    expect(routerMiddlewareCalled).toBe(true);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("app-level and router-level middleware chain works like Express", async () => {
    const app = bunway();
    const router = new Router();
    const order: string[] = [];

    router.use((req, res, next) => {
      order.push("router");
      next();
    });
    router.get("/test", (req, res) => {
      order.push("route");
      res.json({ order });
    });

    app.use("/api", router);

    const response = await app.handle(buildRequest("/api/test"));
    expect(await response.json()).toEqual({ order: ["router", "route"] });
  });
});

// ---------------------------------------------------------------------------
// Phase 3 middleware compat (migrated from phase3.spec.ts)
// ---------------------------------------------------------------------------

import { timeout } from "../../src/middleware/timeout";
import { hpp } from "../../src/middleware/hpp";
import { validate } from "../../src/middleware/validation";
import { json as jsonParser } from "../../src/middleware/body-parser";

const T3 = 20; // base timeout for compat tests (ms)

describe("Express Compatibility: Phase 3 Middleware", () => {
  test("timeout middleware fires 408 like connect-timeout", async () => {
    const app = bunway();
    app.use(timeout(T3));
    app.get("/slow", async (req, res) => {
      await new Promise(r => setTimeout(r, T3 * 20));
      if (!req.timedout) res.json({ ok: true });
    });

    const response = await app.handle(new Request("http://localhost/slow"));
    expect(response.status).toBe(408);
  });

  test("timeout does NOT fire for fast routes like connect-timeout", async () => {
    const app = bunway();
    app.use(timeout(500));
    app.get("/fast", (req, res) => res.json({ timedout: req.timedout }));

    const response = await app.handle(new Request("http://localhost/fast"));
    expect((await response.json()).timedout).toBe(false);
  });

  test("req.timedout flag is set with respond:false like connect-timeout", async () => {
    const app = bunway();
    app.use(timeout(T3, { respond: false }));
    app.get("/check", async (req, res) => {
      await new Promise(r => setTimeout(r, T3 * 10));
      res.json({ timedout: req.timedout });
    });

    const response = await app.handle(new Request("http://localhost/check"));
    expect((await response.json()).timedout).toBe(true);
  });

  test("hpp sanitizes duplicate body params like hpp npm package", async () => {
    const app = bunway();
    app.use(jsonParser());
    app.use(hpp({ whitelist: ["allowed"] }));
    app.post("/api", (req, res) => res.json({ body: req.body }));

    const response = await app.handle(new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: ["user", "admin"], allowed: [1, 2] }),
    }));
    const body = await response.json();
    expect(body.body.role).toBe("admin");
    expect(body.body.allowed).toEqual([1, 2]);
  });

  test("hpp sanitizes duplicate query params like hpp npm package", async () => {
    const app = bunway();
    app.use(hpp());
    app.get("/search", (req, res) => res.json({ q: req.query.get("q") }));

    const response = await app.handle(new Request("http://localhost/search?q=first&q=second"));
    const body = await response.json();
    expect(typeof body.q).toBe("string");
  });

  test("validate works with body schema like express-validator", async () => {
    const app = bunway();
    app.use(jsonParser());
    app.post("/register", validate({ body: { email: { required: true, type: "email" }, password: { required: true, min: 8 } } }), (_req, res) => res.status(201).json({ ok: true }));

    expect((await app.handle(new Request("http://localhost/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "bad", password: "short" }) }))).status).toBe(422);
    expect((await app.handle(new Request("http://localhost/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "u@t.com", password: "securepass" }) }))).status).toBe(201);
  });

  test("validate works with params schema like express-validator", async () => {
    const app = bunway();
    app.get("/users/:id", validate({ params: { id: { required: true, pattern: /^\d+$/ } } }), (req, res) => res.json({ id: req.params.id }));

    expect((await app.handle(new Request("http://localhost/users/42"))).status).toBe(200);
    expect((await app.handle(new Request("http://localhost/users/abc"))).status).toBe(422);
  });

  test("validate works with query schema like express-validator", async () => {
    const app = bunway();
    app.get("/search", validate({ query: { q: { required: true, min: 2 } } }), (_req, res) => res.json({ ok: true }));

    expect((await app.handle(new Request("http://localhost/search?q=bun"))).status).toBe(200);
    expect((await app.handle(new Request("http://localhost/search?q=x"))).status).toBe(422);
    expect((await app.handle(new Request("http://localhost/search"))).status).toBe(422);
  });
});
