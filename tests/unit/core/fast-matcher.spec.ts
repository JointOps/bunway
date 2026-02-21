import { describe, expect, it, beforeEach } from "bun:test";
import { FastMatcher } from "../../../src/core/fast-matcher";
import type { Handler } from "../../../src/types";

const noop: Handler = (_req, _res, next) => next();
const handler1: Handler = (_req, _res, next) => next();
const handler2: Handler = (_req, _res, next) => next();

describe("FastMatcher (Unit)", () => {
  let matcher: FastMatcher;

  beforeEach(() => {
    matcher = new FastMatcher();
  });

  describe("Static route matching", () => {
    it("matches exact static path", () => {
      matcher.add("GET", "/users", [noop]);
      const result = matcher.match("GET", "/users");
      expect(result).not.toBeNull();
      expect(result!.path).toBe("/users");
      expect(result!.params).toEqual({});
      expect(result!.keys).toEqual([]);
    });

    it("returns null for unregistered path", () => {
      matcher.add("GET", "/users", [noop]);
      expect(matcher.match("GET", "/posts")).toBeNull();
    });

    it("returns null for wrong method", () => {
      matcher.add("GET", "/users", [noop]);
      expect(matcher.match("POST", "/users")).toBeNull();
    });

    it("matches root path", () => {
      matcher.add("GET", "/", [noop]);
      expect(matcher.match("GET", "/")).not.toBeNull();
    });

    it("accumulates handlers on same static path", () => {
      matcher.add("GET", "/users", [handler1]);
      matcher.add("GET", "/users", [handler2]);
      const result = matcher.match("GET", "/users");
      expect(result).not.toBeNull();
      expect(result!.handlers.length).toBe(2);
    });

    it("separates handlers by method", () => {
      matcher.add("GET", "/users", [handler1]);
      matcher.add("POST", "/users", [handler2]);
      const getResult = matcher.match("GET", "/users");
      const postResult = matcher.match("POST", "/users");
      expect(getResult!.handlers.length).toBe(1);
      expect(postResult!.handlers.length).toBe(1);
      expect(getResult!.handlers[0]).toBe(handler1);
      expect(postResult!.handlers[0]).toBe(handler2);
    });

    it("matches multiple different static paths", () => {
      matcher.add("GET", "/users", [handler1]);
      matcher.add("GET", "/posts", [handler2]);
      expect(matcher.match("GET", "/users")!.handlers[0]).toBe(handler1);
      expect(matcher.match("GET", "/posts")!.handlers[0]).toBe(handler2);
    });

    it("matches deeply nested static path", () => {
      matcher.add("GET", "/api/v1/users/list", [noop]);
      expect(matcher.match("GET", "/api/v1/users/list")).not.toBeNull();
      expect(matcher.match("GET", "/api/v1/users")).toBeNull();
    });
  });

  describe("Dynamic route matching", () => {
    it("matches named parameter", () => {
      matcher.add("GET", "/users/:id", [noop]);
      const result = matcher.match("GET", "/users/123");
      expect(result).not.toBeNull();
      expect(result!.params).toEqual({ id: "123" });
      expect(result!.keys).toEqual(["id"]);
    });

    it("matches multiple named parameters", () => {
      matcher.add("GET", "/users/:userId/posts/:postId", [noop]);
      const result = matcher.match("GET", "/users/42/posts/99");
      expect(result).not.toBeNull();
      expect(result!.params).toEqual({ userId: "42", postId: "99" });
    });

    it("returns null when dynamic path does not match", () => {
      matcher.add("GET", "/users/:id", [noop]);
      expect(matcher.match("GET", "/posts/123")).toBeNull();
    });

    it("does not match extra path segments", () => {
      matcher.add("GET", "/users/:id", [noop]);
      expect(matcher.match("GET", "/users/123/extra")).toBeNull();
    });

    it("matches wildcard parameter", () => {
      matcher.add("GET", "/files/*", [noop]);
      const result = matcher.match("GET", "/files/path/to/file.txt");
      expect(result).not.toBeNull();
      expect(result!.params["0"]).toBe("path/to/file.txt");
    });

    it("matches named wildcard parameter", () => {
      matcher.add("GET", "/files/*path", [noop]);
      const result = matcher.match("GET", "/files/a/b/c");
      expect(result).not.toBeNull();
      expect(result!.params.path).toBe("a/b/c");
    });

    it("matches optional parameter when present", () => {
      matcher.add("GET", "/users/:id?", [noop]);
      const result = matcher.match("GET", "/users/123");
      expect(result).not.toBeNull();
      expect(result!.params.id).toBe("123");
    });

    it("matches optional parameter when absent", () => {
      matcher.add("GET", "/users/:id?", [noop]);
      const result = matcher.match("GET", "/users");
      expect(result).not.toBeNull();
      expect(result!.params.id).toBeUndefined();
    });

    it("matches first registered dynamic route", () => {
      matcher.add("GET", "/users/:id", [handler1]);
      matcher.add("GET", "/users/:name", [handler2]);
      const result = matcher.match("GET", "/users/test");
      expect(result).not.toBeNull();
      expect(result!.handlers[0]).toBe(handler1);
    });

    it("handles URL-encoded parameter values", () => {
      matcher.add("GET", "/search/:query", [noop]);
      const result = matcher.match("GET", "/search/hello%20world");
      expect(result).not.toBeNull();
      expect(result!.params.query).toBe("hello%20world");
    });
  });

  describe("ALL method fallback", () => {
    it("ALL route matches any method", () => {
      matcher.add("ALL", "/health", [noop]);
      expect(matcher.match("GET", "/health")).not.toBeNull();
      expect(matcher.match("POST", "/health")).not.toBeNull();
      expect(matcher.match("DELETE", "/health")).not.toBeNull();
    });

    it("specific method takes priority over ALL for static", () => {
      matcher.add("ALL", "/health", [handler1]);
      matcher.add("GET", "/health", [handler2]);
      const result = matcher.match("GET", "/health");
      expect(result).not.toBeNull();
      expect(result!.handlers[0]).toBe(handler2);
    });

    it("ALL dynamic route matches any method", () => {
      matcher.add("ALL", "/items/:id", [noop]);
      const result = matcher.match("PUT", "/items/5");
      expect(result).not.toBeNull();
      expect(result!.params.id).toBe("5");
    });
  });

  describe("getMatchingMethods()", () => {
    it("returns methods for static routes", () => {
      matcher.add("GET", "/users", [noop]);
      matcher.add("POST", "/users", [noop]);
      const methods = matcher.getMatchingMethods("/users");
      expect(methods).toContain("GET");
      expect(methods).toContain("POST");
      expect(methods.length).toBe(2);
    });

    it("returns empty array for unmatched path", () => {
      matcher.add("GET", "/users", [noop]);
      expect(matcher.getMatchingMethods("/posts")).toEqual([]);
    });

    it("includes methods from dynamic routes", () => {
      matcher.add("GET", "/users/:id", [noop]);
      matcher.add("PUT", "/users/:id", [noop]);
      const methods = matcher.getMatchingMethods("/users/123");
      expect(methods).toContain("GET");
      expect(methods).toContain("PUT");
    });

    it("does not duplicate methods", () => {
      matcher.add("GET", "/users", [noop]);
      matcher.add("GET", "/users/:id", [noop]);
      const methods = matcher.getMatchingMethods("/users");
      const getCount = methods.filter((m) => m === "GET").length;
      expect(getCount).toBe(1);
    });
  });

  describe("hasRoutes()", () => {
    it("returns false when no routes", () => {
      expect(matcher.hasRoutes()).toBe(false);
    });

    it("returns true after adding static route", () => {
      matcher.add("GET", "/test", [noop]);
      expect(matcher.hasRoutes()).toBe(true);
    });

    it("returns true after adding dynamic route", () => {
      matcher.add("GET", "/test/:id", [noop]);
      expect(matcher.hasRoutes()).toBe(true);
    });
  });

  describe("clear()", () => {
    it("removes all routes", () => {
      matcher.add("GET", "/users", [noop]);
      matcher.add("POST", "/users/:id", [noop]);
      matcher.clear();
      expect(matcher.hasRoutes()).toBe(false);
      expect(matcher.match("GET", "/users")).toBeNull();
    });
  });

  describe("Path classification", () => {
    it("treats paths without : or * as static", () => {
      matcher.add("GET", "/api/v1/users", [noop]);
      expect(matcher.match("GET", "/api/v1/users")).not.toBeNull();
    });

    it("treats paths with : as dynamic", () => {
      matcher.add("GET", "/users/:id", [noop]);
      expect(matcher.match("GET", "/users/42")).not.toBeNull();
    });

    it("treats paths with * as dynamic", () => {
      matcher.add("GET", "/files/*", [noop]);
      expect(matcher.match("GET", "/files/anything")).not.toBeNull();
    });
  });

  describe("Regex compilation", () => {
    it("compiles lazily on first match", () => {
      matcher.add("GET", "/users/:id", [noop]);
      matcher.add("GET", "/posts/:id", [noop]);
      expect(matcher.match("GET", "/users/1")).not.toBeNull();
      expect(matcher.match("GET", "/posts/2")).not.toBeNull();
    });

    it("rebuilds after new route added", () => {
      matcher.add("GET", "/users/:id", [noop]);
      expect(matcher.match("GET", "/users/1")).not.toBeNull();

      matcher.add("GET", "/posts/:id", [noop]);
      expect(matcher.match("GET", "/posts/1")).not.toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("handles special regex characters in static paths", () => {
      matcher.add("GET", "/api/v1.0/health", [noop]);
      expect(matcher.match("GET", "/api/v1.0/health")).not.toBeNull();
    });

    it("handles path with dots in dynamic segments", () => {
      matcher.add("GET", "/files/:name", [noop]);
      const result = matcher.match("GET", "/files/readme.md");
      expect(result).not.toBeNull();
      expect(result!.params.name).toBe("readme.md");
    });

    it("handles numeric parameter values", () => {
      matcher.add("GET", "/page/:num", [noop]);
      const result = matcher.match("GET", "/page/42");
      expect(result!.params.num).toBe("42");
    });

    it("handles empty parameter value", () => {
      matcher.add("GET", "/users/:id", [noop]);
      expect(matcher.match("GET", "/users/")).toBeNull();
    });

    it("handles many routes efficiently", () => {
      for (let i = 0; i < 100; i++) {
        matcher.add("GET", `/route${i}/:id`, [noop]);
      }
      const result = matcher.match("GET", "/route50/test");
      expect(result).not.toBeNull();
      expect(result!.params.id).toBe("test");
    });
  });
});
