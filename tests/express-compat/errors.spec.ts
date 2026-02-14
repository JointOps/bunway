import { describe, test, expect } from "bun:test";
import bunway, { Router } from "../../src";
import { buildRequest } from "../utils/testUtils";

describe("Express Compatibility: Error Handling", () => {
  test("next(err) triggers error handler like Express", async () => {
    const app = bunway();

    app.get("/test", (req, res, next) => {
      next(new Error("test error"));
    });

    app.use((err: Error, req: any, res: any, next: any) => {
      res.status(500).json({ error: err.message });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "test error" });
  });

  test("4-arg error handler catches errors like Express", async () => {
    const app = bunway();

    app.get("/test", (req, res, next) => {
      throw new Error("thrown error");
    });

    app.use((err: Error, req: any, res: any, next: any) => {
      res.status(500).json({ caught: true, message: err.message });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      caught: true,
      message: "thrown error"
    });
  });

  test("Async errors are caught like Express", async () => {
    const app = bunway();

    app.get("/test", async (req, res, next) => {
      throw new Error("async error");
    });

    app.use((err: Error, req: any, res: any, next: any) => {
      res.status(500).json({ error: err.message });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "async error" });
  });

  test("Rejected promises are caught like Express", async () => {
    const app = bunway();

    app.get("/test", async (req, res) => {
      await Promise.reject(new Error("rejected"));
    });

    app.use((err: Error, req: any, res: any, next: any) => {
      res.status(500).json({ error: err.message });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "rejected" });
  });

  test("Multiple error handlers work like Express", async () => {
    const app = bunway();
    const order: number[] = [];

    app.get("/test", (req, res, next) => {
      next(new Error("test"));
    });

    app.use((err: Error, req: any, res: any, next: any) => {
      order.push(1);
      next(err);
    });

    app.use((err: Error, req: any, res: any, next: any) => {
      order.push(2);
      res.status(500).json({ order });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({ order: [1, 2] });
  });

  test("Error handler with next() propagates to next error handler like Express", async () => {
    const app = bunway();
    let firstCalled = false;
    let secondCalled = false;

    app.get("/test", (req, res, next) => {
      next(new Error("test"));
    });

    app.use((err: Error, req: any, res: any, next: any) => {
      firstCalled = true;
      next(err);
    });

    app.use((err: Error, req: any, res: any, next: any) => {
      secondCalled = true;
      res.status(500).json({ ok: true });
    });

    await app.handle(buildRequest("/test"));
    expect(firstCalled).toBe(true);
    expect(secondCalled).toBe(true);
  });

  test("Error in middleware is caught like Express", async () => {
    const app = bunway();

    app.use((req, res, next) => {
      throw new Error("middleware error");
    });

    app.use((err: Error, req: any, res: any, next: any) => {
      res.status(500).json({ error: err.message });
    });

    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "middleware error" });
  });

  test("Custom error with status code works like Express", async () => {
    const app = bunway();

    app.get("/test", (req, res, next) => {
      const error: any = new Error("Not Found");
      error.status = 404;
      next(error);
    });

    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.status || 500).json({ error: err.message });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not Found" });
  });

  test("Error handler on router works like Express", async () => {
    const app = bunway();
    const router = new Router();

    router.get("/test", (req, res, next) => {
      next(new Error("router error"));
    });

    router.use((err: Error, req: any, res: any, next: any) => {
      res.status(500).json({ routerError: err.message });
    });

    app.use("/api", router);

    const response = await app.handle(buildRequest("/api/test"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ routerError: "router error" });
  });

  test("Normal middleware not called when error occurs like Express", async () => {
    const app = bunway();
    let normalMiddlewareCalled = false;

    app.use((req, res, next) => {
      normalMiddlewareCalled = true;
      next();
    });

    app.get("/test", (req, res, next) => {
      next(new Error("error"));
    });

    app.use((err: Error, req: any, res: any, next: any) => {
      res.status(500).json({ error: true });
    });

    await app.handle(buildRequest("/test"));
    expect(normalMiddlewareCalled).toBe(true);
  });
});
