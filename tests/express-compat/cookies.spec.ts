import { describe, test, expect } from "bun:test";
import bunway from "../../src";
import { signCookie } from "../../src";
import { buildRequest } from "../utils/testUtils";

describe("Express Compatibility: Cookie Handling", () => {
  test("bunway.cookieParser() parses cookies like cookie-parser", async () => {
    const app = bunway();
    app.use(bunway.cookieParser());
    app.get("/test", (req, res) => {
      res.json({ cookies: req.cookies });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "Cookie": "session=abc123; user=john" }
    }));

    expect(await response.json()).toEqual({
      cookies: { session: "abc123", user: "john" }
    });
  });

  test("res.cookie() sets cookies like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.cookie("session", "xyz789", { httpOnly: true, maxAge: 3600000 });
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("session=xyz789");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Max-Age=3600000");
  });

  test("res.clearCookie() clears cookies like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.clearCookie("session");
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("session=");
    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970");
  });

  test("Cookie parser with secret verifies HMAC signed cookies like Express", async () => {
    const secret = "test-secret-key";
    const originalValue = "user-session-data";
    const signed = signCookie(originalValue, secret);

    const app = bunway();
    app.use(bunway.cookieParser(secret));

    app.get("/test", (req, res) => {
      res.json({
        unsigned: req.signedCookies["session"],
        inSignedCookies: "session" in req.signedCookies,
        notInPlain: !("session" in req.cookies)
      });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "Cookie": `session=s:${signed}` }
    }));
    const data = await response.json() as { unsigned: string; inSignedCookies: boolean; notInPlain: boolean };
    expect(data.inSignedCookies).toBe(true);
    expect(data.unsigned).toBe(originalValue);
    expect(data.notInPlain).toBe(true);
  });

  test("Cookie parser rejects tampered signed cookies like Express", async () => {
    const app = bunway();
    app.use(bunway.cookieParser("real-secret"));

    app.get("/test", (req, res) => {
      res.json({
        signedCookiesEmpty: Object.keys(req.signedCookies).length === 0,
        tamperedInPlain: "session" in req.cookies
      });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "Cookie": "session=s:tampered-value.bad-signature" }
    }));
    const data = await response.json() as { signedCookiesEmpty: boolean; tamperedInPlain: boolean };
    expect(data.signedCookiesEmpty).toBe(true);
    expect(data.tamperedInPlain).toBe(true);
  });

  test("Cookie options work like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.cookie("session", "test", {
        domain: "example.com",
        path: "/api",
        secure: true,
        httpOnly: true,
        sameSite: "strict"
      });
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("Domain=example.com");
    expect(setCookie).toContain("Path=/api");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
  });
});
