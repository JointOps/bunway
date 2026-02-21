import { describe, expect, it, beforeEach } from "bun:test";
import { Route } from "../../../src/core/route";
import { Router } from "../../../src/core/router";
import type { Handler } from "../../../src/types";

const noop: Handler = (_req, _res, next) => next();

describe("Route (Unit)", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  describe("HTTP Method Delegation", () => {
    it("should delegate get() to router", () => {
      const route = new Route("/users", router);
      route.get(noop);

      const routes = (router as unknown as { routes: { method: string; path: string }[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({ method: "GET", path: "/users" });
    });

    it("should delegate post() to router", () => {
      const route = new Route("/users", router);
      route.post(noop);

      const routes = (router as unknown as { routes: { method: string; path: string }[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({ method: "POST", path: "/users" });
    });

    it("should delegate put() to router", () => {
      const route = new Route("/users/:id", router);
      route.put(noop);

      const routes = (router as unknown as { routes: { method: string; path: string }[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({ method: "PUT", path: "/users/:id" });
    });

    it("should delegate delete() to router", () => {
      const route = new Route("/users/:id", router);
      route.delete(noop);

      const routes = (router as unknown as { routes: { method: string; path: string }[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({ method: "DELETE", path: "/users/:id" });
    });

    it("should delegate patch() to router", () => {
      const route = new Route("/users/:id", router);
      route.patch(noop);

      const routes = (router as unknown as { routes: { method: string; path: string }[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({ method: "PATCH", path: "/users/:id" });
    });

    it("should delegate options() to router", () => {
      const route = new Route("/users", router);
      route.options(noop);

      const routes = (router as unknown as { routes: { method: string; path: string }[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({ method: "OPTIONS", path: "/users" });
    });

    it("should delegate head() to router", () => {
      const route = new Route("/users", router);
      route.head(noop);

      const routes = (router as unknown as { routes: { method: string; path: string }[] }).routes;
      expect(routes.length).toBe(1);
      expect(routes[0]).toMatchObject({ method: "HEAD", path: "/users" });
    });

    it("should delegate all() to router for all methods", () => {
      const route = new Route("/ping", router);
      route.all(noop);

      const routes = (router as unknown as { routes: { method: string }[] }).routes;
      expect(routes.length).toBe(7);
    });
  });

  describe("Chaining", () => {
    it("should return this from each method for chaining", () => {
      const route = new Route("/users", router);

      const result = route
        .get(noop)
        .post(noop)
        .put(noop)
        .delete(noop)
        .patch(noop)
        .options(noop)
        .head(noop);

      expect(result).toBe(route);
    });

    it("should register all chained routes on the same path", () => {
      const route = new Route("/items", router);
      route.get(noop).post(noop).delete(noop);

      const routes = (router as unknown as { routes: { method: string; path: string }[] }).routes;
      expect(routes.length).toBe(3);

      for (const r of routes) {
        expect(r.path).toBe("/items");
      }

      expect(routes[0].method).toBe("GET");
      expect(routes[1].method).toBe("POST");
      expect(routes[2].method).toBe("DELETE");
    });
  });

  describe("Multiple Handlers", () => {
    it("should pass multiple handlers to the router", () => {
      const handler2: Handler = (_req, _res, next) => next();
      const route = new Route("/protected", router);
      route.get(noop, handler2);

      const routes = (router as unknown as { routes: { handlers: unknown[] }[] }).routes;
      expect(routes[0].handlers.length).toBe(2);
    });
  });
});
