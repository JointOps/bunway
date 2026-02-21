import { describe, expect, it } from "bun:test";
import { csrf } from "../../../src/middleware/csrf";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

const createRequest = (
  method = "GET",
  headers: Record<string, string> = {},
  body?: unknown,
  path = "/test"
): BunRequest => {
  const init: RequestInit = { method, headers };
  if (body && typeof body === "string") {
    init.body = body;
  }
  const req = new BunRequest(
    new Request(`http://localhost${path}`, init),
    path
  );
  if (body && typeof body === "object") {
    req.body = body;
  }
  return req;
};

const getSetCookieHeader = (res: BunResponse): string | null => {
  return res.toResponse().headers.get("set-cookie");
};

const noop = () => {};

function extractCsrfToken(res: BunResponse): string | null {
  const cookie = getSetCookieHeader(res);
  if (!cookie) return null;
  const match = cookie.match(/_csrf=([^;]+)/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

function getTokenViaMiddleware(middleware: ReturnType<typeof csrf>): { token: string; req: BunRequest } {
  const req = createRequest("GET");
  const res = new BunResponse();

  middleware(req, res, noop);

  const token = (req as any).csrfToken();
  return { token, req };
}

describe("csrf middleware (Unit)", () => {
  describe("token generation", () => {
    it("should set csrf cookie when no token is present", () => {
      const req = createRequest("GET");
      const res = new BunResponse();

      csrf()(req, res, noop);

      const cookie = getSetCookieHeader(res);
      expect(cookie).not.toBeNull();
      expect(cookie).toContain("_csrf=");
    });

    it("should not set cookie when token already exists in cookies", () => {
      const req = createRequest("GET", { cookie: "_csrf=existing-token" });
      const res = new BunResponse();

      csrf()(req, res, noop);

      const cookie = getSetCookieHeader(res);
      expect(cookie).toBeNull();
    });

    it("should attach req.csrfToken() function", () => {
      const req = createRequest("GET");
      const res = new BunResponse();

      csrf()(req, res, noop);

      expect(typeof (req as any).csrfToken).toBe("function");
      const token = (req as any).csrfToken();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("should return the token via req.csrfToken()", () => {
      const req = createRequest("GET");
      const res = new BunResponse();

      csrf()(req, res, noop);

      const token = (req as any).csrfToken();
      const cookieToken = extractCsrfToken(res);
      expect(token).toBe(cookieToken);
    });
  });

  describe("safe methods (ignored)", () => {
    it("should pass GET requests without validation", () => {
      const req = createRequest("GET");
      const res = new BunResponse();
      let called = false;

      csrf()(req, res, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should pass HEAD requests without validation", () => {
      const req = createRequest("HEAD");
      const res = new BunResponse();
      let called = false;

      csrf()(req, res, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should pass OPTIONS requests without validation", () => {
      const req = createRequest("OPTIONS");
      const res = new BunResponse();
      let called = false;

      csrf()(req, res, () => { called = true; });

      expect(called).toBe(true);
    });
  });

  describe("POST validation", () => {
    it("should pass POST with valid header token", () => {
      const middleware = csrf();
      const { token } = getTokenViaMiddleware(middleware);

      const req = createRequest("POST", {
        "x-csrf-token": token,
        cookie: `_csrf=${token}`,
      });
      const res = new BunResponse();
      let called = false;

      middleware(req, res, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should pass POST with valid body token", () => {
      const middleware = csrf();
      const { token } = getTokenViaMiddleware(middleware);

      const req = createRequest("POST", {
        cookie: `_csrf=${token}`,
      }, { _csrf: token });
      const res = new BunResponse();
      let called = false;

      middleware(req, res, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should return 403 for POST without token", () => {
      const middleware = csrf();
      const { token } = getTokenViaMiddleware(middleware);

      const req = createRequest("POST", {
        cookie: `_csrf=${token}`,
      });
      const res = new BunResponse();
      let called = false;

      middleware(req, res, () => { called = true; });

      expect(called).toBe(false);
      expect(res.toResponse().status).toBe(403);
    });

    it("should return 403 for POST with invalid token", () => {
      const middleware = csrf();
      const { token } = getTokenViaMiddleware(middleware);

      const req = createRequest("POST", {
        "x-csrf-token": "invalid-token-value",
        cookie: `_csrf=${token}`,
      });
      const res = new BunResponse();
      let called = false;

      middleware(req, res, () => { called = true; });

      expect(called).toBe(false);
      expect(res.toResponse().status).toBe(403);
    });

    it("should return error JSON body on 403", async () => {
      const middleware = csrf();
      const { token } = getTokenViaMiddleware(middleware);

      const req = createRequest("POST", {
        cookie: `_csrf=${token}`,
      });
      const res = new BunResponse();

      middleware(req, res, noop);

      const body = await res.toResponse().json();
      expect(body.error).toBe("Invalid CSRF token");
    });
  });

  describe("custom options", () => {
    it("should use custom headerName", () => {
      const middleware = csrf({ headerName: "x-custom-csrf" });
      const { token } = getTokenViaMiddleware(middleware);

      const req = createRequest("POST", {
        "x-custom-csrf": token,
        cookie: `_csrf=${token}`,
      });
      const res = new BunResponse();
      let called = false;

      middleware(req, res, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should use custom bodyField", () => {
      const middleware = csrf({ bodyField: "csrfToken" });
      const { token } = getTokenViaMiddleware(middleware);

      const req = createRequest("POST", {
        cookie: `_csrf=${token}`,
      }, { csrfToken: token });
      const res = new BunResponse();
      let called = false;

      middleware(req, res, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should use custom ignoreMethods", () => {
      const middleware = csrf({ ignoreMethods: ["GET", "HEAD", "OPTIONS", "POST"] });
      const { token } = getTokenViaMiddleware(middleware);

      const req = createRequest("POST", {
        cookie: `_csrf=${token}`,
      });
      const res = new BunResponse();
      let called = false;

      middleware(req, res, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should validate GET when removed from ignoreMethods", () => {
      const middleware = csrf({ ignoreMethods: [] });
      const { token } = getTokenViaMiddleware(middleware);

      const req = createRequest("GET", {
        cookie: `_csrf=${token}`,
      });
      const res = new BunResponse();
      let called = false;

      middleware(req, res, () => { called = true; });

      expect(called).toBe(false);
      expect(res.toResponse().status).toBe(403);
    });
  });
});
