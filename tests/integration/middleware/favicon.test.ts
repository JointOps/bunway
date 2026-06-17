import { afterAll, beforeAll, describe, it, expect } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import bunway from "../../../src";
import { favicon } from "../../../src/middleware/favicon";

const FAVICON_PATH = join(import.meta.dir, ".tmp-favicon.ico");

beforeAll(() => {
  writeFileSync(FAVICON_PATH, new Uint8Array([0, 0, 1, 0, 1, 0, 16, 16]));
});

afterAll(() => {
  try { unlinkSync(FAVICON_PATH); } catch { /* ignore */ }
});

describe("Integration: favicon middleware", () => {
  it("GET /favicon.ico returns 200 with image/x-icon", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));

    const response = await app.handle(new Request("http://localhost/favicon.ico"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/x-icon");
  });

  it("HEAD /favicon.ico returns 200 with no body", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));

    const response = await app.handle(new Request("http://localhost/favicon.ico", { method: "HEAD" }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("Cache-Control reflects the configured maxAge", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH, { maxAge: 3600_000 }));

    const response = await app.handle(new Request("http://localhost/favicon.ico"));
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  it("ETag is present and If-None-Match produces 304", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));

    const first = await app.handle(new Request("http://localhost/favicon.ico"));
    const etag = first.headers.get("etag")!;
    expect(etag).toBeTruthy();

    const second = await app.handle(new Request("http://localhost/favicon.ico", {
      headers: { "If-None-Match": etag },
    }));
    expect(second.status).toBe(304);
  });

  it("non-favicon path passes through to next handler", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));
    app.get("/api", (_req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/api"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("POST to /favicon.ico passes through to next handler", async () => {
    const app = bunway();
    app.use(favicon(FAVICON_PATH));
    app.post("/favicon.ico", (_req, res) => res.json({ method: "POST" }));

    const response = await app.handle(new Request("http://localhost/favicon.ico", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "POST" });
  });
});
