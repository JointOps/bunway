import { describe, expect, it } from "bun:test";
import bunway from "../../../src";

describe("Trust Proxy", () => {
  describe("trust proxy disabled (default)", () => {
    it("returns default IP when trust proxy is false", async () => {
      const app = bunway();

      app.get("/ip", (req, res) => {
        res.json({ ip: req.ip, ips: req.ips });
      });

      const response = await app.handle(
        new Request("http://localhost/ip", {
          headers: { "X-Forwarded-For": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
        })
      );

      const data = await response.json();
      expect(data.ip).toBe("127.0.0.1");
      expect(data.ips).toEqual([]);
    });
  });

  describe("trust proxy enabled (true)", () => {
    it("returns client IP from x-forwarded-for when trust proxy is true", async () => {
      const app = bunway();
      app.set("trust proxy", true);

      app.get("/ip", (req, res) => {
        res.json({ ip: req.ip, ips: req.ips });
      });

      const response = await app.handle(
        new Request("http://localhost/ip", {
          headers: { "X-Forwarded-For": "203.0.113.50, 70.41.3.18" },
        })
      );

      const data = await response.json();
      expect(data.ip).toBe("203.0.113.50");
      expect(data.ips).toEqual(["203.0.113.50", "70.41.3.18"]);
    });

    it("returns default when no x-forwarded-for header", async () => {
      const app = bunway();
      app.set("trust proxy", true);

      app.get("/ip", (req, res) => {
        res.json({ ip: req.ip });
      });

      const response = await app.handle(new Request("http://localhost/ip"));
      const data = await response.json();
      expect(data.ip).toBe("127.0.0.1");
    });
  });

  describe("trust proxy with number (hops)", () => {
    it("trusts specified number of hops", async () => {
      const app = bunway();
      app.set("trust proxy", 1); // Trust only 1 hop

      app.get("/ip", (req, res) => {
        res.json({ ip: req.ip });
      });

      const response = await app.handle(
        new Request("http://localhost/ip", {
          headers: { "X-Forwarded-For": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
        })
      );

      const data = await response.json();
      // With 1 trusted hop, the second-to-last IP should be returned
      expect(data.ip).toBe("70.41.3.18");
    });

    it("trusts two hops", async () => {
      const app = bunway();
      app.set("trust proxy", 2);

      app.get("/ip", (req, res) => {
        res.json({ ip: req.ip });
      });

      const response = await app.handle(
        new Request("http://localhost/ip", {
          headers: { "X-Forwarded-For": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
        })
      );

      const data = await response.json();
      expect(data.ip).toBe("203.0.113.50");
    });
  });

  describe("trust proxy with loopback", () => {
    it("trusts loopback addresses", async () => {
      const app = bunway();
      app.set("trust proxy", "loopback");

      app.get("/ip", (req, res) => {
        res.json({ ip: req.ip });
      });

      const response = await app.handle(
        new Request("http://localhost/ip", {
          headers: { "X-Forwarded-For": "203.0.113.50, 127.0.0.1" },
        })
      );

      const data = await response.json();
      expect(data.ip).toBe("203.0.113.50");
    });
  });

  describe("trust proxy with array", () => {
    it("trusts specified IPs", async () => {
      const app = bunway();
      app.set("trust proxy", ["10.0.0.1", "10.0.0.2"]);

      app.get("/ip", (req, res) => {
        res.json({ ip: req.ip });
      });

      const response = await app.handle(
        new Request("http://localhost/ip", {
          headers: { "X-Forwarded-For": "203.0.113.50, 10.0.0.1" },
        })
      );

      const data = await response.json();
      expect(data.ip).toBe("203.0.113.50");
    });
  });

  describe("trust proxy with function", () => {
    it("uses custom trust function", async () => {
      const app = bunway();
      app.set("trust proxy", (ip: string) => ip.startsWith("10."));

      app.get("/ip", (req, res) => {
        res.json({ ip: req.ip });
      });

      const response = await app.handle(
        new Request("http://localhost/ip", {
          headers: { "X-Forwarded-For": "203.0.113.50, 10.0.0.5" },
        })
      );

      const data = await response.json();
      expect(data.ip).toBe("203.0.113.50");
    });
  });

  describe("uniquelocal trust", () => {
    it("trusts private network addresses", async () => {
      const app = bunway();
      app.set("trust proxy", "uniquelocal");

      app.get("/ip", (req, res) => {
        res.json({ ip: req.ip });
      });

      const response = await app.handle(
        new Request("http://localhost/ip", {
          headers: { "X-Forwarded-For": "203.0.113.50, 192.168.1.1" },
        })
      );

      const data = await response.json();
      expect(data.ip).toBe("203.0.113.50");
    });
  });
});
