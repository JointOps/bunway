import { describe, it, expect, mock } from "bun:test";
import { timeout } from "../../../src/middleware/timeout";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

// All timer-based tests use a 10× ratio: timeout T → wait 10×T.
// This keeps CI reliable without mock timers.
const T = 20; // base timeout (ms)
const WAIT = T * 10; // guaranteed-fire window

function createReqRes(url = "http://localhost/test", method = "GET") {
  const req = new BunRequest(new Request(url, { method }), new URL(url).pathname);
  const res = new BunResponse();
  return { req, res };
}

describe("timeout middleware", () => {
  it("req.timedout starts as false", () => {
    const { req, res } = createReqRes();
    timeout(1000)(req, res, () => {});
    expect(req.timedout).toBe(false);
  });

  it("timer is cleared when response commits before timeout fires", async () => {
    const { req, res } = createReqRes();
    const next = mock(() => {
      res.toResponse();
    });
    timeout(T)(req, res, next);
    // Respond immediately through next(); then wait past the timeout window
    await new Promise((r) => setTimeout(r, WAIT));
    expect(req.timedout).toBe(false);
  });

  it("fires 408 when handler never commits response", async () => {
    const { req, res } = createReqRes();
    timeout(T)(req, res, () => {});
    await new Promise((r) => setTimeout(r, WAIT));
    expect(req.timedout).toBe(true);
    expect(res.statusCode).toBe(408);
  });

  it("skip() prevents timeout from being applied", async () => {
    const { req, res } = createReqRes("http://localhost/health");
    timeout(T, { skip: (r) => r.path === "/health" })(req, res, () => {});
    await new Promise((r) => setTimeout(r, WAIT));
    expect(req.timedout).toBe(false);
  });

  it("respond:false sets timedout but sends no body", async () => {
    const { req, res } = createReqRes();
    timeout(T, { respond: false })(req, res, () => {});
    await new Promise((r) => setTimeout(r, WAIT));
    expect(req.timedout).toBe(true);
    expect(res.headersSent).toBe(false);
  });

  it("custom statusCode is used on timeout", async () => {
    const { req, res } = createReqRes();
    timeout(T, { statusCode: 503 })(req, res, () => {});
    await new Promise((r) => setTimeout(r, WAIT));
    expect(res.statusCode).toBe(503);
  });

  it("calls next() immediately if not timed out", () => {
    const mw = timeout(5000);
    const { req, res } = createReqRes();
    let nextCalled = false;
    mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("sets req.timedout to true on timeout", async () => {
    const mw = timeout(T);
    const { req, res } = createReqRes();
    mw(req, res, () => {});
    await new Promise(resolve => setTimeout(resolve, WAIT));
    expect(req.timedout).toBe(true);
  });

  it("sends 408 status by default on timeout", async () => {
    const mw = timeout(T);
    const { req, res } = createReqRes();
    mw(req, res, () => {});
    await new Promise(resolve => setTimeout(resolve, WAIT));
    const response = res.toResponse();
    expect(response.status).toBe(408);
  });

  it("sends custom status code on timeout", async () => {
    const mw = timeout(T, { statusCode: 503 });
    const { req, res } = createReqRes();
    mw(req, res, () => {});
    await new Promise(resolve => setTimeout(resolve, WAIT));
    const response = res.toResponse();
    expect(response.status).toBe(503);
  });

  it("sends custom string message on timeout", async () => {
    const mw = timeout(T, { message: "Too slow!" });
    const { req, res } = createReqRes();
    mw(req, res, () => {});
    await new Promise(resolve => setTimeout(resolve, WAIT));
    const response = res.toResponse();
    const body = await response.text();
    expect(body).toBe("Too slow!");
  });

  it("sends custom JSON message on timeout", async () => {
    const mw = timeout(T, { message: { error: "timeout", code: "ETIMEDOUT" } });
    const { req, res } = createReqRes();
    mw(req, res, () => {});
    await new Promise(resolve => setTimeout(resolve, WAIT));
    const response = res.toResponse();
    const body = await response.json();
    expect(body.error).toBe("timeout");
    expect(body.code).toBe("ETIMEDOUT");
  });

  it("does not send response when respond: false", async () => {
    const mw = timeout(T, { respond: false });
    const { req, res } = createReqRes();
    mw(req, res, () => {});
    await new Promise(resolve => setTimeout(resolve, WAIT));
    expect(req.timedout).toBe(true);
    expect(res.headersSent).toBe(false);
  });

  it("passes error to next() on timeout", async () => {
    const mw = timeout(T);
    const { req, res } = createReqRes();
    let errorPassed: unknown;
    mw(req, res, (err) => {
      if (err) errorPassed = err;
    });
    await new Promise(resolve => setTimeout(resolve, WAIT));
    expect(errorPassed).toBeDefined();
    expect((errorPassed as Error).message).toBe("Request timeout");
    expect((errorPassed as { code: string }).code).toBe("ETIMEDOUT");
  });

  it("skips timeout when skip function returns true", () => {
    const mw = timeout(T, { skip: (req) => req.path === "/health" });
    const { req, res } = createReqRes("http://localhost/health");
    let nextCalled = false;
    mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.timedout).toBe(false);
  });

  it("does not skip when skip function returns false", async () => {
    const mw = timeout(T, { skip: (req) => req.path === "/health" });
    const { req, res } = createReqRes("http://localhost/slow");
    mw(req, res, () => {});
    await new Promise(resolve => setTimeout(resolve, WAIT));
    expect(req.timedout).toBe(true);
  });

  it("does not double-respond if handler responds before timeout", async () => {
    const mw = timeout(T * 20); // long timeout — handler responds instantly
    const { req, res } = createReqRes();
    let nextCallCount = 0;
    mw(req, res, () => {
      nextCallCount++;
      res.json({ ok: true });
    });
    await new Promise(resolve => setTimeout(resolve, T * 5));
    expect(nextCallCount).toBe(1);
  });

  it("default timeout is req.timedout = false initially", () => {
    const { req } = createReqRes();
    expect(req.timedout).toBe(false);
  });

  it("timer fires no-op when response is already committed", async () => {
    const { req, res } = createReqRes();
    timeout(T)(req, res, () => {
      res.json({ ok: true });
    });
    const statusBefore = res.statusCode;
    await new Promise((r) => setTimeout(r, WAIT));
    expect(res.statusCode).toBe(statusBefore);
    expect(req.timedout).toBe(false);
  });

  it("skip() returning undefined does not prevent timeout", async () => {
    const { req, res } = createReqRes();
    timeout(T, { skip: () => undefined as any })(req, res, () => {});
    await new Promise((r) => setTimeout(r, WAIT));
    expect(req.timedout).toBe(true);
  });

  it("skip() with no skip function applies timeout normally", async () => {
    const { req, res } = createReqRes();
    timeout(T)(req, res, () => {});
    await new Promise((r) => setTimeout(r, WAIT));
    expect(req.timedout).toBe(true);
  });
});
