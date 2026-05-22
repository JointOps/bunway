import * as all from "../../../src";

describe("src/index.ts — all public symbols are exported", () => {
  const REQUIRED = [
    "default",
    "Router", "HttpError", "isHttpError",
    "timeout", "cors", "compression", "validate", "session", "csrf",
    "rateLimit", "serveStatic",
    "sse", "responseTime", "requestId", "methodOverride", "favicon",
  ];

  for (const name of REQUIRED) {
    it(`exports '${name}'`, () => {
      expect(all).toHaveProperty(name);
      expect((all as any)[name]).toBeDefined();
    });
  }
});
