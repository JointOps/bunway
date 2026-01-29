import { describe, expect, it } from "bun:test";
import { HttpError, isHttpError } from "../src";

describe("HttpError", () => {
  it("creates error with status and message", () => {
    const error = new HttpError(404, "Not Found");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Not Found");
    expect(error.name).toBe("HttpError");
  });

  it("creates error with default message", () => {
    const error = new HttpError(500);
    expect(error.message).toBe("HTTP 500");
  });

  it("supports custom headers", () => {
    const error = new HttpError(401, "Unauthorized", {
      headers: { "WWW-Authenticate": "Bearer" },
    });
    expect(error.headers["WWW-Authenticate"]).toBe("Bearer");
  });

  it("supports custom body", () => {
    const error = new HttpError(400, "Bad Request", {
      body: { errors: ["Invalid email"] },
    });
    expect(error.body).toEqual({ errors: ["Invalid email"] });
  });

  it("supports cause", () => {
    const cause = new Error("Original error");
    const error = new HttpError(500, "Wrapped error", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe("isHttpError", () => {
  it("returns true for HttpError instances", () => {
    const error = new HttpError(400);
    expect(isHttpError(error)).toBe(true);
  });

  it("returns false for regular errors", () => {
    const error = new Error("Regular error");
    expect(isHttpError(error)).toBe(false);
  });

  it("returns false for non-errors", () => {
    expect(isHttpError(null)).toBe(false);
    expect(isHttpError(undefined)).toBe(false);
    expect(isHttpError("string")).toBe(false);
    expect(isHttpError({ status: 400 })).toBe(false);
  });
});
