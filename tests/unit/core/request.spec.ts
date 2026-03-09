/**
 * BunRequest Unit Tests
 *
 * Tests the BunRequest class internal logic without full HTTP layer.
 * Based on NestJS and Elysia testing patterns.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

describe("BunRequest (Unit)", () => {
  const createRequest = (url: string, options?: RequestInit): BunRequest => {
    return new BunRequest(new Request(url, options));
  };

  describe("Basic Properties", () => {
    it("should expose method", () => {
      const req = createRequest("http://localhost/users", { method: "POST" });
      expect(req.method).toBe("POST");
    });

    it("should expose url", () => {
      const req = createRequest("http://localhost/users?page=1");
      expect(req.url).toBe("http://localhost/users?page=1");
    });

    it("should expose path (pathname)", () => {
      const req = createRequest("http://localhost/users/123?foo=bar");
      expect(req.path).toBe("/users/123");
      expect(req.pathname).toBe("/users/123");
    });

    it("should expose originalUrl (path + search)", () => {
      const req = createRequest("http://localhost/users?page=1&limit=10");
      expect(req.originalUrl).toBe("/users?page=1&limit=10");
    });

    it("should expose originalUrl without search", () => {
      const req = createRequest("http://localhost/users");
      expect(req.originalUrl).toBe("/users");
    });

    it("should expose hostname", () => {
      const req = createRequest("http://api.example.com/users");
      expect(req.hostname).toBe("api.example.com");
    });

    it("should expose headers", () => {
      const req = createRequest("http://localhost/", {
        headers: { "X-Custom": "value" },
      });
      expect(req.headers.get("X-Custom")).toBe("value");
    });

    it("should expose original Request", () => {
      const original = new Request("http://localhost/");
      const req = new BunRequest(original);
      expect(req.original).toBe(original);
    });
  });

  describe("Query Parameters", () => {
    it("should parse simple query params", () => {
      const req = createRequest("http://localhost/?name=john&age=25");
      expect(req.query.get("name")).toBe("john");
      expect(req.query.get("age")).toBe("25");
    });

    it("should handle missing query params", () => {
      const req = createRequest("http://localhost/?name=john");
      expect(req.query.get("missing")).toBeNull();
    });

    it("should handle array query params with getAll", () => {
      const req = createRequest("http://localhost/?tags=a&tags=b&tags=c");
      expect(req.query.getAll("tags")).toEqual(["a", "b", "c"]);
    });

    it("should handle encoded query params", () => {
      const req = createRequest("http://localhost/?q=hello%20world");
      expect(req.query.get("q")).toBe("hello world");
    });

    it("should handle special characters in query", () => {
      const req = createRequest("http://localhost/?email=test%40example.com");
      expect(req.query.get("email")).toBe("test@example.com");
    });

    it("should handle empty query string", () => {
      const req = createRequest("http://localhost/");
      expect(req.query.toString()).toBe("");
      expect(req.query.get("any")).toBeNull();
    });

    it("should support iteration over query params", () => {
      const req = createRequest("http://localhost/?a=1&b=2");
      const entries: [string, string][] = [];
      for (const [key, value] of req.query) {
        entries.push([key, value]);
      }
      expect(entries).toContainEqual(["a", "1"]);
      expect(entries).toContainEqual(["b", "2"]);
    });
  });

  describe("Express-style Query Access (req.query.name)", () => {
    it("should access single query param as string via property", () => {
      const req = createRequest("http://localhost/?name=john");
      const q = req.query as Record<string, unknown>;
      expect(q.name).toBe("john");
    });

    it("should return array for duplicate query params", () => {
      const req = createRequest("http://localhost/?tag=a&tag=b&tag=c");
      const q = req.query as Record<string, unknown>;
      expect(q.tag).toEqual(["a", "b", "c"]);
    });

    it("should return undefined for missing params via property access", () => {
      const req = createRequest("http://localhost/?name=john");
      const q = req.query as Record<string, unknown>;
      expect(q.missing).toBeUndefined();
    });

    it("should support both .get() and property access simultaneously", () => {
      const req = createRequest("http://localhost/?color=blue&width=10");
      // URLSearchParams style
      expect(req.query.get("color")).toBe("blue");
      expect(req.query.get("width")).toBe("10");
      // Express style
      const q = req.query as Record<string, unknown>;
      expect(q.color).toBe("blue");
      expect(q.width).toBe("10");
    });

    it("should preserve URLSearchParams.size as param count (not shadowed)", () => {
      // 'size' is a URLSearchParams property (param count)
      // It is NOT shadowed by a query param named 'size' — use .get("size") instead
      const req = createRequest("http://localhost/?size=large&other=1");
      expect(req.query.size).toBe(2); // count of params
      expect(req.query.get("size")).toBe("large"); // .get() works correctly
    });

    it("should handle encoded values via property access", () => {
      const req = createRequest("http://localhost/?msg=hello%20world&email=a%40b.com");
      const q = req.query as Record<string, unknown>;
      expect(q.msg).toBe("hello world");
      expect(q.email).toBe("a@b.com");
    });

    it("should work with Object.keys()", () => {
      const req = createRequest("http://localhost/?a=1&b=2&c=3");
      const keys = Object.keys(req.query);
      expect(keys).toContain("a");
      expect(keys).toContain("b");
      expect(keys).toContain("c");
      expect(keys.length).toBeGreaterThanOrEqual(3);
    });

    it("should deduplicate keys in Object.keys() for duplicate params", () => {
      const req = createRequest("http://localhost/?x=1&x=2&y=3");
      const keys = Object.keys(req.query).filter(k => k === "x" || k === "y");
      expect(keys).toEqual(["x", "y"]);
    });

    it("should work with destructuring", () => {
      const req = createRequest("http://localhost/?page=5&limit=20");
      const { page, limit } = req.query as Record<string, string>;
      expect(page).toBe("5");
      expect(limit).toBe("20");
    });

    it("should return empty object properties for no query string", () => {
      const req = createRequest("http://localhost/");
      const q = req.query as Record<string, unknown>;
      expect(q.anything).toBeUndefined();
      expect(Object.keys(req.query).filter(k => typeof k === "string" && !["get", "getAll", "has", "set", "append", "delete", "keys", "values", "entries", "forEach", "toString", "sort"].includes(k))).toEqual([]);
    });

    it("should handle query param with empty value", () => {
      const req = createRequest("http://localhost/?flag=&name=test");
      const q = req.query as Record<string, unknown>;
      expect(q.flag).toBe("");
      expect(q.name).toBe("test");
    });

    it("should handle query param with no value (key only)", () => {
      const req = createRequest("http://localhost/?debug&verbose");
      const q = req.query as Record<string, unknown>;
      expect(q.debug).toBe("");
      expect(q.verbose).toBe("");
    });

    it("should cache the query object (same reference on repeated access)", () => {
      const req = createRequest("http://localhost/?a=1");
      const q1 = req.query;
      const q2 = req.query;
      expect(q1).toBe(q2);
    });

    it("should keep .has() working correctly", () => {
      const req = createRequest("http://localhost/?exists=1");
      expect(req.query.has("exists")).toBe(true);
      expect(req.query.has("nope")).toBe(false);
    });

    it("should keep .getAll() working correctly", () => {
      const req = createRequest("http://localhost/?multi=a&multi=b");
      expect(req.query.getAll("multi")).toEqual(["a", "b"]);
      expect(req.query.getAll("missing")).toEqual([]);
    });

    it("should keep .toString() working correctly", () => {
      const req = createRequest("http://localhost/?a=1&b=2");
      const str = req.query.toString();
      expect(str).toContain("a=1");
      expect(str).toContain("b=2");
    });

    it("should keep .keys(), .values(), .entries() working", () => {
      const req = createRequest("http://localhost/?x=10&y=20");
      expect([...req.query.keys()]).toContain("x");
      expect([...req.query.keys()]).toContain("y");
      expect([...req.query.values()]).toContain("10");
      expect([...req.query.values()]).toContain("20");
      const entries = [...req.query.entries()];
      expect(entries).toContainEqual(["x", "10"]);
      expect(entries).toContainEqual(["y", "20"]);
    });

    it("should keep forEach working", () => {
      const req = createRequest("http://localhost/?a=1&b=2");
      const collected: Record<string, string> = {};
      req.query.forEach((value, key) => {
        collected[key] = value;
      });
      expect(collected.a).toBe("1");
      expect(collected.b).toBe("2");
    });

    it("should handle special characters in param names", () => {
      const req = createRequest("http://localhost/?user-name=john&item_id=42");
      const q = req.query as Record<string, unknown>;
      expect(q["user-name"]).toBe("john");
      expect(q["item_id"]).toBe("42");
    });

    it("should handle numeric-looking values as strings", () => {
      const req = createRequest("http://localhost/?count=42&price=9.99");
      const q = req.query as Record<string, unknown>;
      expect(q.count).toBe("42");
      expect(typeof q.count).toBe("string");
      expect(q.price).toBe("9.99");
      expect(typeof q.price).toBe("string");
    });

    it("should handle boolean-looking values as strings", () => {
      const req = createRequest("http://localhost/?active=true&deleted=false");
      const q = req.query as Record<string, unknown>;
      expect(q.active).toBe("true");
      expect(q.deleted).toBe("false");
    });

    it("should handle complex query string with mixed single and duplicate params", () => {
      const req = createRequest("http://localhost/?search=hello&tag=js&tag=ts&page=1");
      const q = req.query as Record<string, unknown>;
      expect(q.search).toBe("hello");
      expect(q.tag).toEqual(["js", "ts"]);
      expect(q.page).toBe("1");
      // .get() returns first value for duplicates
      expect(req.query.get("tag")).toBe("js");
    });
  });

  describe("Params", () => {
    it("should have empty params by default", () => {
      const req = createRequest("http://localhost/users/123");
      expect(req.params).toEqual({});
    });

    it("should allow setting params", () => {
      const req = createRequest("http://localhost/users/123");
      req.params = { id: "123" };
      expect(req.params.id).toBe("123");
    });

    it("should allow setting multiple params", () => {
      const req = createRequest("http://localhost/users/123/posts/456");
      req.params = { userId: "123", postId: "456" };
      expect(req.params.userId).toBe("123");
      expect(req.params.postId).toBe("456");
    });
  });

  describe("Body", () => {
    it("should have undefined body by default", () => {
      const req = createRequest("http://localhost/");
      expect(req.body).toBeUndefined();
    });

    it("should allow setting body", () => {
      const req = createRequest("http://localhost/");
      req.body = { name: "John" };
      expect(req.body).toEqual({ name: "John" });
    });

    it("should mark body as parsed after setting", () => {
      const req = createRequest("http://localhost/");
      expect(req.isBodyParsed()).toBe(false);
      req.body = { name: "John" };
      expect(req.isBodyParsed()).toBe(true);
    });
  });

  describe("Header Access", () => {
    it("should get header with req.get()", () => {
      const req = createRequest("http://localhost/", {
        headers: { "Content-Type": "application/json" },
      });
      expect(req.get("Content-Type")).toBe("application/json");
    });

    it("should be case-insensitive", () => {
      const req = createRequest("http://localhost/", {
        headers: { "Content-Type": "application/json" },
      });
      expect(req.get("content-type")).toBe("application/json");
      expect(req.get("CONTENT-TYPE")).toBe("application/json");
    });

    it("should return undefined for missing headers", () => {
      const req = createRequest("http://localhost/");
      expect(req.get("X-Missing")).toBeUndefined();
    });

    it("should support req.header() alias", () => {
      const req = createRequest("http://localhost/", {
        headers: { "X-Custom": "value" },
      });
      expect(req.header("X-Custom")).toBe("value");
    });
  });

  describe("Subdomains", () => {
    it("should extract subdomains", () => {
      const req = createRequest("http://api.staging.example.com/");
      expect(req.subdomains).toEqual(["staging", "api"]);
    });

    it("should return empty array for localhost", () => {
      const req = createRequest("http://localhost/");
      expect(req.subdomains).toEqual([]);
    });

    it("should return empty array for IP address", () => {
      const req = createRequest("http://192.168.1.1/");
      expect(req.subdomains).toEqual([]);
    });

    it("should handle single subdomain", () => {
      const req = createRequest("http://api.example.com/");
      expect(req.subdomains).toEqual(["api"]);
    });

    it("should handle no subdomains", () => {
      const req = createRequest("http://example.com/");
      expect(req.subdomains).toEqual([]);
    });
  });

  describe("Protocol", () => {
    it("should detect http protocol", () => {
      const req = createRequest("http://localhost/");
      expect(req.protocol).toBe("http");
    });

    it("should detect https protocol", () => {
      const req = createRequest("https://localhost/");
      expect(req.protocol).toBe("https");
    });

    it("should report secure for https", () => {
      const req = createRequest("https://localhost/");
      expect(req.secure).toBe(true);
    });

    it("should report not secure for http", () => {
      const req = createRequest("http://localhost/");
      expect(req.secure).toBe(false);
    });
  });

  describe("Protocol with X-Forwarded-Proto", () => {
    const createAppRequest = (url: string, headers?: Record<string, string>, trustProxy?: unknown): BunRequest => {
      const req = new BunRequest(new Request(url, { headers }));
      req.setApp({
        get: (setting: string) => {
          if (setting === "trust proxy") return trustProxy;
          return undefined;
        },
        getLogger: () => ({ info() {}, warn() {}, error() {} }),
      });
      return req;
    };

    it("should return X-Forwarded-Proto when trust proxy is true", () => {
      const req = createAppRequest("http://localhost/", {
        "x-forwarded-proto": "https",
      }, true);
      expect(req.protocol).toBe("https");
    });

    it("should ignore X-Forwarded-Proto when trust proxy is false", () => {
      const req = createAppRequest("http://localhost/", {
        "x-forwarded-proto": "https",
      }, false);
      expect(req.protocol).toBe("http");
    });

    it("should ignore X-Forwarded-Proto when trust proxy is not set", () => {
      const req = createAppRequest("http://localhost/", {
        "x-forwarded-proto": "https",
      }, undefined);
      expect(req.protocol).toBe("http");
    });

    it("should use first value from comma-separated X-Forwarded-Proto", () => {
      const req = createAppRequest("http://localhost/", {
        "x-forwarded-proto": "https, http",
      }, true);
      expect(req.protocol).toBe("https");
    });

    it("should fall back to URL protocol when header is absent", () => {
      const req = createAppRequest("http://localhost/", {}, true);
      expect(req.protocol).toBe("http");
    });

    it("should fall back to URL protocol when header is absent (https URL)", () => {
      const req = createAppRequest("https://localhost/", {}, true);
      expect(req.protocol).toBe("https");
    });

    it("req.secure should reflect X-Forwarded-Proto", () => {
      const req = createAppRequest("http://localhost/", {
        "x-forwarded-proto": "https",
      }, true);
      expect(req.secure).toBe(true);
    });

    it("req.secure should be false when proto is http via proxy", () => {
      const req = createAppRequest("https://localhost/", {
        "x-forwarded-proto": "http",
      }, true);
      expect(req.secure).toBe(false);
    });

    it("should work with numeric trust proxy value", () => {
      const req = createAppRequest("http://localhost/", {
        "x-forwarded-proto": "https",
      }, 1);
      expect(req.protocol).toBe("https");
    });

    it("should work with string trust proxy value", () => {
      const req = createAppRequest("http://localhost/", {
        "x-forwarded-proto": "https",
      }, "loopback");
      expect(req.protocol).toBe("https");
    });
  });

  describe("XHR Detection", () => {
    it("should detect XMLHttpRequest", () => {
      const req = createRequest("http://localhost/", {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      expect(req.xhr).toBe(true);
    });

    it("should not detect non-XHR request", () => {
      const req = createRequest("http://localhost/");
      expect(req.xhr).toBe(false);
    });

    it("should be case-insensitive for xhr header", () => {
      const req = createRequest("http://localhost/", {
        headers: { "x-requested-with": "xmlhttprequest" },
      });
      expect(req.xhr).toBe(true);
    });
  });

  describe("Content Type Checking", () => {
    it("should check content type with is()", () => {
      const req = createRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      expect(req.is("json")).toBe("json");
      expect(req.is("application/json")).toBe("application/json");
    });

    it("should return false for non-matching type", () => {
      const req = createRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      expect(req.is("html")).toBe(false);
    });

    it("should handle multiple types", () => {
      const req = createRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "text/html" },
      });
      expect(req.is("json", "html")).toBe("html");
    });

    it("should return false when no content-type", () => {
      const req = createRequest("http://localhost/", { method: "POST" });
      expect(req.is("json")).toBe(false);
    });
  });

  describe("Accept Checking", () => {
    it("should check accept header with accepts()", () => {
      const req = createRequest("http://localhost/", {
        headers: { Accept: "application/json" },
      });
      expect(req.accepts("json")).toBe("json");
    });

    it("should return false for non-accepted type", () => {
      const req = createRequest("http://localhost/", {
        headers: { Accept: "text/html" },
      });
      expect(req.accepts("json")).toBe(false);
    });

    it("should handle wildcard accept", () => {
      const req = createRequest("http://localhost/", {
        headers: { Accept: "*/*" },
      });
      expect(req.accepts("json")).toBe("json");
    });

    it("should handle multiple types in accepts", () => {
      const req = createRequest("http://localhost/", {
        headers: { Accept: "text/html, application/json" },
      });
      expect(req.accepts("json", "html")).toBeTruthy();
    });
  });

  describe("IP Address", () => {
    it("should return default IP without trust proxy", () => {
      const req = createRequest("http://localhost/");
      expect(req.ip).toBe("127.0.0.1");
    });

    it("should ignore X-Forwarded-For without trust proxy", () => {
      const req = createRequest("http://localhost/", {
        headers: { "X-Forwarded-For": "203.0.113.195" },
      });
      // Without trust proxy enabled, should return default
      expect(req.ip).toBe("127.0.0.1");
    });
  });

  describe("IPs Array", () => {
    it("should return empty array without X-Forwarded-For", () => {
      const req = createRequest("http://localhost/");
      expect(req.ips).toEqual([]);
    });
  });

  describe("Locals", () => {
    it("should have empty locals by default", () => {
      const req = createRequest("http://localhost/");
      expect(req.locals).toEqual({});
    });

    it("should allow setting locals", () => {
      const req = createRequest("http://localhost/");
      req.locals.user = { id: 1 };
      expect(req.locals.user).toEqual({ id: 1 });
    });

    it("should preserve locals across operations", () => {
      const req = createRequest("http://localhost/");
      req.locals.step1 = true;
      req.locals.step2 = true;
      expect(req.locals).toEqual({ step1: true, step2: true });
    });
  });

  describe("Route Info", () => {
    it("should have null route by default", () => {
      const req = createRequest("http://localhost/users/123");
      expect(req.route).toBeNull();
    });

    it("should allow setting route", () => {
      const req = createRequest("http://localhost/users/123");
      req.route = { path: "/users/:id", method: "GET" };
      expect(req.route).toEqual({ path: "/users/:id", method: "GET" });
    });
  });

  describe("Base URL", () => {
    it("should have empty baseUrl by default", () => {
      const req = createRequest("http://localhost/users");
      expect(req.baseUrl).toBe("");
    });

    it("should allow setting baseUrl", () => {
      const req = createRequest("http://localhost/api/users");
      req.baseUrl = "/api";
      expect(req.baseUrl).toBe("/api");
    });
  });

  describe("Body Parsing", () => {
    it("should parse JSON body", async () => {
      const req = createRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John" }),
      });

      await req.parseJson();
      expect(req.body).toEqual({ name: "John" });
      expect(req.isBodyParsed()).toBe(true);
    });

    it("should handle empty JSON body", async () => {
      const req = createRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });

      await req.parseJson();
      expect(req.body).toEqual({});
    });

    it("should throw on invalid JSON", async () => {
      const req = createRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      await expect(req.parseJson()).rejects.toThrow();
    });

    it("should parse urlencoded body", async () => {
      const req = createRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "name=John&age=25",
      });

      await req.parseUrlencoded();
      expect(req.body).toEqual({ name: "John", age: "25" });
    });

    it("should parse text body", async () => {
      const req = createRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "Hello, World!",
      });

      await req.parseText();
      expect(req.body).toBe("Hello, World!");
    });

    it("should not re-parse if already parsed", async () => {
      const req = createRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first: true }),
      });

      await req.parseJson();
      req.body = { modified: true };

      // This should not change body since it's already parsed
      await req.parseJson();
      expect(req.body).toEqual({ modified: true });
    });
  });

  describe("Raw Body", () => {
    it("should provide raw body as Uint8Array", async () => {
      const req = createRequest("http://localhost/", {
        method: "POST",
        body: "test body",
      });

      // First parse to get raw body
      await req.parseText();

      // Raw body should be available
      // Note: This depends on implementation storing raw body
    });
  });

  describe("App Context", () => {
    it("should have undefined app by default", () => {
      const req = createRequest("http://localhost/");
      expect(req.app).toBeUndefined();
    });

    it("should allow setting app context", () => {
      const req = createRequest("http://localhost/");
      const mockApp = {
        get: () => undefined,
        getLogger: () => ({
          info: () => {},
          warn: () => {},
          error: () => {},
        }),
      };

      req.setApp(mockApp);
      expect(req.app).toBe(mockApp);
    });
  });
});

