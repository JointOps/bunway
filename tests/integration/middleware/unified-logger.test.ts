import { describe, expect, it } from "bun:test";
import bunway from "../../../src";
import { logger } from "../../../src/middleware/logger";
import { errorHandler } from "../../../src/middleware/error-handler";
import type { BunWayLogger } from "../../../src";

describe("unified logger", () => {
  it("uses default console logger when no logger is configured", async () => {
    const app = bunway();
    const appLogger = app.getLogger();

    expect(appLogger).toBeDefined();
    expect(typeof appLogger.info).toBe("function");
    expect(typeof appLogger.warn).toBe("function");
    expect(typeof appLogger.error).toBe("function");
  });

  it("allows setting a custom logger via app.set", async () => {
    const logs: { level: string; message: string; meta?: Record<string, unknown> }[] = [];

    const customLogger: BunWayLogger = {
      info: (msg, meta) => logs.push({ level: "info", message: msg, meta }),
      warn: (msg, meta) => logs.push({ level: "warn", message: msg, meta }),
      error: (msg, meta) => logs.push({ level: "error", message: msg, meta }),
      debug: (msg, meta) => logs.push({ level: "debug", message: msg, meta }),
    };

    const app = bunway();
    app.set("logger", customLogger);

    const appLogger = app.getLogger();
    appLogger.info("test message", { key: "value" });

    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe("info");
    expect(logs[0].message).toBe("test message");
    expect(logs[0].meta).toEqual({ key: "value" });
  });

  it("logger middleware uses app logger when useAppLogger is true", async () => {
    const logs: string[] = [];

    const customLogger: BunWayLogger = {
      info: (msg) => logs.push(`INFO: ${msg}`),
      warn: (msg) => logs.push(`WARN: ${msg}`),
      error: (msg) => logs.push(`ERROR: ${msg}`),
    };

    const app = bunway();
    app.set("logger", customLogger);

    app.use(logger("dev", { useAppLogger: true }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(new Request("http://localhost/test"));

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("INFO:");
    expect(logs[0]).toContain("GET /test 200");
  });

  it("logger middleware prefers custom stream over app logger", async () => {
    const appLogs: string[] = [];
    const streamLogs: string[] = [];

    const customLogger: BunWayLogger = {
      info: (msg) => appLogs.push(msg),
      warn: (msg) => appLogs.push(msg),
      error: (msg) => appLogs.push(msg),
    };

    const app = bunway();
    app.set("logger", customLogger);

    // Custom stream should take precedence
    app.use(
      logger("dev", {
        stream: { write: (msg) => streamLogs.push(msg.trim()) },
        useAppLogger: true, // Even with this set, stream takes precedence
      })
    );
    app.get("/test", (req, res) => res.json({ ok: true }));

    await app.handle(new Request("http://localhost/test"));

    expect(appLogs.length).toBe(0);
    expect(streamLogs.length).toBe(1);
    expect(streamLogs[0]).toContain("GET /test 200");
  });

  it("errorHandler uses app logger when useAppLogger is true", async () => {
    const logs: { level: string; message: string; meta?: Record<string, unknown> }[] = [];

    const customLogger: BunWayLogger = {
      info: (msg, meta) => logs.push({ level: "info", message: msg, meta }),
      warn: (msg, meta) => logs.push({ level: "warn", message: msg, meta }),
      error: (msg, meta) => logs.push({ level: "error", message: msg, meta }),
    };

    const app = bunway();
    app.set("logger", customLogger);

    app.get("/error", () => {
      throw new Error("Test error");
    });

    app.use(errorHandler({ useAppLogger: true }));

    const response = await app.handle(new Request("http://localhost/error"));

    expect(response.status).toBe(500);
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe("error");
    expect(logs[0].message).toBe("Test error");
    expect(logs[0].meta?.path).toBe("/error");
    expect(logs[0].meta?.method).toBe("GET");
  });

  it("errorHandler prefers custom logger over app logger", async () => {
    const appLogs: string[] = [];
    const customHandlerLogs: string[] = [];

    const customLogger: BunWayLogger = {
      info: (msg) => appLogs.push(msg),
      warn: (msg) => appLogs.push(msg),
      error: (msg) => appLogs.push(msg),
    };

    const app = bunway();
    app.set("logger", customLogger);

    app.get("/error", () => {
      throw new Error("Test error");
    });

    // Custom logger function takes precedence
    app.use(
      errorHandler({
        logger: (err) => customHandlerLogs.push(String(err)),
        useAppLogger: true,
      })
    );

    await app.handle(new Request("http://localhost/error"));

    expect(appLogs.length).toBe(0);
    expect(customHandlerLogs.length).toBe(1);
    expect(customHandlerLogs[0]).toContain("Test error");
  });

  it("request has access to app via req.app", async () => {
    const app = bunway();
    let appFromRequest: unknown;

    app.get("/test", (req, res) => {
      appFromRequest = req.app;
      res.json({ ok: true });
    });

    await app.handle(new Request("http://localhost/test"));

    expect(appFromRequest).toBe(app);
  });

  it("request can access app logger via req.app.getLogger()", async () => {
    const logs: string[] = [];

    const customLogger: BunWayLogger = {
      info: (msg) => logs.push(`INFO: ${msg}`),
      warn: (msg) => logs.push(`WARN: ${msg}`),
      error: (msg) => logs.push(`ERROR: ${msg}`),
    };

    const app = bunway();
    app.set("logger", customLogger);

    app.get("/test", (req, res) => {
      req.app!.getLogger().info("Log from route handler");
      res.json({ ok: true });
    });

    await app.handle(new Request("http://localhost/test"));

    expect(logs.length).toBe(1);
    expect(logs[0]).toBe("INFO: Log from route handler");
  });

  it("supports pino-like logger interface", async () => {
    // Simulate a Pino-like logger structure
    interface PinoLog {
      level: string;
      msg: string;
      [key: string]: unknown;
    }
    const pinoLogs: PinoLog[] = [];

    // Adapter to convert BunWayLogger calls to Pino-style
    const pinoAdapter: BunWayLogger = {
      info: (msg, meta) => pinoLogs.push({ level: "info", msg, ...meta }),
      warn: (msg, meta) => pinoLogs.push({ level: "warn", msg, ...meta }),
      error: (msg, meta) => pinoLogs.push({ level: "error", msg, ...meta }),
      debug: (msg, meta) => pinoLogs.push({ level: "debug", msg, ...meta }),
    };

    const app = bunway();
    app.set("logger", pinoAdapter);

    app.use(logger("dev", { useAppLogger: true }));
    app.get("/api/users", (req, res) => res.json([{ id: 1 }]));

    await app.handle(new Request("http://localhost/api/users"));

    expect(pinoLogs.length).toBe(1);
    expect(pinoLogs[0].level).toBe("info");
    expect(pinoLogs[0].msg).toContain("GET /api/users 200");
  });

  it("supports winston-like logger interface", async () => {
    // Simulate a Winston-like logger structure
    interface WinstonLog {
      level: string;
      message: string;
      meta?: Record<string, unknown>;
    }
    const winstonLogs: WinstonLog[] = [];

    // Adapter to convert BunWayLogger calls to Winston-style
    const winstonAdapter: BunWayLogger = {
      info: (message, meta) => winstonLogs.push({ level: "info", message, meta }),
      warn: (message, meta) => winstonLogs.push({ level: "warn", message, meta }),
      error: (message, meta) => winstonLogs.push({ level: "error", message, meta }),
      debug: (message, meta) => winstonLogs.push({ level: "debug", message, meta }),
    };

    const app = bunway();
    app.set("logger", winstonAdapter);

    app.get("/error", () => {
      throw new Error("Database connection failed");
    });
    app.use(errorHandler({ useAppLogger: true }));

    await app.handle(new Request("http://localhost/error"));

    expect(winstonLogs.length).toBe(1);
    expect(winstonLogs[0].level).toBe("error");
    expect(winstonLogs[0].message).toBe("Database connection failed");
  });
});
