import { afterEach, describe, expect, it } from "bun:test";
import bunway from "../../../src";

describe("graceful shutdown", () => {
  let app: ReturnType<typeof bunway>;

  afterEach(async () => {
    await app?.close();
  });

  it("app.close() stops the server and nullifies app.server", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("ok"));
    const server = app.listen(0);

    const res1 = await fetch(`http://localhost:${server.port}/`);
    expect(res1.status).toBe(200);
    expect(await res1.text()).toBe("ok");

    await app.close();
    expect(app.server).toBeNull();
  });

  it("app.close() resolves when shutdown is complete", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("ok"));
    app.listen(0);

    const result = await app.close();
    expect(result).toBeUndefined();
    expect(app.server).toBeNull();
  });

  it("app.close() on a non-started server is a no-op", async () => {
    app = bunway();
    await app.close();
    expect(app.server).toBeNull();
  });

  it("multiple close() calls don't throw", async () => {
    app = bunway();
    app.listen(0);
    await app.close();
    await app.close();
    await app.close();
    expect(app.server).toBeNull();
  });

  it("server can be restarted after close", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("restarted"));

    app.listen(0);
    await app.close();

    const server2 = app.listen(0);
    const res = await fetch(`http://localhost:${server2.port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("restarted");
  });

  it("app.server reflects lifecycle state", async () => {
    app = bunway();
    expect(app.server).toBeNull();

    const server = app.listen(0);
    expect(app.server).not.toBeNull();
    expect(app.server).toBe(server);

    await app.close();
    expect(app.server).toBeNull();
  });

  it("close() works with middleware-heavy app", async () => {
    app = bunway();
    app.use(bunway.cors());
    app.use(bunway.json());
    app.get("/", (req, res) => res.json({ ok: true }));
    app.listen(0);

    await app.close();
    expect(app.server).toBeNull();
  });

  it("close() works with WebSocket routes registered", async () => {
    app = bunway();
    app.ws("/ws", {
      message(ws, msg) { ws.send(msg); },
    });
    app.listen(0);

    await app.close();
    expect(app.server).toBeNull();
  });

  it("listen(0) assigns random port accessible via app.server.port", async () => {
    app = bunway();
    app.listen(0);
    expect(app.server!.port).toBeGreaterThan(0);
    expect(app.server!.port).not.toBe(3000);
  });

  it("close(callback) fires callback — Express pattern", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("ok"));
    app.listen(0);

    let callbackFired = false;
    await app.close(() => { callbackFired = true; });
    expect(callbackFired).toBe(true);
    expect(app.server).toBeNull();
  });

  it("server.port matches app.server.port", async () => {
    app = bunway();
    const server = app.listen(0);
    expect(server.port).toBe(app.server!.port);
  });

  it("close() allows process to not hang", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("ok"));
    app.listen(0);
    await app.close();
    expect(app.server).toBeNull();
  });
});
