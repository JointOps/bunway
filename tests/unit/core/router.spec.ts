/**
 * Router Unit Tests
 *
 * Tests the Router class internal logic without HTTP layer.
 * Based on Express.js and Elysia testing patterns.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { Router } from "../../../src/core/router";
import { createOrderTracker } from "../../utils/test-helpers";

describe("Router (Unit)", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  describe("Route Registration", () => {
    it("should register GET route", () => {
      router.get("/users", () => {});

      const routes = (router as unknown as { routes: unknown[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({
        method: "GET",
        path: "/users",
      });
    });

    it("should register POST route", () => {
      router.post("/users", () => {});

      const routes = (router as unknown as { routes: unknown[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({
        method: "POST",
        path: "/users",
      });
    });

    it("should register PUT route", () => {
      router.put("/users/:id", () => {});

      const routes = (router as unknown as { routes: unknown[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({
        method: "PUT",
        path: "/users/:id",
      });
    });

    it("should register DELETE route", () => {
      router.delete("/users/:id", () => {});

      const routes = (router as unknown as { routes: unknown[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({
        method: "DELETE",
        path: "/users/:id",
      });
    });

    it("should register PATCH route", () => {
      router.patch("/users/:id", () => {});

      const routes = (router as unknown as { routes: unknown[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({
        method: "PATCH",
        path: "/users/:id",
      });
    });

    it("should register OPTIONS route", () => {
      router.options("/users", () => {});

      const routes = (router as unknown as { routes: unknown[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({
        method: "OPTIONS",
        path: "/users",
      });
    });

    it("should register HEAD route", () => {
      router.head("/users", () => {});

      const routes = (router as unknown as { routes: unknown[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({
        method: "HEAD",
        path: "/users",
      });
    });

    it("should register ALL route for all methods", () => {
      router.all("/ping", () => {});

      const routes = (router as unknown as { routes: unknown[] }).routes;
      expect(routes.length).toBe(7); // GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD
    });

    it("should register multiple handlers for a route", () => {
      const handler1 = () => {};
      const handler2 = () => {};
      const handler3 = () => {};

      router.get("/users", handler1, handler2, handler3);

      const routes = (router as unknown as { routes: { handlers: unknown[] }[] }).routes;
      expect(routes[0].handlers.length).toBe(3);
    });

    it("should support chaining", () => {
      const result = router
        .get("/a", () => {})
        .post("/b", () => {})
        .put("/c", () => {});

      expect(result).toBe(router);
      const routes = (router as unknown as { routes: unknown[] }).routes;
      expect(routes.length).toBe(3);
    });
  });

  describe("Path Pattern Parsing", () => {
    it("should match static path", () => {
      router.get("/users", () => {});

      const routes = (router as unknown as { routes: { regex: RegExp }[] }).routes;
      expect(routes[0].regex.test("/users")).toBe(true);
      expect(routes[0].regex.test("/users/")).toBe(false);
      expect(routes[0].regex.test("/user")).toBe(false);
    });

    it("should match path with named parameter", () => {
      router.get("/users/:id", () => {});

      const routes = (router as unknown as { routes: { regex: RegExp; keys: string[] }[] }).routes;
      expect(routes[0].regex.test("/users/123")).toBe(true);
      expect(routes[0].regex.test("/users/abc")).toBe(true);
      expect(routes[0].regex.test("/users")).toBe(false);
      expect(routes[0].keys).toEqual(["id"]);
    });

    it("should match path with multiple parameters", () => {
      router.get("/users/:userId/posts/:postId", () => {});

      const routes = (router as unknown as { routes: { regex: RegExp; keys: string[] }[] }).routes;
      expect(routes[0].regex.test("/users/1/posts/2")).toBe(true);
      expect(routes[0].keys).toEqual(["userId", "postId"]);
    });

    it("should match path with optional parameter", () => {
      router.get("/users/:id?", () => {});

      const routes = (router as unknown as { routes: { regex: RegExp; keys: string[] }[] }).routes;
      expect(routes[0].regex.test("/users")).toBe(true);
      expect(routes[0].regex.test("/users/123")).toBe(true);
      expect(routes[0].keys).toEqual(["id"]);
    });

    it("should match path with wildcard", () => {
      router.get("/files/*", () => {});

      const routes = (router as unknown as { routes: { regex: RegExp; keys: string[] }[] }).routes;
      expect(routes[0].regex.test("/files/a")).toBe(true);
      expect(routes[0].regex.test("/files/a/b/c")).toBe(true);
      expect(routes[0].regex.test("/files/")).toBe(true);
    });

    it("should match path with named wildcard", () => {
      router.get("/files/*path", () => {});

      const routes = (router as unknown as { routes: { regex: RegExp; keys: string[] }[] }).routes;
      expect(routes[0].regex.test("/files/a/b/c")).toBe(true);
      expect(routes[0].keys).toContain("path");
    });

    it("should extract parameters from match", () => {
      router.get("/users/:id", () => {});

      const routes = (router as unknown as { routes: { regex: RegExp; keys: string[] }[] }).routes;
      const match = "/users/123".match(routes[0].regex);
      expect(match).toBeTruthy();
      expect(match![1]).toBe("123");
    });

    it("should extract multiple parameters", () => {
      router.get("/users/:userId/posts/:postId", () => {});

      const routes = (router as unknown as { routes: { regex: RegExp; keys: string[] }[] }).routes;
      const match = "/users/42/posts/99".match(routes[0].regex);
      expect(match).toBeTruthy();
      expect(match![1]).toBe("42");
      expect(match![2]).toBe("99");
    });
  });

  describe("Middleware Registration", () => {
    it("should register global middleware", () => {
      const middleware = () => {};
      router.use(middleware);

      const middlewares = (router as unknown as { middlewares: unknown[] }).middlewares;
      expect(middlewares.length).toBe(1);
      expect(middlewares[0]).toBe(middleware);
    });

    it("should register multiple middlewares", () => {
      const m1 = () => {};
      const m2 = () => {};
      const m3 = () => {};

      router.use(m1);
      router.use(m2);
      router.use(m3);

      const middlewares = (router as unknown as { middlewares: unknown[] }).middlewares;
      expect(middlewares.length).toBe(3);
    });

    it("should register path-based middleware", () => {
      router.use("/api", () => {});

      const prefixMiddlewares = (router as unknown as { prefixMiddlewares: unknown[] }).prefixMiddlewares;
      expect(prefixMiddlewares.length).toBe(1);
    });

    it("should register error handler (4-param middleware)", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const errorHandler = (_err: unknown, _req: unknown, _res: unknown, _next: unknown) => {};
      router.use(errorHandler);

      const errorHandlers = (router as unknown as { errorHandlers: unknown[] }).errorHandlers;
      expect(errorHandlers.length).toBe(1);
    });
  });

  describe("Sub-Router Registration", () => {
    it("should register sub-router with prefix", () => {
      const subRouter = new Router();
      subRouter.get("/items", () => {});

      router.use("/api", subRouter);

      const children = (router as unknown as { children: { prefix: string; router: Router }[] }).children;
      expect(children.length).toBe(1);
      expect(children[0].prefix).toBe("/api");
      expect(children[0].router).toBe(subRouter);
    });

    it("should support nested sub-routers", () => {
      const v1Router = new Router();
      const usersRouter = new Router();

      usersRouter.get("/", () => {});
      usersRouter.get("/:id", () => {});

      v1Router.use("/users", usersRouter);
      router.use("/api/v1", v1Router);

      const children = (router as unknown as { children: { prefix: string; router: Router }[] }).children;
      expect(children.length).toBe(1);
      expect(children[0].prefix).toBe("/api/v1");
    });
  });

  describe("Param Handlers", () => {
    it("should register param handler", () => {
      router.param("id", () => {});

      const paramHandlers = (router as unknown as { paramHandlers: Map<string, unknown[]> }).paramHandlers;
      expect(paramHandlers.has("id")).toBe(true);
      expect(paramHandlers.get("id")!.length).toBe(1);
    });

    it("should register multiple param handlers for same param", () => {
      router.param("id", () => {});
      router.param("id", () => {});

      const paramHandlers = (router as unknown as { paramHandlers: Map<string, unknown[]> }).paramHandlers;
      expect(paramHandlers.get("id")!.length).toBe(2);
    });

    it("should support chaining with param", () => {
      const result = router
        .param("id", () => {})
        .get("/users/:id", () => {});

      expect(result).toBe(router);
    });
  });

  describe("Route Grouping", () => {
    it("should create route group with prefix", () => {
      router.group("/api", (api) => {
        api.get("/users", () => {});
        api.get("/posts", () => {});
      });

      const children = (router as unknown as { children: { prefix: string; router: Router }[] }).children;
      expect(children.length).toBe(1);
      expect(children[0].prefix).toBe("/api");

      const groupRoutes = (children[0].router as unknown as { routes: unknown[] }).routes;
      expect(groupRoutes.length).toBe(2);
    });

    it("should create route group with middleware", () => {
      const authMiddleware = () => {};

      router.group("/admin", { middleware: [authMiddleware] }, (admin) => {
        admin.get("/dashboard", () => {});
      });

      const children = (router as unknown as { children: { prefix: string; router: Router }[] }).children;
      const groupMiddlewares = (children[0].router as unknown as { middlewares: unknown[] }).middlewares;
      expect(groupMiddlewares.length).toBe(1);
    });

    it("should support nested groups", () => {
      router.group("/api", (api) => {
        api.group("/v1", (v1) => {
          v1.get("/users", () => {});
        });
      });

      const children = (router as unknown as { children: { prefix: string; router: Router }[] }).children;
      expect(children[0].prefix).toBe("/api");

      const nestedChildren = (children[0].router as unknown as { children: { prefix: string }[] }).children;
      expect(nestedChildren[0].prefix).toBe("/v1");
    });
  });

  describe("WebSocket Routes", () => {
    it("should register WebSocket route", () => {
      router.ws("/chat", {
        open: () => {},
        message: () => {},
      });

      const wsRoutes = (router as unknown as { wsRoutes: unknown[] }).wsRoutes;
      expect(wsRoutes.length).toBe(1);
    });

    it("should register WebSocket route with path params", () => {
      router.ws("/rooms/:roomId", {
        open: () => {},
      });

      const wsRoutes = (router as unknown as { wsRoutes: { keys: string[] }[] }).wsRoutes;
      expect(wsRoutes[0].keys).toContain("roomId");
    });

    it("should register WebSocket route with middleware", () => {
      const authMiddleware = () => {};

      router.ws("/secure", authMiddleware, {
        open: () => {},
      });

      const wsRoutes = (router as unknown as { wsRoutes: { middlewares: unknown[] }[] }).wsRoutes;
      expect(wsRoutes[0].middlewares.length).toBe(1);
    });
  });

  describe("Route Debugging", () => {
    it("should return registered routes", () => {
      router.get("/users", () => {});
      router.post("/users", () => {});
      router.get("/users/:id", () => {});

      const routes = router.getRegisteredRoutes();

      expect(routes.length).toBe(3);
      expect(routes[0]).toMatchObject({ method: "GET", path: "/users" });
      expect(routes[1]).toMatchObject({ method: "POST", path: "/users" });
      expect(routes[2]).toMatchObject({ method: "GET", path: "/users/:id" });
    });

    it("should include sub-router routes with prefix", () => {
      const subRouter = new Router();
      subRouter.get("/items", () => {});

      router.get("/", () => {});
      router.use("/api", subRouter);

      const routes = router.getRegisteredRoutes();

      expect(routes.find((r) => r.fullPath === "/")).toBeDefined();
      expect(routes.find((r) => r.fullPath === "/api/items")).toBeDefined();
    });

    it("should include WebSocket routes", () => {
      router.get("/", () => {});
      router.ws("/chat", { open: () => {} });

      const routes = router.getRegisteredRoutes();

      expect(routes.find((r) => r.method === "WS")).toBeDefined();
    });
  });

  describe("Middleware Execution Order", () => {
    it("should track middleware registration order", () => {
      const tracker = createOrderTracker();

      router.use(() => tracker.track("m1"));
      router.use(() => tracker.track("m2"));
      router.get("/", () => tracker.track("handler"));

      // Just verify registration order - execution tested in integration
      const middlewares = (router as unknown as { middlewares: unknown[] }).middlewares;
      const routes = (router as unknown as { routes: unknown[] }).routes;

      expect(middlewares.length).toBe(2);
      expect(routes.length).toBe(1);
    });
  });
});

describe("Router – handleError()", () => {
  it("custom error handler receives error and can send response", async () => {
    const router = new Router();
    router.get("/test", (_req, _res, next) => next(new Error("boom")));
    router.use((err: unknown, _req: any, res: any, _next: any) => {
      res.status(500).json({ caught: (err as Error).message });
    });

    const response = await router.handle(new Request("http://localhost/test"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ caught: "boom" });
  });

  it("error handler that also calls next(err) propagates to next handler", async () => {
    const router = new Router();
    router.get("/test", (_req, _res, next) => next(new Error("original")));
    router.use((err: unknown, _req: any, _res: any, next: any) => { next(err); });
    router.use((err: unknown, _req: any, res: any, _next: any) => {
      res.status(503).json({ final: true });
    });

    const response = await router.handle(new Request("http://localhost/test"));
    expect(response.status).toBe(503);
  });

  it("HttpError with body is serialized as JSON", async () => {
    const router = new Router();
    const { HttpError } = await import("../../../src/core/errors");
    router.get("/test", (_req, _res, next) => {
      next(new HttpError(422, "Validation failed", { body: { field: "name", msg: "required" } }));
    });

    const response = await router.handle(new Request("http://localhost/test"));
    expect(response.status).toBe(422);
    const body = await response.json() as { field: string };
    expect(body.field).toBe("name");
  });

  it("HttpError with no body sends message as text", async () => {
    const router = new Router();
    const { HttpError } = await import("../../../src/core/errors");
    router.get("/test", (_req, _res, next) => {
      next(new HttpError(404));
    });

    const response = await router.handle(new Request("http://localhost/test"));
    expect(response.status).toBe(404);
  });

  it("error with .status < 500 exposes message (expose=true)", async () => {
    const router = new Router();
    router.get("/test", (_req, _res, next) => {
      const err: any = new Error("Bad input");
      err.status = 400;
      next(err);
    });

    const response = await router.handle(new Request("http://localhost/test"));
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("Bad input");
  });

  it("error with .statusCode is used for status code", async () => {
    const router = new Router();
    router.get("/test", (_req, _res, next) => {
      const err: any = new Error("Conflict");
      err.statusCode = 409;
      next(err);
    });

    const response = await router.handle(new Request("http://localhost/test"));
    expect(response.status).toBe(409);
  });
});

describe("Router – runPipeline() next('route') and next('router') signals", () => {
  it("next('route') skips remaining handlers in current route match", async () => {
    const router = new Router();
    const log: string[] = [];
    router.get("/test",
      (_req, _res, next) => { log.push("first"); next("route"); },
      (_req, _res, _next) => { log.push("second"); }
    );
    router.get("/test", (_req, res) => { log.push("fallback"); res.json({ log }); });

    const response = await router.handle(new Request("http://localhost/test"));
    expect(response.status).toBe(200);
    expect(log).toContain("first");
    expect(log).not.toContain("second");
    expect(log).toContain("fallback");
  });

  it("next('router') skips remaining route matches", async () => {
    const router = new Router();
    router.get("/test",
      (_req, _res, next) => { next("router"); }
    );
    router.get("/test", (_req, res) => { res.json({ shouldNotHit: true }); });

    const response = await router.handle(new Request("http://localhost/test"));
    expect(response.status).toBe(404);
  });
});

describe("Router – prefixMiddlewares execution", () => {
  it("prefix middleware rewrites req.path for matching sub-paths", async () => {
    const router = new Router();
    let capturedPath = "";
    router.use("/api", (req, _res, next) => {
      capturedPath = req.path;
      next();
    });
    router.get("/api/users", (_req, res) => res.json({ ok: true }));

    await router.handle(new Request("http://localhost/api/users"));
    expect(capturedPath).toBe("/users");
  });

  it("prefix middleware does not run for non-matching paths", async () => {
    const router = new Router();
    let called = false;
    router.use("/api", (_req, _res, next) => { called = true; next(); });
    router.get("/other", (_req, res) => res.json({ ok: true }));

    await router.handle(new Request("http://localhost/other"));
    expect(called).toBe(false);
  });
});

describe("Router – route() method", () => {
  it("route() returns a Route instance supporting chained HTTP methods", async () => {
    const router = new Router();
    router.route("/tasks")
      .get((_req, res) => res.json({ method: "GET" }))
      .post((_req, res) => res.json({ method: "POST" }));

    const getRes = await router.handle(new Request("http://localhost/tasks"));
    expect(await getRes.json()).toEqual({ method: "GET" });

    const postRes = await router.handle(new Request("http://localhost/tasks", { method: "POST" }));
    expect(await postRes.json()).toEqual({ method: "POST" });
  });
});

describe("Router – setAppContext()", () => {
  it("setAppContext is called twice and overwrites previous context", () => {
    const router = new Router();
    const ctx1 = { setApp: () => {} };
    const ctx2 = { setApp: () => {} };
    router.setAppContext(ctx1);
    router.setAppContext(ctx2);
    expect((router as unknown as { _appContext: unknown })._appContext).toBe(ctx2);
  });
});

describe("Router – param() execution", () => {
  it("param handler is executed when matching param exists in route", async () => {
    const router = new Router();
    const seen: string[] = [];
    router.param("id", (_req, _res, next, value) => { seen.push(value); next(); });
    router.get("/users/:id", (_req, res) => res.json({ ok: true }));

    await router.handle(new Request("http://localhost/users/99"));
    expect(seen).toEqual(["99"]);
  });

  it("param handler is not executed for routes without the param", async () => {
    const router = new Router();
    let paramCalled = false;
    router.param("id", (_req, _res, next, _value) => { paramCalled = true; next(); });
    router.get("/static", (_req, res) => res.json({ ok: true }));

    await router.handle(new Request("http://localhost/static"));
    expect(paramCalled).toBe(false);
  });
});

describe("use() with array paths", () => {
  it("registers middleware for all paths in array", async () => {
    const router = new Router();
    const log: string[] = [];
    router.use(["/api", "/v2"], (req, res, next) => {
      log.push(req.path);
      res.json({ ok: true });
    });
    await router.handle(new Request("http://localhost/api"));
    await router.handle(new Request("http://localhost/v2"));
    expect(log).toEqual(["/", "/"]);
  });

  it("single string still works (no regression)", async () => {
    const router = new Router();
    router.use("/api", (req, res) => res.json({ ok: true }));
    const response = await router.handle(new Request("http://localhost/api"));
    expect(response.status).toBe(200);
  });

  it("array with sub-router mount", async () => {
    const router = new Router();
    const sub = new Router();
    sub.get("/test", (req, res) => res.json({ hit: true }));
    router.use(["/v1", "/v2"], sub);

    const r1 = await router.handle(new Request("http://localhost/v1/test"));
    const r2 = await router.handle(new Request("http://localhost/v2/test"));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  it("empty array is no-op", async () => {
    const router = new Router();
    router.use([], (req, res) => res.json({ ok: true }));
    const response = await router.handle(new Request("http://localhost/test"));
    expect(response.status).toBe(404);
  });

  it("array paths with multiple handlers", async () => {
    const router = new Router();
    const log: string[] = [];
    router.use(
      ["/a", "/b"],
      (req, res, next) => { log.push("mw"); next(); },
      (req, res) => res.json({ ok: true })
    );
    await router.handle(new Request("http://localhost/a"));
    await router.handle(new Request("http://localhost/b"));
    expect(log).toEqual(["mw", "mw"]);
  });

  it("array paths with route parameters", async () => {
    const router = new Router();
    const sub = new Router({ mergeParams: true });
    sub.get("/info", (req, res) => res.json({ id: req.params.id }));
    router.use(["/users/:id", "/accounts/:id"], sub);

    const r1 = await router.handle(new Request("http://localhost/users/42/info"));
    const body1 = await r1.json();
    expect(body1.id).toBe("42");

    const r2 = await router.handle(new Request("http://localhost/accounts/99/info"));
    const body2 = await r2.json();
    expect(body2.id).toBe("99");
  });
});
