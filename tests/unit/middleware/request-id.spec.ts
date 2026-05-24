import { describe, expect, it } from "bun:test";
import bunway from "../../../src";
import { requestId } from "../../../src/middleware/request-id";

describe("requestId middleware", () => {
  it("generates a UUID and sets req.id", async () => {
    const app = bunway();
    app.use(requestId());
    app.get("/id", (req, res) => res.json({ id: (req as unknown as { id: string }).id }));

    const res = await app.handle(new Request("http://localhost/id"));
    const body = await res.json();
    expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("echoes ID in response header by default", async () => {
    const app = bunway();
    app.use(requestId());
    app.get("/id", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/id"));
    expect(res.headers.has("x-request-id")).toBe(true);
  });

  it("reuses incoming X-Request-Id if already present", async () => {
    const app = bunway();
    app.use(requestId());
    app.get("/id", (req, res) => res.json({ id: (req as unknown as { id: string }).id }));

    const res = await app.handle(new Request("http://localhost/id", {
      headers: { "X-Request-Id": "my-id" },
    }));
    const body = await res.json();
    expect(body.id).toBe("my-id");
  });

  it("custom generator function is used", async () => {
    const app = bunway();
    app.use(requestId({ generator: () => "fixed-id" }));
    app.get("/id", (req, res) => res.json({ id: (req as unknown as { id: string }).id }));

    const res = await app.handle(new Request("http://localhost/id"));
    const body = await res.json();
    expect(body.id).toBe("fixed-id");
  });

  it("setHeader: false omits the response header", async () => {
    const app = bunway();
    app.use(requestId({ setHeader: false }));
    app.get("/id", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/id"));
    expect(res.headers.has("x-request-id")).toBe(false);
  });

  it("custom header name is used for both read and write", async () => {
    const app = bunway();
    app.use(requestId({ header: "X-Trace-Id" }));
    app.get("/id", (req, res) => res.json({ id: (req as unknown as { id: string }).id }));

    const res = await app.handle(new Request("http://localhost/id", {
      headers: { "X-Trace-Id": "trace-1" },
    }));
    const body = await res.json();
    expect(res.headers.get("x-trace-id")).toBe("trace-1");
    expect(body.id).toBe("trace-1");
  });

  it("empty-string X-Request-Id is kept as-is (nullish coalescing, not falsy check)", async () => {
    const app = bunway();
    app.use(requestId({ generator: () => "generated" }));
    app.get("/id", (req, res) => res.json({ id: (req as unknown as { id: string }).id }));

    const res = await app.handle(new Request("http://localhost/id", {
      headers: { "X-Request-Id": "" },
    }));
    const body = await res.json();
    expect(body.id).toBe("");
  });

  it("custom header with setHeader: false sets req.id but omits response header", async () => {
    const app = bunway();
    app.use(requestId({ header: "X-Trace-Id", setHeader: false }));
    app.get("/id", (req, res) => res.json({ id: (req as unknown as { id: string }).id }));

    const res = await app.handle(new Request("http://localhost/id"));
    expect(res.headers.has("x-trace-id")).toBe(false);
    const body = await res.json();
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
  });

  it("two sequential requests receive unique IDs", async () => {
    const app = bunway();
    app.use(requestId());
    app.get("/id", (_req, res) => res.json({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/id"));
    const r2 = await app.handle(new Request("http://localhost/id"));
    const id1 = r1.headers.get("x-request-id");
    const id2 = r2.headers.get("x-request-id");
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it("generated UUID matches UUID v4 format", async () => {
    const app = bunway();
    app.use(requestId());
    app.get("/id", (_req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/id"));
    const id = response.headers.get("x-request-id") ?? "";
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("generator that throws propagates through the pipeline as a 500", async () => {
    const app = bunway();
    app.use(requestId({ generator: () => { throw new Error("id-gen failed"); } }));
    app.get("/id", (_req, res) => res.json({ ok: true }));
    app.use((_err: Error, _req: any, res: any, _next: any) => {
      res.status(500).json({ caught: true });
    });

    const response = await app.handle(new Request("http://localhost/id"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.caught).toBe(true);
  });
});
