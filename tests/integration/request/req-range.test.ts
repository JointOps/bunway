import { describe, it, expect } from "bun:test";
import bunway from "../../../src";

describe("Integration: req.range()", () => {
  it("parses Range header in handler", async () => {
    const app = bunway();
    let rangeResult: unknown;
    app.get("/file", (req, res) => {
      rangeResult = req.range(10000);
      res.json({ ranges: rangeResult });
    });

    await app.handle(
      new Request("http://localhost/file", {
        headers: { range: "bytes=0-999" },
      })
    );
    expect(Array.isArray(rangeResult)).toBe(true);
  });

  it("returns undefined when no Range header", async () => {
    const app = bunway();
    let rangeResult: unknown = "not-set";
    app.get("/file", (req, res) => {
      rangeResult = req.range(10000);
      res.json({});
    });

    await app.handle(new Request("http://localhost/file"));
    expect(rangeResult).toBeUndefined();
  });

  it("returns -1 for unsatisfiable range", async () => {
    const app = bunway();
    let rangeResult: unknown;
    app.get("/file", (req, res) => {
      rangeResult = req.range(100);
      if (rangeResult === -1) {
        res.status(416).end();
        return;
      }
      res.json({});
    });

    const response = await app.handle(
      new Request("http://localhost/file", {
        headers: { range: "bytes=500-600" },
      })
    );
    expect(response.status).toBe(416);
  });
});
