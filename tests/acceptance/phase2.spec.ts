import { describe, it, expect, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import bunway from "../../src";

const TEST_DIR = "/tmp/bunway-phase2-acceptance";
const TEST_FILE = `${TEST_DIR}/video.bin`;

describe("Acceptance: Phase 2 features (full HTTP round-trip)", () => {
  let server: ReturnType<typeof Bun.serve> | null = null;

  afterEach(async () => {
    if (server) {
      server.stop();
      server = null;
    }
  });

  it("req.fresh returns 304 via real HTTP", async () => {
    const app = bunway();
    app.get("/data", (req, res) => {
      res.set("ETag", '"v1"');
      if (req.fresh) {
        res.status(304).end();
        return;
      }
      res.json({ data: "hello" });
    });

    server = app.listen({ port: 0 });
    const port = server.port;

    const response = await fetch(`http://localhost:${port}/data`, {
      headers: { "If-None-Match": '"v1"' },
    });
    expect(response.status).toBe(304);
  });

  it("res.sendFile() returns 206 for Range requests via real HTTP", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, "0123456789ABCDEF"); // 16 bytes

    const app = bunway();
    app.get("/download", async (req, res) => {
      await res.sendFile(TEST_FILE);
    });

    server = app.listen({ port: 0 });
    const port = server.port;

    const response = await fetch(`http://localhost:${port}/download`, {
      headers: { Range: "bytes=0-7" },
    });
    expect(response.status).toBe(206);
    const body = await response.text();
    expect(body).toBe("01234567");
    expect(response.headers.get("Content-Range")).toBe("bytes 0-7/16");

    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("res.jsonp() returns JSONP via real HTTP", async () => {
    const app = bunway();
    app.get("/api", (req, res) => res.jsonp({ name: "test" }));

    server = app.listen({ port: 0 });
    const port = server.port;

    const response = await fetch(`http://localhost:${port}/api?callback=handle`);
    expect(response.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    const body = await response.text();
    expect(body).toContain("handle");
  });

  it("req.res and res.req cross-references work via real HTTP", async () => {
    const app = bunway();
    let crossRefsOk = false;
    app.get("/check", (req, res) => {
      crossRefsOk = req.res === res && res.req === req;
      res.json({ crossRefsOk });
    });

    server = app.listen({ port: 0 });
    const port = server.port;

    const response = await fetch(`http://localhost:${port}/check`);
    const body = await response.json();
    expect(body.crossRefsOk).toBe(true);
  });
});
