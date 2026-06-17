import { describe, expect, it } from "bun:test";
import bunway from "../../../src";
import { buildRequest } from "../../utils/test-helpers";

describe("router.param()", () => {
  it("preprocesses route parameter", async () => {
    const app = bunway();
    const processed: string[] = [];

    app.param("id", (req, res, next, value, name) => {
      processed.push(`${name}=${value}`);
      next();
    });

    app.get("/users/:id", (req, res) => {
      res.json({ id: req.params.id });
    });

    const response = await app.handle(buildRequest("/users/123"));

    expect(response.status).toBe(200);
    expect(processed).toEqual(["id=123"]);
  });

  it("can modify request based on param", async () => {
    const app = bunway();

    app.param("userId", (req, res, next, value) => {
      res.locals.user = { id: value, name: `User ${value}` };
      next();
    });

    app.get("/users/:userId", (req, res) => {
      res.json({ user: res.locals.user });
    });

    const response = await app.handle(buildRequest("/users/42"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: { id: "42", name: "User 42" },
    });
  });

  it("runs multiple param handlers for same param", async () => {
    const app = bunway();
    const order: string[] = [];

    app.param("id", (req, res, next) => {
      order.push("first");
      next();
    });

    app.param("id", (req, res, next) => {
      order.push("second");
      next();
    });

    app.get("/items/:id", (req, res) => {
      res.json({ order });
    });

    const response = await app.handle(buildRequest("/items/1"));

    expect(response.status).toBe(200);
    expect((await response.json()).order).toEqual(["first", "second"]);
  });

  it("handles multiple params in route", async () => {
    const app = bunway();
    const processed: string[] = [];

    app.param("category", (req, res, next, value) => {
      processed.push(`category=${value}`);
      next();
    });

    app.param("id", (req, res, next, value) => {
      processed.push(`id=${value}`);
      next();
    });

    app.get("/products/:category/:id", (req, res) => {
      res.json({ processed });
    });

    const response = await app.handle(buildRequest("/products/electronics/42"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.processed).toContain("category=electronics");
    expect(body.processed).toContain("id=42");
  });

  it("can reject request in param handler", async () => {
    const app = bunway();

    app.param("id", (req, res, next, value) => {
      if (!/^\d+$/.test(value)) {
        res.status(400).json({ error: "ID must be numeric" });
        return;
      }
      next();
    });

    app.get("/items/:id", (req, res) => {
      res.json({ id: req.params.id });
    });

    const invalidResponse = await app.handle(buildRequest("/items/abc"));
    expect(invalidResponse.status).toBe(400);

    const validResponse = await app.handle(buildRequest("/items/123"));
    expect(validResponse.status).toBe(200);
  });

  it("param handler can be async", async () => {
    const app = bunway();

    app.param("id", async (req, res, next, value) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      res.locals.processed = true;
      next();
    });

    app.get("/async/:id", (req, res) => {
      res.json({ processed: res.locals.processed });
    });

    const response = await app.handle(buildRequest("/async/123"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: true });
  });

  it("only runs param handler when param is in route", async () => {
    const app = bunway();
    let ran = false;

    app.param("id", (req, res, next) => {
      ran = true;
      next();
    });

    app.get("/no-params", (req, res) => {
      res.json({ ran });
    });

    const response = await app.handle(buildRequest("/no-params"));

    expect(response.status).toBe(200);
    expect(ran).toBe(false);
  });

  it("runs param callback only once when next('route') skips to a second route with the same param", async () => {
    const app = bunway();
    let callCount = 0;

    app.param("id", (req, res, next, value) => {
      callCount++;
      next();
    });

    app.get("/items/:id", (req, res, next) => {
      next("route");
    });

    app.get("/items/:id", (req, res) => {
      res.json({ callCount });
    });

    const response = await app.handle(buildRequest("/items/42"));

    expect(response.status).toBe(200);
    expect((await response.json()).callCount).toBe(1);
  });

  it("runs param callback only once even when multiple routes with the same param are traversed via next('route')", async () => {
    const app = bunway();
    const calls: string[] = [];

    app.param("userId", (req, res, next, value) => {
      calls.push(value);
      next();
    });

    app.get("/users/:userId", (req, res, next) => next("route"));
    app.get("/users/:userId", (req, res, next) => next("route"));
    app.get("/users/:userId", (req, res) => {
      res.json({ calls });
    });

    const response = await app.handle(buildRequest("/users/99"));

    expect(response.status).toBe(200);
    expect((await response.json()).calls).toEqual(["99"]);
  });

  it("runs param callbacks independently for different param names", async () => {
    const app = bunway();
    const calls: string[] = [];

    app.param("category", (req, res, next, value) => {
      calls.push(`category:${value}`);
      next();
    });

    app.param("id", (req, res, next, value) => {
      calls.push(`id:${value}`);
      next();
    });

    app.get("/shop/:category/:id", (req, res, next) => next("route"));
    app.get("/shop/:category/:id", (req, res) => {
      res.json({ calls });
    });

    const response = await app.handle(buildRequest("/shop/electronics/7"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.calls).toContain("category:electronics");
    expect(body.calls).toContain("id:7");
    expect(body.calls.filter((c: string) => c.startsWith("category:")).length).toBe(1);
    expect(body.calls.filter((c: string) => c.startsWith("id:")).length).toBe(1);
  });
});
