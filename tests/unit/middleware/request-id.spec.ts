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
});
