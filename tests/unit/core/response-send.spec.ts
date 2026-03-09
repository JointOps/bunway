import { describe, it, expect } from "bun:test";
import { BunResponse } from "../../../src/core/response";

describe("res.send() Content-Type auto-detection", () => {
  it("sets text/html for string body", () => {
    const res = new BunResponse();
    res.send("Hello World");
    const response = res.toResponse();
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  it("delegates to json() for object body", () => {
    const res = new BunResponse();
    res.send({ name: "John" });
    const response = res.toResponse();
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("sets octet-stream for Uint8Array", () => {
    const res = new BunResponse();
    res.send(new Uint8Array([1, 2, 3]));
    const response = res.toResponse();
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("does not override existing Content-Type", () => {
    const res = new BunResponse();
    res.type("text/plain");
    res.send("Hello");
    const response = res.toResponse();
    expect(response.headers.get("content-type")).toBe("text/plain");
  });

  it("sets Content-Length for strings", () => {
    const res = new BunResponse();
    res.send("Hello");
    const response = res.toResponse();
    expect(response.headers.get("content-length")).toBe("5");
  });

  it("sets Content-Length for UTF-8 strings correctly", () => {
    const res = new BunResponse();
    res.send("héllo");
    const response = res.toResponse();
    // 'é' is 2 bytes in UTF-8
    expect(response.headers.get("content-length")).toBe("6");
  });

  it("returns this for chaining", () => {
    const res = new BunResponse();
    const result = res.send("Hello");
    expect(result).toBe(res);
  });

  it("handles null body", () => {
    const res = new BunResponse();
    res.send(null);
    expect(res.headersSent).toBe(true);
  });

  it("handles undefined body", () => {
    const res = new BunResponse();
    res.send(undefined);
    expect(res.headersSent).toBe(true);
  });

  it("delegates array to json()", () => {
    const res = new BunResponse();
    res.send([1, 2, 3]);
    const response = res.toResponse();
    expect(response.headers.get("content-type")).toBe("application/json");
  });
});

describe("res.json() chaining", () => {
  it("returns this for chaining", () => {
    const res = new BunResponse();
    const result = res.json({ ok: true });
    expect(result).toBe(res);
  });

  it("sets Content-Length", () => {
    const res = new BunResponse();
    res.json({ name: "test" });
    const response = res.toResponse();
    expect(response.headers.get("content-length")).toBeDefined();
  });
});
