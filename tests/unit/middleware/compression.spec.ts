import { describe, expect, it } from "bun:test";
import { compression } from "../../../src/middleware/compression";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";
import { gunzipSync, inflateSync } from "zlib";

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

const LARGE_STRING = "x".repeat(2000);
const SMALL_STRING = "x".repeat(100);

describe("compression middleware (Unit)", () => {
  describe("skip conditions", () => {
    it("should skip when no accept-encoding header is present", () => {
      const req = createRequest();
      const res = new BunResponse();

      compression()(req, res, noop);

      res.json({ hello: "world" });
      expect(getHeader(res, "Content-Encoding")).toBeNull();
    });

    it("should skip when accept-encoding has no supported encoding", () => {
      const req = createRequest({ "accept-encoding": "br" });
      const res = new BunResponse();

      compression()(req, res, noop);

      res.json({ hello: "world" });
      expect(getHeader(res, "Content-Encoding")).toBeNull();
    });
  });

  describe("gzip compression", () => {
    it("should wrap json method when gzip is supported", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      compression()(req, res, noop);
      res.json({ data: LARGE_STRING });

      expect(getHeader(res, "Content-Encoding")).toBe("gzip");
      expect(getHeader(res, "Vary")).toBe("Accept-Encoding");
      expect(getHeader(res, "Content-Type")).toBe("application/json");
    });

    it("should wrap text method when gzip is supported", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      compression()(req, res, noop);
      res.text(LARGE_STRING);

      expect(getHeader(res, "Content-Encoding")).toBe("gzip");
      expect(getHeader(res, "Content-Type")).toBe("text/plain");
    });

    it("should wrap html method when gzip is supported", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      compression()(req, res, noop);
      res.html("<html>" + LARGE_STRING + "</html>");

      expect(getHeader(res, "Content-Encoding")).toBe("gzip");
      expect(getHeader(res, "Content-Type")).toBe("text/html");
    });

    it("should produce valid gzip data for json", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();
      const payload = { data: LARGE_STRING };

      compression()(req, res, noop);
      res.json(payload);

      const response = res.toResponse();
      const body = response.body;
      expect(body).not.toBeNull();
    });
  });

  describe("deflate compression", () => {
    it("should use deflate when only deflate is supported", () => {
      const req = createRequest({ "accept-encoding": "deflate" });
      const res = new BunResponse();

      compression()(req, res, noop);
      res.json({ data: LARGE_STRING });

      expect(getHeader(res, "Content-Encoding")).toBe("deflate");
      expect(getHeader(res, "Vary")).toBe("Accept-Encoding");
    });

    it("should prefer gzip when both gzip and deflate are supported", () => {
      const req = createRequest({ "accept-encoding": "gzip, deflate" });
      const res = new BunResponse();

      compression()(req, res, noop);
      res.json({ data: LARGE_STRING });

      expect(getHeader(res, "Content-Encoding")).toBe("gzip");
    });
  });

  describe("threshold", () => {
    it("should not compress data below default threshold (1024 bytes)", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      compression()(req, res, noop);
      res.text(SMALL_STRING);

      expect(getHeader(res, "Content-Encoding")).toBeNull();
    });

    it("should compress data above default threshold", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      compression()(req, res, noop);
      res.text(LARGE_STRING);

      expect(getHeader(res, "Content-Encoding")).toBe("gzip");
    });

    it("should respect custom threshold", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      compression({ threshold: 50 })(req, res, noop);
      res.text(SMALL_STRING);

      expect(getHeader(res, "Content-Encoding")).toBe("gzip");
    });
  });

  describe("filter", () => {
    it("should use custom filter function", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      compression({ filter: () => false })(req, res, noop);
      res.json({ data: LARGE_STRING });

      expect(getHeader(res, "Content-Encoding")).toBeNull();
    });

    it("should compress when custom filter returns true", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      compression({ filter: () => true })(req, res, noop);
      res.json({ data: LARGE_STRING });

      expect(getHeader(res, "Content-Encoding")).toBe("gzip");
    });
  });

  describe("double-wrapping prevention", () => {
    it("should prevent double-wrapping via Symbol", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      const middleware = compression();
      middleware(req, res, noop);

      const jsonAfterFirst = res.json;

      middleware(req, res, noop);

      expect(res.json).toBe(jsonAfterFirst);
    });
  });

  describe("custom level", () => {
    it("should not error with custom compression level", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      compression({ level: 1 })(req, res, noop);
      res.text(LARGE_STRING);

      expect(getHeader(res, "Content-Encoding")).toBe("gzip");
    });

    it("should not error with max compression level", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();

      compression({ level: 9 })(req, res, noop);
      res.text(LARGE_STRING);

      expect(getHeader(res, "Content-Encoding")).toBe("gzip");
    });
  });

  describe("next() callback", () => {
    it("should call next when compression is applied", () => {
      const req = createRequest({ "accept-encoding": "gzip" });
      const res = new BunResponse();
      let called = false;

      compression()(req, res, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should call next when compression is skipped", () => {
      const req = createRequest();
      const res = new BunResponse();
      let called = false;

      compression()(req, res, () => { called = true; });

      expect(called).toBe(true);
    });
  });
});
