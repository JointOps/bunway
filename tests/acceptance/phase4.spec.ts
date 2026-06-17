import { describe, it, expect, afterEach, beforeAll, afterAll } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import bunway from "../../src";

const FAVICON_PATH = join(import.meta.dir, ".tmp-favicon.ico");

beforeAll(() => {
  writeFileSync(FAVICON_PATH, new Uint8Array([0, 0, 1, 0, 1, 0, 16, 16]));
});

afterAll(() => {
  try { unlinkSync(FAVICON_PATH); } catch { /* ignore */ }
});

describe("Acceptance: Phase 4 DX features (full HTTP round-trip)", () => {
  let server: ReturnType<typeof Bun.serve> | null = null;

  afterEach(() => {
    if (server) {
      server.stop();
      server = null;
    }
  });

  it("responseTime header is present on real HTTP responses", async () => {
    const app = bunway();
    app.use(bunway.responseTime());
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    server = app.listen({ port: 0 });
    const response = await fetch(`http://localhost:${server.port}/ping`);
    expect(response.headers.has("x-response-time")).toBe(true);
    expect(response.headers.get("x-response-time")).toMatch(/ms$/);
  });

  it("requestId propagates through a real request pipeline", async () => {
    const app = bunway();
    app.use(bunway.requestId());
    app.get("/id", (req, res) => res.json({ id: (req as unknown as { id: string }).id }));

    server = app.listen({ port: 0 });
    const response = await fetch(`http://localhost:${server.port}/id`);
    const body = await response.json() as { id: string };
    expect(body.id).toBeTruthy();
    expect(response.headers.get("x-request-id")).toBe(body.id);
  });

  it("requestId echoes incoming header via real HTTP", async () => {
    const app = bunway();
    app.use(bunway.requestId());
    app.get("/id", (_req, res) => res.json({ ok: true }));

    server = app.listen({ port: 0 });
    const response = await fetch(`http://localhost:${server.port}/id`, {
      headers: { "X-Request-Id": "real-http-id" },
    });
    expect(response.headers.get("x-request-id")).toBe("real-http-id");
  });

  it("methodOverride converts POST to PUT via real HTTP", async () => {
    const app = bunway();
    app.use(bunway.methodOverride());
    app.put("/resource", (req, res) => res.json({ method: req.method }));

    server = app.listen({ port: 0 });
    const response = await fetch(`http://localhost:${server.port}/resource`, {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "PUT" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "PUT" });
  });

  it("methodOverride converts POST to DELETE via query param via real HTTP", async () => {
    const app = bunway();
    app.use(bunway.methodOverride({ getter: "_method" }));
    app.delete("/resource", (req, res) => res.json({ method: req.method }));

    server = app.listen({ port: 0 });
    const response = await fetch(`http://localhost:${server.port}/resource?_method=DELETE`, {
      method: "POST",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "DELETE" });
  });

  it("favicon serves icon with correct headers via real HTTP", async () => {
    const app = bunway();
    app.use(bunway.favicon(FAVICON_PATH));

    server = app.listen({ port: 0 });
    const response = await fetch(`http://localhost:${server.port}/favicon.ico`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/x-icon");
    expect(response.headers.get("etag")).toBeTruthy();
    expect(response.headers.get("cache-control")).toContain("max-age=");
  });

  it("favicon ETag 304 cycle works via real HTTP", async () => {
    const app = bunway();
    app.use(bunway.favicon(FAVICON_PATH));

    server = app.listen({ port: 0 });
    const first = await fetch(`http://localhost:${server.port}/favicon.ico`);
    const etag = first.headers.get("etag")!;

    const second = await fetch(`http://localhost:${server.port}/favicon.ico`, {
      headers: { "If-None-Match": etag },
    });
    expect(second.status).toBe(304);
  });

  it("SSE response has correct content-type via real HTTP", async () => {
    const app = bunway();
    app.get("/events", bunway.sse({ heartbeatInterval: 0 }), (_req, res) => {
      (res as unknown as { sendEvent: (e: string, d: unknown) => void }).sendEvent("ping", { ts: 1 });
      res.end();
    });

    server = app.listen({ port: 0 });
    const response = await fetch(`http://localhost:${server.port}/events`);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const text = await response.text();
    expect(text).toContain("event: ping");
    expect(text).toContain('"ts":1');
  });

  it("all Phase 4 middleware work together via real HTTP", async () => {
    const app = bunway();
    app.use(bunway.requestId());
    app.use(bunway.responseTime());
    app.use(bunway.methodOverride());
    app.put("/api", (req, res) => res.json({ method: req.method, id: (req as unknown as { id: string }).id }));

    server = app.listen({ port: 0 });
    const response = await fetch(`http://localhost:${server.port}/api`, {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "PUT" },
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { method: string; id: string };
    expect(body.method).toBe("PUT");
    expect(body.id).toBeTruthy();
    expect(response.headers.has("x-response-time")).toBe(true);
    expect(response.headers.has("x-request-id")).toBe(true);
  });
});
