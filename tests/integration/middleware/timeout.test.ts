import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { timeout } from "../../../src/middleware/timeout";

describe("Integration: timeout middleware", () => {
  it("returns 408 when handler exceeds timeout", async () => {
    const app = bunway();
    app.use(timeout(50));
    app.get("/slow", async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (!req.timedout) res.json({ ok: true });
    });

    const response = await app.handle(new Request("http://localhost/slow"));
    expect(response.status).toBe(408);
  });

  it("returns normal response when handler is fast enough", async () => {
    const app = bunway();
    app.use(timeout(5000));
    app.get("/fast", (req, res) => {
      res.json({ ok: true });
    });

    const response = await app.handle(new Request("http://localhost/fast"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("respects skip function for specific routes", async () => {
    const app = bunway();
    app.use(timeout(50, { skip: (req) => req.path === "/upload" }));
    app.get("/upload", async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      res.json({ uploaded: true });
    });

    const response = await app.handle(new Request("http://localhost/upload"));
    expect(response.status).toBe(200);
  });

  it("handler can check req.timedout with respond: false", async () => {
    const app = bunway();
    app.use(timeout(50, { respond: false }));
    app.get("/check", async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (req.timedout) {
        res.status(503).json({ error: "Service busy" });
      } else {
        res.json({ ok: true });
      }
    });

    const response = await app.handle(new Request("http://localhost/check"));
    expect(response.status).toBe(503);
  });

  it("custom status code and message work end-to-end", async () => {
    const app = bunway();
    app.use(timeout(50, { statusCode: 504, message: { error: "Gateway Timeout" } }));
    app.get("/slow", async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (!req.timedout) res.json({ ok: true });
    });

    const response = await app.handle(new Request("http://localhost/slow"));
    expect(response.status).toBe(504);
    const body = await response.json();
    expect(body.error).toBe("Gateway Timeout");
  });
});
