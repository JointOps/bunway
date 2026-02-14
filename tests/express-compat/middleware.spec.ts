import { describe, test, expect } from "bun:test";
import bunway, { Router } from "../../src";
import { buildRequest } from "../utils/testUtils";

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

    await app.handle(buildRequest("/protected"));
    expect(authCalled).toBe(true);

    authCalled = false;
    await app.handle(buildRequest("/public"));
    expect(authCalled).toBe(false);
  });

  test("error propagates through middleware like Express", async () => {
    const app = bunway();

    app.use((req, res, next) => {
      next(new Error("test error"));
    });
    app.use((err: Error, req: any, res: any, next: any) => {
      res.status(500).json({ error: err.message });
    });
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
