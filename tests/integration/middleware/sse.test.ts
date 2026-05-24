import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { sse } from "../../../src/middleware/sse";

type SseRes = { sendEvent: (event: string, data: unknown, id?: string) => void };

describe("Integration: sse middleware", () => {
  it("sets all required SSE headers in route pipeline", async () => {
    const app = bunway();
    app.get("/events", sse(), (_req, res) => res.end());

    const response = await app.handle(new Request("http://localhost/events"));
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(response.headers.get("connection")).toBe("keep-alive");
  });

  it("sendEvent produces correct SSE wire format end-to-end", async () => {
    const app = bunway();
    app.get("/events", sse({ heartbeatInterval: 0 }), (_req, res) => {
      (res as unknown as SseRes).sendEvent("update", { value: 42 }, "1");
      res.end();
    });

    const response = await app.handle(new Request("http://localhost/events"));
    const text = await response.text();
    expect(text).toContain("id: 1\n");
    expect(text).toContain("event: update\n");
    expect(text).toContain('data: {"value":42}\n\n');
  });

  it("multiple events are correctly delimited", async () => {
    const app = bunway();
    app.get("/events", sse({ heartbeatInterval: 0 }), (_req, res) => {
      const send = (res as unknown as SseRes).sendEvent.bind(res);
      send("a", 1);
      send("b", 2);
      res.end();
    });

    const response = await app.handle(new Request("http://localhost/events"));
    const text = await response.text();
    const blocks = text.split("\n\n").filter(Boolean);
    expect(blocks.length).toBe(2);
    expect(blocks[0]).toContain("event: a");
    expect(blocks[1]).toContain("event: b");
  });

  it("heartbeat fires within the configured interval", async () => {
    const HB = 20;
    const app = bunway();
    app.get("/events", sse({ heartbeatInterval: HB }), async (_req, res) => {
      await new Promise((r) => setTimeout(r, HB * 10)); // 10× guarantees at least one ping
      res.end();
    });

    const response = await app.handle(new Request("http://localhost/events"));
    const text = await response.text();
    expect(text).toContain(": ping\n\n");
  });

  it("non-SSE routes are unaffected by sse() middleware on other routes", async () => {
    const app = bunway();
    app.get("/events", sse({ heartbeatInterval: 0 }), (_req, res) => res.end());
    app.get("/api", (_req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/api"));
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-accel-buffering")).toBeNull();
  });

  it("response status is 200 for SSE stream", async () => {
    const app = bunway();
    app.get("/events", sse({ heartbeatInterval: 0 }), (_req, res) => res.end());

    const response = await app.handle(new Request("http://localhost/events"));
    expect(response.status).toBe(200);
  });
});
