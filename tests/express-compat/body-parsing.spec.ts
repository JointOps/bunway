import { describe, test, expect } from "bun:test";
import bunway from "../../src";
import { buildRequest } from "../utils/testUtils";

describe("Express Compatibility: Body Parsing", () => {
  test("bunway.json() parses JSON body like express.json()", async () => {
    const app = bunway();
    app.use(bunway.json());
    app.post("/test", (req, res) => {
      res.json({ received: req.body });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test", value: 123 })
    }));

    expect(await response.json()).toEqual({
      received: { name: "test", value: 123 }
    });
  });

  test("bunway.urlencoded() parses form data like express.urlencoded()", async () => {
    const app = bunway();
    app.use(bunway.urlencoded());
    app.post("/test", (req, res) => {
      res.json({ received: req.body });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=test&value=123"
    }));

    expect(await response.json()).toEqual({
      received: { name: "test", value: "123" }
    });
  });

  test("bunway.text() parses text body like express.text()", async () => {
    const app = bunway();
    app.use(bunway.text());
    app.post("/test", (req, res) => {
      res.json({ received: req.body });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "Hello World"
    }));

    expect(await response.json()).toEqual({
      received: "Hello World"
    });
  });

  test("JSON parsing rejects invalid JSON like Express", async () => {
    const app = bunway();
    app.use(bunway.json());
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.status || 500).json({ error: err.message });
    });
    app.post("/test", (req, res) => {
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json"
    }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Invalid JSON");
  });

  test("Body parser respects Content-Type like Express", async () => {
    const app = bunway();
    app.use(bunway.json());
    app.post("/test", (req, res) => {
      res.json({ bodyParsed: req.body !== undefined });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "plain text"
    }));

    expect(await response.json()).toEqual({ bodyParsed: false });
  });

  test("Multiple body parsers work like Express", async () => {
    const app = bunway();
    app.use(bunway.json());
    app.use(bunway.urlencoded());

    app.post("/json", (req, res) => {
      res.json({ type: "json", body: req.body });
    });

    app.post("/form", (req, res) => {
      res.json({ type: "form", body: req.body });
    });

    const response1 = await app.handle(buildRequest("/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true })
    }));
    expect(await response1.json()).toEqual({
      type: "json",
      body: { test: true }
    });

    const response2 = await app.handle(buildRequest("/form", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "test=true"
    }));
    expect(await response2.json()).toEqual({
      type: "form",
      body: { test: "true" }
    });
  });

  test("Empty JSON body works like Express", async () => {
    const app = bunway();
    app.use(bunway.json());
    app.post("/test", (req, res) => {
      res.json({ body: req.body });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: ""
    }));

    expect(await response.json()).toEqual({ body: {} });
  });

  test("Nested JSON objects work like Express", async () => {
    const app = bunway();
    app.use(bunway.json());
    app.post("/test", (req, res) => {
      res.json({ received: req.body });
    });

    const complexObject = {
      user: {
        name: "test",
        profile: {
          age: 25,
          hobbies: ["coding", "reading"]
        }
      }
    };

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(complexObject)
    }));

    expect(await response.json()).toEqual({ received: complexObject });
  });

  test("Body parser limit option works like Express", async () => {
    const app = bunway();
    app.use(bunway.json({ limit: 100 }));
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.status || 500).json({ error: err.message });
    });
    app.post("/test", (req, res) => {
      res.json({ ok: true });
    });

    const largeBody = { data: "x".repeat(200) };

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(largeBody)
    }));

    expect(response.status).toBe(413);
  });

  test("Body parser works for POST requests like Express", async () => {
    const app = bunway();
    app.use(bunway.json());
    app.post("/test", (req, res) => {
      res.json({ hasBody: req.body !== undefined, body: req.body });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true })
    }));

    const data = await response.json();
    expect(data.hasBody).toBe(true);
    expect(data.body).toEqual({ test: true });
  });

  test("bunway.raw() parses binary body like express.raw()", async () => {
    const app = bunway();
    app.use(bunway.raw());
    app.post("/test", (req, res) => {
      res.json({ isBuffer: Buffer.isBuffer(req.body), length: (req.body as Buffer).length });
    });

    const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: binaryData
    }));

    const data = await response.json() as { isBuffer: boolean; length: number };
    expect(data.isBuffer).toBe(true);
    expect(data.length).toBe(5);
  });

  test("bunway.raw() skips non-matching content types like Express", async () => {
    const app = bunway();
    app.use(bunway.raw());
    app.post("/test", (req, res) => {
      res.json({ bodyParsed: req.body !== undefined });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }));

    expect(await response.json()).toEqual({ bodyParsed: false });
  });

  test("bunway.urlencoded({ extended: true }) parses nested form data", async () => {
    const app = bunway();
    app.use(bunway.urlencoded({ extended: true }));
    app.post("/test", (req, res) => {
      res.json({ body: req.body });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=test&value=123"
    }));

    const data = await response.json() as { body: Record<string, string> };
    expect(data.body.name).toBe("test");
    expect(data.body.value).toBe("123");
  });

  test("bunway.json({ type }) accepts custom type matcher like Express", async () => {
    const app = bunway();
    app.use(bunway.json({ type: "application/*" }));
    app.post("/test", (req, res) => {
      res.json({ body: req.body });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/vnd.api+json" },
      body: JSON.stringify({ api: true })
    }));

    expect(await response.json()).toEqual({ body: { api: true } });
  });

  test("body is parsed for PUT requests like Express", async () => {
    const app = bunway();
    app.use(bunway.json());
    app.put("/test", (req, res) => {
      res.json({ body: req.body });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updated: true })
    }));

    expect(await response.json()).toEqual({ body: { updated: true } });
  });

  test("body is parsed for PATCH requests like Express", async () => {
    const app = bunway();
    app.use(bunway.json());
    app.patch("/test", (req, res) => {
      res.json({ body: req.body });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "value" })
    }));

    expect(await response.json()).toEqual({ body: { field: "value" } });
  });
});
