import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { responseTime } from "../../../src/middleware/response-time";

describe("Integration: responseTime middleware", () => {
  it("X-Response-Time header is present on successful response", async () => {
    const app = bunway();
    app.use(responseTime());
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/ping"));
    expect(response.headers.has("x-response-time")).toBe(true);
  });

  it("elapsed time includes async work in handler", async () => {
    const app = bunway();
    app.use(responseTime({ suffix: false }));
    app.get("/slow", async (_req, res) => {
      await new Promise((r) => setTimeout(r, 10));
      res.json({ ok: true });
    });

    const response = await app.handle(new Request("http://localhost/slow"));
    const elapsed = Number(response.headers.get("x-response-time"));
    expect(elapsed).toBeGreaterThanOrEqual(10);
  });

  it("suffix: false produces a plain numeric string", async () => {
    const app = bunway();
    app.use(responseTime({ suffix: false }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/ping"));
    const value = response.headers.get("x-response-time") ?? "";
    expect(value).not.toContain("ms");
    expect(isNaN(Number(value))).toBe(false);
  });

  it("custom digits option formats correctly", async () => {
    const app = bunway();
    app.use(responseTime({ digits: 0, suffix: false }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/ping"));
    expect(response.headers.get("x-response-time")).toMatch(/^\d+$/);
  });

  it("custom header name is set on response", async () => {
    const app = bunway();
    app.use(responseTime({ header: "X-Duration" }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/ping"));
    expect(response.headers.has("x-duration")).toBe(true);
    expect(response.headers.has("x-response-time")).toBe(false);
  });

  it("value is non-negative across multiple sequential requests", async () => {
    const app = bunway();
    app.use(responseTime({ suffix: false }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i++) {
      const response = await app.handle(new Request("http://localhost/ping"));
      const elapsed = Number(response.headers.get("x-response-time"));
      expect(elapsed).toBeGreaterThanOrEqual(0);
    }
  });
});
