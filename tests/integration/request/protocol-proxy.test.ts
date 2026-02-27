import { describe, expect, it } from "bun:test";
import bunway from "../../../src";
import { buildRequest } from "../../utils/testUtils";

describe("req.protocol with X-Forwarded-Proto", () => {
  it("returns http by default", async () => {
    const app = bunway();
    app.get("/", (req, res) => res.json({ protocol: req.protocol, secure: req.secure }));

    const res = await app.handle(buildRequest("/"));
    expect(await res.json()).toEqual({ protocol: "http", secure: false });
  });

  it("ignores X-Forwarded-Proto when trust proxy is disabled (default)", async () => {
    const app = bunway();
    app.get("/", (req, res) => res.json({ protocol: req.protocol }));

    const res = await app.handle(buildRequest("/", {
      headers: { "X-Forwarded-Proto": "https" },
    }));
    expect(await res.json()).toEqual({ protocol: "http" });
  });

  it("uses X-Forwarded-Proto when trust proxy is true", async () => {
    const app = bunway();
    app.set("trust proxy", true);
    app.get("/", (req, res) => res.json({ protocol: req.protocol, secure: req.secure }));

    const res = await app.handle(buildRequest("/", {
      headers: { "X-Forwarded-Proto": "https" },
    }));
    expect(await res.json()).toEqual({ protocol: "https", secure: true });
  });

  it("uses first value from comma-separated X-Forwarded-Proto", async () => {
    const app = bunway();
    app.set("trust proxy", true);
    app.get("/", (req, res) => res.json({ protocol: req.protocol }));

    const res = await app.handle(buildRequest("/", {
      headers: { "X-Forwarded-Proto": "https, http" },
    }));
    expect(await res.json()).toEqual({ protocol: "https" });
  });

  it("falls back to URL protocol when header is absent with trust proxy", async () => {
    const app = bunway();
    app.set("trust proxy", true);
    app.get("/", (req, res) => res.json({ protocol: req.protocol }));

    const res = await app.handle(buildRequest("/"));
    expect(await res.json()).toEqual({ protocol: "http" });
  });

  it("works with numeric trust proxy", async () => {
    const app = bunway();
    app.set("trust proxy", 1);
    app.get("/", (req, res) => res.json({ protocol: req.protocol }));

    const res = await app.handle(buildRequest("/", {
      headers: { "X-Forwarded-Proto": "https" },
    }));
    expect(await res.json()).toEqual({ protocol: "https" });
  });

  it("works with string trust proxy", async () => {
    const app = bunway();
    app.set("trust proxy", "loopback");
    app.get("/", (req, res) => res.json({ protocol: req.protocol }));

    const res = await app.handle(buildRequest("/", {
      headers: { "X-Forwarded-Proto": "https" },
    }));
    expect(await res.json()).toEqual({ protocol: "https" });
  });

  it("req.secure reflects proxy-forwarded protocol", async () => {
    const app = bunway();
    app.set("trust proxy", true);
    app.get("/", (req, res) => res.json({ secure: req.secure }));

    const r1 = await app.handle(buildRequest("/", {
      headers: { "X-Forwarded-Proto": "https" },
    }));
    expect(await r1.json()).toEqual({ secure: true });

    const r2 = await app.handle(buildRequest("/", {
      headers: { "X-Forwarded-Proto": "http" },
    }));
    expect(await r2.json()).toEqual({ secure: false });
  });
});
