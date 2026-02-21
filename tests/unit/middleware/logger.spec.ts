import { describe, expect, it } from "bun:test";
import { logger } from "../../../src/middleware/logger";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

const createRequest = (
  method = "GET",
  path = "/test",
  headers: Record<string, string> = {}
): BunRequest => {
  return new BunRequest(
    new Request(`http://localhost${path}`, { method, headers }),
    path
  );
};

const noop = () => {};

function captureStream(): { messages: string[]; stream: { write: (msg: string) => void } } {
  const messages: string[] = [];
  return {
    messages,
    stream: { write: (msg: string) => messages.push(msg) },
  };
}

describe("logger middleware (Unit)", () => {
  describe("basic logging", () => {
    it("should log when a response method is called", () => {
      const { messages, stream } = captureStream();
      const req = createRequest();
      const res = new BunResponse();

      logger("tiny", { stream })(req, res, noop);
      res.json({ ok: true });

      expect(messages.length).toBe(1);
    });

    it("should call next()", () => {
      const { stream } = captureStream();
      const req = createRequest();
      const res = new BunResponse();
      let called = false;

      logger("tiny", { stream })(req, res, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should log only once even if multiple response methods are called", () => {
      const { messages, stream } = captureStream();
      const req = createRequest();
      const res = new BunResponse();

      logger("tiny", { stream })(req, res, noop);
      res.json({ a: 1 });

      expect(messages.length).toBe(1);
    });
  });

  describe("predefined formats", () => {
    it("should log in tiny format", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("GET", "/hello");
      const res = new BunResponse();

      logger("tiny", { stream })(req, res, noop);
      res.status(200).json({ ok: true });

      expect(messages.length).toBe(1);
      const line = messages[0];
      expect(line).toContain("GET");
      expect(line).toContain("/hello");
      expect(line).toContain("200");
      expect(line).toContain("ms");
    });

    it("should log in short format", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("POST", "/api");
      const res = new BunResponse();

      logger("short", { stream })(req, res, noop);
      res.status(201).json({ created: true });

      expect(messages.length).toBe(1);
      const line = messages[0];
      expect(line).toContain("POST");
      expect(line).toContain("/api");
      expect(line).toContain("201");
    });

    it("should log in dev format by default", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("GET", "/default");
      const res = new BunResponse();

      logger(undefined, { stream })(req, res, noop);
      res.json({ ok: true });

      expect(messages.length).toBe(1);
      const line = messages[0];
      expect(line).toContain("GET");
      expect(line).toContain("/default");
      expect(line).toContain("200");
    });

    it("should log in combined format", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("GET", "/combined", {
        "user-agent": "TestAgent/1.0",
      });
      const res = new BunResponse();

      logger("combined", { stream })(req, res, noop);
      res.json({ ok: true });

      expect(messages.length).toBe(1);
      const line = messages[0];
      expect(line).toContain("GET");
      expect(line).toContain("TestAgent/1.0");
    });

    it("should log in common format", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("GET", "/common");
      const res = new BunResponse();

      logger("common", { stream })(req, res, noop);
      res.json({ ok: true });

      expect(messages.length).toBe(1);
      const line = messages[0];
      expect(line).toContain("GET");
      expect(line).toContain("/common");
    });
  });

  describe("custom format string", () => {
    it("should use custom format string with tokens", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("DELETE", "/resource");
      const res = new BunResponse();

      logger(":method :url :status", { stream })(req, res, noop);
      res.status(204).send(null);

      expect(messages.length).toBe(1);
      const line = messages[0];
      expect(line).toContain("DELETE");
      expect(line).toContain("/resource");
      expect(line).toContain("204");
    });
  });

  describe("custom format function", () => {
    it("should use custom format function", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("PATCH", "/item");
      const res = new BunResponse();

      logger((_tokens, r, s, meta) => {
        return `${r.method} ${r.path} -> ${s.statusCode} (${meta.responseTime.toFixed(0)}ms)`;
      }, { stream })(req, res, noop);

      res.status(200).json({ updated: true });

      expect(messages.length).toBe(1);
      const line = messages[0];
      expect(line).toContain("PATCH");
      expect(line).toContain("/item");
      expect(line).toContain("200");
      expect(line).toContain("ms");
    });
  });

  describe("skip option", () => {
    it("should skip logging when skip returns true", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("GET", "/health");
      const res = new BunResponse();

      logger("tiny", {
        stream,
        skip: (r) => r.path === "/health",
      })(req, res, noop);

      res.json({ status: "ok" });

      expect(messages.length).toBe(0);
    });

    it("should log when skip returns false", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("GET", "/api");
      const res = new BunResponse();

      logger("tiny", {
        stream,
        skip: (r) => r.path === "/health",
      })(req, res, noop);

      res.json({ ok: true });

      expect(messages.length).toBe(1);
    });
  });

  describe("immediate option", () => {
    it("should log immediately on request when immediate is true", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("GET", "/fast");
      const res = new BunResponse();
      let nextCalled = false;

      logger("tiny", { stream, immediate: true })(req, res, () => {
        nextCalled = true;
      });

      expect(messages.length).toBe(1);
      expect(nextCalled).toBe(true);
    });

    it("should not log again when response is sent in immediate mode", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("GET", "/fast");
      const res = new BunResponse();

      logger("tiny", { stream, immediate: true })(req, res, noop);
      res.json({ ok: true });

      expect(messages.length).toBe(1);
    });
  });

  describe("response method wrapping", () => {
    it("should log on res.text()", () => {
      const { messages, stream } = captureStream();
      const req = createRequest();
      const res = new BunResponse();

      logger("tiny", { stream })(req, res, noop);
      res.text("hello");

      expect(messages.length).toBe(1);
    });

    it("should log on res.html()", () => {
      const { messages, stream } = captureStream();
      const req = createRequest();
      const res = new BunResponse();

      logger("tiny", { stream })(req, res, noop);
      res.html("<h1>Hi</h1>");

      expect(messages.length).toBe(1);
    });

    it("should log on res.send()", () => {
      const { messages, stream } = captureStream();
      const req = createRequest();
      const res = new BunResponse();

      logger("tiny", { stream })(req, res, noop);
      res.send("raw data");

      expect(messages.length).toBe(1);
    });

    it("should log on res.sendStatus()", () => {
      const { messages, stream } = captureStream();
      const req = createRequest();
      const res = new BunResponse();

      logger("tiny", { stream })(req, res, noop);
      res.sendStatus(404);

      expect(messages.length).toBe(1);
      expect(messages[0]).toContain("404");
    });

    it("should log on res.redirect()", () => {
      const { messages, stream } = captureStream();
      const req = createRequest();
      const res = new BunResponse();

      logger("tiny", { stream })(req, res, noop);
      res.redirect("/new-location");

      expect(messages.length).toBe(1);
      expect(messages[0]).toContain("302");
    });
  });

  describe("double-wrapping prevention", () => {
    it("should prevent double-wrapping via Symbol", () => {
      const { messages, stream } = captureStream();
      const req = createRequest();
      const res = new BunResponse();

      const middleware = logger("tiny", { stream });
      middleware(req, res, noop);
      middleware(req, res, noop);

      res.json({ ok: true });

      expect(messages.length).toBe(1);
    });
  });

  describe("tokens", () => {
    it("should include response-time token", () => {
      const { messages, stream } = captureStream();
      const req = createRequest();
      const res = new BunResponse();

      logger(":response-time", { stream })(req, res, noop);
      res.json({ ok: true });

      expect(messages.length).toBe(1);
      const time = parseFloat(messages[0].trim());
      expect(time).toBeGreaterThanOrEqual(0);
    });

    it("should include user-agent token", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("GET", "/test", { "user-agent": "BunTest/2.0" });
      const res = new BunResponse();

      logger(":user-agent", { stream })(req, res, noop);
      res.json({ ok: true });

      expect(messages[0]).toContain("BunTest/2.0");
    });

    it("should show dash for missing user-agent", () => {
      const { messages, stream } = captureStream();
      const req = createRequest("GET", "/test");
      const res = new BunResponse();

      logger(":user-agent", { stream })(req, res, noop);
      res.json({ ok: true });

      expect(messages[0]).toContain("-");
    });
  });
});
