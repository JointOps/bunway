import { describe, expect, it } from "bun:test";
import bunway from "../../../src";

describe("streaming responses", () => {
  it("supports res.write() and res.end() for streaming", async () => {
    const app = bunway();

    app.get("/stream", (req, res) => {
      res.set("Content-Type", "text/plain");
      res.write("Hello ");
      res.write("World");
      res.end("!");
    });

    const response = await app.handle(new Request("http://localhost/stream"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(text).toBe("Hello World!");
  });

  it("supports res.end() without prior write()", async () => {
    const app = bunway();

    app.get("/end-only", (req, res) => {
      res.set("Content-Type", "text/plain");
      res.end("Direct end");
    });

    const response = await app.handle(new Request("http://localhost/end-only"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe("Direct end");
  });

  it("supports res.end() with no data", async () => {
    const app = bunway();

    app.get("/empty-end", (req, res) => {
      res.status(204);
      res.end();
    });

    const response = await app.handle(new Request("http://localhost/empty-end"));

    expect(response.status).toBe(204);
  });

  it("supports streaming with Uint8Array chunks", async () => {
    const app = bunway();

    app.get("/binary-stream", (req, res) => {
      res.set("Content-Type", "application/octet-stream");
      res.write(new Uint8Array([72, 101, 108, 108, 111])); // "Hello"
      res.write(new Uint8Array([32])); // " "
      res.end(new Uint8Array([87, 111, 114, 108, 100])); // "World"
    });

    const response = await app.handle(new Request("http://localhost/binary-stream"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe("Hello World");
  });

  it("supports streaming with ArrayBuffer chunks", async () => {
    const app = bunway();

    app.get("/arraybuffer-stream", (req, res) => {
      res.set("Content-Type", "text/plain");
      const encoder = new TextEncoder();
      res.write(encoder.encode("Array").buffer);
      res.end(encoder.encode("Buffer").buffer);
    });

    const response = await app.handle(new Request("http://localhost/arraybuffer-stream"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe("ArrayBuffer");
  });

  it("supports multiple write() calls", async () => {
    const app = bunway();

    app.get("/multi-write", (req, res) => {
      res.set("Content-Type", "text/plain");
      for (let i = 1; i <= 5; i++) {
        res.write(`${i}`);
      }
      res.end();
    });

    const response = await app.handle(new Request("http://localhost/multi-write"));
    const text = await response.text();

    expect(text).toBe("12345");
  });

  it("sets custom status code with streaming", async () => {
    const app = bunway();

    app.get("/stream-status", (req, res) => {
      res.status(201);
      res.set("Content-Type", "text/plain");
      res.write("Created: ");
      res.end("resource");
    });

    const response = await app.handle(new Request("http://localhost/stream-status"));
    const text = await response.text();

    expect(response.status).toBe(201);
    expect(text).toBe("Created: resource");
  });

  it("supports custom headers with streaming", async () => {
    const app = bunway();

    app.get("/stream-headers", (req, res) => {
      res.set("Content-Type", "text/event-stream");
      res.set("Cache-Control", "no-cache");
      res.set("X-Custom-Header", "custom-value");
      res.write("data: hello\n\n");
      res.end();
    });

    const response = await app.handle(new Request("http://localhost/stream-headers"));

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
  });

  it("res.flushHeaders() marks headers as flushed", async () => {
    const app = bunway();
    let headersFlushed = false;

    app.get("/flush", (req, res) => {
      res.set("Content-Type", "text/plain");
      res.flushHeaders();
      headersFlushed = true;
      res.write("After flush");
      res.end();
    });

    const response = await app.handle(new Request("http://localhost/flush"));
    const text = await response.text();

    expect(headersFlushed).toBe(true);
    expect(text).toBe("After flush");
  });

  it("isStreaming() returns correct state", async () => {
    const app = bunway();
    let wasStreaming = false;

    app.get("/check-streaming", (req, res) => {
      res.write("chunk");
      wasStreaming = res.isStreaming();
      res.end();
    });

    await app.handle(new Request("http://localhost/check-streaming"));

    expect(wasStreaming).toBe(true);
  });

  it("write() returns false after stream is closed", async () => {
    const app = bunway();
    let writeResult: boolean | undefined;

    app.get("/write-after-end", (req, res) => {
      res.write("before");
      res.end();
      writeResult = res.write("after");
    });

    await app.handle(new Request("http://localhost/write-after-end"));

    expect(writeResult).toBe(false);
  });

  it("works with async handlers", async () => {
    const app = bunway();

    app.get("/async-stream", async (req, res) => {
      res.set("Content-Type", "text/plain");
      res.write("Start-");
      await new Promise((r) => setTimeout(r, 10));
      res.write("Middle-");
      await new Promise((r) => setTimeout(r, 10));
      res.end("End");
    });

    const response = await app.handle(new Request("http://localhost/async-stream"));
    const text = await response.text();

    expect(text).toBe("Start-Middle-End");
  });

  it("streaming works with middleware", async () => {
    const app = bunway();

    app.use((req, res, next) => {
      res.set("X-Middleware", "applied");
      next();
    });

    app.get("/stream-with-middleware", (req, res) => {
      res.set("Content-Type", "text/plain");
      res.write("Hello");
      res.end();
    });

    const response = await app.handle(new Request("http://localhost/stream-with-middleware"));

    expect(response.headers.get("X-Middleware")).toBe("applied");
    expect(await response.text()).toBe("Hello");
  });
});
