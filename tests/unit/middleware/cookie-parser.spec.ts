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

  it("tampered signed cookie → req.signedCookies[name] === false, absent from req.cookies", () => {
    const handler = cookieParser({ secret: "correct-secret" });
    const req = makeReq("bad=s:tampered-value.invalidsignature");
    const res = new BunResponse();

    handler(req, res, () => {});

    expect(req.signedCookies.bad).toBe(false);
    expect(req.cookies.bad).toBeUndefined();
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

  describe("Phase 14 — JSON cookies (j: prefix)", () => {
    it("j: prefixed plain cookie value is parsed as a JSON object", () => {
      const handler = cookieParser({ secret: "s" });
      const req = makeReq('prefs=j:{"theme":"dark","lang":"en"}');
      const res = new BunResponse();
      handler(req, res, () => {});
      expect(req.cookies.prefs).toEqual({ theme: "dark", lang: "en" });
    });

    it("j: with invalid JSON is left as-is (raw string)", () => {
      const handler = cookieParser({ secret: "s" });
      const req = makeReq("broken=j:{not valid json}");
      const res = new BunResponse();
      handler(req, res, () => {});
      expect(req.cookies.broken).toBe("j:{not valid json}");
    });

    it("non j: cookie is not JSON-parsed", () => {
      const handler = cookieParser({ secret: "s" });
      const req = makeReq("name=alice");
      const res = new BunResponse();
      handler(req, res, () => {});
      expect(req.cookies.name).toBe("alice");
      expect(typeof req.cookies.name).toBe("string");
    });

    it("j: prefixed signed cookie is parsed as JSON after signature verification", () => {
      const secret = "json-sign";
      const jsonStr = 'j:{"role":"admin"}';
      const signed = sign(jsonStr, secret);
      const handler = cookieParser({ secret });
      const req = makeReq(`auth=s:${signed}`);
      const res = new BunResponse();
      handler(req, res, () => {});
      expect(req.signedCookies.auth).toEqual({ role: "admin" });
    });

    it("j: prefix on tampered signed cookie → signedCookies[name] === false (not parsed)", () => {
      const handler = cookieParser({ secret: "s" });
      const badSig = "A".repeat(43);
      const req = makeReq(`cfg=s:j:{"admin":true}.${badSig}`);
      const res = new BunResponse();
      handler(req, res, () => {});
      expect(req.signedCookies.cfg).toBe(false);
    });
  });

  describe("Phase 4 — tampered signed cookies produce false in signedCookies", () => {
    it("wrong-secret tampered cookie → signedCookies[name] === false", () => {
      const handler = cookieParser({ secret: "correct" });
      // Signature length is fixed for base64url SHA-256; craft a structurally valid but wrong sig
      const badSig = "A".repeat(43); // 43-char base64url — wrong but structurally plausible
      const req = makeReq(`tok=s:realval.${badSig}`);
      const res = new BunResponse();
      handler(req, res, () => {});
      expect(req.signedCookies.tok).toBe(false);
      expect(req.cookies.tok).toBeUndefined();
    });

    it("valid cookie → string, tampered cookie → false in same request", () => {
      const secret = "mix";
      const validSigned = sign("good", secret);
      const handler = cookieParser({ secret });
      const req = makeReq(`valid=s:${validSigned}; tampered=s:bad.${"B".repeat(43)}`);
      const res = new BunResponse();
      handler(req, res, () => {});
      expect(req.signedCookies.valid).toBe("good");
      expect(req.signedCookies.tampered).toBe(false);
      expect(req.cookies.valid).toBeUndefined();
      expect(req.cookies.tampered).toBeUndefined();
    });
  });

  describe("Phase 15 — decode option", () => {
    it("custom decode function is applied to cookie values before processing", () => {
      const handler = cookieParser({
        decode: (v) => v.split("").reverse().join(""), // reverse each value
      });
      const req = makeReq("name=ecila"); // reversed: "alice"
      const res = new BunResponse();
      handler(req, res, () => {});
      expect(req.cookies.name).toBe("alice");
    });

    it("decode errors are caught and original value is kept", () => {
      const handler = cookieParser({
        decode: (v) => { if (v === "bad") throw new Error("decode failed"); return v; },
      });
      const req = makeReq("good=ok; broken=bad");
      const res = new BunResponse();
      handler(req, res, () => {});
      expect(req.cookies.good).toBe("ok");
      expect(req.cookies.broken).toBe("bad"); // decode errored → original kept
    });
  });

  describe("Phase 15 — idempotency guard", () => {
    it("second invocation of cookieParser is a no-op (next() still called)", () => {
      const secret = "idem-secret";
      const signed = sign("value", secret);
      const handler = cookieParser({ secret });
      const req = makeReq(`tok=s:${signed}`);
      const res = new BunResponse();

      let nextCount = 0;
      handler(req, res, () => { nextCount++; });
      handler(req, res, () => { nextCount++; }); // second mount — idempotency guard kicks in

      expect(nextCount).toBe(2); // next() called both times (guard only skips parsing)
      expect(req.signedCookies.tok).toBe("value"); // parsed once, still correct
      expect(req.cookies.tok).toBeUndefined();
    });

    it("_cookiesParsed flag is set after first run", () => {
      const handler = cookieParser({ secret: "s" });
      const req = makeReq("a=1");
      const res = new BunResponse();
      handler(req, res, () => {});
      expect((req as any)._cookiesParsed).toBe(true);
    });
  });
});
