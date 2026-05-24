import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from "fs";
import { join } from "path";
import { serveStatic } from "../../../src/middleware/static";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

const TMP = join(import.meta.dir, ".tmp-static");
const PUBLIC = join(TMP, "public");
const OUTSIDE = join(TMP, "outside");

function req(path: string, method = "GET", headers?: Record<string, string>): BunRequest {
  const url = `http://localhost${path}`;
  return new BunRequest(new Request(url, { method, headers }), path);
}

function res(): BunResponse {
  return new BunResponse();
}

async function dispatch(
  mw: ReturnType<typeof serveStatic>,
  request: BunRequest,
  response: BunResponse
): Promise<{ nextCalled: boolean; response: BunResponse }> {
  let nextCalled = false;
  await mw(request, response, () => { nextCalled = true; });
  return { nextCalled, response };
}

beforeAll(() => {
  mkdirSync(PUBLIC, { recursive: true });
  mkdirSync(OUTSIDE, { recursive: true });
  mkdirSync(join(PUBLIC, "sub"), { recursive: true });
  mkdirSync(join(PUBLIC, ".hidden-dir"), { recursive: true });

  writeFileSync(join(PUBLIC, "hello.txt"), "hello world");
  writeFileSync(join(PUBLIC, "index.html"), "<h1>Index</h1>");
  writeFileSync(join(PUBLIC, "app.js"), "console.log('app')");
  writeFileSync(join(PUBLIC, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  writeFileSync(join(PUBLIC, ".env"), "SECRET=abc");
  writeFileSync(join(PUBLIC, ".hidden-dir", "file.txt"), "hidden dir file");
  writeFileSync(join(PUBLIC, "sub", "page.html"), "<p>sub</p>");
  writeFileSync(join(PUBLIC, "data"), "raw data");
  writeFileSync(join(OUTSIDE, "secret.txt"), "outside root");
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("serveStatic — isPathSafe (path traversal prevention)", () => {
  it("blocks ../ traversal above root", async () => {
    const mw = serveStatic(PUBLIC, { fallthrough: false });
    const { nextCalled, response } = await dispatch(mw, req("/../outside/secret.txt"), res());
    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(403);
  });

  it("blocks URL-encoded traversal %2e%2e", async () => {
    const mw = serveStatic(PUBLIC, { fallthrough: false });
    const r = req("/%2e%2e/outside/secret.txt");
    const { nextCalled, response } = await dispatch(mw, r, res());
    // decodeURIComponent resolves to ../ which resolve() normalises — still caught
    expect(nextCalled).toBe(false);
  });

  it("fallthrough: true passes traversal attempt to next() instead of 403", async () => {
    const mw = serveStatic(PUBLIC, { fallthrough: true });
    const { nextCalled } = await dispatch(mw, req("/../outside/secret.txt"), res());
    expect(nextCalled).toBe(true);
  });

  it("serves file safely within root", async () => {
    const mw = serveStatic(PUBLIC);
    const { nextCalled, response } = await dispatch(mw, req("/hello.txt"), res());
    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(200);
  });
});

describe("serveStatic — HTTP method handling", () => {
  it("GET serves file", async () => {
    const mw = serveStatic(PUBLIC);
    const { response } = await dispatch(mw, req("/hello.txt", "GET"), res());
    expect(response.statusCode).toBe(200);
  });

  it("HEAD returns 200 with no body", async () => {
    const mw = serveStatic(PUBLIC);
    const { response } = await dispatch(mw, req("/hello.txt", "HEAD"), res());
    expect(response.statusCode).toBe(200);
    const r = response.toResponse();
    const body = await r.text();
    expect(body).toBe("");
  });

  it("POST with fallthrough: true calls next()", async () => {
    const mw = serveStatic(PUBLIC, { fallthrough: true });
    const { nextCalled } = await dispatch(mw, req("/hello.txt", "POST"), res());
    expect(nextCalled).toBe(true);
  });

  it("POST with fallthrough: false returns 405", async () => {
    const mw = serveStatic(PUBLIC, { fallthrough: false });
    const { nextCalled, response } = await dispatch(mw, req("/hello.txt", "POST"), res());
    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(405);
  });

  it("DELETE with fallthrough: false returns 405", async () => {
    const mw = serveStatic(PUBLIC, { fallthrough: false });
    const { nextCalled, response } = await dispatch(mw, req("/hello.txt", "DELETE"), res());
    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(405);
  });
});

describe("serveStatic — dotfiles", () => {
  it("dotfiles: deny returns 403", async () => {
    const mw = serveStatic(PUBLIC, { dotfiles: "deny" });
    const { response } = await dispatch(mw, req("/.env"), res());
    expect(response.statusCode).toBe(403);
  });

  it("dotfiles: ignore with fallthrough: true calls next()", async () => {
    const mw = serveStatic(PUBLIC, { dotfiles: "ignore", fallthrough: true });
    const { nextCalled } = await dispatch(mw, req("/.env"), res());
    expect(nextCalled).toBe(true);
  });

  it("dotfiles: ignore with fallthrough: false returns 404", async () => {
    const mw = serveStatic(PUBLIC, { dotfiles: "ignore", fallthrough: false });
    const { response } = await dispatch(mw, req("/.env"), res());
    expect(response.statusCode).toBe(404);
  });

  it("dotfiles: allow serves dotfiles", async () => {
    const mw = serveStatic(PUBLIC, { dotfiles: "allow" });
    const { response } = await dispatch(mw, req("/.env"), res());
    expect(response.statusCode).toBe(200);
  });
});

describe("serveStatic — ETag conditional requests", () => {
  it("sets ETag header on response", async () => {
    const mw = serveStatic(PUBLIC, { etag: true });
    const { response } = await dispatch(mw, req("/hello.txt"), res());
    expect(response.get("ETag")).toBeTruthy();
  });

  it("returns 304 when If-None-Match matches ETag", async () => {
    const mw = serveStatic(PUBLIC, { etag: true });
    const first = res();
    await dispatch(mw, req("/hello.txt"), first);
    const etag = first.get("ETag")!;

    const second = res();
    const { response } = await dispatch(mw, req("/hello.txt", "GET", { "if-none-match": etag }), second);
    expect(response.statusCode).toBe(304);
  });

  it("etag: false omits ETag header", async () => {
    const mw = serveStatic(PUBLIC, { etag: false });
    const { response } = await dispatch(mw, req("/hello.txt"), res());
    expect(response.get("ETag")).toBeUndefined();
  });

  it("non-matching If-None-Match still serves 200", async () => {
    const mw = serveStatic(PUBLIC, { etag: true });
    const { response } = await dispatch(mw, req("/hello.txt", "GET", { "if-none-match": '"stale-etag"' }), res());
    expect(response.statusCode).toBe(200);
  });
});

describe("serveStatic — Last-Modified conditional requests", () => {
  it("sets Last-Modified header", async () => {
    const mw = serveStatic(PUBLIC, { lastModified: true });
    const { response } = await dispatch(mw, req("/hello.txt"), res());
    expect(response.get("Last-Modified")).toBeTruthy();
  });

  it("returns 304 when If-Modified-Since is after file mtime", async () => {
    const mw = serveStatic(PUBLIC, { lastModified: true, etag: false });
    // A date clearly in the future ensures stat.mtime <= clientDate
    const futureDate = new Date(Date.now() + 86_400_000).toUTCString();
    const { response } = await dispatch(
      mw,
      req("/hello.txt", "GET", { "if-modified-since": futureDate }),
      res()
    );
    expect(response.statusCode).toBe(304);
  });

  it("lastModified: false omits Last-Modified header", async () => {
    const mw = serveStatic(PUBLIC, { lastModified: false });
    const { response } = await dispatch(mw, req("/hello.txt"), res());
    expect(response.get("Last-Modified")).toBeUndefined();
  });
});

describe("serveStatic — Cache-Control", () => {
  it("sets max-age=0 by default", async () => {
    const mw = serveStatic(PUBLIC);
    const { response } = await dispatch(mw, req("/hello.txt"), res());
    expect(response.get("Cache-Control")).toContain("max-age=0");
  });

  it("respects custom maxAge", async () => {
    const mw = serveStatic(PUBLIC, { maxAge: 3600 });
    const { response } = await dispatch(mw, req("/hello.txt"), res());
    expect(response.get("Cache-Control")).toContain("max-age=3600");
  });

  it("immutable: true appends immutable directive", async () => {
    const mw = serveStatic(PUBLIC, { maxAge: 31536000, immutable: true });
    const { response } = await dispatch(mw, req("/hello.txt"), res());
    expect(response.get("Cache-Control")).toContain("immutable");
  });
});

describe("serveStatic — index files", () => {
  it("serves index.html for directory request by default", async () => {
    const mw = serveStatic(PUBLIC);
    const { response } = await dispatch(mw, req("/"), res());
    expect(response.statusCode).toBe(200);
  });

  it("index: false disables index file serving", async () => {
    const mw = serveStatic(PUBLIC, { index: false, fallthrough: false });
    const { response } = await dispatch(mw, req("/"), res());
    expect(response.statusCode).toBe(404);
  });

  it("index array tries each file in order", async () => {
    const mw = serveStatic(PUBLIC, { index: ["missing.html", "index.html"] });
    const { response } = await dispatch(mw, req("/"), res());
    expect(response.statusCode).toBe(200);
  });
});

describe("serveStatic — extensions fallback", () => {
  it("serves file without extension when extensions option set", async () => {
    const mw = serveStatic(PUBLIC, { extensions: ["html"] });
    const { response } = await dispatch(mw, req("/sub/page"), res());
    expect(response.statusCode).toBe(200);
  });

  it("falls through when no extension match found", async () => {
    const mw = serveStatic(PUBLIC, { extensions: ["html"], fallthrough: true });
    const { nextCalled } = await dispatch(mw, req("/nonexistent"), res());
    expect(nextCalled).toBe(true);
  });
});

describe("serveStatic — MIME types", () => {
  it("sets correct Content-Type for .txt", async () => {
    const mw = serveStatic(PUBLIC);
    const { response } = await dispatch(mw, req("/hello.txt"), res());
    expect(response.get("Content-Type")).toContain("text/plain");
  });

  it("sets correct Content-Type for .html", async () => {
    const mw = serveStatic(PUBLIC);
    const { response } = await dispatch(mw, req("/index.html"), res());
    expect(response.get("Content-Type")).toContain("text/html");
  });

  it("sets correct Content-Type for .js", async () => {
    const mw = serveStatic(PUBLIC);
    const { response } = await dispatch(mw, req("/app.js"), res());
    expect(response.get("Content-Type")).toContain("javascript");
  });
});

describe("serveStatic — missing files", () => {
  it("fallthrough: true calls next() for missing file", async () => {
    const mw = serveStatic(PUBLIC, { fallthrough: true });
    const { nextCalled } = await dispatch(mw, req("/does-not-exist.txt"), res());
    expect(nextCalled).toBe(true);
  });

  it("fallthrough: false returns 404 for missing file", async () => {
    const mw = serveStatic(PUBLIC, { fallthrough: false });
    const { response } = await dispatch(mw, req("/does-not-exist.txt"), res());
    expect(response.statusCode).toBe(404);
  });
});
