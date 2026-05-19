import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { buildRequest } from "../../utils/testUtils";

describe("handleError", () => {
  it("plain Error with .status uses that status code", async () => {
    const app = bunway();
    app.get("/err", () => {
      const e = new Error("forbidden");
      (e as any).status = 403;
      throw e;
    });
    const res = await app.handle(buildRequest("/err"));
    expect(res.status).toBe(403);
  });

  it("plain Error with .statusCode uses that status code", async () => {
    const app = bunway();
    app.get("/err", () => {
      const e = new Error("unprocessable");
      (e as any).statusCode = 422;
      throw e;
    });
    const res = await app.handle(buildRequest("/err"));
    expect(res.status).toBe(422);
  });

  it("plain Error with no status → 500 and generic message (not raw err.message)", async () => {
    const app = bunway();
    app.get("/err", () => {
      throw new Error("db password is hunter2");
    });
    const res = await app.handle(buildRequest("/err"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal Server Error");
    expect(body.error).not.toContain("hunter2");
  });

  it("err.expose:true reveals message even on 5xx", async () => {
    const app = bunway();
    app.get("/err", () => {
      const e = new Error("safe to show");
      (e as any).expose = true;
      throw e;
    });
    const res = await app.handle(buildRequest("/err"));
    const body = await res.json();
    expect(body.error).toBe("safe to show");
  });

  it("async error handler is awaited before response commits", async () => {
    const app = bunway();
    let sideEffect = false;
    app.get("/err", () => {
      throw new Error("test");
    });
    app.use(async (_err: any, _req: any, res: any, _next: any) => {
      await new Promise((r) => setTimeout(r, 15));
      sideEffect = true;
      res.status(500).json({ custom: "handled" });
    });
    const res = await app.handle(buildRequest("/err"));
    expect(sideEffect).toBe(true);
    const body = await res.json();
    expect(body.custom).toBe("handled");
  });
});
