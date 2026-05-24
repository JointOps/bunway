import { describe, it, expect, beforeEach } from "bun:test";
import { Passport } from "../../../src/middleware/passport";
import type { Strategy, AuthenticateOptions } from "../../../src/middleware/passport";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

function makeReqRes(url = "http://localhost/", method = "GET") {
  const req = new BunRequest(new Request(url, { method })) as any;
  const res = new BunResponse() as any;
  return { req, res };
}

function makeStrategy(name: string, action: (ctx: any, req: any, opts: any) => void): Strategy {
  // authenticate must be on the prototype — the source does Object.getPrototypeOf(strategy).authenticate
  const proto = {
    authenticate(req: any, opts: any) {
      action(this, req, opts);
    },
  };
  return Object.assign(Object.create(proto), { name }) as Strategy;
}

describe("Passport", () => {
  describe("use() / unuse()", () => {
    it("use(strategy) registers strategy by its name", () => {
      const p = new Passport();
      const s = makeStrategy("local", () => {});
      p.use(s);
      // Verify it is retrievable by authenticating
      const { req, res } = makeReqRes();
      req._passport = { instance: p };
      req.login = (_u: any, _o: any, done?: () => void) => done?.();
      let succeeded = false;
      p.authenticate("local")(req, res, () => {});
      // strategy was found and called (no "Unknown strategy" error thrown)
    });

    it("use(name, strategy) registers under a custom name", () => {
      const p = new Passport();
      const s = makeStrategy("original", (ctx) => ctx.success({ id: 1 }));
      p.use("custom-name", s);

      const { req, res } = makeReqRes();
      req._passport = { instance: p };
      req.login = (_u: any, _o: any, done?: () => void) => done?.();

      let user: any;
      p.authenticate("custom-name", (_err: any, u: any) => { user = u; })(req, res, () => {});
      expect(user).toEqual({ id: 1 });
    });

    it("use() returns this for chaining", () => {
      const p = new Passport();
      const s = makeStrategy("local", () => {});
      expect(p.use(s)).toBe(p);
    });

    it("unuse() removes a strategy", () => {
      const p = new Passport();
      p.use(makeStrategy("local", () => {}));
      p.unuse("local");

      const { req, res } = makeReqRes();
      let errPassed: any;
      p.authenticate("local")(req, res, (err) => { errPassed = err; });
      expect(errPassed?.message).toContain("Unknown authentication strategy");
    });

    it("unuse() returns this for chaining", () => {
      const p = new Passport();
      expect(p.unuse("nonexistent")).toBe(p);
    });
  });

  describe("initialize()", () => {
    it("attaches req.login, req.logout, req.isAuthenticated, req.isUnauthenticated", () => {
      const p = new Passport();
      const { req, res } = makeReqRes();
      let nextCalled = false;
      p.initialize()(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(typeof req.login).toBe("function");
      expect(typeof req.logout).toBe("function");
      expect(typeof req.isAuthenticated).toBe("function");
      expect(typeof req.isUnauthenticated).toBe("function");
    });

    it("req.isAuthenticated() returns false before login", () => {
      const p = new Passport();
      const { req, res } = makeReqRes();
      p.initialize()(req, res, () => {});
      expect(req.isAuthenticated()).toBe(false);
    });

    it("req.login sets user and calls done", (done) => {
      const p = new Passport();
      const { req, res } = makeReqRes();
      p.initialize()(req, res, () => {});
      req.login({ id: 42 }, { session: false }, (err?: Error) => {
        expect(err).toBeUndefined();
        expect(req.isAuthenticated()).toBe(true);
        done();
      });
    });

    it("req.login serializes to session when session:true and serializeUser registered", (done) => {
      const p = new Passport();
      p.serializeUser((user: any, cb) => cb(null, user.id));
      const { req, res } = makeReqRes();
      req.session = {} as any;
      p.initialize()(req, res, () => {});
      req.login({ id: 7 }, { session: true }, (err?: Error) => {
        expect(err).toBeUndefined();
        expect(req.session.passport?.user).toBe(7);
        done();
      });
    });

    it("req.logout clears user and session.passport", () => {
      const p = new Passport();
      const { req, res } = makeReqRes();
      p.initialize()(req, res, () => {});
      req.user = { id: 1 };
      req.session = { passport: { user: 1 } };
      req.logout();
      expect(req.user).toBeNull();
      expect(req.session.passport).toBeUndefined();
    });

    it("req.isUnauthenticated() is inverse of isAuthenticated()", (done) => {
      const p = new Passport();
      const { req, res } = makeReqRes();
      p.initialize()(req, res, () => {});
      expect(req.isUnauthenticated()).toBe(true);
      req.login({ id: 1 }, { session: false }, () => {
        expect(req.isUnauthenticated()).toBe(false);
        done();
      });
    });

    it("userProperty option changes where user is attached", (done) => {
      const p = new Passport();
      const { req, res } = makeReqRes();
      p.initialize({ userProperty: "account" })(req, res, () => {});
      req.login({ id: 99 }, { session: false }, () => {
        expect(req.account).toEqual({ id: 99 });
        expect(req.user).toBeUndefined();
        done();
      });
    });
  });

  describe("session()", () => {
    it("calls next() immediately when no session present", () => {
      const p = new Passport();
      const { req, res } = makeReqRes();
      let nextCalled = false;
      p.session()(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("calls next() when session has no passport.user", () => {
      const p = new Passport();
      const { req, res } = makeReqRes();
      req.session = {};
      let nextCalled = false;
      p.session()(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("calls next() when no deserializeUser registered", () => {
      const p = new Passport();
      const { req, res } = makeReqRes();
      req.session = { passport: { user: 1 } };
      let nextCalled = false;
      p.session()(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("deserializes user from session and attaches to req", (done) => {
      const p = new Passport();
      p.deserializeUser((id: any, cb) => cb(null, { id, name: "Alice" }));
      const { req, res } = makeReqRes();
      req.session = { passport: { user: 5 } };
      p.initialize()(req, res, () => {});
      p.session()(req, res, () => {
        expect(req.user).toEqual({ id: 5, name: "Alice" });
        done();
      });
    });

    it("clears session.passport when deserializer returns false", (done) => {
      const p = new Passport();
      p.deserializeUser((_id: any, cb) => cb(null, false));
      const { req, res } = makeReqRes();
      req.session = { passport: { user: 99 } };
      p.session()(req, res, () => {
        expect(req.session.passport).toBeUndefined();
        done();
      });
    });

    it("passes error to next() when deserializer errors", (done) => {
      const p = new Passport();
      p.deserializeUser((_id: any, cb) => cb(new Error("db down")));
      const { req, res } = makeReqRes();
      req.session = { passport: { user: 1 } };
      p.session()(req, res, (err: any) => {
        expect(err?.message).toBe("db down");
        done();
      });
    });
  });

  describe("authenticate()", () => {
    it("calls success action and invokes next() on auth success", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.success({ id: 1 })));
      const { req, res } = makeReqRes();
      req.login = (_u: any, _o: any, done?: () => void) => done?.();
      let nextCalled = false;
      p.authenticate("local")(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("responds 401 when strategy fails with no redirect", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.fail("Invalid credentials")));
      const { req, res } = makeReqRes();
      let status = 0;
      res.status = (s: number) => { status = s; return res; };
      res.json = () => {};
      p.authenticate("local")(req, res, () => {});
      expect(status).toBe(401);
    });

    it("redirects on successRedirect after success", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.success({ id: 1 })));
      const { req, res } = makeReqRes();
      req.login = (_u: any, _o: any, done?: () => void) => done?.();
      let redirectUrl = "";
      res.redirect = (url: string) => { redirectUrl = url; };
      p.authenticate("local", { successRedirect: "/dashboard" })(req, res, () => {});
      expect(redirectUrl).toBe("/dashboard");
    });

    it("redirects on failureRedirect when strategy fails", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.fail()));
      const { req, res } = makeReqRes();
      let redirectUrl = "";
      res.redirect = (url: string) => { redirectUrl = url; };
      p.authenticate("local", { failureRedirect: "/login" })(req, res, () => {});
      expect(redirectUrl).toBe("/login");
    });

    it("passes error to next() when failWithError is set and strategy fails", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.fail("bad creds")));
      const { req, res } = makeReqRes();
      let nextErr: any;
      p.authenticate("local", { failWithError: true })(req, res, (err) => { nextErr = err; });
      expect((nextErr as Error)?.message).toBe("Unauthorized");
      expect((nextErr as any)?.status).toBe(401);
    });

    it("custom callback receives (null, user, info) on success", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.success({ id: 5 }, { scope: "all" })));
      const { req, res } = makeReqRes();
      let cbArgs: any[] = [];
      p.authenticate("local", (err: any, user: any, info: any) => {
        cbArgs = [err, user, info];
      })(req, res, () => {});
      expect(cbArgs[0]).toBeNull();
      expect(cbArgs[1]).toEqual({ id: 5 });
      expect(cbArgs[2]).toEqual({ scope: "all" });
    });

    it("custom callback receives (null, false, challenge) on failure", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.fail("wrong password")));
      const { req, res } = makeReqRes();
      let cbArgs: any[] = [];
      p.authenticate("local", (err: any, user: any, info: any) => {
        cbArgs = [err, user, info];
      })(req, res, () => {});
      expect(cbArgs[0]).toBeNull();
      expect(cbArgs[1]).toBe(false);
      expect(cbArgs[2]).toBe("wrong password");
    });

    it("custom callback receives (err) when strategy calls error()", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.error(new Error("db error"))));
      const { req, res } = makeReqRes();
      let cbErr: any;
      p.authenticate("local", (err: any) => { cbErr = err; })(req, res, () => {});
      expect(cbErr?.message).toBe("db error");
    });

    it("passes error to next() when strategy calls error() without callback", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.error(new Error("strategy err"))));
      const { req, res } = makeReqRes();
      let nextErr: any;
      p.authenticate("local")(req, res, (err) => { nextErr = err; });
      expect((nextErr as Error)?.message).toBe("strategy err");
    });

    it("unknown strategy passes error to next()", () => {
      const p = new Passport();
      const { req, res } = makeReqRes();
      let nextErr: any;
      p.authenticate("ghost")(req, res, (err) => { nextErr = err; });
      expect((nextErr as Error)?.message).toContain("Unknown authentication strategy");
    });

    it("strategy that throws is caught and passed to next()", () => {
      const p = new Passport();
      p.use(makeStrategy("local", () => { throw new Error("bang"); }));
      const { req, res } = makeReqRes();
      let nextErr: any;
      p.authenticate("local")(req, res, (err) => { nextErr = err; });
      expect((nextErr as Error)?.message).toBe("bang");
    });

    it("multi-strategy: second strategy succeeds when first fails", () => {
      const p = new Passport();
      p.use(makeStrategy("s1", (ctx) => ctx.fail("no")));
      p.use(makeStrategy("s2", (ctx) => ctx.success({ id: 2 })));
      const { req, res } = makeReqRes();
      req.login = (_u: any, _o: any, done?: () => void) => done?.();
      let nextCalled = false;
      p.authenticate(["s1", "s2"])(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("multi-strategy: all fail → callback gets (null, false, [challenges])", () => {
      const p = new Passport();
      p.use(makeStrategy("s1", (ctx) => ctx.fail("chal-1")));
      p.use(makeStrategy("s2", (ctx) => ctx.fail("chal-2")));
      const { req, res } = makeReqRes();
      let cbArgs: any[] = [];
      p.authenticate(["s1", "s2"], (err: any, user: any, info: any) => {
        cbArgs = [err, user, info];
      })(req, res, () => {});
      expect(cbArgs[1]).toBe(false);
      expect(cbArgs[2]).toEqual(["chal-1", "chal-2"]);
    });

    it("assignProperty attaches user to custom key instead of calling login()", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.success({ id: 3 })));
      const { req, res } = makeReqRes();
      req.login = () => { throw new Error("should not be called"); };
      let nextCalled = false;
      p.authenticate("local", { assignProperty: "account" })(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(req.account).toEqual({ id: 3 });
    });

    it("actionContext.redirect() triggers res.redirect()", () => {
      const p = new Passport();
      p.use(makeStrategy("oauth", (ctx) => ctx.redirect("https://oauth.example.com/auth")));
      const { req, res } = makeReqRes();
      let redirected = "";
      res.redirect = (_status: any, url?: any) => { redirected = url ?? _status; };
      p.authenticate("oauth")(req, res, () => {});
      expect(redirected).toContain("oauth.example.com");
    });

    it("actionContext.pass() calls next() without setting user", () => {
      const p = new Passport();
      p.use(makeStrategy("optional", (ctx) => ctx.pass()));
      const { req, res } = makeReqRes();
      let nextCalled = false;
      p.authenticate("optional")(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(req.user).toBeUndefined();
    });
  });

  describe("authorize()", () => {
    it("attaches user to req.account on success (no callback)", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.success({ id: 10 })));
      const { req, res } = makeReqRes();
      let nextCalled = false;
      p.authorize("local")(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(req.account).toEqual({ id: 10 });
    });

    it("with callback, callback receives user like authenticate()", () => {
      const p = new Passport();
      p.use(makeStrategy("local", (ctx) => ctx.success({ id: 10 })));
      const { req, res } = makeReqRes();
      let cbUser: any;
      p.authorize("local", {}, (_err: any, user: any) => { cbUser = user; })(req, res, () => {});
      expect(cbUser).toEqual({ id: 10 });
    });
  });
});
