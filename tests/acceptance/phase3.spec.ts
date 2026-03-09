import { describe, it, expect, afterEach } from "bun:test";
import bunway from "../../src";
import { timeout } from "../../src/middleware/timeout";
import { hpp } from "../../src/middleware/hpp";
import { validate } from "../../src/middleware/validation";
import { json } from "../../src/middleware/body-parser";

describe("Acceptance: Phase 3 features (full HTTP round-trip)", () => {
  let server: ReturnType<typeof Bun.serve> | null = null;

  afterEach(async () => {
    if (server) {
      server.stop();
      server = null;
    }
  });

  it("timeout middleware returns 408 via real HTTP", async () => {
    const app = bunway();
    app.use(timeout(100));
    app.get("/slow", async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!req.timedout) res.json({ ok: true });
    });

    server = app.listen({ port: 0 });
    const port = server.port;

    const response = await fetch(`http://localhost:${port}/slow`);
    expect(response.status).toBe(408);
  });

  it("hpp middleware sanitizes polluted query via real HTTP", async () => {
    const app = bunway();
    app.use(hpp());
    app.get("/search", (req, res) => {
      res.json({
        q: req.query.get("q"),
        polluted: req.locals.queryPolluted !== undefined,
      });
    });

    server = app.listen({ port: 0 });
    const port = server.port;

    const response = await fetch(`http://localhost:${port}/search?q=first&q=second`);
    const body = await response.json();
    expect(body.polluted).toBe(true);
  });

  it("validate middleware returns 422 for invalid body via real HTTP", async () => {
    const app = bunway();
    app.use(json());
    app.post(
      "/users",
      validate({
        body: {
          name: { required: true, type: "string", min: 2 },
          email: { required: true, type: "email" },
        },
      }),
      (req, res) => res.status(201).json({ created: true })
    );

    server = app.listen({ port: 0 });
    const port = server.port;

    const response = await fetch(`http://localhost:${port}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A" }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.errors.length).toBeGreaterThanOrEqual(1);
  });

  it("all Phase 3 middleware work together via real HTTP", async () => {
    const app = bunway();
    app.use(json());
    app.use(timeout(5000));
    app.use(hpp());
    app.post(
      "/api/data",
      validate({
        body: { name: { required: true } },
      }),
      (req, res) => {
        res.json({ name: (req.body as Record<string, unknown>).name });
      }
    );

    server = app.listen({ port: 0 });
    const port = server.port;

    const response = await fetch(`http://localhost:${port}/api/data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "bunway" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe("bunway");
  });
});
