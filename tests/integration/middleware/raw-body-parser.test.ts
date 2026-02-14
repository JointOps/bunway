import { describe, expect, it } from "bun:test";
import bunway, { raw } from "../../../src";
import { buildRequest } from "../../utils/testUtils";
import crypto from "crypto";

describe("raw() body parser", () => {
  describe("Basic functionality", () => {
    it("parses raw binary body as Buffer", async () => {
      const app = bunway();
      app.use(raw());
      app.post("/webhook", (req, res) => {
        expect(req.body).toBeInstanceOf(Buffer);
        res.json({ size: req.body.length, type: typeof req.body });
      });

      const binaryData = Buffer.from("binary data here");
      const response = await app.handle(
        buildRequest("/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: binaryData,
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.size).toBe(binaryData.length);
      expect(data.type).toBe("object");
    });

    it("marks body as parsed", async () => {
      const app = bunway();
      app.use(raw());
      app.post("/test", (req, res) => {
        res.json({ parsed: req.isBodyParsed() });
      });

      const response = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: Buffer.from("data"),
        })
      );

      expect(await response.json()).toEqual({ parsed: true });
    });

    it("skips parsing if body already parsed", async () => {
      const app = bunway();
      let rawCalled = false;

      app.use((req, res, next) => {
        req.body = { existing: "data" };
        next();
      });

      app.use(
        raw({
          verify: () => {
            rawCalled = true;
          },
        })
      );

      app.post("/test", (req, res) => {
        res.json({ body: req.body });
      });

      await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: Buffer.from("data"),
        })
      );

      expect(rawCalled).toBe(false);
    });
  });

  describe("Content-Type matching", () => {
    it("defaults to application/octet-stream", async () => {
      const app = bunway();
      app.use(raw());
      app.post("/test", (req, res) => {
        res.json({ parsed: req.isBodyParsed() });
      });

      const match = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: Buffer.from("data"),
        })
      );
      expect((await match.json()).parsed).toBe(true);

      const noMatch = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: Buffer.from("data"),
        })
      );
      expect((await noMatch.json()).parsed).toBe(false);
    });

    it("matches custom string content-type", async () => {
      const app = bunway();
      app.use(raw({ type: "application/webhook" }));
      app.post("/test", (req, res) => {
        res.json({ parsed: req.isBodyParsed() });
      });

      const match = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/webhook+json" },
          body: Buffer.from("data"),
        })
      );
      expect((await match.json()).parsed).toBe(true);

      const noMatch = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: Buffer.from("data"),
        })
      );
      expect((await noMatch.json()).parsed).toBe(false);
    });

    it("matches RegExp content-type", async () => {
      const app = bunway();
      app.use(raw({ type: /^application\/(webhook|stripe)/ }));
      app.post("/test", (req, res) => {
        res.json({ parsed: req.isBodyParsed() });
      });

      const webhookMatch = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/webhook+json" },
          body: Buffer.from("data"),
        })
      );
      expect((await webhookMatch.json()).parsed).toBe(true);

      const stripeMatch = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/stripe+json" },
          body: Buffer.from("data"),
        })
      );
      expect((await stripeMatch.json()).parsed).toBe(true);

      const noMatch = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: Buffer.from("data"),
        })
      );
      expect((await noMatch.json()).parsed).toBe(false);
    });

    it("matches function content-type", async () => {
      const app = bunway();
      app.use(
        raw({
          type: (ct: string) => ct.startsWith("application/") && ct.includes("webhook"),
        })
      );
      app.post("/test", (req, res) => {
        res.json({ parsed: req.isBodyParsed() });
      });

      const match = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/webhook-custom" },
          body: Buffer.from("data"),
        })
      );
      expect((await match.json()).parsed).toBe(true);

      const noMatch = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "text/webhook" },
          body: Buffer.from("data"),
        })
      );
      expect((await noMatch.json()).parsed).toBe(false);
    });
  });

  describe("Size limits", () => {
    it("enforces default 100kb limit", async () => {
      const app = bunway();
      app.use(raw());
      app.post("/test", (req, res) => res.json({ ok: true }));

      const smallData = Buffer.alloc(50 * 1024);
      const smallResponse = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: smallData,
        })
      );
      expect(smallResponse.status).toBe(200);

      const largeData = Buffer.alloc(150 * 1024);
      const largeResponse = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: largeData,
        })
      );
      expect(largeResponse.status).toBe(413);
      expect(await largeResponse.json()).toEqual({ error: "Payload too large" });
    });

    it("accepts custom numeric limit", async () => {
      const app = bunway();
      app.use(raw({ limit: 1024 }));
      app.post("/test", (req, res) => res.json({ ok: true }));

      const withinLimit = Buffer.alloc(512);
      const okResponse = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: withinLimit,
        })
      );
      expect(okResponse.status).toBe(200);

      const overLimit = Buffer.alloc(2048);
      const tooLargeResponse = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: overLimit,
        })
      );
      expect(tooLargeResponse.status).toBe(413);
    });

    it("parses string limit with units (kb, mb)", async () => {
      const app = bunway();
      app.use(raw({ limit: "5kb" }));
      app.post("/test", (req, res) => res.json({ ok: true }));

      const withinLimit = Buffer.alloc(4 * 1024);
      const okResponse = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: withinLimit,
        })
      );
      expect(okResponse.status).toBe(200);

      const overLimit = Buffer.alloc(6 * 1024);
      const tooLargeResponse = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: overLimit,
        })
      );
      expect(tooLargeResponse.status).toBe(413);
    });

    it("parses limit with decimal values (1.5mb)", async () => {
      const app = bunway();
      app.use(raw({ limit: "1.5mb" }));
      app.post("/test", (req, res) => res.json({ size: req.body.length }));

      const data = Buffer.alloc(1 * 1024 * 1024);
      const response = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: data,
        })
      );
      expect(response.status).toBe(200);

      const largeData = Buffer.alloc(2 * 1024 * 1024);
      const largeResponse = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: largeData,
        })
      );
      expect(largeResponse.status).toBe(413);
    });
  });

  describe("Verify callback", () => {
    it("calls verify callback with buffer before setting body", async () => {
      const app = bunway();
      let verifyBuffer: Buffer | null = null;
      let verifyEncoding: string | null = null;

      app.use(
        raw({
          verify: (req, res, buf, encoding) => {
            verifyBuffer = buf;
            verifyEncoding = encoding;
          },
        })
      );

      app.post("/test", (req, res) => {
        res.json({ ok: true });
      });

      const testData = Buffer.from("test data");
      await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: testData,
        })
      );

      expect(verifyBuffer).toBeInstanceOf(Buffer);
      expect(verifyBuffer?.toString()).toBe("test data");
      expect(verifyEncoding).toBe("binary");
    });

    it("returns 403 if verify callback throws", async () => {
      const app = bunway();

      app.use(
        raw({
          verify: () => {
            throw new Error("Signature verification failed");
          },
        })
      );

      app.post("/webhook", (req, res) => {
        res.json({ ok: true });
      });

      const response = await app.handle(
        buildRequest("/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: Buffer.from("data"),
        })
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Signature verification failed" });
    });

    it("supports webhook signature verification (Stripe-like)", async () => {
      const app = bunway();
      const secret = "whsec_test_secret";

      app.use(
        raw({
          verify: (req, res, buf) => {
            const signature = req.get("stripe-signature");
            if (!signature) {
              throw new Error("Missing signature");
            }

            const expectedSig = crypto.createHmac("sha256", secret).update(buf).digest("hex");

            if (signature !== expectedSig) {
              throw new Error("Invalid signature");
            }
          },
        })
      );

      app.post("/webhook", (req, res) => {
        res.json({ verified: true });
      });

      const body = Buffer.from("webhook payload");
      const validSig = crypto.createHmac("sha256", secret).update(body).digest("hex");

      const validResponse = await app.handle(
        buildRequest("/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "stripe-signature": validSig,
          },
          body,
        })
      );

      expect(validResponse.status).toBe(200);
      expect(await validResponse.json()).toEqual({ verified: true });

      const invalidResponse = await app.handle(
        buildRequest("/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "stripe-signature": "invalid_signature",
          },
          body,
        })
      );

      expect(invalidResponse.status).toBe(403);
      expect(await invalidResponse.json()).toEqual({ error: "Invalid signature" });
    });
  });

  describe("Integration", () => {
    it("works with route-specific middleware", async () => {
      const app = bunway();

      app.post(
        "/webhook",
        raw({ type: "application/webhook" }),
        (req, res) => {
          res.json({ size: req.body.length });
        }
      );

      app.post("/other", (req, res) => {
        res.json({ parsed: req.isBodyParsed() });
      });

      const webhookRes = await app.handle(
        buildRequest("/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/webhook" },
          body: Buffer.from("data"),
        })
      );
      expect(webhookRes.status).toBe(200);
      expect((await webhookRes.json()).size).toBe(4);

      const otherRes = await app.handle(
        buildRequest("/other", {
          method: "POST",
          headers: { "Content-Type": "application/webhook" },
          body: Buffer.from("data"),
        })
      );
      expect((await otherRes.json()).parsed).toBe(false);
    });

    it("works with bunway.raw() factory method", async () => {
      const app = bunway();
      app.use(bunway.raw());
      app.post("/test", (req, res) => {
        res.json({ ok: true });
      });

      const response = await app.handle(
        buildRequest("/test", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: Buffer.from("data"),
        })
      );

      expect(response.status).toBe(200);
    });
  });
});
