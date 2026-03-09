import { describe, it, expect } from "bun:test";
import bunway from "../../../src";

describe("Integration: res.send() auto-detection", () => {
  it("auto-sets text/html for string body", async () => {
    const app = bunway();
    app.get("/", (req, res) => res.send("Hello"));

    const response = await app.handle(new Request("http://localhost/"));
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe("Hello");
  });

  it("auto-delegates object to json()", async () => {
    const app = bunway();
    app.get("/", (req, res) => res.send({ ok: true }));

    const response = await app.handle(new Request("http://localhost/"));
    expect(response.headers.get("content-type")).toBe("application/json");
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("preserves explicit Content-Type", async () => {
    const app = bunway();
    app.get("/", (req, res) => {
      res.type("text/plain");
      res.send("Hello");
    });

    const response = await app.handle(new Request("http://localhost/"));
    expect(response.headers.get("content-type")).toBe("text/plain");
  });

  it("res.status().send() chains correctly", async () => {
    const app = bunway();
    app.get("/", (req, res) => {
      res.status(201).send("Created");
    });

    const response = await app.handle(new Request("http://localhost/"));
    expect(response.status).toBe(201);
    expect(await response.text()).toBe("Created");
  });

  it("res.status().json() chains correctly", async () => {
    const app = bunway();
    app.get("/", (req, res) => {
      res.status(201).json({ created: true });
    });

    const response = await app.handle(new Request("http://localhost/"));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.created).toBe(true);
  });
});