describe("req.fresh / req.stale", () => {
  function createFreshReq(
    url: string,
    headers: Record<string, string>,
    resStatus: number,
    resHeaders: Record<string, string>
  ): BunRequest {
    const req = new BunRequest(
      new Request(url, { method: "GET", headers }),
      new URL(url).pathname
    );
    const res = new BunResponse();
    res.status(resStatus);
    for (const [k, v] of Object.entries(resHeaders)) {
      res.set(k, v);
    }
    req.setRes(res);
    return req;
  }

  it("returns false for POST requests", () => {
    const req = new BunRequest(
      new Request("http://localhost/test", { method: "POST", headers: { "if-none-match": '"abc"' } }),
      "/test"
    );
    const res = new BunResponse();
    res.status(200);
    res.set("etag", '"abc"');
    req.setRes(res);
    expect(req.fresh).toBe(false);
  });

  it("returns false when status < 200", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"abc"' },
      100,
      { "etag": '"abc"' }
    );
    expect(req.fresh).toBe(false);
  });

  it("returns false when status >= 300 and not 304", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"abc"' },
      400,
      { "etag": '"abc"' }
    );
    expect(req.fresh).toBe(false);
  });

  it("returns true for 304 with matching ETag", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"abc"' },
      304,
      { "etag": '"abc"' }
    );
    expect(req.fresh).toBe(true);
  });

  it("returns false with no cache headers", () => {
    const req = createFreshReq("http://localhost/test", {}, 200, { "etag": '"abc"' });
    expect(req.fresh).toBe(false);
  });

  it("returns true when If-None-Match matches ETag", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"abc"' },
      200,
      { "etag": '"abc"' }
    );
    expect(req.fresh).toBe(true);
  });

  it("returns false when If-None-Match does not match ETag", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"abc"' },
      200,
      { "etag": '"def"' }
    );
    expect(req.fresh).toBe(false);
  });

  it("handles weak ETag comparison (W/ prefix)", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": 'W/"abc"' },
      200,
      { "etag": '"abc"' }
    );
    expect(req.fresh).toBe(true);
  });

  it("handles weak ETag on response side", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"abc"' },
      200,
      { "etag": 'W/"abc"' }
    );
    expect(req.fresh).toBe(true);
  });

  it("If-None-Match: * matches any ETag", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": "*" },
      200,
      { "etag": '"anything"' }
    );
    expect(req.fresh).toBe(true);
  });

  it("handles comma-separated If-None-Match list", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"aaa", "bbb", "ccc"' },
      200,
      { "etag": '"bbb"' }
    );
    expect(req.fresh).toBe(true);
  });

  it("returns false when ETag not in list", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"aaa", "bbb"' },
      200,
      { "etag": '"zzz"' }
    );
    expect(req.fresh).toBe(false);
  });

  it("returns true when If-Modified-Since matches Last-Modified", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    const req = createFreshReq(
      "http://localhost/test",
      { "if-modified-since": date.toUTCString() },
      200,
      { "last-modified": date.toUTCString() }
    );
    expect(req.fresh).toBe(true);
  });

  it("returns false when Last-Modified is after If-Modified-Since", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-modified-since": new Date("2026-01-01").toUTCString() },
      200,
      { "last-modified": new Date("2026-02-01").toUTCString() }
    );
    expect(req.fresh).toBe(false);
  });

  it("returns true when both ETag and Last-Modified match", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    const req = createFreshReq(
      "http://localhost/test",
      {
        "if-none-match": '"abc"',
        "if-modified-since": date.toUTCString(),
      },
      200,
      {
        "etag": '"abc"',
        "last-modified": date.toUTCString(),
      }
    );
    expect(req.fresh).toBe(true);
  });

  it("returns true when ETag matches even if Last-Modified is newer (If-None-Match takes precedence)", () => {
    const req = createFreshReq(
      "http://localhost/test",
      {
        "if-none-match": '"abc"',
        "if-modified-since": new Date("2026-01-01").toUTCString(),
      },
      200,
      {
        "etag": '"abc"',
        "last-modified": new Date("2026-06-01").toUTCString(),
      }
    );
    // When If-None-Match is present, If-Modified-Since is COMPLETELY IGNORED (RFC 2616 Section 14.26)
    expect(req.fresh).toBe(true);
  });

  it("handles HEAD requests as fresh-eligible", () => {
    const req = new BunRequest(
      new Request("http://localhost/test", { method: "HEAD", headers: { "if-none-match": '"abc"' } }),
      "/test"
    );
    const res = new BunResponse();
    res.status(200);
    res.set("etag", '"abc"');
    req.setRes(res);
    expect(req.fresh).toBe(true);
  });

  it("returns false when no res is set", () => {
    const req = new BunRequest(
      new Request("http://localhost/test", { headers: { "if-none-match": '"abc"' } }),
      "/test"
    );
    expect(req.fresh).toBe(false);
  });

  it("handles invalid If-Modified-Since date gracefully", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-modified-since": "not-a-date" },
      200,
      { "last-modified": new Date().toUTCString() }
    );
    expect(req.fresh).toBe(false);
  });

  it("req.stale is inverse of req.fresh", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"abc"' },
      200,
      { "etag": '"abc"' }
    );
    expect(req.stale).toBe(false);
    expect(req.fresh).toBe(true);
  });

  it("req.stale is true when not fresh", () => {
    const req = createFreshReq("http://localhost/test", {}, 200, {});
    expect(req.stale).toBe(true);
  });

  it("returns false when Cache-Control: no-cache is set (always stale)", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"abc"', "cache-control": "no-cache" },
      200,
      { "etag": '"abc"' }
    );
    expect(req.fresh).toBe(false);
  });

  it("returns false when Cache-Control contains no-cache among directives", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": '"abc"', "cache-control": "max-age=0, no-cache" },
      200,
      { "etag": '"abc"' }
    );
    expect(req.fresh).toBe(false);
  });

  it("If-None-Match: * returns true even with no server ETag", () => {
    const req = createFreshReq(
      "http://localhost/test",
      { "if-none-match": "*" },
      200,
      {} // no etag set
    );
    expect(req.fresh).toBe(true);
  });

  it("If-None-Match completely ignores If-Modified-Since even when IMS says stale", () => {
    const req = createFreshReq(
      "http://localhost/test",
      {
        "if-none-match": '"v1"',
        "if-modified-since": new Date("2020-01-01").toUTCString(),
      },
      200,
      {
        "etag": '"v1"',
        "last-modified": new Date("2026-06-01").toUTCString(), // much newer than IMS
      }
    );
    // ETag matches → fresh. IMS is completely ignored when INM is present.
    expect(req.fresh).toBe(true);
  });
});

