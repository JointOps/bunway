import { describe, it, expect } from "bun:test";
import bunway from "../../src";
import { timeout } from "../../src/middleware/timeout";
import { hpp } from "../../src/middleware/hpp";
import { validate } from "../../src/middleware/validation";
import { json } from "../../src/middleware/body-parser";

describe("Express Compatibility: Phase 3", () => {
  it("timeout middleware works like connect-timeout", async () => {
    const app = bunway();
    app.use(timeout(50));
    app.get("/slow", async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (!req.timedout) res.json({ ok: true });
    });

    const response = await app.handle(new Request("http://localhost/slow"));
    expect(response.status).toBe(408);
  });

  it("hpp middleware works like hpp npm package", async () => {
    const app = bunway();
    app.use(json());
    app.use(hpp({ whitelist: ["allowed"] }));
    app.post("/api", (req, res) => {
      res.json({ body: req.body, polluted: req.locals.bodyPolluted });
    });

    const response = await app.handle(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: ["user", "admin"], allowed: [1, 2] }),
      })
    );
    const body = await response.json();
    expect(body.body.role).toBe("admin"); // sanitized to last
    expect(body.body.allowed).toEqual([1, 2]); // whitelisted, kept as array
  });

  it("validate middleware works like express-validator pattern", async () => {
    const app = bunway();
    app.use(json());
    app.post(
      "/register",
      validate({
        body: {
          email: { required: true, type: "email" },
          password: { required: true, type: "string", min: 8 },
        },
      }),
      (req, res) => res.status(201).json({ ok: true })
    );

    // Invalid
    const r1 = await app.handle(
      new Request("http://localhost/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "bad", password: "short" }),
      })
    );
    expect(r1.status).toBe(422);

    // Valid
    const r2 = await app.handle(
      new Request("http://localhost/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@test.com", password: "securepass123" }),
      })
    );
    expect(r2.status).toBe(201);
  });

  it("req.timedout flag works like connect-timeout", async () => {
    const app = bunway();
    app.use(timeout(50, { respond: false }));
    app.get("/check", async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      res.json({ timedout: req.timedout });
    });

    const response = await app.handle(new Request("http://localhost/check"));
    const body = await response.json();
    expect(body.timedout).toBe(true);
  });
});
