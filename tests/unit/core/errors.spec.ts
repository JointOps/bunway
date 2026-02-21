import { describe, expect, it } from "bun:test";
import { HttpError, isHttpError } from "../../../src/core/errors";

describe("HttpError (Unit)", () => {
  describe("Constructor", () => {
    it("should create an error with status and message", () => {
      const err = new HttpError(404, "Not Found");
      expect(err.status).toBe(404);
      expect(err.message).toBe("Not Found");
    });

    it("should default message to 'HTTP {status}' when no message provided", () => {
      const err = new HttpError(500);
      expect(err.message).toBe("HTTP 500");
    });

    it("should set name to 'HttpError'", () => {
      const err = new HttpError(400);
      expect(err.name).toBe("HttpError");
    });

    it("should have readonly status", () => {
      const err = new HttpError(403, "Forbidden");
      expect(err.status).toBe(403);
    });

    it("should be an instance of Error", () => {
      const err = new HttpError(500);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("Headers", () => {
    it("should default headers to an empty object", () => {
      const err = new HttpError(400);
      expect(err.headers).toEqual({});
    });

    it("should copy headers from options", () => {
      const err = new HttpError(429, "Too Many Requests", {
        headers: { "Retry-After": "60" },
      });
      expect(err.headers["Retry-After"]).toBe("60");
    });

    it("should not share header reference with options", () => {
      const headers = { "X-Custom": "value" };
      const err = new HttpError(400, "Bad Request", { headers });
      headers["X-Custom"] = "changed";
      expect(err.headers["X-Custom"]).toBe("value");
    });
  });

  describe("Body", () => {
    it("should default body to {error: message} when message is provided", () => {
      const err = new HttpError(404, "Not Found");
      expect(err.body).toEqual({ error: "Not Found" });
    });

    it("should default body to undefined when no message is provided", () => {
      const err = new HttpError(500);
      expect(err.body).toBeUndefined();
    });

    it("should use options.body when provided", () => {
      const customBody = { code: "RATE_LIMIT", retryAfter: 60 };
      const err = new HttpError(429, "Too Many Requests", { body: customBody });
      expect(err.body).toEqual(customBody);
    });
  });

  describe("Cause", () => {
    it("should support cause via options", () => {
      const original = new Error("connection refused");
      const err = new HttpError(502, "Bad Gateway", { cause: original });
      expect(err.cause).toBe(original);
    });

    it("should have no cause when not provided", () => {
      const err = new HttpError(400);
      expect(err.cause).toBeUndefined();
    });
  });

  describe("isHttpError()", () => {
    it("should return true for HttpError instances", () => {
      const err = new HttpError(404, "Not Found");
      expect(isHttpError(err)).toBe(true);
    });

    it("should return false for regular Error", () => {
      expect(isHttpError(new Error("fail"))).toBe(false);
    });

    it("should return false for null", () => {
      expect(isHttpError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isHttpError(undefined)).toBe(false);
    });

    it("should return false for plain objects", () => {
      expect(isHttpError({ status: 404, message: "Not Found" })).toBe(false);
    });

    it("should return false for strings", () => {
      expect(isHttpError("HttpError")).toBe(false);
    });
  });
});
