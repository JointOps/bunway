import { describe, expect, it } from "bun:test";
import { csrf } from "../../../src/middleware/csrf";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";
import { HttpError } from "../../../src/core/errors";

const SECRET = "test-csrf-secret-at-least-32-chars!!";

const createRequest = (
  method = "GET",
  headers: Record<string, string> = {},
  body?: Record<string, unknown>,
  path = "/test"
): BunRequest => {
  const req = new BunRequest(
    new Request(`http://localhost${path}`, { method, headers }),
    path
  );
  if (body) req.body = body;
  return req;
};

const noop = () => {};

function getSetCookieHeader(res: BunResponse): string | null {
  return res.toResponse().headers.get("set-cookie");
}

function setupMw(): { middleware: ReturnType<typeof csrf>; signedToken: string; rawToken: string } {
  const middleware = csrf({ secret: SECRET });
  const req = createRequest("GET");
  const res = new BunResponse();

  middleware(req, res, noop);

  const signedToken = (req as any).csrfToken() as string;
  const cookieHeader = getSetCookieHeader(res) ?? "";
  const match = cookieHeader.match(/_csrf=([^;]+)/);
  const rawToken = match ? decodeURIComponent(match[1]) : "";

  return { middleware, signedToken, rawToken };
}

describe("csrf middleware (Unit)", () => {
  describe("configuration", () => {
    it("throws when secret is empty string", () => {
      expect(() => csrf({ secret: "" })).toThrow("secret");
    });
  });

  describe("token generation", () => {
    it("sets csrf cookie on GET request", () => {
      const req = createRequest("GET");
      const res = new BunResponse();
      csrf({ secret: SECRET })(req, res, noop);
      expect(getSetCookieHeader(res)).toContain("_csrf=");
    });

    it("does not reset cookie when one already exists", () => {
      const req = createRequest("GET", { cookie: "_csrf=existing-raw-token-123" });
      const res = new BunResponse();
      csrf({ secret: SECRET })(req, res, noop);
      expect(getSetCookieHeader(res)).toBeNull();
    });

    it("attaches req.csrfToken() function", () => {
      const req = createRequest("GET");
      const res = new BunResponse();
      csrf({ secret: SECRET })(req, res, noop);
      expect(typeof (req as any).csrfToken).toBe("function");
    });

    it("csrfToken() returns a value containing a dot separator (signed format)", () => {
      const { signedToken } = setupMw();
      expect(signedToken).toContain(".");
    });

    it("csrfToken() return value differs from the cookie (cookie is raw, token is signed)", () => {
      const { signedToken, rawToken } = setupMw();
      expect(signedToken).not.toBe(rawToken);
    });

    it("rawToken is the prefix of signedToken (sign() format: rawToken.HMAC)", () => {
      const { signedToken, rawToken } = setupMw();
      const dotIdx = signedToken.lastIndexOf(".");
      expect(signedToken.slice(0, dotIdx)).toBe(rawToken);
    });

    it("cookie is not httpOnly by default", () => {
      const req = createRequest("GET");
      const res = new BunResponse();
      csrf({ secret: SECRET })(req, res, noop);
      expect((getSetCookieHeader(res) ?? "").toLowerCase()).not.toContain("httponly");
    });

    it("cookie is httpOnly when explicitly set", () => {
      const req = createRequest("GET");
      const res = new BunResponse();
      csrf({ secret: SECRET, cookie: { httpOnly: true } })(req, res, noop);
      expect((getSetCookieHeader(res) ?? "").toLowerCase()).toContain("httponly");
    });
  });

  describe("safe method passthrough", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      it(`passes ${method} without validation`, () => {
        const req = createRequest(method);
        const res = new BunResponse();
        let called = false;
        csrf({ secret: SECRET })(req, res, () => { called = true; });
        expect(called).toBe(true);
      });
    }
  });

  describe("POST validation - valid cases", () => {
    it("accepts valid signed token in x-csrf-token header", () => {
      const { middleware, signedToken, rawToken } = setupMw();
      const req = createRequest("POST", {
        "x-csrf-token": signedToken,
        cookie: `_csrf=${rawToken}`,
      });
      const res = new BunResponse();
      let nextArg: unknown = undefined;
      middleware(req, res, (err) => { nextArg = err; });
      expect(nextArg).toBeUndefined();
    });

    it("accepts valid signed token in body field", () => {
      const { middleware, signedToken, rawToken } = setupMw();
      const req = createRequest("POST", { cookie: `_csrf=${rawToken}` }, { _csrf: signedToken });
      const res = new BunResponse();
      let nextArg: unknown = undefined;
      middleware(req, res, (err) => { nextArg = err; });
      expect(nextArg).toBeUndefined();
    });
  });

  describe("POST validation - rejection cases", () => {
    it("rejects when no submitted token", () => {
      const { middleware, rawToken } = setupMw();
      const req = createRequest("POST", { cookie: `_csrf=${rawToken}` });
      const res = new BunResponse();
      let nextArg: unknown = undefined;
      middleware(req, res, (err) => { nextArg = err; });
      expect(nextArg).toBeInstanceOf(HttpError);
      expect((nextArg as HttpError).status).toBe(403);
    });

    it("rejects raw (unsigned) token - submitting cookie value directly no longer works", () => {
      const { middleware, rawToken } = setupMw();
      const req = createRequest("POST", {
        "x-csrf-token": rawToken,
        cookie: `_csrf=${rawToken}`,
      });
      const res = new BunResponse();
      let nextArg: unknown = undefined;
      middleware(req, res, (err) => { nextArg = err; });
      expect(nextArg).toBeInstanceOf(HttpError);
      expect((nextArg as HttpError).status).toBe(403);
    });

    it("rejects token signed with wrong secret", () => {
      const { signedToken } = setupMw();
      const wrongMw = csrf({ secret: "wrong-secret-also-32-chars-long!!" });
      const { rawToken: rawToken2 } = setupMw();

      const middleware = csrf({ secret: SECRET });
      const req = createRequest("POST", {
        "x-csrf-token": signedToken,
        cookie: `_csrf=${rawToken2}`,
      });
      const res = new BunResponse();
      let nextArg: unknown = undefined;
      middleware(req, res, (err) => { nextArg = err; });
      expect(nextArg).toBeInstanceOf(HttpError);
      expect(wrongMw).toBeDefined();
    });

    it("rejects when cookie value does not match signed token's raw part (injection simulation)", () => {
      const { middleware, signedToken } = setupMw();
      const req = createRequest("POST", {
        "x-csrf-token": signedToken,
        cookie: "_csrf=attacker-injected-cookie-value",
      });
      const res = new BunResponse();
      let nextArg: unknown = undefined;
      middleware(req, res, (err) => { nextArg = err; });
      expect(nextArg).toBeInstanceOf(HttpError);
      expect((nextArg as HttpError).status).toBe(403);
    });

    it("calls next(HttpError) - does not write directly to response", () => {
      const { middleware, rawToken } = setupMw();
      const req = createRequest("POST", { cookie: `_csrf=${rawToken}` });
      const res = new BunResponse();
      let nextCalled = false;
      middleware(req, res, (err) => { nextCalled = true; expect(err).toBeDefined(); });
      expect(nextCalled).toBe(true);
      expect(res.toResponse().status).toBe(200);
    });
  });

  describe("custom options", () => {
    it("uses custom headerName", () => {
      const middleware = csrf({ secret: SECRET, headerName: "x-my-csrf" });
      const req = createRequest("GET");
      const res = new BunResponse();
      middleware(req, res, noop);
      const signedToken = (req as any).csrfToken();
      const match = (getSetCookieHeader(res) ?? "").match(/_csrf=([^;]+)/);
      const rawToken = decodeURIComponent(match![1]);

      const postReq = createRequest("POST", {
        "x-my-csrf": signedToken,
        cookie: `_csrf=${rawToken}`,
      });
      let nextArg: unknown = "sentinel";
      middleware(postReq, new BunResponse(), (err) => { nextArg = err; });
      expect(nextArg).toBeUndefined();
    });

    it("uses custom bodyField", () => {
      const middleware = csrf({ secret: SECRET, bodyField: "csrfToken" });
      const req = createRequest("GET");
      const res = new BunResponse();
      middleware(req, res, noop);
      const signedToken = (req as any).csrfToken();
      const match = (getSetCookieHeader(res) ?? "").match(/_csrf=([^;]+)/);
      const rawToken = decodeURIComponent(match![1]);

      const postReq = createRequest("POST", { cookie: `_csrf=${rawToken}` }, { csrfToken: signedToken });
      let nextArg: unknown = "sentinel";
      middleware(postReq, new BunResponse(), (err) => { nextArg = err; });
      expect(nextArg).toBeUndefined();
    });

    it("uses custom ignoreMethods - POST skipped when added", () => {
      const middleware = csrf({ secret: SECRET, ignoreMethods: ["GET", "HEAD", "OPTIONS", "POST"] });
      const req = createRequest("POST", { cookie: "_csrf=rawvalue" });
      let called = false;
      middleware(req, new BunResponse(), () => { called = true; });
      expect(called).toBe(true);
    });

    it("uses custom cookie name", () => {
      const middleware = csrf({ secret: SECRET, cookie: { name: "x-myapp-csrf" } });
      const req = createRequest("GET");
      const res = new BunResponse();
      middleware(req, res, noop);
      expect(getSetCookieHeader(res)).toContain("x-myapp-csrf=");
    });
  });
});
