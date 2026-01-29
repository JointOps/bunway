import { describe, expect, it } from "bun:test";
import bunway, { rateLimit } from "../../../src";
import { buildRequest } from "../../utils/testUtils";

describe("rateLimit middleware", () => {
  it("allows requests under the limit", async () => {
    const app = bunway();
    app.use(rateLimit({ max: 5, windowMs: 60000 }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("4");
  });

  it("blocks requests over the limit", async () => {
    const app = bunway();
    app.use(rateLimit({ max: 2, windowMs: 60000 }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(buildRequest("/test"));
    await app.handle(buildRequest("/test"));
    const response = await app.handle(buildRequest("/test"));

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("Retry-After")).toBeDefined();
  });

  it("uses custom status code", async () => {
    const app = bunway();
    app.use(rateLimit({ max: 1, windowMs: 60000, statusCode: 503 }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(buildRequest("/test"));
    const response = await app.handle(buildRequest("/test"));

    expect(response.status).toBe(503);
  });

  it("uses custom message", async () => {
    const app = bunway();
    app.use(
      rateLimit({
        max: 1,
        windowMs: 60000,
        message: { error: "Slow down!", code: "RATE_LIMITED" },
      })
    );
    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(buildRequest("/test"));
    const response = await app.handle(buildRequest("/test"));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Slow down!",
      code: "RATE_LIMITED",
    });
  });

  it("uses custom key generator", async () => {
    const app = bunway();
    app.use(
      rateLimit({
        max: 1,
        windowMs: 60000,
        keyGenerator: (req) => req.path,
      })
    );
    app.get("/path1", (req, res) => res.json({ path: 1 }));
    app.get("/path2", (req, res) => res.json({ path: 2 }));

    await app.handle(buildRequest("/path1"));
    const response1 = await app.handle(buildRequest("/path1"));
    const response2 = await app.handle(buildRequest("/path2"));

    expect(response1.status).toBe(429);
    expect(response2.status).toBe(200);
  });

  it("skips when configured", async () => {
    const app = bunway();
    app.use(
      rateLimit({
        max: 1,
        windowMs: 60000,
        skip: (req) => req.path === "/health",
      })
    );
    app.get("/api", (req, res) => res.json({ api: true }));
    app.get("/health", (req, res) => res.json({ health: true }));

    await app.handle(buildRequest("/api"));
    const apiResponse = await app.handle(buildRequest("/api"));
    const healthResponse1 = await app.handle(buildRequest("/health"));
    const healthResponse2 = await app.handle(buildRequest("/health"));

    expect(apiResponse.status).toBe(429);
    expect(healthResponse1.status).toBe(200);
    expect(healthResponse2.status).toBe(200);
  });

  it("calls onLimitReached callback", async () => {
    let limitReached = false;
    let reachedInfo: { ip: string; path: string } | null = null;

    const app = bunway();
    app.use(
      rateLimit({
        max: 1,
        windowMs: 60000,
        onLimitReached: (req) => {
          limitReached = true;
          reachedInfo = { ip: req.ip, path: req.path };
        },
      })
    );
    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(buildRequest("/test"));
    await app.handle(buildRequest("/test"));

    expect(limitReached).toBe(true);
    expect(reachedInfo?.path).toBe("/test");
  });

  it("can disable headers", async () => {
    const app = bunway();
    app.use(rateLimit({ max: 5, windowMs: 60000, headers: false }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
    expect(response.headers.get("X-RateLimit-Remaining")).toBeNull();
  });

  it("decrements remaining count correctly", async () => {
    const app = bunway();
    app.use(rateLimit({ max: 3, windowMs: 60000 }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    const r1 = await app.handle(buildRequest("/test"));
    const r2 = await app.handle(buildRequest("/test"));
    const r3 = await app.handle(buildRequest("/test"));

    expect(r1.headers.get("X-RateLimit-Remaining")).toBe("2");
    expect(r2.headers.get("X-RateLimit-Remaining")).toBe("1");
    expect(r3.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});
