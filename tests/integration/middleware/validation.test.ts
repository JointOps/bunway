import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { validate } from "../../../src/middleware/validation";
import { json } from "../../../src/middleware/body-parser";

describe("Integration: validate middleware", () => {
  it("validates request body in full pipeline", async () => {
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
      (req, res) => {
        res.status(201).json({ created: true });
      }
    );

    // Valid request
    const r1 = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Alice", email: "alice@example.com" }),
      })
    );
    expect(r1.status).toBe(201);

    // Invalid request
    const r2 = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "A", email: "not-email" }),
      })
    );
    expect(r2.status).toBe(422);
    const body = await r2.json();
    expect(body.errors.length).toBe(2);
  });

  it("validates route params", async () => {
    const app = bunway();
    app.get(
      "/users/:id",
      validate({
        params: {
          id: { required: true, pattern: /^\d+$/ },
        },
      }),
      (req, res) => {
        res.json({ id: req.params.id });
      }
    );

    const r1 = await app.handle(new Request("http://localhost/users/42"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/users/abc"));
    expect(r2.status).toBe(422);
  });

  it("validates query parameters", async () => {
    const app = bunway();
    app.get(
      "/search",
      validate({
        query: {
          q: { required: true, min: 1 },
        },
      }),
      (req, res) => {
        res.json({ results: [] });
      }
    );

    const r1 = await app.handle(new Request("http://localhost/search?q=bunway"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/search"));
    expect(r2.status).toBe(422);
  });

  it("custom error formatter works in pipeline", async () => {
    const app = bunway();
    app.use(json());
    app.post(
      "/api",
      validate(
        { body: { name: { required: true } } },
        { errorFormatter: (errors) => ({ ok: false, messages: errors.map(e => e.message) }) }
      ),
      (req, res) => res.json({ ok: true })
    );

    const response = await app.handle(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.messages).toBeDefined();
  });

  it("validation with enum and custom validator", async () => {
    const app = bunway();
    app.use(json());
    app.post(
      "/register",
      validate({
        body: {
          role: { required: true, enum: ["user", "admin"] },
          username: {
            required: true,
            custom: (val) => val !== "root" ? true : "Username 'root' is reserved",
          },
        },
      }),
      (req, res) => res.status(201).json({ registered: true })
    );

    // Valid
    const r1 = await app.handle(
      new Request("http://localhost/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "user", username: "alice" }),
      })
    );
    expect(r1.status).toBe(201);

    // Invalid role
    const r2 = await app.handle(
      new Request("http://localhost/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "superadmin", username: "alice" }),
      })
    );
    expect(r2.status).toBe(422);

    // Reserved username
    const r3 = await app.handle(
      new Request("http://localhost/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "user", username: "root" }),
      })
    );
    expect(r3.status).toBe(422);
    const body = await r3.json();
    expect(body.errors[0].message).toBe("Username 'root' is reserved");
  });
});
