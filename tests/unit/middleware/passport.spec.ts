/**
 * Passport adapter smoke tests.
 *
 * These tests verify Bunway's passport compatibility shim using a typed mock that
 * matches the PassportJS interface. They do NOT require the 'passport' npm package.
 * They guard: headers proxy, req.login/logout/isAuthenticated, session deserialization,
 * and the fail-fast check in passportAuthenticate.
 */

import { describe, expect, it } from "bun:test";
import { passportInitialize, passportSession, passportAuthenticate } from "../../../src/middleware/passport";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

// ── Minimal mock that satisfies the PassportLike interface ────────────────────

type DoneCallback = (err?: unknown, value?: unknown) => void;

function makePassportMock(overrides: {
  serializeUser?: (user: unknown, req: BunRequest, done: DoneCallback) => void;
  deserializeUser?: (obj: unknown, req: BunRequest, done: DoneCallback) => void;
  authenticate?: (strategyName: string | string[], options: Record<string, unknown>) => (req: BunRequest, res: BunResponse, next: (err?: unknown) => void) => void;
} = {}) {
  return {
    serializeUser: overrides.serializeUser ?? ((_user: unknown, _req: BunRequest, done: DoneCallback) => done(undefined, "mock-serial")),
    deserializeUser: overrides.deserializeUser ?? ((obj: unknown, _req: BunRequest, done: DoneCallback) => done(undefined, { id: obj })),
    authenticate: overrides.authenticate ?? ((_name: string | string[], _opts: Record<string, unknown>) => (
      (req: BunRequest, _res: BunResponse, next: (err?: unknown) => void) => {
        (req as any).user = { id: "mocked", strategy: _name };
        next();
      }
    )),
  };
}

function makeRequest(headers: Record<string, string> = {}, path = "/"): BunRequest {
  return new BunRequest(new Request(`http://localhost${path}`, { headers }), path);
}

function makeResponse(): BunResponse {
  return new BunResponse();
}

