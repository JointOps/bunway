import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { buildRequest } from "../../utils/test-helpers";

describe("app.use(path, handler) — prefix middleware", () => {
  it("runs for all routes under the prefix", async () => {
    const app = bunway();
    const hits: string[] = [];
    app.use("/api", (_req, _res, next) => {
      hits.push("mw");
      next();
    });
    app.get("/api/users", (_req, res) => res.json({ ok: true }));
    app.get("/api/products", (_req, res) => res.json({ ok: true }));

    await app.handle(buildRequest("/api/users"));
    await app.handle(buildRequest("/api/products"));
    expect(hits).toEqual(["mw", "mw"]);
  });

  it("does NOT run for routes outside the prefix", async () => {
    const app = bunway();
    let ran = false;
    app.use("/api", (_req, _res, next) => {
      ran = true;
      next();
    });
    app.get("/health", (_req, res) => res.json({ ok: true }));

    await app.handle(buildRequest("/health"));
    expect(ran).toBe(false);
  });

  it("req.path is relativized inside prefix middleware", async () => {
    const app = bunway();
    let seenPath = "";
    app.use("/api", (r, _res, next) => {
      seenPath = r.path;
      next();
    });
    app.get("/api/users", (_req, res) => res.json({ ok: true }));

    await app.handle(buildRequest("/api/users"));
    expect(seenPath).toBe("/users");
  });

  it("multiple prefix middlewares for same prefix all run in order", async () => {
    const app = bunway();
    const log: string[] = [];
    app.use("/api", (_req, _res, next) => {
      log.push("auth");
      next();
    });
    app.use("/api", (_req, _res, next) => {
      log.push("rate-limit");
      next();
    });
    app.get("/api/data", (_req, res) => res.json({ log }));

    const res = await app.handle(buildRequest("/api/data"));
    const body = await res.json();
    expect(body.log).toEqual(["auth", "rate-limit"]);
  });

  it("prefix middleware on /api does NOT match /apple", async () => {
    const app = bunway();
    let ran = false;
    app.use("/api", (_req, _res, next) => {
      ran = true;
      next();
    });
    app.get("/apple", (_req, res) => res.json({ ok: true }));

    await app.handle(buildRequest("/apple"));
    expect(ran).toBe(false);
  });
});
