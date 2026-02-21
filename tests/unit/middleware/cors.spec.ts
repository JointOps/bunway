import { describe, expect, it } from "bun:test";
import { cors } from "../../../src/middleware/cors";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

const createRequest = (
  headers: Record<string, string> = {},
  method = "GET"
): BunRequest => {
  return new BunRequest(
    new Request("http://localhost/test", { method, headers }),
    "/test"
  );
};

const getHeader = (res: BunResponse, name: string): string | null => {
  return res.toResponse().headers.get(name);
};

const noop = () => {};

describe("cors middleware (Unit)", () => {
  describe("default behavior", () => {
    it("should set Access-Control-Allow-Origin to * when no credentials", () => {
      const req = createRequest({ origin: "http://example.com" });
      const res = new BunResponse();

      cors()(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Origin")).toBe("*");
    });

    it("should add Vary: Origin header", () => {
      const req = createRequest({ origin: "http://example.com" });
      const res = new BunResponse();

      cors()(req, res, noop);

      expect(getHeader(res, "Vary")).toBe("Origin");
    });

    it("should not set CORS headers when no Origin header is present", () => {
      const req = createRequest();
      const res = new BunResponse();
      let called = false;

      cors()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(getHeader(res, "Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("origin: true", () => {
    it("should reflect the request origin", () => {
      const req = createRequest({ origin: "http://example.com" });
      const res = new BunResponse();

      cors({ origin: true })(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Origin")).toBe("http://example.com");
    });
  });

  describe("origin: specific string", () => {
    it("should allow matching origin", () => {
      const req = createRequest({ origin: "http://example.com" });
      const res = new BunResponse();

      cors({ origin: "http://example.com" })(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Origin")).toBe("http://example.com");
    });

    it("should reject non-matching origin", () => {
      const req = createRequest({ origin: "http://evil.com" });
      const res = new BunResponse();
      let called = false;

      cors({ origin: "http://example.com" })(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(getHeader(res, "Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("origin: RegExp", () => {
    it("should allow origin matching the pattern", () => {
      const req = createRequest({ origin: "http://app.example.com" });
      const res = new BunResponse();

      cors({ origin: /\.example\.com$/ })(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Origin")).toBe("http://app.example.com");
    });

    it("should reject origin not matching the pattern", () => {
      const req = createRequest({ origin: "http://evil.com" });
      const res = new BunResponse();
      let called = false;

      cors({ origin: /\.example\.com$/ })(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(getHeader(res, "Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("origin: array", () => {
    it("should allow origin from array of strings", () => {
      const req = createRequest({ origin: "http://b.com" });
      const res = new BunResponse();

      cors({ origin: ["http://a.com", "http://b.com"] })(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Origin")).toBe("http://b.com");
    });

    it("should allow origin from array with RegExp", () => {
      const req = createRequest({ origin: "http://staging.example.com" });
      const res = new BunResponse();

      cors({ origin: ["http://prod.com", /\.example\.com$/] })(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Origin")).toBe("http://staging.example.com");
    });

    it("should reject origin not in array", () => {
      const req = createRequest({ origin: "http://evil.com" });
      const res = new BunResponse();
      let called = false;

      cors({ origin: ["http://a.com", "http://b.com"] })(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(getHeader(res, "Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("origin: function", () => {
    it("should use the return value from the function", () => {
      const req = createRequest({ origin: "http://custom.com" });
      const res = new BunResponse();

      const originFn = (origin: string | null) => origin || false;
      cors({ origin: originFn as any })(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Origin")).toBe("http://custom.com");
    });

    it("should return null when function returns false", () => {
      const req = createRequest({ origin: "http://blocked.com" });
      const res = new BunResponse();
      let called = false;

      const originFn = () => false;
      cors({ origin: originFn as any })(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(getHeader(res, "Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("credentials: true", () => {
    it("should add Access-Control-Allow-Credentials header", () => {
      const req = createRequest({ origin: "http://example.com" });
      const res = new BunResponse();

      cors({ origin: "http://example.com", credentials: true })(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Credentials")).toBe("true");
    });

    it("should reflect request origin instead of * when credentials enabled with default origin", () => {
      const req = createRequest({ origin: "http://example.com" });
      const res = new BunResponse();

      cors({ credentials: true })(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Origin")).toBe("http://example.com");
      expect(getHeader(res, "Access-Control-Allow-Credentials")).toBe("true");
    });
  });

  describe("preflight (OPTIONS)", () => {
    const createPreflight = (
      headers: Record<string, string> = {}
    ): BunRequest => {
      return createRequest(
        {
          origin: "http://example.com",
          "access-control-request-method": "POST",
          ...headers,
        },
        "OPTIONS"
      );
    };

    it("should set Access-Control-Allow-Methods", () => {
      const req = createPreflight();
      const res = new BunResponse();

      cors()(req, res, noop);

      const methods = getHeader(res, "Access-Control-Allow-Methods");
      expect(methods).toContain("GET");
      expect(methods).toContain("POST");
      expect(methods).toContain("DELETE");
    });

    it("should set Access-Control-Allow-Headers from config", () => {
      const req = createPreflight();
      const res = new BunResponse();

      cors({ allowedHeaders: ["Content-Type", "Authorization"] })(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
    });

    it("should mirror request headers when no allowedHeaders configured", () => {
      const req = createPreflight({
        "access-control-request-headers": "X-Custom, X-Token",
      });
      const res = new BunResponse();

      cors()(req, res, noop);

      expect(getHeader(res, "Access-Control-Allow-Headers")).toBe("X-Custom, X-Token");
    });

    it("should set Access-Control-Max-Age", () => {
      const req = createPreflight();
      const res = new BunResponse();

      cors({ maxAge: 3600 })(req, res, noop);

      expect(getHeader(res, "Access-Control-Max-Age")).toBe("3600");
    });

    it("should return 204 by default for preflight", () => {
      const req = createPreflight();
      const res = new BunResponse();

      cors()(req, res, noop);

      expect(res.toResponse().status).toBe(204);
    });

    it("should call next instead of responding when preflightContinue is true", () => {
      const req = createPreflight();
      const res = new BunResponse();
      let called = false;

      cors({ preflightContinue: true })(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(res.toResponse().status).toBe(200);
    });
  });

  describe("exposedHeaders", () => {
    it("should set Access-Control-Expose-Headers", () => {
      const req = createRequest({ origin: "http://example.com" });
      const res = new BunResponse();

      cors({ exposedHeaders: ["X-Request-Id", "X-Total-Count"] })(req, res, noop);

      expect(getHeader(res, "Access-Control-Expose-Headers")).toBe("X-Request-Id, X-Total-Count");
    });
  });
});
