import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { rateLimit } from "../../../src/middleware/rate-limit";
import type { RateLimitHandler } from "../../../src/middleware/rate-limit";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

const createRequest = (
  headers: Record<string, string> = {},
  method = "GET",
  path = "/test"
): BunRequest => {
  return new BunRequest(
    new Request(`http://localhost${path}`, { method, headers }),
    path
  );
};

const getHeader = (res: BunResponse, name: string): string | null => {
  return res.toResponse().headers.get(name);
};

const noop = () => {};

describe("rateLimit middleware (Unit)", () => {
  let limiter: RateLimitHandler;

  afterEach(() => {
    if (limiter) limiter.reset();
  });

  describe("basic behavior", () => {
    it("should allow requests under the limit", () => {
      limiter = rateLimit({ max: 5 });
      const req = createRequest();
      const res = new BunResponse();
      let called = false;

      limiter(req, res, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should call next for each allowed request", () => {
      limiter = rateLimit({ max: 3 });

      for (let i = 0; i < 3; i++) {
        const req = createRequest();
        const res = new BunResponse();
        let called = false;

        limiter(req, res, () => { called = true; });
        expect(called).toBe(true);
      }
    });
  });

  describe("rate limit headers", () => {
    it("should set X-RateLimit-Limit header", () => {
      limiter = rateLimit({ max: 10 });
      const req = createRequest();
      const res = new BunResponse();

      limiter(req, res, noop);

      expect(getHeader(res, "X-RateLimit-Limit")).toBe("10");
    });

    it("should set X-RateLimit-Remaining header", () => {
      limiter = rateLimit({ max: 10 });
      const req = createRequest();
      const res = new BunResponse();

      limiter(req, res, noop);

      expect(getHeader(res, "X-RateLimit-Remaining")).toBe("9");
    });

    it("should set X-RateLimit-Reset header", () => {
      limiter = rateLimit({ max: 10 });
      const req = createRequest();
      const res = new BunResponse();

      limiter(req, res, noop);

      const reset = getHeader(res, "X-RateLimit-Reset");
      expect(reset).not.toBeNull();
      expect(parseInt(reset!, 10)).toBeGreaterThan(0);
    });

    it("should decrement X-RateLimit-Remaining with each request", () => {
      limiter = rateLimit({ max: 5 });

      for (let i = 0; i < 3; i++) {
        const req = createRequest();
        const res = new BunResponse();
        limiter(req, res, noop);

        if (i === 2) {
          expect(getHeader(res, "X-RateLimit-Remaining")).toBe("2");
        }
      }
    });

    it("should not set headers when headers option is false", () => {
      limiter = rateLimit({ max: 5, headers: false });
      const req = createRequest();
      const res = new BunResponse();

      limiter(req, res, noop);

      expect(getHeader(res, "X-RateLimit-Limit")).toBeNull();
      expect(getHeader(res, "X-RateLimit-Remaining")).toBeNull();
      expect(getHeader(res, "X-RateLimit-Reset")).toBeNull();
    });
  });

  describe("rate limit exceeded", () => {
    it("should return 429 when limit is exceeded", () => {
      limiter = rateLimit({ max: 2 });

      for (let i = 0; i < 2; i++) {
        const req = createRequest();
        const res = new BunResponse();
        limiter(req, res, noop);
      }

      const req = createRequest();
      const res = new BunResponse();
      let called = false;

      limiter(req, res, () => { called = true; });

      expect(called).toBe(false);
      expect(res.toResponse().status).toBe(429);
    });

    it("should set Retry-After header when exceeded", () => {
      limiter = rateLimit({ max: 1 });

      const req1 = createRequest();
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      const req2 = createRequest();
      const res2 = new BunResponse();
      limiter(req2, res2, noop);

      const retryAfter = getHeader(res2, "Retry-After");
      expect(retryAfter).not.toBeNull();
      expect(parseInt(retryAfter!, 10)).toBeGreaterThan(0);
    });

    it("should return default error message as object", async () => {
      limiter = rateLimit({ max: 1 });

      const req1 = createRequest();
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      const req2 = createRequest();
      const res2 = new BunResponse();
      limiter(req2, res2, noop);

      const body = await res2.toResponse().json();
      expect(body.error).toBe("Too many requests, please try again later.");
    });

    it("should use custom statusCode", () => {
      limiter = rateLimit({ max: 1, statusCode: 503 });

      const req1 = createRequest();
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      const req2 = createRequest();
      const res2 = new BunResponse();
      limiter(req2, res2, noop);

      expect(res2.toResponse().status).toBe(503);
    });

    it("should use custom string message", async () => {
      limiter = rateLimit({ max: 1, message: "Rate limited!" });

      const req1 = createRequest();
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      const req2 = createRequest();
      const res2 = new BunResponse();
      limiter(req2, res2, noop);

      const body = await res2.toResponse().json();
      expect(body.error).toBe("Rate limited!");
    });

    it("should use custom object message", async () => {
      limiter = rateLimit({ max: 1, message: { msg: "slow down", code: 429 } });

      const req1 = createRequest();
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      const req2 = createRequest();
      const res2 = new BunResponse();
      limiter(req2, res2, noop);

      const body = await res2.toResponse().json();
      expect(body.msg).toBe("slow down");
      expect(body.code).toBe(429);
    });
  });

  describe("custom max", () => {
    it("should respect custom max value", () => {
      limiter = rateLimit({ max: 3 });

      for (let i = 0; i < 3; i++) {
        const req = createRequest();
        const res = new BunResponse();
        let called = false;

        limiter(req, res, () => { called = true; });
        expect(called).toBe(true);
      }

      const req = createRequest();
      const res = new BunResponse();
      let called = false;

      limiter(req, res, () => { called = true; });
      expect(called).toBe(false);
      expect(res.toResponse().status).toBe(429);
    });
  });

  describe("keyGenerator", () => {
    it("should use custom keyGenerator function", () => {
      limiter = rateLimit({
        max: 1,
        keyGenerator: (req) => req.path,
      });

      const req1 = createRequest({}, "GET", "/path-a");
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      const req2 = createRequest({}, "GET", "/path-b");
      const res2 = new BunResponse();
      let called = false;

      limiter(req2, res2, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should share limit for same key", () => {
      limiter = rateLimit({
        max: 1,
        keyGenerator: () => "shared-key",
      });

      const req1 = createRequest({}, "GET", "/path-a");
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      const req2 = createRequest({}, "GET", "/path-b");
      const res2 = new BunResponse();
      let called = false;

      limiter(req2, res2, () => { called = true; });

      expect(called).toBe(false);
      expect(res2.toResponse().status).toBe(429);
    });
  });

  describe("skip", () => {
    it("should bypass rate limiting when skip returns true", () => {
      limiter = rateLimit({
        max: 1,
        skip: () => true,
      });

      const req1 = createRequest();
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      const req2 = createRequest();
      const res2 = new BunResponse();
      let called = false;

      limiter(req2, res2, () => { called = true; });

      expect(called).toBe(true);
    });

    it("should not bypass when skip returns false", () => {
      limiter = rateLimit({
        max: 1,
        skip: () => false,
      });

      const req1 = createRequest();
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      const req2 = createRequest();
      const res2 = new BunResponse();
      let called = false;

      limiter(req2, res2, () => { called = true; });

      expect(called).toBe(false);
    });
  });

  describe("onLimitReached", () => {
    it("should fire onLimitReached callback when limit is exceeded", () => {
      let limitReached = false;
      let reachedReqInfo: { ip: string; path: string; method: string } | null = null;

      limiter = rateLimit({
        max: 1,
        onLimitReached: (req) => {
          limitReached = true;
          reachedReqInfo = req;
        },
      });

      const req1 = createRequest();
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      expect(limitReached).toBe(false);

      const req2 = createRequest();
      const res2 = new BunResponse();
      limiter(req2, res2, noop);

      expect(limitReached).toBe(true);
      expect(reachedReqInfo).not.toBeNull();
      expect(reachedReqInfo!.method).toBe("GET");
    });
  });

  describe("reset and size", () => {
    it("should have reset method that is callable", () => {
      limiter = rateLimit({ max: 5 });

      expect(typeof limiter.reset).toBe("function");
      limiter.reset();
    });

    it("should have size property", () => {
      limiter = rateLimit({ max: 5 });

      expect(typeof limiter.size).toBe("number");
    });

    it("should allow requests again after creating new limiter", () => {
      limiter = rateLimit({ max: 1 });

      const req1 = createRequest();
      const res1 = new BunResponse();
      limiter(req1, res1, noop);

      const req2 = createRequest();
      const res2 = new BunResponse();
      limiter(req2, res2, noop);
      expect(res2.toResponse().status).toBe(429);

      limiter.reset();
      limiter = rateLimit({ max: 1 });

      const req3 = createRequest();
      const res3 = new BunResponse();
      let called = false;

      limiter(req3, res3, () => { called = true; });
      expect(called).toBe(true);
    });

    it("should not throw when reset is called multiple times", () => {
      limiter = rateLimit({ max: 5 });

      limiter.reset();
      limiter.reset();
    });
  });
});
