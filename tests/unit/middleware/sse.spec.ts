import { describe, expect, it } from "bun:test";
import bunway from "../../../src";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";
import { sse } from "../../../src/middleware/sse";

describe("sse middleware", () => {
  it("sets Content-Type: text/event-stream", async () => {
    const app = bunway();
    app.get("/events", sse(), (_req, res) => res.end());

    const res = await app.handle(new Request("http://localhost/events"));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("sets Cache-Control: no-cache", async () => {
    const app = bunway();
    app.get("/events", sse(), (_req, res) => res.end());

    const res = await app.handle(new Request("http://localhost/events"));
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("sets X-Accel-Buffering: no", async () => {
    const app = bunway();
    app.get("/events", sse(), (_req, res) => res.end());

    const res = await app.handle(new Request("http://localhost/events"));
    expect(res.headers.get("x-accel-buffering")).toBe("no");
  });

  it("sendEvent emits id, event, and data lines", async () => {
    const app = bunway();
    app.get("/events", sse(), (_req, res) => {
      (res as unknown as { sendEvent: (event: string, data: unknown, id?: string) => void }).sendEvent(
        "update",
        { count: 1 },
        "42"
      );
      res.end();
    });

    const res = await app.handle(new Request("http://localhost/events"));
    const text = await res.text();
    expect(text).toContain("id: 42\n");
    expect(text).toContain("event: update\n");
    expect(text).toContain("data: {\"count\":1}\n\n");
  });

  it("sendEvent without id omits id line", async () => {
    const app = bunway();
    app.get("/events", sse(), (_req, res) => {
      (res as unknown as { sendEvent: (event: string, data: unknown, id?: string) => void }).sendEvent(
        "ping",
        {}
      );
      res.end();
    });

    const res = await app.handle(new Request("http://localhost/events"));
    const text = await res.text();
    expect(text).not.toContain("id:");
  });

  it("heartbeat sends ping comment within interval", async () => {
    const HB = 20; // heartbeat interval
    const app = bunway();
    app.get("/events", sse({ heartbeatInterval: HB }), async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, HB * 10)); // 10× — guarantees at least one ping
      res.end();
    });

    const res = await app.handle(new Request("http://localhost/events"));
    const text = await res.text();
    expect(text).toContain(": ping\n\n");
  });

  it("heartbeatInterval: 0 disables the ping timer", async () => {
    const app = bunway();
    app.get("/events", sse({ heartbeatInterval: 0 }), async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 200)); // long enough to see if ping fires
      res.end();
    });

    const res = await app.handle(new Request("http://localhost/events"));
    const text = await res.text();
    expect(text).not.toContain(": ping");
  });

  it("abort signal closes the stream and clears the timer", async () => {
    const controller = new AbortController();
    const req = new BunRequest(new Request("http://localhost/events", { signal: controller.signal }), "/events");
    const res = new BunResponse();
    let nextCalled = false;

    sse({ heartbeatInterval: 100 })(req, res, () => {
      nextCalled = true;
    });

    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(nextCalled).toBe(true);
    expect(res.isSent()).toBe(true);
  });

  it("sets Connection: keep-alive header", async () => {
    const app = bunway();
    app.get("/events", sse(), (_req, res) => res.end());

    const res = await app.handle(new Request("http://localhost/events"));
    expect(res.headers.get("connection")).toBe("keep-alive");
  });

  it("sendEvent with primitive string data JSON-encodes it", async () => {
    const app = bunway();
    app.get("/events", sse({ heartbeatInterval: 0 }), (_req, res) => {
      (res as unknown as { sendEvent: (event: string, data: unknown) => void }).sendEvent("msg", "hello");
      res.end();
    });

    const res = await app.handle(new Request("http://localhost/events"));
    const text = await res.text();
    expect(text).toContain('data: "hello"\n\n');
  });

  it("sendEvent with null data JSON-encodes it", async () => {
    const app = bunway();
    app.get("/events", sse({ heartbeatInterval: 0 }), (_req, res) => {
      (res as unknown as { sendEvent: (event: string, data: unknown) => void }).sendEvent("reset", null);
      res.end();
    });

    const res = await app.handle(new Request("http://localhost/events"));
    const text = await res.text();
    expect(text).toContain("data: null\n\n");
  });
});
