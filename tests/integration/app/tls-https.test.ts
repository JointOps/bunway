import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import bunway from "../../../src";

const TLS_DIR = join(import.meta.dir, "../../fixtures/tls");

let tlsCert: string;
let tlsKey: string;

beforeAll(() => {
  tlsCert = readFileSync(join(TLS_DIR, "cert.pem"), "utf-8");
  tlsKey = readFileSync(join(TLS_DIR, "key.pem"), "utf-8");
});

describe("TLS/HTTPS support", () => {
  let app: ReturnType<typeof bunway>;

  afterEach(async () => {
    await app?.close();
  });

  it("listen with tls options starts HTTPS server", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("secure"));

    const server = app.listen({ port: 0, tls: { key: tlsKey, cert: tlsCert } });
    expect(server.port).toBeGreaterThan(0);

    const res = await fetch(`https://localhost:${server.port}/`, {
      tls: { rejectUnauthorized: false },
    } as RequestInit);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("secure");
  });

  it("req.secure returns true for HTTPS requests", async () => {
    app = bunway();
    let capturedSecure = false;

    app.get("/check", (req, res) => {
      capturedSecure = req.secure;
      res.json({ secure: req.secure });
    });

    const server = app.listen({ port: 0, tls: { key: tlsKey, cert: tlsCert } });

    await fetch(`https://localhost:${server.port}/check`, {
      tls: { rejectUnauthorized: false },
    } as RequestInit);

    expect(capturedSecure).toBe(true);
  });

  it("req.protocol returns 'https' for HTTPS requests", async () => {
    app = bunway();
    let capturedProtocol = "";

    app.get("/proto", (req, res) => {
      capturedProtocol = req.protocol;
      res.json({ protocol: req.protocol });
    });

    const server = app.listen({ port: 0, tls: { key: tlsKey, cert: tlsCert } });

    await fetch(`https://localhost:${server.port}/proto`, {
      tls: { rejectUnauthorized: false },
    } as RequestInit);

    expect(capturedProtocol).toBe("https");
  });

  it("TLS server works with middleware stack", async () => {
    app = bunway();
    app.use(bunway.cors());
    app.use(bunway.json());
    app.get("/api", (req, res) => res.json({ tls: true }));

    const server = app.listen({ port: 0, tls: { key: tlsKey, cert: tlsCert } });

    const res = await fetch(`https://localhost:${server.port}/api`, {
      tls: { rejectUnauthorized: false },
    } as RequestInit);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tls: true });
  });

  it("non-TLS listen still works (no regression)", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("plain"));

    const server = app.listen(0);
    const res = await fetch(`http://localhost:${server.port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("plain");
  });

  it("close() works on TLS server", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("ok"));
    app.listen({ port: 0, tls: { key: tlsKey, cert: tlsCert } });

    await app.close();
    expect(app.server).toBeNull();
  });

  it("TLS with string content for cert/key works", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("string-tls"));

    const server = app.listen({ port: 0, tls: { key: tlsKey, cert: tlsCert } });
    expect(server.port).toBeGreaterThan(0);
    expect(app.server).not.toBeNull();
  });

  it("ListenOptions type accepts tls field", () => {
    const options: import("../../../src/types").ListenOptions = {
      port: 3000,
      hostname: "localhost",
      tls: {
        key: "fake-key",
        cert: "fake-cert",
        passphrase: "test",
        ca: "fake-ca",
      },
    };
    expect(options.tls).toBeDefined();
    expect(options.tls!.key).toBe("fake-key");
  });

  it("TLS with Buffer content for cert/key works", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("buffer-tls"));

    const server = app.listen({
      port: 0,
      tls: { key: Buffer.from(tlsKey), cert: Buffer.from(tlsCert) },
    });

    expect(server.port).toBeGreaterThan(0);

    const res = await fetch(`https://localhost:${server.port}/`, {
      tls: { rejectUnauthorized: false },
    } as RequestInit);
    expect(res.status).toBe(200);
  });

  it("TLS server restart works", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("restarted-tls"));

    app.listen({ port: 0, tls: { key: tlsKey, cert: tlsCert } });
    await app.close();

    const server = app.listen({ port: 0, tls: { key: tlsKey, cert: tlsCert } });

    const res = await fetch(`https://localhost:${server.port}/`, {
      tls: { rejectUnauthorized: false },
    } as RequestInit);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("restarted-tls");
  });
});
