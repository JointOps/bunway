import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { Router } from "../../../src/core/router";

describe("Integration: array paths in use()", () => {
  it("middleware runs for all paths in array", async () => {
    const app = bunway();
    const log: string[] = [];
    app.use(["/api", "/v2"], (req, res, next) => {
      log.push(req.path);
      next();
    });
    app.get("/api", (req, res) => res.json({ ok: true }));
    app.get("/v2", (req, res) => res.json({ ok: true }));

    await app.handle(new Request("http://localhost/api"));
    await app.handle(new Request("http://localhost/v2"));
    expect(log).toEqual(["/api", "/v2"]);
  });

  it("sub-router mounted on multiple paths", async () => {
    const app = bunway();
    const api = new Router();
    api.get("/health", (req, res) => res.json({ status: "ok" }));
    app.use(["/v1", "/v2"], api);

    const r1 = await app.handle(new Request("http://localhost/v1/health"));
    const r2 = await app.handle(new Request("http://localhost/v2/health"));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  it("empty array does not register anything", async () => {
    const app = bunway();
    app.use([], (req, res) => res.json({ ok: true }));
    app.get("/test", (req, res) => res.json({ fallback: true }));

    const response = await app.handle(new Request("http://localhost/test"));
    const body = await response.json();
    expect(body.fallback).toBe(true);
  });
});
