import { describe, expect, it } from "bun:test";
import { cookieParser } from "../../../src/middleware/cookie-parser";
import { sign } from "../../../src/utils/crypto";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

function makeReq(cookieHeader?: string): BunRequest {
  const headers: Record<string, string> = {};
  if (cookieHeader) {
    headers["cookie"] = cookieHeader;
  }
  return new BunRequest(
    new Request("http://localhost/test", { headers }),
    "/test",
  );
}

describe("Cookie Parser Middleware (Unit)", () => {
  it("without secret: calls next and does not modify cookies", () => {
    const handler = cookieParser();
    const req = makeReq("name=alice; theme=dark");
    const res = new BunResponse();
    let called = false;

    handler(req, res, () => { called = true; });

    expect(called).toBe(true);
    expect(req.cookies.name).toBe("alice");
    expect(req.cookies.theme).toBe("dark");
  });

  it("with secret: moves signed cookies to req.signedCookies", () => {
    const secret = "my-secret";
    const signedValue = sign("hello", secret);
    const handler = cookieParser({ secret });
    const req = makeReq(`token=s:${signedValue}; plain=world`);
    const res = new BunResponse();

    handler(req, res, () => {});

    expect(req.signedCookies.token).toBe("hello");
    expect(req.cookies.token).toBeUndefined();
    expect(req.cookies.plain).toBe("world");
  });

  it("signed cookie prefixed with s: gets unsigned", () => {
    const secret = "sign-test";
    const signedValue = sign("user-42", secret);
    const handler = cookieParser({ secret });
    const req = makeReq(`sid=s:${signedValue}`);
    const res = new BunResponse();

    handler(req, res, () => {});

    expect(req.signedCookies.sid).toBe("user-42");
    expect(req.cookies.sid).toBeUndefined();
  });

  it("invalid signed cookie stays in req.cookies", () => {
    const handler = cookieParser({ secret: "correct-secret" });
    const req = makeReq("bad=s:tampered-value.invalidsignature");
    const res = new BunResponse();

    handler(req, res, () => {});

    expect(req.cookies.bad).toBe("s:tampered-value.invalidsignature");
    expect(req.signedCookies.bad).toBeUndefined();
  });

  it("array of secrets supports key rotation", () => {
    const oldSecret = "old-secret";
    const newSecret = "new-secret";
    const signedWithOld = sign("rotated-value", oldSecret);
    const handler = cookieParser({ secret: [newSecret, oldSecret] });
    const req = makeReq(`data=s:${signedWithOld}`);
    const res = new BunResponse();

    handler(req, res, () => {});

    expect(req.signedCookies.data).toBe("rotated-value");
    expect(req.cookies.data).toBeUndefined();
  });

  it("mix of signed and unsigned cookies", () => {
    const secret = "mix-secret";
    const signedA = sign("value-a", secret);
    const signedB = sign("value-b", secret);
    const handler = cookieParser({ secret });
    const req = makeReq(
      `signed1=s:${signedA}; plain1=foo; signed2=s:${signedB}; plain2=bar`,
    );
    const res = new BunResponse();

    handler(req, res, () => {});

    expect(req.signedCookies.signed1).toBe("value-a");
    expect(req.signedCookies.signed2).toBe("value-b");
    expect(req.cookies.plain1).toBe("foo");
    expect(req.cookies.plain2).toBe("bar");
    expect(req.cookies.signed1).toBeUndefined();
    expect(req.cookies.signed2).toBeUndefined();
  });

  it("no cookies: calls next normally", () => {
    const handler = cookieParser({ secret: "some-secret" });
    const req = makeReq();
    const res = new BunResponse();
    let called = false;

    handler(req, res, () => { called = true; });

    expect(called).toBe(true);
  });

  it("empty options: calls next", () => {
    const handler = cookieParser({});
    const req = makeReq("a=1");
    const res = new BunResponse();
    let called = false;

    handler(req, res, () => { called = true; });

    expect(called).toBe(true);
    expect(req.cookies.a).toBe("1");
  });

  it("cookie with s: prefix but no secret configured stays untouched", () => {
    const handler = cookieParser();
    const req = makeReq("tok=s:some.signed.value");
    const res = new BunResponse();

    handler(req, res, () => {});

    expect(req.cookies.tok).toBe("s:some.signed.value");
  });

  it("only first matching secret is used for unsigned value", () => {
    const secret1 = "secret-one";
    const secret2 = "secret-two";
    const signedWithFirst = sign("data", secret1);
    const handler = cookieParser({ secret: [secret1, secret2] });
    const req = makeReq(`val=s:${signedWithFirst}`);
    const res = new BunResponse();

    handler(req, res, () => {});

    expect(req.signedCookies.val).toBe("data");
  });
});
