import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import bunway from "../../src";

const TLS_DIR = join(import.meta.dir, "../fixtures/tls");

let tlsCert: string;
let tlsKey: string;

beforeAll(() => {
  tlsCert = readFileSync(join(TLS_DIR, "cert.pem"), "utf-8");
  tlsKey = readFileSync(join(TLS_DIR, "key.pem"), "utf-8");
});

describe("server lifecycle acceptance", () => {
  let app: ReturnType<typeof bunway>;

  afterEach(async () => {
    await app?.close();
  });

  it("full lifecycle: listen → serve requests → close → server nullified", async () => {
    app = bunway();
    app.use(bunway.json());
    app.get("/health", (req, res) => res.json({ status: "ok" }));
    app.post("/echo", (req, res) => res.json(req.body));

    const server = app.listen(0);
    const base = `http://localhost:${server.port}`;

    const r1 = await fetch(`${base}/health`);
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ status: "ok" });

    const r2 = await fetch(`${base}/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ping: true }),
    });
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ ping: true });

    await app.close();
    expect(app.server).toBeNull();
  });

  it("HTTPS full lifecycle: listen with TLS → serve → close", async () => {
    app = bunway();
    app.get("/secure", (req, res) => {
      res.json({ secure: req.secure, protocol: req.protocol });
    });

    const server = app.listen({ port: 0, tls: { key: tlsKey, cert: tlsCert } });

    const res = await fetch(`https://localhost:${server.port}/secure`, {
      tls: { rejectUnauthorized: false },
    } as RequestInit);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.secure).toBe(true);
    expect(body.protocol).toBe("https");

    await app.close();
    expect(app.server).toBeNull();
  });

  it("restart cycle: listen → close → listen → serve → close", async () => {
    app = bunway();
    let counter = 0;
    app.get("/count", (req, res) => {
      counter++;
      res.json({ count: counter });
    });

    const s1 = app.listen(0);
    const r1 = await fetch(`http://localhost:${s1.port}/count`);
    expect((await r1.json()).count).toBe(1);
    await app.close();

    const s2 = app.listen(0);
    const r2 = await fetch(`http://localhost:${s2.port}/count`);
    expect((await r2.json()).count).toBe(2);

    await app.close();
  });

  it("Express-style shutdown pattern with callback", async () => {
    app = bunway();
    app.get("/", (req, res) => res.text("ok"));
    app.listen(0);

    let shutdownComplete = false;
    await app.close(() => {
      shutdownComplete = true;
    });

    expect(shutdownComplete).toBe(true);
    expect(app.server).toBeNull();
  });
});
