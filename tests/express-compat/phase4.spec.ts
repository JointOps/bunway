import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import bunway from "../../src";

const FAVICON_PATH = join(process.cwd(), "tests/express-compat/fixtures/favicon.ico");

beforeAll(() => {
  if (!existsSync(FAVICON_PATH)) {
    writeFileSync(FAVICON_PATH, Buffer.alloc(16, 0));
  }
});

afterAll(() => {
  if (existsSync(FAVICON_PATH)) {
    unlinkSync(FAVICON_PATH);
  }
});

describe("Express Compatibility: Phase 4 — DX Middleware", () => {
  // requestId compat
  it("requestId sets req.id and X-Request-Id response header", async () => {
    const app = bunway();
    app.use(bunway.requestId());
    app.get("/", (req, res) => res.json({ id: (req as any).id }));

    const response = await app.handle(new Request("http://localhost/"));
    const body = await response.json() as { id: string };
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
    expect(response.headers.get("X-Request-Id")).toBe(body.id);
  });

  it("requestId echoes incoming X-Request-Id header", async () => {
    const app = bunway();
    app.use(bunway.requestId());
    app.get("/", (req, res) => res.json({ id: (req as any).id }));

    const response = await app.handle(new Request("http://localhost/", {
      headers: { "X-Request-Id": "my-trace-id" },
    }));
    const body = await response.json() as { id: string };
    expect(body.id).toBe("my-trace-id");
    expect(response.headers.get("X-Request-Id")).toBe("my-trace-id");
  });

  it("requestId with setHeader:false suppresses response header", async () => {
    const app = bunway();
    app.use(bunway.requestId({ setHeader: false }));
    app.get("/", (req, res) => res.json({ id: (req as any).id }));

    const response = await app.handle(new Request("http://localhost/"));
    expect(response.headers.get("X-Request-Id")).toBeNull();
    const body = await response.json() as { id: string };
    expect(typeof body.id).toBe("string");
  });

  it("requestId uses custom header name", async () => {
    const app = bunway();
    app.use(bunway.requestId({ header: "X-Trace-Id" }));
    app.get("/", (req, res) => res.json({ id: (req as any).id }));

    const response = await app.handle(new Request("http://localhost/", {
      headers: { "X-Trace-Id": "trace-abc" },
    }));
    expect(response.headers.get("X-Trace-Id")).toBe("trace-abc");
  });

  // responseTime compat
  it("responseTime adds X-Response-Time header to response", async () => {
    const app = bunway();
    app.use(bunway.responseTime());
    app.get("/", (req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/"));
    const header = response.headers.get("X-Response-Time");
    expect(header).toBeTruthy();
    expect(header).toContain("ms");
  });

  it("responseTime with suffix:false omits 'ms' suffix", async () => {
    const app = bunway();
    app.use(bunway.responseTime({ suffix: false }));
    app.get("/", (req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/"));
    const header = response.headers.get("X-Response-Time");
    expect(header).toBeTruthy();
    expect(header).not.toContain("ms");
  });

  it("responseTime with custom header name", async () => {
    const app = bunway();
    app.use(bunway.responseTime({ header: "X-Duration" }));
    app.get("/", (req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/"));
    expect(response.headers.get("X-Duration")).toBeTruthy();
    expect(response.headers.get("X-Response-Time")).toBeNull();
  });

  // methodOverride compat
  it("methodOverride converts POST to PUT via X-HTTP-Method-Override header", async () => {
    const app = bunway();
    app.use(bunway.methodOverride());
    app.put("/resource", (req, res) => res.json({ method: req.method }));

    const response = await app.handle(new Request("http://localhost/resource", {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "PUT" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "PUT" });
  });

  it("methodOverride converts POST to DELETE via _method query param", async () => {
    const app = bunway();
    app.use(bunway.methodOverride({ getter: "_method" }));
    app.delete("/resource", (req, res) => res.json({ method: req.method }));

    const response = await app.handle(new Request("http://localhost/resource?_method=DELETE", {
      method: "POST",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "DELETE" });
  });

  it("methodOverride does not override non-POST requests", async () => {
    const app = bunway();
    app.use(bunway.methodOverride());
    app.get("/resource", (req, res) => res.json({ method: req.method }));

    const response = await app.handle(new Request("http://localhost/resource", {
      method: "GET",
      headers: { "X-HTTP-Method-Override": "DELETE" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "GET" });
  });

  it("methodOverride sets _originalMethod on overridden requests", async () => {
    const app = bunway();
    app.use(bunway.methodOverride());
    app.put("/resource", (req, res) => res.json({ original: (req as any)._originalMethod }));

    const response = await app.handle(new Request("http://localhost/resource", {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "PUT" },
    }));
    expect(await response.json()).toEqual({ original: "POST" });
  });

  // favicon compat
  it("favicon serves image/x-icon on GET /favicon.ico", async () => {
    const app = bunway();
    app.use(bunway.favicon(FAVICON_PATH));
    app.get("/", (req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/favicon.ico"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/x-icon");
  });

  it("favicon includes Cache-Control and ETag headers", async () => {
    const app = bunway();
    app.use(bunway.favicon(FAVICON_PATH));

    const response = await app.handle(new Request("http://localhost/favicon.ico"));
    expect(response.headers.get("Cache-Control")).toContain("max-age=");
    expect(response.headers.get("ETag")).toBeTruthy();
  });

  it("favicon returns 304 for matching If-None-Match", async () => {
    const app = bunway();
    app.use(bunway.favicon(FAVICON_PATH));

    const first = await app.handle(new Request("http://localhost/favicon.ico"));
    const etag = first.headers.get("ETag")!;

    const second = await app.handle(new Request("http://localhost/favicon.ico", {
      headers: { "If-None-Match": etag },
    }));
    expect(second.status).toBe(304);
  });

  it("favicon passes through non-favicon paths to next handler", async () => {
    const app = bunway();
    app.use(bunway.favicon(FAVICON_PATH));
    app.get("/other", (req, res) => res.json({ reached: true }));

    const response = await app.handle(new Request("http://localhost/other"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reached: true });
  });

  it("favicon passes through non-GET/HEAD verbs to next handler", async () => {
    const app = bunway();
    app.use(bunway.favicon(FAVICON_PATH));
    app.post("/favicon.ico", (req, res) => res.json({ method: "POST" }));

    const response = await app.handle(new Request("http://localhost/favicon.ico", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "POST" });
  });

  // sse compat
  it("sse middleware sets required SSE headers", async () => {
    const app = bunway();
    app.get("/events", bunway.sse(), (req, res) => {
      res.end();
    });

    const response = await app.handle(new Request("http://localhost/events"));
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("sse sendEvent writes correct event wire format", async () => {
    const app = bunway();
    app.get("/events", bunway.sse({ heartbeatInterval: 0 }), (req, res) => {
      (res as any).sendEvent("update", { count: 1 });
      res.end();
    });

    const response = await app.handle(new Request("http://localhost/events"));
    const text = await response.text();
    expect(text).toContain("event: update");
    expect(text).toContain("data:");
    expect(text).toContain('"count":1');
  });

  it("sse non-SSE routes are unaffected", async () => {
    const app = bunway();
    app.use(bunway.sse({ heartbeatInterval: 0 }));
    app.get("/api", (req, res) => {
      res.json({ ok: true });
    });

    const response = await app.handle(new Request("http://localhost/api"));
    const contentType = response.headers.get("Content-Type");
    expect(contentType).toContain("application/json");
  });
});
