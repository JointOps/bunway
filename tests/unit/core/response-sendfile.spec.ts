import { describe, it, expect, afterAll } from "bun:test";
import { BunResponse } from "../../../src/core/response";
import { join } from "path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";

const FIXTURES = join(import.meta.dir, "__fixtures__");

// Setup test fixtures
if (!existsSync(FIXTURES)) mkdirSync(FIXTURES, { recursive: true });
writeFileSync(join(FIXTURES, "test.txt"), "hello world");
writeFileSync(join(FIXTURES, "test.json"), '{"ok":true}');

describe("res.sendFile() with callback", () => {
  it("calls callback on success", async () => {
    const res = new BunResponse();
    let callbackCalled = false;
    let callbackErr: Error | undefined;
    await res.sendFile(join(FIXTURES, "test.txt"), (err) => {
      callbackCalled = true;
      callbackErr = err;
    });
    expect(callbackCalled).toBe(true);
    expect(callbackErr).toBeUndefined();
  });

  it("calls callback with error for missing file", async () => {
    const res = new BunResponse();
    let callbackErr: Error | undefined;
    await res.sendFile(join(FIXTURES, "nonexistent.txt"), (err) => {
      callbackErr = err;
    });
    expect(callbackErr).toBeDefined();
  });

  it("accepts options and callback together", async () => {
    const res = new BunResponse();
    let callbackCalled = false;
    await res.sendFile(join(FIXTURES, "test.txt"), { maxAge: 3600000 }, (err) => {
      callbackCalled = true;
    });
    expect(callbackCalled).toBe(true);
  });
});

describe("res.sendFile() extended options", () => {
  it("sets Last-Modified header when lastModified is not false", async () => {
    const res = new BunResponse();
    await res.sendFile(join(FIXTURES, "test.txt"), { lastModified: true });
    const response = res.toResponse();
    expect(response.headers.get("last-modified")).toBeDefined();
  });

  it("sets Cache-Control header with immutable", async () => {
    const res = new BunResponse();
    await res.sendFile(join(FIXTURES, "test.txt"), {
      maxAge: 86400000,
      cacheControl: true,
      immutable: true,
    });
    const response = res.toResponse();
    const cc = response.headers.get("cache-control");
    expect(cc).toContain("max-age=86400");
    expect(cc).toContain("immutable");
  });

  it("sets Accept-Ranges header by default", async () => {
    const res = new BunResponse();
    await res.sendFile(join(FIXTURES, "test.txt"));
    const response = res.toResponse();
    expect(response.headers.get("accept-ranges")).toBe("bytes");
  });
});

describe("res.download() with callback", () => {
  it("calls callback on success", async () => {
    const res = new BunResponse();
    let callbackCalled = false;
    await res.download(join(FIXTURES, "test.txt"), "download.txt", {}, (err) => {
      callbackCalled = true;
    });
    expect(callbackCalled).toBe(true);
    const response = res.toResponse();
    expect(response.headers.get("content-disposition")).toContain("download.txt");
  });
});

describe("res.attachment() Content-Type", () => {
  it("sets Content-Type based on filename extension", () => {
    const res = new BunResponse();
    res.attachment("report.pdf");
    const response = res.toResponse();
    expect(response.headers.get("content-type")).toContain("pdf");
    expect(response.headers.get("content-disposition")).toContain("report.pdf");
  });

  it("sets Content-Type for .json extension", () => {
    const res = new BunResponse();
    res.attachment("data.json");
    const response = res.toResponse();
    expect(response.headers.get("content-type")).toContain("json");
  });

  it("does not set Content-Type without filename", () => {
    const res = new BunResponse();
    res.attachment();
    const response = res.toResponse();
    expect(response.headers.get("content-disposition")).toBe("attachment");
  });
});

// Cleanup
afterAll(() => {
  if (existsSync(FIXTURES)) rmSync(FIXTURES, { recursive: true });
});
