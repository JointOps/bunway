import { describe, expect, it } from "bun:test";
import bunway from "../../../src";
import { logger } from "../../../src/middleware/logger";

describe("logger middleware", () => {
  it("logs requests in dev format", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("dev", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(new Request("http://localhost/test"));

    expect(logs.length).toBe(1);
    expect(logs[0]).toMatch(/GET \/test 200/);
    expect(logs[0]).toMatch(/ms/);
  });

  it("logs requests in tiny format", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("tiny", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/api/users", (req, res) => res.json([{ id: 1 }]));

    await app.handle(new Request("http://localhost/api/users"));

    expect(logs.length).toBe(1);
    expect(logs[0]).toMatch(/GET \/api\/users 200/);
  });

  it("logs requests in combined format", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("combined", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(
      new Request("http://localhost/test", {
        headers: { "User-Agent": "TestAgent/1.0" },
      })
    );

    expect(logs[0]).toContain("TestAgent/1.0");
    expect(logs[0]).toContain("GET /test");
    expect(logs[0]).toContain("200");
  });

  it("logs requests in common format", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("common", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(new Request("http://localhost/test"));

    expect(logs.length).toBe(1);
    expect(logs[0]).toMatch(/GET \/test HTTP\/1\.1/);
    expect(logs[0]).toContain("200");
  });

  it("logs requests in short format", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("short", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(new Request("http://localhost/test"));

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("GET /test");
    expect(logs[0]).toContain("ms");
  });

  it("supports skip option", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("dev", {
        stream: { write: (msg) => logs.push(msg) },
        skip: (req) => req.path === "/health",
      })
    );

    app.get("/health", (req, res) => res.text("OK"));
    app.get("/api", (req, res) => res.json({ ok: true }));

    await app.handle(new Request("http://localhost/health"));
    await app.handle(new Request("http://localhost/api"));

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("/api");
  });

  it("supports custom format function", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger(
        (tokens, req, res, meta) => {
          return `CUSTOM: ${req.method} ${req.path} ${res.statusCode}`;
        },
        {
          stream: { write: (msg) => logs.push(msg.trim()) },
        }
      )
    );

    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(new Request("http://localhost/test"));

    expect(logs[0]).toBe("CUSTOM: GET /test 200");
  });

  it("supports custom format string", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger(":method :path :status", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.post("/users", (req, res) => res.status(201).json({ id: 1 }));

    await app.handle(
      new Request("http://localhost/users", { method: "POST" })
    );

    expect(logs[0]).toBe("POST /users 201");
  });

  it("captures response time", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("tiny", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/slow", async (req, res) => {
      await new Promise((r) => setTimeout(r, 50));
      res.json({ ok: true });
    });

    await app.handle(new Request("http://localhost/slow"));

    const timeMatch = logs[0].match(/(\d+\.\d+) ms/);
    expect(timeMatch).toBeDefined();
    const time = parseFloat(timeMatch![1]);
    expect(time).toBeGreaterThanOrEqual(50);
  });

  it("logs different status codes correctly", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("dev", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/ok", (req, res) => res.json({ ok: true }));
    app.get("/created", (req, res) => res.status(201).json({ id: 1 }));
    app.get("/not-found", (req, res) => res.status(404).json({ error: "Not found" }));
    app.get("/error", (req, res) => res.status(500).json({ error: "Server error" }));

    await app.handle(new Request("http://localhost/ok"));
    await app.handle(new Request("http://localhost/created"));
    await app.handle(new Request("http://localhost/not-found"));
    await app.handle(new Request("http://localhost/error"));

    expect(logs[0]).toContain("200");
    expect(logs[1]).toContain("201");
    expect(logs[2]).toContain("404");
    expect(logs[3]).toContain("500");
  });

  it("logs text responses", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("dev", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/text", (req, res) => res.text("Hello, World!"));

    await app.handle(new Request("http://localhost/text"));

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("GET /text 200");
  });

  it("logs html responses", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("dev", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/html", (req, res) => res.html("<h1>Hello</h1>"));

    await app.handle(new Request("http://localhost/html"));

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("GET /html 200");
  });

  it("logs redirects", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("dev", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/old", (req, res) => res.redirect("/new"));

    await app.handle(new Request("http://localhost/old"));

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("GET /old 302");
  });

  it("logs sendStatus responses", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("dev", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.delete("/resource/:id", (req, res) => res.sendStatus(204));

    await app.handle(
      new Request("http://localhost/resource/123", { method: "DELETE" })
    );

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("DELETE /resource/123 204");
  });

  it("uses tokens for user-agent and referrer", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger(":user-agent :referrer", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(
      new Request("http://localhost/test", {
        headers: {
          "User-Agent": "MyBrowser/1.0",
          Referer: "http://example.com",
        },
      })
    );

    expect(logs[0]).toContain("MyBrowser/1.0");
    expect(logs[0]).toContain("http://example.com");
  });

  it("handles missing headers gracefully", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger(":user-agent :referrer", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(new Request("http://localhost/test"));

    expect(logs[0]).toBe("- -");
  });

  it("supports immediate logging", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger("dev", {
        stream: { write: (msg) => logs.push(msg.trim()) },
        immediate: true,
      })
    );

    app.get("/test", async (req, res) => {
      // Log should already be written before this
      await new Promise((r) => setTimeout(r, 10));
      res.json({ ok: true });
    });

    await app.handle(new Request("http://localhost/test"));

    expect(logs.length).toBe(1);
    // In immediate mode, response time is 0
    expect(logs[0]).toContain("0.000 ms");
  });

  it("uses remote-addr token", async () => {
    const logs: string[] = [];
    const app = bunway();

    app.use(
      logger(":remote-addr :method :url", {
        stream: { write: (msg) => logs.push(msg.trim()) },
      })
    );

    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(new Request("http://localhost/test"));

    expect(logs[0]).toContain("127.0.0.1 GET /test");
  });
});
