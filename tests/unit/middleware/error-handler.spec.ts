import { describe, expect, it } from "bun:test";
import { errorHandler } from "../../../src/middleware/error-handler";
import { HttpError } from "../../../src/core/errors";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

function createReqRes() {
  const req = new BunRequest(new Request("http://localhost/test"), "/test");
  const res = new BunResponse();
  return { req, res };
}

async function getBody(res: BunResponse): Promise<Record<string, unknown>> {
  const response = res.toResponse();
  return response.json();
}

describe("Error Handler Middleware (Unit)", () => {
  describe("HttpError handling", () => {
    it("sets correct status from HttpError", () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: false });
      const err = new HttpError(404, "Not Found");
      handler(err, req, res, () => {});
      expect(res.toResponse().status).toBe(404);
    });

    it("sets custom headers from HttpError", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: false });
      const err = new HttpError(429, "Too Many Requests", {
        headers: { "Retry-After": "60", "X-RateLimit-Reset": "1234567890" },
      });
      handler(err, req, res, () => {});
      const headers = res.toResponse().headers;
      expect(headers.get("Retry-After")).toBe("60");
      expect(headers.get("X-RateLimit-Reset")).toBe("1234567890");
    });

    it("uses HttpError body when present", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: false });
      const err = new HttpError(400, "Bad Request", {
        body: { error: "Bad Request", fields: { name: "required" } },
      });
      handler(err, req, res, () => {});
      const body = await getBody(res);
      expect(body.error).toBe("Bad Request");
      expect((body.fields as Record<string, string>).name).toBe("required");
    });

    it("falls back to { error: message } when HttpError has no body", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: false });
      const err = new HttpError(403);
      handler(err, req, res, () => {});
      const body = await getBody(res);
      expect(body.error).toBe("HTTP 403");
    });
  });

  describe("Regular error handling", () => {
    it("returns 500 status", () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: false });
      handler(new Error("Something broke"), req, res, () => {});
      expect(res.toResponse().status).toBe(500);
    });

    it("includes error message", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: false });
      handler(new Error("Something broke"), req, res, () => {});
      const body = await getBody(res);
      expect(body.error).toBe("Something broke");
    });

    it("uses 'Internal Server Error' for non-Error values", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: false });
      handler("string error", req, res, () => {});
      const body = await getBody(res);
      expect(body.error).toBe("Internal Server Error");
    });
  });

  describe("Development mode", () => {
    it("includes stack trace", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: true });
      handler(new Error("Dev error"), req, res, () => {});
      const body = await getBody(res);
      expect(body.stack).toBeDefined();
      expect(typeof body.stack).toBe("string");
      expect((body.stack as string)).toContain("Dev error");
    });

    it("includes request method and path", async () => {
      const req = new BunRequest(new Request("http://localhost/api/users", { method: "POST" }), "/api/users");
      const res = new BunResponse();
      const handler = errorHandler({ development: true });
      handler(new Error("test"), req, res, () => {});
      const body = await getBody(res);
      expect(body.method).toBe("POST");
      expect(body.path).toBe("/api/users");
    });

    it("includes timestamp", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: true });
      handler(new Error("test"), req, res, () => {});
      const body = await getBody(res);
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe("string");
    });

    it("includes error type (constructor name)", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: true });
      handler(new TypeError("bad type"), req, res, () => {});
      const body = await getBody(res);
      expect(body.type).toBe("TypeError");
    });
  });

  describe("Production mode (development: false)", () => {
    it("does not include stack trace", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: false });
      handler(new Error("prod error"), req, res, () => {});
      const body = await getBody(res);
      expect(body.stack).toBeUndefined();
    });

    it("does not include request info by default", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: false });
      handler(new Error("prod error"), req, res, () => {});
      const body = await getBody(res);
      expect(body.method).toBeUndefined();
      expect(body.path).toBeUndefined();
      expect(body.timestamp).toBeUndefined();
    });
  });

  describe("Options", () => {
    it("includeStack: true adds stack in production", async () => {
      const { req, res } = createReqRes();
      const handler = errorHandler({ development: false, includeStack: true });
      handler(new Error("stack test"), req, res, () => {});
      const body = await getBody(res);
      expect(body.stack).toBeDefined();
      expect((body.stack as string)).toContain("stack test");
    });

    it("showRequestInfo: true adds method and path in production", async () => {
      const req = new BunRequest(new Request("http://localhost/items", { method: "DELETE" }), "/items");
      const res = new BunResponse();
      const handler = errorHandler({ development: false, showRequestInfo: true });
      handler(new Error("test"), req, res, () => {});
      const body = await getBody(res);
      expect(body.method).toBe("DELETE");
      expect(body.path).toBe("/items");
    });

    it("custom logger function is called with error and request", () => {
      const { req, res } = createReqRes();
      let loggedErr: unknown = null;
      let loggedReq: unknown = null;
      const handler = errorHandler({
        development: false,
        logger: (err, r) => {
          loggedErr = err;
          loggedReq = r;
        },
      });
      const error = new Error("logged error");
      handler(error, req, res, () => {});
      expect(loggedErr).toBe(error);
      expect(loggedReq).toBe(req);
    });

    it("useAppLogger calls app.getLogger().error()", () => {
      const req = new BunRequest(new Request("http://localhost/test"), "/test");
      const res = new BunResponse();
      let loggedMessage = "";
      let loggedMeta: Record<string, unknown> = {};
      req.setApp({
        get: () => undefined,
        getLogger: () => ({
          info: () => {},
          warn: () => {},
          error: (msg: string, meta?: Record<string, unknown>) => {
            loggedMessage = msg;
            loggedMeta = meta || {};
          },
        }),
      });
      const handler = errorHandler({ development: false, useAppLogger: true });
      handler(new Error("app logger test"), req, res, () => {});
      expect(loggedMessage).toBe("app logger test");
      expect(loggedMeta.path).toBe("/test");
      expect(loggedMeta.method).toBe("GET");
    });
  });

  describe("HttpError with development mode request info", () => {
    it("includes method and path for HttpError without body in dev mode", async () => {
      const req = new BunRequest(new Request("http://localhost/api/data", { method: "PUT" }), "/api/data");
      const res = new BunResponse();
      const handler = errorHandler({ development: true });
      const err = new HttpError(422);
      handler(err, req, res, () => {});
      const body = await getBody(res);
      expect(body.method).toBe("PUT");
      expect(body.path).toBe("/api/data");
    });
  });
});
