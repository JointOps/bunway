import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { requestId } from "../../../src/middleware/request-id";

describe("Integration: requestId middleware", () => {
  it("req.id matches the X-Request-Id response header value", async () => {
    const app = bunway();
    app.use(requestId());
    app.get("/", (req, res) => res.json({ id: (req as unknown as { id: string }).id }));

    const response = await app.handle(new Request("http://localhost/"));
    const body = await response.json() as { id: string };
    expect(body.id).toBe(response.headers.get("x-request-id"));
  });

  it("incoming X-Request-Id is echoed back in response header", async () => {
    const app = bunway();
    app.use(requestId());
    app.get("/", (_req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/", {
      headers: { "X-Request-Id": "echo-this-id" },
    }));
    expect(response.headers.get("x-request-id")).toBe("echo-this-id");
  });

  it("two sequential requests receive unique generated IDs", async () => {
    const app = bunway();
    app.use(requestId());
    app.get("/", (_req, res) => res.json({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/"));
    const r2 = await app.handle(new Request("http://localhost/"));
    expect(r1.headers.get("x-request-id")).not.toBe(r2.headers.get("x-request-id"));
  });

  it("setHeader: false suppresses the response header but still sets req.id", async () => {
    const app = bunway();
    app.use(requestId({ setHeader: false }));
    app.get("/", (req, res) => res.json({ id: (req as unknown as { id: string }).id }));

    const response = await app.handle(new Request("http://localhost/"));
    expect(response.headers.has("x-request-id")).toBe(false);
    const body = await response.json() as { id: string };
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
  });

  it("custom generator function is invoked per request", async () => {
    let counter = 0;
    const app = bunway();
    app.use(requestId({ generator: () => `req-${++counter}` }));
    app.get("/", (_req, res) => res.json({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/"));
    const r2 = await app.handle(new Request("http://localhost/"));
    expect(r1.headers.get("x-request-id")).toBe("req-1");
    expect(r2.headers.get("x-request-id")).toBe("req-2");
  });
});