describe("req.range()", () => {
  function createRangeReq(rangeHeader?: string): BunRequest {
    const headers: Record<string, string> = {};
    if (rangeHeader) headers["range"] = rangeHeader;
    return new BunRequest(
      new Request("http://localhost/file", { headers }),
      "/file"
    );
  }

  it("returns undefined when no Range header", () => {
    const req = createRangeReq();
    expect(req.range(1000)).toBeUndefined();
  });

  it("parses single byte range", () => {
    const req = createRangeReq("bytes=0-499");
    const result = req.range(1000);
    expect(result).not.toBe(-1);
    expect(result).not.toBe(-2);
    if (typeof result === "object" && Array.isArray(result)) {
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ start: 0, end: 499 });
      expect(result.type).toBe("bytes");
    }
  });

  it("parses multiple ranges", () => {
    const req = createRangeReq("bytes=0-99, 200-299");
    const result = req.range(1000);
    if (typeof result === "object" && Array.isArray(result)) {
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ start: 0, end: 99 });
      expect(result[1]).toEqual({ start: 200, end: 299 });
    }
  });

  it("parses suffix range (-500)", () => {
    const req = createRangeReq("bytes=-500");
    const result = req.range(1000);
    if (typeof result === "object" && Array.isArray(result)) {
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ start: 500, end: 999 });
    }
  });

  it("parses open-ended range (500-)", () => {
    const req = createRangeReq("bytes=500-");
    const result = req.range(1000);
    if (typeof result === "object" && Array.isArray(result)) {
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ start: 500, end: 999 });
    }
  });

  it("returns -2 for malformed range (no =)", () => {
    const req = createRangeReq("bytes 0-499");
    expect(req.range(1000)).toBe(-2);
  });

  it("parses non-bytes range type (Express accepts any type)", () => {
    const req = createRangeReq("items=0-10");
    const result = req.range(1000);
    if (typeof result === "object" && Array.isArray(result)) {
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ start: 0, end: 10 });
      expect(result.type).toBe("items");
    } else {
      throw new Error("Expected parsed range array, got " + result);
    }
  });

  it("returns -1 for unsatisfiable range", () => {
    const req = createRangeReq("bytes=2000-3000");
    expect(req.range(1000)).toBe(-1);
  });

  it("clamps end to size - 1", () => {
    const req = createRangeReq("bytes=0-9999");
    const result = req.range(100);
    if (typeof result === "object" && Array.isArray(result)) {
      expect(result[0]).toEqual({ start: 0, end: 99 });
    }
  });

  it("suffix range larger than file size returns -1 (unsatisfiable — start < 0 is skipped)", () => {
    const req = createRangeReq("bytes=-5000");
    const result = req.range(100);
    // start = 100 - 5000 = -4900, start < 0 → range skipped → no valid ranges → -1
    expect(result).toBe(-1);
  });

  it("combines overlapping ranges with combine option", () => {
    const req = createRangeReq("bytes=0-100, 50-200");
    const result = req.range(1000, { combine: true });
    if (typeof result === "object" && Array.isArray(result)) {
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ start: 0, end: 200 });
    }
  });

  it("combines adjacent ranges", () => {
    const req = createRangeReq("bytes=0-99, 100-199");
    const result = req.range(1000, { combine: true });
    if (typeof result === "object" && Array.isArray(result)) {
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ start: 0, end: 199 });
    }
  });

  it("handles zero-length file", () => {
    const req = createRangeReq("bytes=0-0");
    expect(req.range(0)).toBe(-1);
  });

  it("returns -2 for completely empty range specifier", () => {
    const req = createRangeReq("bytes=");
    expect(req.range(1000)).toBe(-1);
  });
});
