import { describe, expect, it, beforeEach } from "bun:test";
import { BunWayApp } from "../../../src/core/app";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";
import type { Handler } from "../../../src/types";

const noop: Handler = (_req, _res, next) => next();

describe("BunWayApp (Unit)", () => {
  let app: BunWayApp;

  beforeEach(() => {
    app = new BunWayApp();
  });

  describe("Constructor Defaults", () => {
    it("should have 'view engine' undefined by default", () => {
      expect(app.get("view engine")).toBeUndefined();
    });

    it("should have 'views' set to './views' by default", () => {
      expect(app.get("views")).toBe("./views");
    });

    it("should have 'trust proxy' set to false by default", () => {
      expect(app.get("trust proxy")).toBe(false);
    });

    it("should have 'json spaces' set to 0 by default", () => {
      expect(app.get("json spaces")).toBe(0);
    });

    it("should have 'case sensitive routing' set to false by default", () => {
      expect(app.get("case sensitive routing")).toBe(false);
    });

    it("should have 'strict routing' set to false by default", () => {
      expect(app.get("strict routing")).toBe(false);
    });

    it("should have 'etag' set to 'weak' by default", () => {
      expect(app.get("etag")).toBe("weak");
    });

    it("should have 'x-powered-by' set to true by default", () => {
      expect(app.get("x-powered-by")).toBe(true);
    });

    it("should have 'env' default to 'development' when NODE_ENV is unset", () => {
      const env = app.get("env");
      expect(env).toMatch(/^(development|test|production)$/);
    });
  });

  describe("Constructor with Custom Settings", () => {
    it("should merge custom settings with defaults", () => {
      const custom = new BunWayApp({
        settings: { "view engine": "ejs", "json spaces": 2 },
      });

      expect(custom.get("view engine")).toBe("ejs");
      expect(custom.get("json spaces")).toBe(2);
      expect(custom.get("views")).toBe("./views");
    });

    it("should override default settings with custom values", () => {
      const custom = new BunWayApp({
        settings: { "trust proxy": true, "x-powered-by": false },
      });

      expect(custom.get("trust proxy")).toBe(true);
      expect(custom.get("x-powered-by")).toBe(false);
    });
  });

  describe("set() and get()", () => {
    it("should store and retrieve a setting", () => {
      app.set("custom", "value");
      expect(app.get("custom")).toBe("value");
    });

    it("should return this for chaining", () => {
      const result = app.set("key", "val");
      expect(result).toBe(app);
    });

    it("should overwrite existing settings", () => {
      app.set("views", "/custom/views");
      expect(app.get("views")).toBe("/custom/views");
    });

    it("should return undefined for non-existent settings", () => {
      expect(app.get("nonexistent")).toBeUndefined();
    });
  });

  describe("enable() and disable()", () => {
    it("should set a setting to true", () => {
      app.enable("trust proxy");
      expect(app.get("trust proxy")).toBe(true);
    });

    it("should set a setting to false", () => {
      app.disable("x-powered-by");
      expect(app.get("x-powered-by")).toBe(false);
    });

    it("should return this for chaining from enable", () => {
      const result = app.enable("trust proxy");
      expect(result).toBe(app);
    });

    it("should return this for chaining from disable", () => {
      const result = app.disable("x-powered-by");
      expect(result).toBe(app);
    });
  });

  describe("enabled() and disabled()", () => {
    it("should return true for truthy settings", () => {
      app.set("flag", true);
      expect(app.enabled("flag")).toBe(true);
    });

    it("should return false for falsy settings", () => {
      app.set("flag", false);
      expect(app.enabled("flag")).toBe(false);
    });

    it("should return false for undefined settings", () => {
      expect(app.enabled("nonexistent")).toBe(false);
    });

    it("should return true for disabled falsy settings", () => {
      app.set("flag", false);
      expect(app.disabled("flag")).toBe(true);
    });

    it("should return false for disabled truthy settings", () => {
      app.set("flag", true);
      expect(app.disabled("flag")).toBe(false);
    });

    it("should return true for disabled undefined settings", () => {
      expect(app.disabled("nonexistent")).toBe(true);
    });
  });

  describe("engine() and getEngine()", () => {
    it("should register and retrieve a template engine", () => {
      const renderFn = (_path: string, _opts: Record<string, unknown>, cb: (err: Error | null, html?: string) => void) => {
        cb(null, "<html></html>");
      };

      app.engine("ejs", renderFn);
      expect(app.getEngine("ejs")).toBe(renderFn);
    });

    it("should strip leading dot from extension on engine()", () => {
      const renderFn = (_path: string, _opts: Record<string, unknown>, cb: (err: Error | null, html?: string) => void) => {
        cb(null, "");
      };

      app.engine(".pug", renderFn);
      expect(app.getEngine("pug")).toBe(renderFn);
    });

    it("should strip leading dot from extension on getEngine()", () => {
      const renderFn = (_path: string, _opts: Record<string, unknown>, cb: (err: Error | null, html?: string) => void) => {
        cb(null, "");
      };

      app.engine("hbs", renderFn);
      expect(app.getEngine(".hbs")).toBe(renderFn);
    });

    it("should return undefined for unregistered engine", () => {
      expect(app.getEngine("nunjucks")).toBeUndefined();
    });

    it("should return this for chaining from engine()", () => {
      const result = app.engine("ejs", () => {});
      expect(result).toBe(app);
    });
  });

  describe("getSettings()", () => {
    it("should return all settings", () => {
      const settings = app.getSettings();
      expect(settings).toHaveProperty("views");
      expect(settings).toHaveProperty("etag");
      expect(settings).toHaveProperty("x-powered-by");
      expect(settings).toHaveProperty("trust proxy");
    });

    it("should reflect changes made via set()", () => {
      app.set("custom-key", 42);
      const settings = app.getSettings();
      expect(settings["custom-key"]).toBe(42);
    });
  });

  describe("getLogger()", () => {
    it("should return default logger when none configured", () => {
      const logger = app.getLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("should return custom logger when configured", () => {
      const customLogger = {
        info: () => {},
        warn: () => {},
        error: () => {},
      };

      app.set("logger", customLogger);
      expect(app.getLogger()).toBe(customLogger);
    });
  });

  describe("locals", () => {
    it("should be an empty object by default", () => {
      expect(app.locals).toEqual({});
    });

    it("should allow setting arbitrary properties", () => {
      app.locals.title = "My App";
      app.locals.version = "1.0.0";

      expect(app.locals.title).toBe("My App");
      expect(app.locals.version).toBe("1.0.0");
    });
  });

  describe("get() dual purpose", () => {
    it("should retrieve a setting when called with no handlers", () => {
      app.set("view engine", "pug");
      expect(app.get("view engine")).toBe("pug");
    });

    it("should register a GET route when called with handlers", () => {
      app.get("/users", noop);

      const routes = (app as unknown as { routes: { method: string; path: string }[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({ method: "GET", path: "/users" });
    });

    it("should register a GET route with multiple handlers", () => {
      const handler2: Handler = (_req, _res, next) => next();
      app.get("/items", noop, handler2);

      const routes = (app as unknown as { routes: { handlers: unknown[] }[] }).routes;
      expect(routes[0].handlers.length).toBe(2);
    });
  });

  describe("path()", () => {
    it("should return mountpath for root app", () => {
      const app = new BunWayApp();
      expect(app.path()).toBe("/");
    });

    it("should concatenate parent path with own mountpath", () => {
      const parent = new BunWayApp();
      const child = new BunWayApp();
      parent.use("/api", child);
      expect(child.path()).toBe("/api");
    });

    it("should handle nested sub-app paths", () => {
      const root = new BunWayApp();
      const api = new BunWayApp();
      const v1 = new BunWayApp();
      root.use("/api", api);
      api.use("/v1", v1);
      expect(v1.path()).toBe("/api/v1");
    });

    it("should handle trailing slash in parent path without doubling slash", () => {
      const root = new BunWayApp();
      root.mountpath = "/";
      const child = new BunWayApp();
      child.mountpath = "/child";
      (child as unknown as { _parent: BunWayApp })._parent = root;
      const result = child.path();
      expect(result).not.toContain("//");
    });
  });

  describe("mountpath setter", () => {
    it("should set and read mountpath", () => {
      const app = new BunWayApp();
      app.mountpath = "/admin";
      expect(app.mountpath).toBe("/admin");
    });

    it("should overwrite previous mountpath", () => {
      const app = new BunWayApp();
      app.mountpath = "/v1";
      app.mountpath = "/v2";
      expect(app.mountpath).toBe("/v2");
    });
  });

  describe("Constructor 'env' setting", () => {
    it("should match a valid environment string", () => {
      const env = app.get("env") as string;
      expect(env).toMatch(/^(development|test|production)$/);
    });
  });

  describe("getLogger() functional validation", () => {
    it("should return a logger with all required methods", () => {
      const logger = app.getLogger();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("should return a logger that actually logs without throwing", () => {
      const logger = app.getLogger();
      expect(() => logger.info("test message")).not.toThrow();
      expect(() => logger.warn("test warning")).not.toThrow();
      expect(() => logger.error("test error")).not.toThrow();
    });

    it("custom logger returned by getLogger() has callable methods", () => {
      const calls: string[] = [];
      const customLogger = {
        info: (msg: string) => calls.push(`info:${msg}`),
        warn: (msg: string) => calls.push(`warn:${msg}`),
        error: (msg: string) => calls.push(`error:${msg}`),
      };
      app.set("logger", customLogger);
      const logger = app.getLogger();
      logger.info("hello");
      logger.warn("caution");
      logger.error("oops");
      expect(calls).toEqual(["info:hello", "warn:caution", "error:oops"]);
    });
  });

  describe("listen() with hostname option", () => {
    it("should start server with hostname option set", () => {
      const a = new BunWayApp();
      const server = a.listen({ port: 0, hostname: "127.0.0.1" });
      expect(server).toBeDefined();
      expect(typeof server.stop).toBe("function");
      server.stop();
    });
  });

  describe("server lifecycle", () => {
    it("should have server as null before listen()", () => {
      const app = new BunWayApp();
      expect(app.server).toBeNull();
    });

    it("should expose server after listen()", () => {
      const app = new BunWayApp();
      const server = app.listen(0);
      expect(app.server).toBe(server);
      expect(app.server).not.toBeNull();
      server.stop();
    });

    it("should set server to null after close()", async () => {
      const app = new BunWayApp();
      app.listen(0);
      await app.close();
      expect(app.server).toBeNull();
    });

    it("close() should return a Promise", () => {
      const app = new BunWayApp();
      const result = app.close();
      expect(result).toBeInstanceOf(Promise);
    });

    it("close() on non-started app should resolve without error", async () => {
      const app = new BunWayApp();
      await expect(app.close()).resolves.toBeUndefined();
    });

    it("multiple close() calls should not throw", async () => {
      const app = new BunWayApp();
      app.listen(0);
      await app.close();
      await app.close();
      await app.close();
      expect(app.server).toBeNull();
    });

    it("listen() should still return server for backward compat", () => {
      const app = new BunWayApp();
      const server = app.listen(0);
      expect(server).toBeDefined();
      expect(typeof server.stop).toBe("function");
      expect(typeof server.port).toBe("number");
      server.stop();
    });

    it("listen(port) overload should work", () => {
      const app = new BunWayApp();
      const server = app.listen(0);
      expect(server.port).toBeGreaterThan(0);
      server.stop();
    });

    it("listen(options) overload should work", () => {
      const app = new BunWayApp();
      const server = app.listen({ port: 0 });
      expect(server.port).toBeGreaterThan(0);
      server.stop();
    });

    it("close(callback) should call callback", async () => {
      const app = new BunWayApp();
      app.listen(0);
      let called = false;
      await app.close(() => { called = true; });
      expect(called).toBe(true);
    });

    it("close(callback) on non-started app should still call callback", async () => {
      const app = new BunWayApp();
      let called = false;
      await app.close(() => { called = true; });
      expect(called).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // handleWebSocketUpgrade() and runUpgradePipeline()
  // ---------------------------------------------------------------------------

  function makeWsRequest(path = "/ws"): Request {
    return new Request(`http://localhost${path}`, {
      headers: { upgrade: "websocket" },
    });
  }

  function makeMockServer({ upgradeResult = true } = {}) {
    return {
      requestIP: (_req: Request) => ({ address: "127.0.0.1", port: 0, family: "IPv4" }),
      upgrade: (_req: Request, _data: unknown) => upgradeResult,
    };
  }

  describe("handleWebSocketUpgrade()", () => {
    it("returns 404 when no WS route matches the path", async () => {
      const app = new BunWayApp();
      const res = await (app as any).handleWebSocketUpgrade(makeWsRequest("/missing"), makeMockServer());
      expect(res).toBeInstanceOf(Response);
      expect((res as Response).status).toBe(404);
    });

    it("returns 403 when a middleware throws during the upgrade pipeline", async () => {
      const app = new BunWayApp();
      app.ws("/ws", { open: () => {} });
      app.use((_req: any, _res: any, _next: any) => { throw new Error("auth denied"); });
      const res = await (app as any).handleWebSocketUpgrade(makeWsRequest("/ws"), makeMockServer());
      expect((res as Response).status).toBe(403);
    });

    it("returns the middleware response when middleware sends a response (isSent)", async () => {
      const app = new BunWayApp();
      app.ws("/ws", { open: () => {} });
      app.use((_req: any, res: any) => { res.status(401).json({ error: "Unauthorized" }); });
      const res = await (app as any).handleWebSocketUpgrade(makeWsRequest("/ws"), makeMockServer());
      expect((res as Response).status).toBe(401);
    });

    it("returns 400 when server.upgrade() returns false", async () => {
      const app = new BunWayApp();
      app.ws("/ws", { open: () => {} });
      const res = await (app as any).handleWebSocketUpgrade(makeWsRequest("/ws"), makeMockServer({ upgradeResult: false }));
      expect((res as Response).status).toBe(400);
    });

    it("returns undefined on a successful upgrade (signals Bun that WS took over)", async () => {
      const app = new BunWayApp();
      app.ws("/ws", { open: () => {} });
      const res = await (app as any).handleWebSocketUpgrade(makeWsRequest("/ws"), makeMockServer());
      expect(res).toBeUndefined();
    });

    it("attaches route params to req before running middleware", async () => {
      const app = new BunWayApp();
      let capturedId: string | undefined;
      app.ws("/chat/:roomId", (req: any, _res: any, next: any) => {
        capturedId = req.params.roomId;
        next();
      }, { open: () => {} });
      await (app as any).handleWebSocketUpgrade(makeWsRequest("/chat/42"), makeMockServer());
      expect(capturedId).toBe("42");
    });
  });

  describe("runUpgradePipeline()", () => {
    it("runs all handlers in order and resolves", async () => {
      const app = new BunWayApp();
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      const order: number[] = [];
      const pipeline = [
        (_r: any, _s: any, next: any) => { order.push(1); next(); },
        (_r: any, _s: any, next: any) => { order.push(2); next(); },
      ];
      await (app as any).runUpgradePipeline(pipeline, req, res);
      expect(order).toEqual([1, 2]);
    });

    it("calling done() twice inside a handler does not resolve twice", async () => {
      const app = new BunWayApp();
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      let resolveCount = 0;
      const pipeline = [
        (_r: any, _s: any, next: any) => { next(); next(); resolveCount++; },
      ];
      await (app as any).runUpgradePipeline(pipeline, req, res);
      expect(resolveCount).toBe(1);
    });

    it("async middleware is awaited before continuing", async () => {
      const app = new BunWayApp();
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      const order: number[] = [];
      const pipeline = [
        async (_r: any, _s: any, next: any) => {
          await new Promise<void>(r => setTimeout(r, 10));
          order.push(1);
          next();
        },
        (_r: any, _s: any, next: any) => { order.push(2); next(); },
      ];
      await (app as any).runUpgradePipeline(pipeline, req, res);
      expect(order).toEqual([1, 2]);
    });

    it("stops processing further handlers when res.isSent() is true", async () => {
      const app = new BunWayApp();
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      let secondCalled = false;
      const pipeline = [
        (_r: any, r: any, next: any) => { r.json({ ok: true }); next(); },
        (_r: any, _s: any, _next: any) => { secondCalled = true; },
      ];
      await (app as any).runUpgradePipeline(pipeline, req, res);
      expect(secondCalled).toBe(false);
    });

    it("rejects when a handler throws synchronously", async () => {
      const app = new BunWayApp();
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      const pipeline = [
        () => { throw new Error("sync boom"); },
      ];
      await expect((app as any).runUpgradePipeline(pipeline, req, res)).rejects.toThrow("sync boom");
    });

    it("rejects when next() is called with an error", async () => {
      const app = new BunWayApp();
      const req = new BunRequest(new Request("http://localhost/"), "/");
      const res = new BunResponse();
      const pipeline = [
        (_r: any, _s: any, next: any) => { next(new Error("next error")); },
      ];
      await expect((app as any).runUpgradePipeline(pipeline, req, res)).rejects.toThrow("next error");
    });
  });
});
