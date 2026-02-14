import { describe, test, expect } from "bun:test";
import bunway, { Router } from "../../src";
import { buildRequest } from "../utils/testUtils";

describe("Express Compatibility: Routing", () => {
  test("app.get(path, handler) works like Express", async () => {
    const app = bunway();
    app.get("/users", (req, res) => res.json({ users: [] }));

    const response = await app.handle(buildRequest("/users"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ users: [] });
  });

  test("app.post(path, handler) works like Express", async () => {
    const app = bunway();
    app.post("/users", (req, res) => res.json({ created: true }));

    const response = await app.handle(buildRequest("/users", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: true });
  });

  test("app.put(path, handler) works like Express", async () => {
    const app = bunway();
    app.put("/users/:id", (req, res) => res.json({ updated: req.params.id }));

    const response = await app.handle(buildRequest("/users/42", { method: "PUT" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: "42" });
  });

  test("app.delete(path, handler) works like Express", async () => {
    const app = bunway();
    app.delete("/users/:id", (req, res) => res.json({ deleted: req.params.id }));

    const response = await app.handle(buildRequest("/users/42", { method: "DELETE" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: "42" });
  });

  test("app.patch(path, handler) works like Express", async () => {
    const app = bunway();
    app.patch("/users/:id", (req, res) => res.json({ patched: req.params.id }));

    const response = await app.handle(buildRequest("/users/42", { method: "PATCH" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ patched: "42" });
  });

  test("app.all(path, handler) responds to all HTTP methods", async () => {
    const app = bunway();
    app.all("/health", (req, res) => res.json({ method: req.method }));

    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    for (const method of methods) {
      const response = await app.handle(buildRequest("/health", { method }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ method });
    }
  });

  test("route parameters work like Express (:id, :name)", async () => {
    const app = bunway();
    app.get("/users/:userId/posts/:postId", (req, res) => {
      res.json({
        userId: req.params.userId,
        postId: req.params.postId,
      });
    });

    const response = await app.handle(buildRequest("/users/123/posts/456"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "123", postId: "456" });
  });

  test("wildcard routes work like Express", async () => {
    const app = bunway();
    app.get("/files/*", (req, res) => {
      res.json({ path: req.path });
    });

    const response = await app.handle(buildRequest("/files/some/deep/path.txt"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.path).toBe("/files/some/deep/path.txt");
  });

  test("optional parameters work like Express (:id?)", async () => {
    const app = bunway();
    app.get("/users/:id?", (req, res) => {
      res.json({ id: req.params.id || "all" });
    });

    const response1 = await app.handle(buildRequest("/users/42"));
    expect(await response1.json()).toEqual({ id: "42" });

    const response2 = await app.handle(buildRequest("/users"));
    expect(await response2.json()).toEqual({ id: "all" });
  });

  test("router mounting works like Express", async () => {
    const app = bunway();
    const router = new Router();

    router.get("/list", (req, res) => res.json({ items: [] }));
    app.use("/api", router);

    const response = await app.handle(buildRequest("/api/list"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
  });

  test("router with path works like Express", async () => {
    const app = bunway();
    const router = new Router();

    router.get("/posts", (req, res) => {
      res.json({ path: req.path, url: req.url });
    });
    app.use("/api/v1", router);

    const response = await app.handle(buildRequest("/api/v1/posts"));
    const data = await response.json();
    expect(data.path).toBe("/posts");
    expect(data.url).toContain("/api/v1/posts");
  });

  test("multiple handlers per route work like Express", async () => {
    const app = bunway();
    const order: number[] = [];

    app.get("/test",
      (req, res, next) => {
        order.push(1);
        next();
      },
      (req, res, next) => {
        order.push(2);
        next();
      },
      (req, res) => {
        order.push(3);
        res.json({ order });
      }
    );

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({ order: [1, 2, 3] });
  });

  test("app.use() without path works like Express", async () => {
    const app = bunway();
    let called = false;

    app.use((req, res, next) => {
      called = true;
      next();
    });
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));
    expect(called).toBe(true);
    expect(response.status).toBe(200);
  });

  test("app.use(path, handler) works like Express", async () => {
    const app = bunway();
    const router = new Router();
    let apiCalled = false;

    router.use((req, res, next) => {
      apiCalled = true;
      next();
    });
    router.get("/test", (req, res) => res.json({ ok: true }));

    app.use("/api", router);
    app.get("/other", (req, res) => res.json({ ok: false }));

    await app.handle(buildRequest("/api/test"));
    expect(apiCalled).toBe(true);

    apiCalled = false;
    await app.handle(buildRequest("/other"));
    expect(apiCalled).toBe(false);
  });

  test("404 on unmatched route like Express", async () => {
    const app = bunway();
    app.get("/exists", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/does-not-exist"));
    expect(response.status).toBe(404);
  });
});
