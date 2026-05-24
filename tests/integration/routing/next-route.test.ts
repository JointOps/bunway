import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { buildRequest } from "../../utils/test-helpers";

describe("next('route')", () => {
  it("skips remaining handlers in current route definition and falls to next match", async () => {
    const app = bunway();
    app.get(
      "/check",
      (_req, _res, next) => {
        next("route");
      },
      (_req, res) => {
        res.json({ from: "should-be-skipped" });
      }
    );
    app.get("/check", (_req, res) => {
      res.json({ from: "second-route" });
    });

    const res = await app.handle(buildRequest("/check"));
    const body = await res.json();
    expect(body.from).toBe("second-route");
  });

  it("returns 404 when next('route') called and no further matching routes exist", async () => {
    const app = bunway();
    app.get("/only", (_req, _res, next) => {
      next("route");
    });

    const res = await app.handle(buildRequest("/only"));
    expect(res.status).toBe(404);
  });

  it("global middlewares are NOT skipped by next('route')", async () => {
    const app = bunway();
    const log: string[] = [];
    app.use((_req, _res, next) => {
      log.push("global");
      next();
    });
    app.get("/path", (_req, _res, next) => {
      log.push("first");
      next("route");
    });
    app.get("/path", (_req, res) => {
      res.json({ log });
    });

    const res = await app.handle(buildRequest("/path"));
    const body = await res.json();
    expect(body.log).toContain("global");
    expect(body.log).toContain("first");
  });

  it("next('router') exits the router entirely and returns 404 when no parent", async () => {
    const app = bunway();
    app.get("/router-test", (_req, _res, next) => {
      next("router");
    });
    app.get("/router-test", (_req, res) => {
      res.json({ ok: true });
    });

    const res = await app.handle(buildRequest("/router-test"));
    expect(res.status).toBe(404);
  });
});
