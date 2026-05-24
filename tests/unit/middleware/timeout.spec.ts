import { describe, it, expect, mock } from "bun:test";
import { timeout } from "../../../src/middleware/timeout";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";
import type { NextFunction } from "../../../src/types";

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
    timeout(200)(req, res, next);
    await new Promise((r) => setTimeout(r, 300));
    expect(req.timedout).toBe(false);
  });

  it("fires 408 when handler never commits response", async () => {
    const { req, res } = createReqRes();
    timeout(20)(req, res, () => {});
    await new Promise((r) => setTimeout(r, 80));
    expect(req.timedout).toBe(true);
    expect(res.statusCode).toBe(408);
  });

  it("skip() prevents timeout from being applied", async () => {
    const { req, res } = createReqRes("http://localhost/health");
    timeout(20, { skip: (r) => r.path === "/health" })(req, res, () => {});
    await new Promise((r) => setTimeout(r, 80));
    expect(req.timedout).toBe(false);
  });

  it("respond:false sets timedout but sends no body", async () => {
    const { req, res } = createReqRes();
    timeout(20, { respond: false })(req, res, () => {});
    await new Promise((r) => setTimeout(r, 80));
    expect(req.timedout).toBe(true);
    expect(res.headersSent).toBe(false);
  });

  it("custom statusCode is used on timeout", async () => {
    const { req, res } = createReqRes();
    timeout(20, { statusCode: 503 })(req, res, () => {});
    await new Promise((r) => setTimeout(r, 80));
    expect(res.statusCode).toBe(503);
  });

  it("calls next() immediately if not timed out", async () => {
    const mw = timeout(5000);
    const { req, res } = createReqRes();
    let nextCalled = false;
    mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("sets req.timedout to true on timeout", async () => {
    const mw = timeout(50);
    const { req, res } = createReqRes();
    let errorPassed: unknown;
    mw(req, res, (err) => { errorPassed = err; });

    // Simulate slow handler by waiting
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(req.timedout).toBe(true);
  });

  it("sends 408 status by default on timeout", async () => {
    const mw = timeout(50);
    const { req, res } = createReqRes();
    mw(req, res, () => {});

    await new Promise(resolve => setTimeout(resolve, 100));
    const response = res.toResponse();
    expect(response.status).toBe(408);
  });

  it("sends custom status code on timeout", async () => {
    const mw = timeout(50, { statusCode: 503 });
    const { req, res } = createReqRes();
    mw(req, res, () => {});

    await new Promise(resolve => setTimeout(resolve, 100));
    const response = res.toResponse();
    expect(response.status).toBe(503);
  });

  it("sends custom string message on timeout", async () => {
    const mw = timeout(50, { message: "Too slow!" });
    const { req, res } = createReqRes();
    mw(req, res, () => {});

    await new Promise(resolve => setTimeout(resolve, 100));
    const response = res.toResponse();
    const body = await response.text();
    expect(body).toBe("Too slow!");
  });

  it("sends custom JSON message on timeout", async () => {
    const mw = timeout(50, { message: { error: "timeout", code: "ETIMEDOUT" } });
    const { req, res } = createReqRes();
    mw(req, res, () => {});

    await new Promise(resolve => setTimeout(resolve, 100));
    const response = res.toResponse();
    const body = await response.json();
    expect(body.error).toBe("timeout");
    expect(body.code).toBe("ETIMEDOUT");
  });

  it("does not send response when respond: false", async () => {
    const mw = timeout(50, { respond: false });
    const { req, res } = createReqRes();
    mw(req, res, () => {});

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(req.timedout).toBe(true);
    // Response should not have been sent
    expect(res.headersSent).toBe(false);
  });

  it("passes error to next() on timeout", async () => {
    const mw = timeout(50);
    const { req, res } = createReqRes();
    let errorPassed: unknown;
    mw(req, res, (err) => {
      if (err) errorPassed = err;
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(errorPassed).toBeDefined();
    expect((errorPassed as Error).message).toBe("Request timeout");
    expect((errorPassed as { code: string }).code).toBe("ETIMEDOUT");
  });

  it("skips timeout when skip function returns true", () => {
    const mw = timeout(50, {
      skip: (req) => req.path === "/health",
    });
    const { req, res } = createReqRes("http://localhost/health");
    let nextCalled = false;
    mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    // req.timedout should remain false since timeout was skipped
    expect(req.timedout).toBe(false);
  });

  it("does not skip when skip function returns false", async () => {
    const mw = timeout(50, {
      skip: (req) => req.path === "/health",
    });
    const { req, res } = createReqRes("http://localhost/slow");
    mw(req, res, () => {});

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(req.timedout).toBe(true);
  });

  it("does not double-respond if handler responds before timeout", async () => {
    const mw = timeout(200);
    const { req, res } = createReqRes();
    let nextCallCount = 0;
    mw(req, res, () => {
      nextCallCount++;
      // Simulate handler responding immediately
      res.json({ ok: true });
    });

    // Wait past the timeout
    await new Promise(resolve => setTimeout(resolve, 300));
    // Next should only have been called once (by wrappedNext, not by timeout)
    expect(nextCallCount).toBe(1);
  });

  it("default timeout is req.timedout = false initially", () => {
    const { req } = createReqRes();
    expect(req.timedout).toBe(false);
  });

  it("timer fires no-op when response is already committed", async () => {
    const { req, res } = createReqRes();
    timeout(50)(req, res, () => {
      res.json({ ok: true });
    });
    const statusBefore = res.statusCode;
    await new Promise((r) => setTimeout(r, 100));
    // Status should not have changed to 408 after commit
    expect(res.statusCode).toBe(statusBefore);
    expect(req.timedout).toBe(false);
  });

  it("skip() returning undefined does not prevent timeout", async () => {
    const { req, res } = createReqRes();
    timeout(50, { skip: () => undefined as any })(req, res, () => {});
    await new Promise((r) => setTimeout(r, 100));
    expect(req.timedout).toBe(true);
  });

  it("skip() with no skip function applies timeout normally", async () => {
    const { req, res } = createReqRes();
    timeout(50)(req, res, () => {});
    await new Promise((r) => setTimeout(r, 100));
    expect(req.timedout).toBe(true);
  });
});
