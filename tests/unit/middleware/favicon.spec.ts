import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { unlinkSync, writeFileSync } from "fs";
import bunway from "../../../src";
import { favicon } from "../../../src/middleware/favicon";

const FAVICON_PATH = "/tmp/bunway-test-favicon.ico";
const FAVICON_BYTES = new Uint8Array([0, 0, 1, 0, 1, 0, 16, 16]);

beforeAll(() => {
  writeFileSync(FAVICON_PATH, FAVICON_BYTES);
});

afterAll(() => {
  try {
    unlinkSync(FAVICON_PATH);
  } catch {
    // Ignore cleanup failures.
  }
});

describe("favicon middleware", () => {
  it("serves /favicon.ico with image/x-icon content-type", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));

    const res = await app.handle(new Request("http://localhost/favicon.ico"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/x-icon");
  });

  it("returns 304 on ETag match", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));

    const first = await app.handle(new Request("http://localhost/favicon.ico"));
    const etag = first.headers.get("etag") ?? "";
    const second = await app.handle(new Request("http://localhost/favicon.ico", {
      headers: { "If-None-Match": etag },
    }));
    expect(second.status).toBe(304);
  });

  it("sets Cache-Control with max-age", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH, { maxAge: 1000 }));

    const res = await app.handle(new Request("http://localhost/favicon.ico"));
    expect(res.headers.get("cache-control")).toBe("public, max-age=1");
  });

  it("passes through non-favicon paths to next middleware", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));
    app.get("/other", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/other"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("HEAD request returns 200 with empty body", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));

    const res = await app.handle(new Request("http://localhost/favicon.ico", { method: "HEAD" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("throws at initialization if path does not exist", () => {
    expect(() => favicon("/no/such/favicon.ico")).toThrow("Favicon not found");
  });

  it("POST to /favicon.ico calls next() rather than serving the icon", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));
    app.post("/favicon.ico", (_req, res) => res.json({ reached: true }));

    const res = await app.handle(new Request("http://localhost/favicon.ico", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reached: true });
  });

  it("non-matching If-None-Match ETag still serves 200", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));

    const res = await app.handle(new Request("http://localhost/favicon.ico", {
      headers: { "If-None-Match": '"not-the-real-etag"' },
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/x-icon");
  });

  it("default maxAge is 86400 seconds", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));

    const res = await app.handle(new Request("http://localhost/favicon.ico"));
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
  });

  it("maxAge: 0 produces max-age=0 in Cache-Control", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH, { maxAge: 0 }));

    const res = await app.handle(new Request("http://localhost/favicon.ico"));
    expect(res.headers.get("cache-control")).toBe("public, max-age=0");
  });
});