async function callMiddleware(
  mw: (req: BunRequest, res: BunResponse, next: (err?: unknown) => void) => void | Promise<void>,
  req: BunRequest,
  res = makeResponse()
): Promise<unknown> {
  let nextArg: unknown = "NOT_CALLED";
  await mw(req, res, (err) => { nextArg = err; });
  return nextArg;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("passport adapter (Unit)", () => {
  describe("passportInitialize()", () => {
    it("calls next() without error", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      const result = await callMiddleware(mw, req);
      expect(result).toBeUndefined();
    });

    it("attaches req.isAuthenticated() — returns false when req.user is unset", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      await callMiddleware(mw, req);
      expect(req.isAuthenticated()).toBe(false);
    });

    it("req.isAuthenticated() returns true after req.user is set", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      await callMiddleware(mw, req);
      req.user = { id: "alice" };
      expect(req.isAuthenticated()).toBe(true);
    });

    it("req.isUnauthenticated() is inverse of isAuthenticated()", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      await callMiddleware(mw, req);
      expect(req.isUnauthenticated()).toBe(true);
      req.user = { id: "x" };
      expect(req.isUnauthenticated()).toBe(false);
    });

    it("attaches req.login / req.logIn — sets req.user", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      await callMiddleware(mw, req);
      await (req as any).login({ id: "user-99" }, { session: false });
      expect(req.user?.id).toBe("user-99");
    });

    it("attaches req.logout — clears req.user", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      await callMiddleware(mw, req);
      req.user = { id: "x" };
      await (req as any).logout();
      expect(req.user).toBeUndefined();
    });

    it("req._passport is populated", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      await callMiddleware(mw, req);
      expect((req as any)._passport).toBeDefined();
      expect((req as any)._passport.instance).toBe(pp);
    });

    it("shimmed res has setHeader()", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      const res = makeResponse();
      await callMiddleware(mw, req, res);
      expect(typeof (res as any).setHeader).toBe("function");
    });

    it("shimmed res.setHeader() delegates to res.set()", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      const res = makeResponse();
      await callMiddleware(mw, req, res);
      (res as any).setHeader("X-Test-Shim", "yes");
      expect(res.get("X-Test-Shim")).toBe("yes");
    });

    it("req.connection.remoteAddress is accessible", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      await callMiddleware(mw, req);
      expect((req as any).connection).toBeDefined();
      expect(typeof (req as any).connection.remoteAddress).toBe("string");
    });
  });

  describe("headers proxy — the critical Passport strategy compat layer", () => {
    it("req.headers['authorization'] works like req.get('authorization')", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest({ authorization: "Bearer test-token-123" });
      await callMiddleware(mw, req);

      const proxy = req.headers as any;
      expect(proxy["authorization"]).toBe("Bearer test-token-123");
    });

    it("req.headers['Authorization'] works case-insensitively", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest({ authorization: "Bearer case-test" });
      await callMiddleware(mw, req);

      const proxy = req.headers as any;
      expect(proxy["Authorization"]).toBe("Bearer case-test");
    });

    it("req.headers[header] returns undefined for missing header", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest();
      await callMiddleware(mw, req);

      const proxy = req.headers as any;
      expect(proxy["x-api-key"]).toBeUndefined();
    });

    it("proxy is only applied once (idempotent)", async () => {
      const pp = makePassportMock();
      const mw = passportInitialize(pp);
      const req = makeRequest({ authorization: "Bearer once-only" });

      await callMiddleware(mw, req);
      await callMiddleware(mw, req);

      const proxy = req.headers as any;
      expect(proxy["authorization"]).toBe("Bearer once-only");
    });
  });

  describe("passportSession()", () => {
    it("calls next() when req.session is absent", async () => {
      const pp = makePassportMock();
      const mw = passportSession(pp);
      const req = makeRequest();
      const result = await callMiddleware(mw, req);
      expect(result).toBeUndefined();
    });

    it("calls next() when session has no passport.user", async () => {
      const pp = makePassportMock();
      const mw = passportSession(pp);
      const req = makeRequest();
      (req as any).session = { passport: {}, save: (cb: () => void) => cb() };
      const result = await callMiddleware(mw, req);
      expect(result).toBeUndefined();
    });

    it("deserializes user from session.passport.user and sets req.user", async () => {
      const pp = makePassportMock({
        deserializeUser: (obj, _req, done) => done(undefined, { id: obj, name: "Restored" }),
      });
      const mw = passportSession(pp);
      const req = makeRequest();
      (req as any).session = { passport: { user: "user-id-from-db" }, save: (cb: () => void) => cb() };

      await callMiddleware(mw, req);
      expect(req.user?.id).toBe("user-id-from-db");
      expect((req.user as any)?.name).toBe("Restored");
    });

    it("sets req.user to undefined when deserialization fails (soft fail)", async () => {
      const pp = makePassportMock({
        deserializeUser: (_obj, _req, done) => done(new Error("DB error")),
      });
      const mw = passportSession(pp);
      const req = makeRequest();
      (req as any).session = { passport: { user: "stale-id" }, save: (cb: () => void) => cb() };

      await callMiddleware(mw, req);
      expect(req.user).toBeUndefined();
    });
  });

  describe("passportAuthenticate()", () => {
    it("fails fast with clear error when passportInitialize() was not called first", async () => {
      const pp = makePassportMock();
      const mw = passportAuthenticate(pp, "local");
      const req = makeRequest();
      const result = await callMiddleware(mw, req);
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain("passportInitialize()");
    });

    it("delegates to passport.authenticate() after initialize", async () => {
      const pp = makePassportMock();
      const init = passportInitialize(pp);
      const auth = passportAuthenticate(pp, "mock-strategy");

      const req = makeRequest({ authorization: "Bearer tok" });
      await callMiddleware(init, req);
      const result = await callMiddleware(auth, req);

      expect(result).toBeUndefined();
      expect((req as any).user?.strategy).toBe("mock-strategy");
    });
  });

  describe("passport convenience object", () => {
    it("passport.initialize === passportInitialize", async () => {
      const { passport } = await import("../../../src/middleware/passport");
      expect(passport.initialize).toBe(passportInitialize);
    });

    it("passport.session === passportSession", async () => {
      const { passport } = await import("../../../src/middleware/passport");
      expect(passport.session).toBe(passportSession);
    });

    it("passport.authenticate === passportAuthenticate", async () => {
      const { passport } = await import("../../../src/middleware/passport");
      expect(passport.authenticate).toBe(passportAuthenticate);
    });
  });
});
