import { describe, expect, it } from "bun:test";
import { json, urlencoded, text, raw } from "../../../src/middleware/body-parser";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

const createPostRequest = (
  contentType: string,
  body: string | ArrayBuffer,
  path = "/test"
): BunRequest => {
  return new BunRequest(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    }),
    path
  );
};

const noop = () => {};

describe("body-parser middleware (Unit)", () => {
  describe("json()", () => {
    it("should skip if body is already parsed", async () => {
      const req = createPostRequest("application/json", JSON.stringify({ a: 1 }));
      req.body = { existing: true };
      const res = new BunResponse();
      let called = false;

      await json()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toEqual({ existing: true });
    });

    it("should skip if no content-type header", async () => {
      const req = new BunRequest(
        new Request("http://localhost/test", {
          method: "POST",
          body: JSON.stringify({ a: 1 }),
        }),
        "/test"
      );
      const res = new BunResponse();
      let called = false;

      await json()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toBeUndefined();
    });

    it("should skip if content-type does not match", async () => {
      const req = createPostRequest("text/plain", "hello");
      const res = new BunResponse();
      let called = false;

      await json()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toBeUndefined();
    });

    it("should parse valid JSON body", async () => {
      const payload = { hello: "world", count: 42 };
      const req = createPostRequest("application/json", JSON.stringify(payload));
      const res = new BunResponse();
      let called = false;

      await json()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toEqual(payload);
    });

    it("should return 400 for invalid JSON", async () => {
      const req = createPostRequest("application/json", "{invalid json}");
      const res = new BunResponse();
      let called = false;

      await json()(req, res, () => { called = true; });

      expect(called).toBe(false);
      const response = res.toResponse();
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Invalid JSON");
    });

    it("should return 413 for oversized body", async () => {
      const largePayload = JSON.stringify({ data: "x".repeat(200) });
      const req = createPostRequest("application/json", largePayload);
      const res = new BunResponse();
      let called = false;

      await json({ limit: 10 })(req, res, () => { called = true; });

      expect(called).toBe(false);
      const response = res.toResponse();
      expect(response.status).toBe(413);
    });

    it("should accept custom type matcher as string", async () => {
      const req = createPostRequest("application/vnd.api+json", JSON.stringify({ ok: true }));
      const res = new BunResponse();
      let called = false;

      await json({ type: "vnd.api+json" })(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toEqual({ ok: true });
    });

    it("should accept custom type matcher as RegExp", async () => {
      const req = createPostRequest("application/json; charset=utf-8", JSON.stringify({ ok: true }));
      const res = new BunResponse();
      let called = false;

      await json({ type: /^application\/json/ })(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toEqual({ ok: true });
    });

    it("should accept custom type matcher as function", async () => {
      const req = createPostRequest("application/json", JSON.stringify({ ok: true }));
      const res = new BunResponse();
      let called = false;

      const matcher = (ct: string) => ct.startsWith("application/");
      await json({ type: matcher })(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toEqual({ ok: true });
    });
  });

  describe("urlencoded()", () => {
    it("should skip non-urlencoded content types", async () => {
      const req = createPostRequest("application/json", JSON.stringify({ a: 1 }));
      const res = new BunResponse();
      let called = false;

      await urlencoded()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toBeUndefined();
    });

    it("should parse form data", async () => {
      const req = createPostRequest(
        "application/x-www-form-urlencoded",
        "name=John&age=30"
      );
      const res = new BunResponse();
      let called = false;

      await urlencoded()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toEqual({ name: "John", age: "30" });
    });

    it("should return 413 for oversized body", async () => {
      const req = createPostRequest(
        "application/x-www-form-urlencoded",
        "data=" + "x".repeat(200)
      );
      const res = new BunResponse();
      let called = false;

      await urlencoded({ limit: 10 })(req, res, () => { called = true; });

      expect(called).toBe(false);
      const response = res.toResponse();
      expect(response.status).toBe(413);
    });
  });

  describe("text()", () => {
    it("should skip non-text content types", async () => {
      const req = createPostRequest("application/json", JSON.stringify({ a: 1 }));
      const res = new BunResponse();
      let called = false;

      await text()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toBeUndefined();
    });

    it("should parse text body", async () => {
      const req = createPostRequest("text/plain", "Hello, world!");
      const res = new BunResponse();
      let called = false;

      await text()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toBe("Hello, world!");
    });

    it("should return 413 for oversized body", async () => {
      const req = createPostRequest("text/plain", "x".repeat(200));
      const res = new BunResponse();
      let called = false;

      await text({ limit: 10 })(req, res, () => { called = true; });

      expect(called).toBe(false);
      const response = res.toResponse();
      expect(response.status).toBe(413);
    });
  });

  describe("raw()", () => {
    it("should parse raw body as Buffer", async () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const req = new BunRequest(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: payload,
        }),
        "/test"
      );
      const res = new BunResponse();
      let called = false;

      await raw()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(Buffer.isBuffer(req.body)).toBe(true);
      const buf = req.body as Buffer;
      expect(buf[0]).toBe(0x01);
      expect(buf[1]).toBe(0x02);
      expect(buf[2]).toBe(0x03);
    });

    it("should respect string limit option", async () => {
      const smallPayload = new Uint8Array(50);
      const req = new BunRequest(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: smallPayload,
        }),
        "/test"
      );
      const res = new BunResponse();
      let called = false;

      await raw({ limit: "100kb" })(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(Buffer.isBuffer(req.body)).toBe(true);
    });

    it("should return 413 for oversized body", async () => {
      const largePayload = new Uint8Array(200);
      const req = new BunRequest(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: largePayload,
        }),
        "/test"
      );
      const res = new BunResponse();
      let called = false;

      await raw({ limit: 10 })(req, res, () => { called = true; });

      expect(called).toBe(false);
      const response = res.toResponse();
      expect(response.status).toBe(413);
    });

    it("should call verify function with buffer", async () => {
      const payload = new Uint8Array([0xCA, 0xFE]);
      const req = new BunRequest(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: payload,
        }),
        "/test"
      );
      const res = new BunResponse();
      let verifyCalled = false;
      let verifyBuffer: Buffer | null = null;

      const verify = (_req: any, _res: any, buf: Buffer) => {
        verifyCalled = true;
        verifyBuffer = buf;
      };

      await raw({ verify })(req, res, noop);

      expect(verifyCalled).toBe(true);
      expect(verifyBuffer).not.toBeNull();
      expect(verifyBuffer![0]).toBe(0xCA);
      expect(verifyBuffer![1]).toBe(0xFE);
    });

    it("should return 403 if verify throws", async () => {
      const payload = new Uint8Array([0x01]);
      const req = new BunRequest(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: payload,
        }),
        "/test"
      );
      const res = new BunResponse();
      let called = false;

      const verify = () => {
        throw new Error("Signature mismatch");
      };

      await raw({ verify })(req, res, () => { called = true; });

      expect(called).toBe(false);
      const response = res.toResponse();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Signature mismatch");
    });

    it("should skip non-matching content type", async () => {
      const req = createPostRequest("text/plain", "hello");
      const res = new BunResponse();
      let called = false;

      await raw()(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(req.body).toBeUndefined();
    });

    it("should skip if body is already parsed", async () => {
      const req = new BunRequest(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: new Uint8Array([0x01]),
        }),
        "/test"
      );
      req.body = Buffer.from([0xFF]);
      const res = new BunResponse();
      let called = false;

      await raw()(req, res, () => { called = true; });

      expect(called).toBe(true);
      const buf = req.body as Buffer;
      expect(buf[0]).toBe(0xFF);
    });

    it("should use custom type matcher with RegExp", async () => {
      const req = createPostRequest("application/x-protobuf", "binary-data");
      const res = new BunResponse();
      let called = false;

      await raw({ type: /application\/x-protobuf/ })(req, res, () => { called = true; });

      expect(called).toBe(true);
      expect(Buffer.isBuffer(req.body)).toBe(true);
    });
  });
});
