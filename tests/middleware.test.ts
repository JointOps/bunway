import { describe, expect, it } from "bun:test";
import bunway, { cors, json, urlencoded, text, errorHandler, HttpError } from "../src";
import { buildRequest, TEST_ORIGIN } from "./testUtils";

describe("json middleware", () => {
  it("parses JSON body", async () => {
    const app = bunway();
    app.use(json());
    app.post("/test", (req, res) => {
      res.json({ received: req.body });
    });

    const response = await app.handle(
      buildRequest("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John" }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: { name: "John" } });
  });

  it("skips non-JSON content types", async () => {
    const app = bunway();
    app.use(json());
    app.post("/test", (req, res) => {
      res.json({ body: req.body, parsed: req.isBodyParsed() });
    });

    const response = await app.handle(
      buildRequest("/test", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "hello",
      })
    );

    const data = await response.json();
    expect(data.parsed).toBe(false);
  });

  it("returns 413 for payload too large", async () => {
    const app = bunway();
    app.use(json({ limit: 10 }));
    app.post("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(
      buildRequest("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "x".repeat(100) }),
      })
    );

    expect(response.status).toBe(413);
  });
});

describe("urlencoded middleware", () => {
  it("parses form data", async () => {
    const app = bunway();
    app.use(urlencoded());
    app.post("/test", (req, res) => {
      res.json({ received: req.body });
    });

    const response = await app.handle(
      buildRequest("/test", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "name=John&age=30",
      })
    );

    expect(await response.json()).toEqual({ received: { name: "John", age: "30" } });
  });
});

describe("text middleware", () => {
  it("parses text body", async () => {
    const app = bunway();
    app.use(text());
    app.post("/test", (req, res) => {
      res.json({ received: req.body });
    });

    const response = await app.handle(
      buildRequest("/test", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "Hello World",
      })
    );

    expect(await response.json()).toEqual({ received: "Hello World" });
  });
});

describe("cors middleware", () => {
  it("sets CORS headers for simple requests", async () => {
    const app = bunway();
    app.use(cors());
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(
      buildRequest("/test", {
        headers: { Origin: TEST_ORIGIN },
      })
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("reflects origin when origin is true", async () => {
    const app = bunway();
    app.use(cors({ origin: true }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(
      buildRequest("/test", {
        headers: { Origin: TEST_ORIGIN },
      })
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(TEST_ORIGIN);
  });

  it("handles preflight requests", async () => {
    const app = bunway();
    app.use(cors());
    app.options("/test", (req, res) => res.noContent());
    app.post("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(
      buildRequest("/test", {
        method: "OPTIONS",
        headers: {
          Origin: TEST_ORIGIN,
          "Access-Control-Request-Method": "POST",
        },
      })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeDefined();
  });

  it("sets credentials header when enabled", async () => {
    const app = bunway();
    app.use(cors({ credentials: true }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(
      buildRequest("/test", {
        headers: { Origin: TEST_ORIGIN },
      })
    );

    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });
});

describe("errorHandler middleware", () => {
  it("handles HttpError", async () => {
    const app = bunway();
    app.use(errorHandler());
    app.get("/test", () => {
      throw new HttpError(403, "Forbidden");
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("handles generic errors", async () => {
    const app = bunway();
    app.use(errorHandler());
    app.get("/test", () => {
      throw new Error("Something went wrong");
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Something went wrong");
  });

  it("logs errors when logger is provided", async () => {
    const logged: unknown[] = [];
    const app = bunway();
    app.use(errorHandler({ logger: (err) => logged.push(err) }));
    app.get("/test", () => {
      throw new Error("Test error");
    });

    await app.handle(buildRequest("/test"));
    expect(logged.length).toBe(1);
  });
});
