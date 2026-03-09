import { describe, it, expect } from "bun:test";
import { hpp } from "../../../src/middleware/hpp";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

function createReqRes(url: string, body?: Record<string, unknown>) {
  const req = new BunRequest(new Request(url), new URL(url).pathname);
  const res = new BunResponse();
  if (body) req.body = body;
  return { req, res };
}

describe("hpp middleware", () => {
  describe("query parameter protection", () => {
    it("allows single query parameters through", () => {
      const mw = hpp();
      const { req, res } = createReqRes("http://localhost/test?name=alice");
      let nextCalled = false;
      mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(req.locals.queryPolluted).toBeUndefined();
    });

    it("detects duplicate query parameters", () => {
      const mw = hpp();
      const { req, res } = createReqRes("http://localhost/test?color=red&color=blue");
      mw(req, res, () => {});
      expect(req.locals.queryPolluted).toBeDefined();
      const polluted = req.locals.queryPolluted as Record<string, string[]>;
      expect(polluted.color).toEqual(["red", "blue"]);
    });

    it("does not pollute for single params", () => {
      const mw = hpp();
      const { req, res } = createReqRes("http://localhost/test?a=1&b=2");
      mw(req, res, () => {});
      expect(req.locals.queryPolluted).toBeUndefined();
    });

    it("whitelists specific parameters", () => {
      const mw = hpp({ whitelist: ["tags"] });
      const { req, res } = createReqRes("http://localhost/test?tags=a&tags=b&name=x&name=y");
      mw(req, res, () => {});
      const polluted = req.locals.queryPolluted as Record<string, string[]>;
      // tags should NOT be in polluted (whitelisted)
      expect(polluted.tags).toBeUndefined();
      // name should be in polluted
      expect(polluted.name).toEqual(["x", "y"]);
    });

    it("handles no query string", () => {
      const mw = hpp();
      const { req, res } = createReqRes("http://localhost/test");
      let nextCalled = false;
      mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(req.locals.queryPolluted).toBeUndefined();
    });

    it("handles empty query string", () => {
      const mw = hpp();
      const { req, res } = createReqRes("http://localhost/test?");
      let nextCalled = false;
      mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("skips query check when checkQuery is false", () => {
      const mw = hpp({ checkQuery: false });
      const { req, res } = createReqRes("http://localhost/test?a=1&a=2");
      mw(req, res, () => {});
      expect(req.locals.queryPolluted).toBeUndefined();
    });
  });

  describe("body parameter protection", () => {
    it("sanitizes array values in body to last value", () => {
      const mw = hpp();
      const body = { name: ["alice", "bob"], age: 25 };
      const { req, res } = createReqRes("http://localhost/test", body);
      mw(req, res, () => {});
      expect((req.body as Record<string, unknown>).name).toBe("bob");
      expect((req.body as Record<string, unknown>).age).toBe(25);
    });

    it("stores original polluted body values", () => {
      const mw = hpp();
      const body = { role: ["user", "admin"] };
      const { req, res } = createReqRes("http://localhost/test", body);
      mw(req, res, () => {});
      const polluted = req.locals.bodyPolluted as Record<string, unknown[]>;
      expect(polluted.role).toEqual(["user", "admin"]);
    });

    it("whitelists body parameters", () => {
      const mw = hpp({ whitelist: ["tags"] });
      const body = { tags: ["a", "b"], role: ["user", "admin"] };
      const { req, res } = createReqRes("http://localhost/test", body);
      mw(req, res, () => {});
      // tags should remain as array (whitelisted)
      expect((req.body as Record<string, unknown>).tags).toEqual(["a", "b"]);
      // role should be sanitized to last value
      expect((req.body as Record<string, unknown>).role).toBe("admin");
    });

    it("skips body check when checkBody is false", () => {
      const mw = hpp({ checkBody: false });
      const body = { role: ["user", "admin"] };
      const { req, res } = createReqRes("http://localhost/test", body);
      mw(req, res, () => {});
      // Body should remain unchanged
      expect((req.body as Record<string, unknown>).role).toEqual(["user", "admin"]);
    });

    it("handles null body gracefully", () => {
      const mw = hpp();
      const { req, res } = createReqRes("http://localhost/test");
      let nextCalled = false;
      mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it("handles non-object body gracefully", () => {
      const mw = hpp();
      const { req, res } = createReqRes("http://localhost/test");
      req.body = "string body";
      let nextCalled = false;
      mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });
  });

  describe("options", () => {
    it("uses default options when none provided", () => {
      const mw = hpp();
      const body = { x: ["a", "b"] };
      const { req, res } = createReqRes("http://localhost/test?y=1&y=2", body);
      mw(req, res, () => {});
      // Both query and body should be checked by default
      expect(req.locals.queryPolluted).toBeDefined();
      expect(req.locals.bodyPolluted).toBeDefined();
    });

    it("empty whitelist means all duplicates are sanitized", () => {
      const mw = hpp({ whitelist: [] });
      const body = { a: [1, 2], b: [3, 4] };
      const { req, res } = createReqRes("http://localhost/test", body);
      mw(req, res, () => {});
      expect((req.body as Record<string, unknown>).a).toBe(2);
      expect((req.body as Record<string, unknown>).b).toBe(4);
    });
  });
});
