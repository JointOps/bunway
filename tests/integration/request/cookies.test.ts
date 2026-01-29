import { describe, expect, it } from "bun:test";
import bunway, { cookieParser, signCookie, unsignCookie } from "../../../src";
import { buildRequest } from "../../utils/testUtils";

describe("req.cookies", () => {
  it("parses cookies from request header", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ cookies: req.cookies });
    });

    const response = await app.handle(
      buildRequest("/test", {
        headers: { Cookie: "name=John; age=30" },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cookies: { name: "John", age: "30" },
    });
  });

  it("handles URL-encoded cookie values", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ cookies: req.cookies });
    });

    const response = await app.handle(
      buildRequest("/test", {
        headers: { Cookie: "message=hello%20world" },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cookies: { message: "hello world" },
    });
  });

  it("handles empty cookie header", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ cookies: req.cookies });
    });

    const response = await app.handle(buildRequest("/test"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cookies: {} });
  });

  it("handles quoted cookie values", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ cookies: req.cookies });
    });

    const response = await app.handle(
      buildRequest("/test", {
        headers: { Cookie: 'token="abc123"' },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cookies: { token: "abc123" } });
  });

  it("handles multiple cookies", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ cookies: req.cookies });
    });

    const response = await app.handle(
      buildRequest("/test", {
        headers: { Cookie: "a=1; b=2; c=3" },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cookies: { a: "1", b: "2", c: "3" },
    });
  });
});

describe("cookieParser middleware", () => {
  it("parses cookies without secret", async () => {
    const app = bunway();
    app.use(cookieParser());
    app.get("/test", (req, res) => {
      res.json({ cookies: req.cookies });
    });

    const response = await app.handle(
      buildRequest("/test", {
        headers: { Cookie: "session=abc123" },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cookies: { session: "abc123" } });
  });

  it("parses signed cookies with secret", async () => {
    const app = bunway();
    const secret = "my-secret-key";
    app.use(cookieParser({ secret }));
    app.get("/test", (req, res) => {
      res.json({
        cookies: req.cookies,
        signedCookies: req.signedCookies,
      });
    });

    const signedValue = signCookie("user123", secret);
    const response = await app.handle(
      buildRequest("/test", {
        headers: { Cookie: `userId=s:${signedValue}; normalCookie=hello` },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.signedCookies.userId).toBe("user123");
    expect(body.cookies.normalCookie).toBe("hello");
  });

  it("rejects tampered signed cookies", async () => {
    const app = bunway();
    app.use(cookieParser({ secret: "my-secret" }));
    app.get("/test", (req, res) => {
      res.json({ signedCookies: req.signedCookies });
    });

    const response = await app.handle(
      buildRequest("/test", {
        headers: { Cookie: "token=s:value.invalid-signature" },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.signedCookies.token).toBeUndefined();
  });
});

describe("signCookie and unsignCookie", () => {
  it("signs and unsigns cookies", () => {
    const secret = "test-secret";
    const value = "my-value";

    const signed = signCookie(value, secret);
    expect(signed).toContain(value);
    expect(signed).toContain(".");

    const unsigned = unsignCookie(signed, [secret]);
    expect(unsigned).toBe(value);
  });

  it("returns false for invalid signature", () => {
    const result = unsignCookie("value.invalid", ["secret"]);
    expect(result).toBe(false);
  });

  it("tries multiple secrets", () => {
    const oldSecret = "old-secret";
    const newSecret = "new-secret";
    const value = "my-value";

    const signed = signCookie(value, oldSecret);
    const unsigned = unsignCookie(signed, [newSecret, oldSecret]);

    expect(unsigned).toBe(value);
  });
});
