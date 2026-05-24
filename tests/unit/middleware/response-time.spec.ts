import { describe, expect, it } from "bun:test";
import bunway from "../../../src";
import { responseTime } from "../../../src/middleware/response-time";

describe("responseTime middleware", () => {
  it("sets X-Response-Time header on every response", async () => {
    const app = bunway();
    app.use(responseTime());
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/ping"));
    expect(res.headers.has("x-response-time")).toBe(true);
  });

  it("value ends with ms suffix by default", async () => {
    const app = bunway();
    app.use(responseTime());
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/ping"));
    expect(res.headers.get("x-response-time")).toMatch(/^\d+\.\d{3}ms$/);
  });

  it("custom header name is respected", async () => {
    const app = bunway();
    app.use(responseTime({ header: "X-Duration" }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/ping"));
    expect(res.headers.has("x-duration")).toBe(true);
  });

  it("suffix: false omits the ms unit", async () => {
    const app = bunway();
    app.use(responseTime({ suffix: false }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/ping"));
    const value = res.headers.get("x-response-time") ?? "";
    expect(value).not.toContain("ms");
    expect(Number(value)).toBeGreaterThanOrEqual(0);
  });

  it("digits option controls decimal places", async () => {
    const app = bunway();
    app.use(responseTime({ digits: 0, suffix: false }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/ping"));
    expect(res.headers.get("x-response-time")).toMatch(/^\d+$/);
  });

  it("value is a positive number", async () => {
    const app = bunway();
    app.use(responseTime({ suffix: false }));
    app.get("/ping", async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      res.json({ ok: true });
    });

    const res = await app.handle(new Request("http://localhost/ping"));
    expect(Number(res.headers.get("x-response-time"))).toBeGreaterThan(0);
  });

  it("suffix: true explicitly produces ms suffix", async () => {
    const app = bunway();
    app.use(responseTime({ suffix: true }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/ping"));
    expect(res.headers.get("x-response-time")).toMatch(/ms$/);
  });

  it("digits: 2 produces exactly two decimal places", async () => {
    const app = bunway();
    app.use(responseTime({ digits: 2, suffix: false }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/ping"));
    expect(res.headers.get("x-response-time")).toMatch(/^\d+\.\d{2}$/);
  });

  it("value is non-negative even for instant handlers", async () => {
    const app = bunway();
    app.use(responseTime({ suffix: false }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/ping"));
    const elapsed = Number(res.headers.get("x-response-time"));
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it("digits and suffix combine correctly", async () => {
    const app = bunway();
    app.use(responseTime({ digits: 1, suffix: true }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const res = await app.handle(new Request("http://localhost/ping"));
    expect(res.headers.get("x-response-time")).toMatch(/^\d+\.\dms$/);
  });

  it("digits: -1 throws RangeError (unguarded toFixed)", async () => {
    const app = bunway();
    app.use(responseTime({ digits: -1, suffix: false }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));
    // The error is thrown during response finalization (outside the error-handler
    // middleware chain), so the promise itself rejects rather than producing a 500.
    await expect(app.handle(new Request("http://localhost/ping"))).rejects.toThrow(RangeError);
  });
});
