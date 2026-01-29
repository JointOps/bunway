import { describe, expect, it } from "bun:test";
import { BunRequest } from "../../../src";

function createRequest(url: string, init?: RequestInit): BunRequest {
  return new BunRequest(new Request(url, init));
}

describe("BunRequest", () => {
  describe("basic properties", () => {
    it("exposes method", () => {
      const req = createRequest("http://localhost/test", { method: "POST" });
      expect(req.method).toBe("POST");
    });

    it("exposes url", () => {
      const req = createRequest("http://localhost/test?foo=bar");
      expect(req.url).toBe("http://localhost/test?foo=bar");
    });

    it("exposes path/pathname", () => {
      const req = createRequest("http://localhost/users/123?q=test");
      expect(req.path).toBe("/users/123");
      expect(req.pathname).toBe("/users/123");
    });

    it("exposes query parameters", () => {
      const req = createRequest("http://localhost/test?name=John&age=30");
      expect(req.query.get("name")).toBe("John");
      expect(req.query.get("age")).toBe("30");
    });

    it("exposes originalUrl with path and query", () => {
      const req = createRequest("http://localhost/users/123?sort=asc&limit=10");
      expect(req.originalUrl).toBe("/users/123?sort=asc&limit=10");
    });

    it("exposes originalUrl without query string", () => {
      const req = createRequest("http://localhost/users/123");
      expect(req.originalUrl).toBe("/users/123");
    });

    it("exposes hostname", () => {
      const req = createRequest("http://example.com:8080/test");
      expect(req.hostname).toBe("example.com");
    });

    it("exposes protocol", () => {
      const req = createRequest("https://localhost/test");
      expect(req.protocol).toBe("https");
      expect(req.secure).toBe(true);
    });
  });

  describe("headers", () => {
    it("provides get() helper for headers", () => {
      const req = createRequest("http://localhost/test", {
        headers: { "Content-Type": "application/json" },
      });
      expect(req.get("content-type")).toBe("application/json");
    });

    it("returns undefined for missing headers", () => {
      const req = createRequest("http://localhost/test");
      expect(req.get("x-custom")).toBeUndefined();
    });

    it("provides header() alias for get()", () => {
      const req = createRequest("http://localhost/test", {
        headers: { "X-Custom-Header": "custom-value" },
      });
      expect(req.header("x-custom-header")).toBe("custom-value");
      expect(req.header("x-custom-header")).toBe(req.get("x-custom-header"));
    });
  });

  describe("params", () => {
    it("allows setting and getting params", () => {
      const req = createRequest("http://localhost/users/123");
      req.params = { id: "123" };
      expect(req.params.id).toBe("123");
      expect(req.param("id")).toBe("123");
    });

    it("param() falls back to query string", () => {
      const req = createRequest("http://localhost/test?id=456");
      expect(req.param("id")).toBe("456");
    });
  });

  describe("is()", () => {
    it("checks content type", () => {
      const req = createRequest("http://localhost/test", {
        headers: { "Content-Type": "application/json" },
      });
      expect(req.is("json")).toBe("json");
      expect(req.is("html")).toBe(false);
    });
  });

  describe("accepts()", () => {
    it("checks accept header", () => {
      const req = createRequest("http://localhost/test", {
        headers: { Accept: "application/json" },
      });
      expect(req.accepts("json", "html")).toBe("json");
    });
  });

  describe("body parsing", () => {
    it("parses JSON body", async () => {
      const req = createRequest("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John" }),
      });
      const body = await req.parseJson();
      expect(body).toEqual({ name: "John" });
      expect(req.body).toEqual({ name: "John" });
    });

    it("parses URL-encoded body", async () => {
      const req = createRequest("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "name=John&age=30",
      });
      const body = await req.parseUrlencoded();
      expect(body).toEqual({ name: "John", age: "30" });
    });

    it("parses text body", async () => {
      const req = createRequest("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "Hello World",
      });
      const body = await req.parseText();
      expect(body).toBe("Hello World");
    });

    it("throws on payload too large", async () => {
      const req = createRequest("http://localhost/test", {
        method: "POST",
        body: "x".repeat(2000),
      });
      await expect(req.parseJson(100)).rejects.toThrow("Payload Too Large");
    });
  });

  describe("locals", () => {
    it("provides per-request storage", () => {
      const req = createRequest("http://localhost/test");
      req.locals.user = { id: 1 };
      expect(req.locals.user).toEqual({ id: 1 });
    });
  });

  describe("subdomains", () => {
    it("extracts subdomains from hostname", () => {
      const req = createRequest("http://foo.bar.example.com/test");
      expect(req.subdomains).toEqual(["bar", "foo"]);
    });

    it("returns empty array for localhost", () => {
      const req = createRequest("http://localhost/test");
      expect(req.subdomains).toEqual([]);
    });

    it("returns empty array for IP addresses", () => {
      const req = createRequest("http://192.168.1.1/test");
      expect(req.subdomains).toEqual([]);
    });

    it("returns empty array for simple domain", () => {
      const req = createRequest("http://example.com/test");
      expect(req.subdomains).toEqual([]);
    });

    it("handles single subdomain", () => {
      const req = createRequest("http://api.example.com/test");
      expect(req.subdomains).toEqual(["api"]);
    });
  });

  describe("baseUrl", () => {
    it("defaults to empty string", () => {
      const req = createRequest("http://localhost/test");
      expect(req.baseUrl).toBe("");
    });

    it("can be set", () => {
      const req = createRequest("http://localhost/api/users");
      req.baseUrl = "/api";
      expect(req.baseUrl).toBe("/api");
    });
  });

  describe("route", () => {
    it("defaults to null", () => {
      const req = createRequest("http://localhost/test");
      expect(req.route).toBeNull();
    });

    it("can be set", () => {
      const req = createRequest("http://localhost/users/123");
      req.route = { path: "/users/:id", method: "GET" };
      expect(req.route).toEqual({ path: "/users/:id", method: "GET" });
    });
  });
});
