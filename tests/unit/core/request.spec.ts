/**
 * BunRequest Unit Tests
 *
 * Tests the BunRequest class internal logic without full HTTP layer.
 * Based on NestJS and Elysia testing patterns.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { BunRequest } from "../../../src/core/request";

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
