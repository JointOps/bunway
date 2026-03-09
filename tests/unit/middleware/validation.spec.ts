import { describe, it, expect } from "bun:test";
import { validate } from "../../../src/middleware/validation";
import type { ValidationSchema, ValidationError } from "../../../src/middleware/validation";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

function createReqRes(
  url: string,
  options?: { method?: string; body?: unknown; params?: Record<string, string> }
) {
  const method = options?.method ?? "GET";
  const req = new BunRequest(new Request(url, { method }), new URL(url).pathname);
  const res = new BunResponse();
  if (options?.body) req.body = options.body;
  if (options?.params) req.params = options.params;
  return { req, res };
}

describe("validate middleware", () => {
  describe("required fields", () => {
    it("passes when required field is present", async () => {
      const mw = validate({ body: { name: { required: true } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: "Alice" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("fails when required field is missing", async () => {
      const mw = validate({ body: { name: { required: true } } });
      const { req, res } = createReqRes("http://localhost/test", { body: {} });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      const response = res.toResponse();
      expect(response.status).toBe(422);
    });

    it("fails when required field is empty string", async () => {
      const mw = validate({ body: { name: { required: true } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: "" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });

    it("fails when required field is null", async () => {
      const mw = validate({ body: { name: { required: true } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: null } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });
  });

  describe("type validation", () => {
    it("validates string type", async () => {
      const mw = validate({ body: { name: { type: "string" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: "Alice" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("rejects non-string for string type", async () => {
      const mw = validate({ body: { name: { type: "string" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: 123 } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });

    it("validates number type", async () => {
      const mw = validate({ body: { age: { type: "number" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { age: 25 } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("rejects NaN for number type", async () => {
      const mw = validate({ body: { age: { type: "number" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { age: NaN } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });

    it("validates integer type", async () => {
      const mw = validate({ body: { count: { type: "integer" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { count: 5 } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("rejects float for integer type", async () => {
      const mw = validate({ body: { count: { type: "integer" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { count: 5.5 } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });

    it("validates boolean type", async () => {
      const mw = validate({ body: { active: { type: "boolean" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { active: true } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("validates email type", async () => {
      const mw = validate({ body: { email: { type: "email" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { email: "user@example.com" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("rejects invalid email", async () => {
      const mw = validate({ body: { email: { type: "email" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { email: "not-an-email" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });

    it("validates url type", async () => {
      const mw = validate({ body: { website: { type: "url" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { website: "https://bunway.dev" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("rejects invalid url", async () => {
      const mw = validate({ body: { website: { type: "url" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { website: "not-a-url" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });

    it("validates uuid type", async () => {
      const mw = validate({ body: { id: { type: "uuid" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { id: "550e8400-e29b-41d4-a716-446655440000" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("rejects invalid uuid", async () => {
      const mw = validate({ body: { id: { type: "uuid" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { id: "not-a-uuid" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });
  });

  describe("min/max validation", () => {
    it("validates string min length", async () => {
      const mw = validate({ body: { name: { min: 3 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: "Alice" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("rejects string below min length", async () => {
      const mw = validate({ body: { name: { min: 3 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: "Al" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });

    it("validates string max length", async () => {
      const mw = validate({ body: { name: { max: 10 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: "Alice" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("rejects string above max length", async () => {
      const mw = validate({ body: { name: { max: 3 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: "Alice" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });

    it("validates number min value", async () => {
      const mw = validate({ body: { age: { type: "number", min: 18 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { age: 25 } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("rejects number below min value", async () => {
      const mw = validate({ body: { age: { type: "number", min: 18 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { age: 10 } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });

    it("validates number max value", async () => {
      const mw = validate({ body: { score: { type: "number", max: 100 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { score: 85 } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("rejects number above max value", async () => {
      const mw = validate({ body: { score: { type: "number", max: 100 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { score: 150 } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });
  });

  describe("pattern validation", () => {
    it("passes when value matches pattern", async () => {
      const mw = validate({ body: { code: { pattern: /^[A-Z]{3}-\d{3}$/ } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { code: "ABC-123" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("fails when value does not match pattern", async () => {
      const mw = validate({ body: { code: { pattern: /^[A-Z]{3}-\d{3}$/ } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { code: "abc" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });
  });

  describe("enum validation", () => {
    it("passes when value is in enum", async () => {
      const mw = validate({ body: { role: { enum: ["admin", "user", "guest"] } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { role: "admin" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("fails when value is not in enum", async () => {
      const mw = validate({ body: { role: { enum: ["admin", "user", "guest"] } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { role: "superadmin" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });
  });

  describe("custom validators", () => {
    it("passes with custom sync validator returning true", async () => {
      const mw = validate({
        body: { age: { custom: (val) => typeof val === "number" && val >= 18 } },
      });
      const { req, res } = createReqRes("http://localhost/test", { body: { age: 25 } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("fails with custom sync validator returning false", async () => {
      const mw = validate({
        body: { age: { custom: (val) => typeof val === "number" && val >= 18 } },
      });
      const { req, res } = createReqRes("http://localhost/test", { body: { age: 10 } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });

    it("fails with custom validator returning error string", async () => {
      const mw = validate({
        body: { name: { custom: (val) => val === "admin" ? "Name 'admin' is reserved" : true } },
      });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: "admin" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      const response = res.toResponse();
      const body = await response.json();
      expect(body.errors[0].message).toBe("Name 'admin' is reserved");
    });

    it("supports async custom validators", async () => {
      const mw = validate({
        body: {
          username: {
            custom: async (val) => {
              // Simulate async lookup
              await new Promise(r => setTimeout(r, 10));
              return val !== "taken";
            },
          },
        },
      });
      const { req, res } = createReqRes("http://localhost/test", { body: { username: "taken" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
    });
  });

  describe("sanitizers", () => {
    it("trims whitespace when trim: true", async () => {
      const mw = validate({ body: { name: { required: true, trim: true, min: 1 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { name: "  Alice  " } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("converts to number when toNumber: true", async () => {
      const mw = validate({ body: { age: { toNumber: true, type: "number", min: 18 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { age: "25" } });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });
  });

  describe("multiple sources", () => {
    it("validates params, query, and body together", async () => {
      const schema: ValidationSchema = {
        params: { id: { required: true, pattern: /^\d+$/ } },
        query: { page: { type: "string" } },
        body: { name: { required: true, min: 2 } },
      };
      const mw = validate(schema);
      const { req, res } = createReqRes("http://localhost/users/42?page=1", {
        body: { name: "Alice" },
        params: { id: "42" },
      });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("collects errors from multiple sources", async () => {
      const schema: ValidationSchema = {
        params: { id: { required: true } },
        body: { name: { required: true } },
      };
      const mw = validate(schema);
      const { req, res } = createReqRes("http://localhost/test", { body: {}, params: {} });
      await mw(req, res, () => {});
      const response = res.toResponse();
      const body = await response.json();
      expect(body.errors.length).toBe(2);
    });
  });

  describe("options", () => {
    it("abortEarly stops at first error", async () => {
      const schema: ValidationSchema = {
        body: {
          name: { required: true },
          email: { required: true },
          age: { required: true },
        },
      };
      const mw = validate(schema, { abortEarly: true });
      const { req, res } = createReqRes("http://localhost/test", { body: {} });
      await mw(req, res, () => {});
      const response = res.toResponse();
      const body = await response.json();
      expect(body.errors.length).toBe(1);
    });

    it("custom statusCode is used", async () => {
      const mw = validate({ body: { name: { required: true } } }, { statusCode: 400 });
      const { req, res } = createReqRes("http://localhost/test", { body: {} });
      await mw(req, res, () => {});
      const response = res.toResponse();
      expect(response.status).toBe(400);
    });

    it("custom errorFormatter shapes the response", async () => {
      const mw = validate(
        { body: { name: { required: true } } },
        { errorFormatter: (errors) => ({ success: false, issues: errors.map(e => e.message) }) }
      );
      const { req, res } = createReqRes("http://localhost/test", { body: {} });
      await mw(req, res, () => {});
      const response = res.toResponse();
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.issues).toBeDefined();
      expect(body.issues.length).toBe(1);
    });

    it("custom onError handler is called instead of auto-response", async () => {
      let receivedErrors: ValidationError[] = [];
      const mw = validate(
        { body: { name: { required: true } } },
        {
          onError: (errors, req, res, next) => {
            receivedErrors = errors;
            res.status(400).json({ custom: true });
          },
        }
      );
      const { req, res } = createReqRes("http://localhost/test", { body: {} });
      await mw(req, res, () => {});
      expect(receivedErrors.length).toBe(1);
      const response = res.toResponse();
      expect(response.status).toBe(400);
    });

    it("custom error message is used", async () => {
      const mw = validate({ body: { name: { required: true, message: "Name is mandatory!" } } });
      const { req, res } = createReqRes("http://localhost/test", { body: {} });
      await mw(req, res, () => {});
      const response = res.toResponse();
      const body = await response.json();
      expect(body.errors[0].message).toBe("Name is mandatory!");
    });
  });

  describe("edge cases", () => {
    it("skips validation for optional field that is not present", async () => {
      const mw = validate({ body: { name: { type: "string", min: 3 } } });
      const { req, res } = createReqRes("http://localhost/test", { body: {} });
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      // Field is not required, so missing field should pass
      expect(nextCalled).toBe(true);
    });

    it("empty schema passes all requests", async () => {
      const mw = validate({});
      const { req, res } = createReqRes("http://localhost/test");
      let nextCalled = false;
      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("validation error includes field name and source", async () => {
      const mw = validate({ body: { email: { type: "email", required: true } } });
      const { req, res } = createReqRes("http://localhost/test", { body: { email: "invalid" } });
      await mw(req, res, () => {});
      const response = res.toResponse();
      const body = await response.json();
      expect(body.errors[0].field).toBe("email");
      expect(body.errors[0].source).toBe("body");
    });
  });
});
