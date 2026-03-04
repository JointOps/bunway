import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import bunway from "../../../src";

const TEST_DIR = "/tmp/bunway-sendfile-range-test";
const TEST_FILE = `${TEST_DIR}/sample.txt`;
const TEST_CONTENT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; // 26 bytes

describe("Integration: res.sendFile() range support", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, TEST_CONTENT);
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("sets Accept-Ranges: bytes on all sendFile responses", async () => {
    const app = bunway();
    app.get("/file", async (req, res) => {
      await res.sendFile(TEST_FILE);
    });

    const response = await app.handle(new Request("http://localhost/file"));
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.status).toBe(200);
  });

  it("returns full file when no Range header", async () => {
    const app = bunway();
    app.get("/file", async (req, res) => {
      await res.sendFile(TEST_FILE);
    });

    const response = await app.handle(new Request("http://localhost/file"));
    const body = await response.text();
    expect(body).toBe(TEST_CONTENT);
    expect(response.headers.get("Content-Length")).toBe("26");
  });

  it("returns 206 with partial content for valid Range", async () => {
    const app = bunway();
    app.get("/file", async (req, res) => {
      await res.sendFile(TEST_FILE);
    });

    const response = await app.handle(
      new Request("http://localhost/file", {
        headers: { range: "bytes=0-4" },
      })
    );
    expect(response.status).toBe(206);
    const body = await response.text();
    expect(body).toBe("ABCDE");
    expect(response.headers.get("Content-Range")).toBe("bytes 0-4/26");
    expect(response.headers.get("Content-Length")).toBe("5");
  });

  it("handles suffix range", async () => {
    const app = bunway();
    app.get("/file", async (req, res) => {
      await res.sendFile(TEST_FILE);
    });

    const response = await app.handle(
      new Request("http://localhost/file", {
        headers: { range: "bytes=-5" },
      })
    );
    expect(response.status).toBe(206);
    const body = await response.text();
    expect(body).toBe("VWXYZ");
  });

  it("handles open-ended range", async () => {
    const app = bunway();
    app.get("/file", async (req, res) => {
      await res.sendFile(TEST_FILE);
    });

    const response = await app.handle(
      new Request("http://localhost/file", {
        headers: { range: "bytes=20-" },
      })
    );
    expect(response.status).toBe(206);
    const body = await response.text();
    expect(body).toBe("UVWXYZ");
    expect(response.headers.get("Content-Range")).toBe("bytes 20-25/26");
  });

  it("returns 416 for unsatisfiable range", async () => {
    const app = bunway();
    app.get("/file", async (req, res) => {
      await res.sendFile(TEST_FILE);
    });

    const response = await app.handle(
      new Request("http://localhost/file", {
        headers: { range: "bytes=100-200" },
      })
    );
    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */26");
  });

  it("clamps end to file size", async () => {
    const app = bunway();
    app.get("/file", async (req, res) => {
      await res.sendFile(TEST_FILE);
    });

    const response = await app.handle(
      new Request("http://localhost/file", {
        headers: { range: "bytes=0-9999" },
      })
    );
    expect(response.status).toBe(206);
    const body = await response.text();
    expect(body).toBe(TEST_CONTENT);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-25/26");
  });

  it("simulates resumable download (sequential ranges)", async () => {
    const app = bunway();
    app.get("/file", async (req, res) => {
      await res.sendFile(TEST_FILE);
    });

    const r1 = await app.handle(
      new Request("http://localhost/file", { headers: { range: "bytes=0-12" } })
    );
    const r2 = await app.handle(
      new Request("http://localhost/file", { headers: { range: "bytes=13-25" } })
    );

    const part1 = await r1.text();
    const part2 = await r2.text();
    expect(part1 + part2).toBe(TEST_CONTENT);
  });
});
