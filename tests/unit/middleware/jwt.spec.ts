import { describe, expect, it } from "bun:test";
import { jwt, jwtSign, jwtDecode } from "../../../src/middleware/jwt";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";
import { HttpError } from "../../../src/core/errors";

const SECRET = "unit-test-jwt-secret-32chars-min!";

const createRequest = (headers: Record<string, string> = {}, path = "/"): BunRequest =>
  new BunRequest(new Request(`http://localhost${path}`, { headers }), path);

async function run(
  middleware: ReturnType<typeof jwt>,
  headers: Record<string, string> = {}
): Promise<{ req: BunRequest; nextArg: unknown }> {
  const req = createRequest(headers);
  let nextArg: unknown = "NOT_CALLED";
  await middleware(req, new BunResponse(), (err) => { nextArg = err; });
  return { req, nextArg };
}

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

describe("jwt middleware (Unit)", () => {
  describe("configuration errors", () => {
    it("throws if neither secret nor jwksUri provided", () => {
      expect(() => jwt({})).toThrow();
    });
  });

  describe("HS256 — happy path", () => {
    it("sets req.user with decoded payload", async () => {
      const token = jwtSign({ sub: "user123", name: "Alice" }, SECRET);
      const { req, nextArg } = await run(jwt({ secret: SECRET }), bearer(token));
      expect(nextArg).toBeUndefined();
      expect((req as any).user.sub).toBe("user123");
      expect((req as any).user.name).toBe("Alice");
    });

    it("also sets req.auth as alias", async () => {
      const token = jwtSign({ sub: "u1" }, SECRET);
      const { req } = await run(jwt({ secret: SECRET }), bearer(token));
      expect((req as any).auth).toEqual((req as any).user);
    });

    it("sets req.auth when requestProperty is 'auth'", async () => {
      const token = jwtSign({ sub: "u2" }, SECRET);
      const { req } = await run(jwt({ secret: SECRET, requestProperty: "auth" }), bearer(token));
      expect((req as any).auth).toBeDefined();
    });
  });

  describe("HS384 / HS512 variants", () => {
    for (const alg of ["HS384", "HS512"] as const) {
      it(`accepts ${alg} tokens`, async () => {
        const token = jwtSign({ sub: "u" }, SECRET, { algorithm: alg });
        const { nextArg } = await run(jwt({ secret: SECRET, algorithms: [alg] }), bearer(token));
        expect(nextArg).toBeUndefined();
      });
    }
  });

  describe("RSA-PSS (PS256 / PS384 / PS512) — PEM secret mode", () => {
    const pssHash: Record<"PS256" | "PS384" | "PS512", string> = {
      PS256: "SHA-256",
      PS384: "SHA-384",
      PS512: "SHA-512",
    };
    const saltLength: Record<"PS256" | "PS384" | "PS512", number> = {
      PS256: 32,
      PS384: 48,
      PS512: 64,
    };

    function base64url(buf: ArrayBuffer | Uint8Array): string {
      return Buffer.from(buf as ArrayBuffer).toString("base64url");
    }

    function toPem(der: ArrayBuffer, label: string): string {
      const b64 = Buffer.from(der).toString("base64");
      const lines = b64.match(/.{1,64}/g)!.join("\n");
      return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
    }

    async function makeKeyPair(alg: "PS256" | "PS384" | "PS512") {
      const keyPair = await crypto.subtle.generateKey(
        { name: "RSA-PSS", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: pssHash[alg] },
        true,
        ["sign", "verify"]
      ) as CryptoKeyPair;
      const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
      return { privateKey: keyPair.privateKey, publicKeyPem: toPem(spki, "PUBLIC KEY") };
    }

    async function signPss(alg: "PS256" | "PS384" | "PS512", privateKey: CryptoKey, payload: Record<string, unknown>): Promise<string> {
      const header = base64url(new TextEncoder().encode(JSON.stringify({ alg, typ: "JWT" })));
      const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
      const signingInput = new TextEncoder().encode(`${header}.${body}`);
      const sig = await crypto.subtle.sign({ name: "RSA-PSS", saltLength: saltLength[alg] }, privateKey, signingInput);
      return `${header}.${body}.${base64url(sig)}`;
    }

    for (const alg of ["PS256", "PS384", "PS512"] as const) {
      it(`verifies a valid ${alg} token`, async () => {
        const { privateKey, publicKeyPem } = await makeKeyPair(alg);
        const token = await signPss(alg, privateKey, { sub: "pss-user" });
        const { nextArg, req } = await run(
          jwt({ secret: publicKeyPem, algorithms: [alg] }),
          bearer(token)
        );
        expect(nextArg).toBeUndefined();
        expect((req as any).user.sub).toBe("pss-user");
      });

      it(`rejects a tampered ${alg} token`, async () => {
        const { privateKey, publicKeyPem } = await makeKeyPair(alg);
        const token = await signPss(alg, privateKey, { sub: "pss-user" });
        const tampered = token.slice(0, -2) + (token.slice(-2) === "AA" ? "BB" : "AA");
        const { nextArg } = await run(
          jwt({ secret: publicKeyPem, algorithms: [alg] }),
          bearer(tampered)
        );
        expect(nextArg).toBeInstanceOf(HttpError);
      });
    }
  });

  describe("rejection cases", () => {
    it("returns 401 when no token and credentialsRequired (default)", async () => {
      const { nextArg } = await run(jwt({ secret: SECRET }));
      expect(nextArg).toBeInstanceOf(HttpError);
      expect((nextArg as HttpError).status).toBe(401);
    });

    it("calls next() when no token and credentialsRequired: false", async () => {
      const { nextArg } = await run(jwt({ secret: SECRET, credentialsRequired: false }));
      expect(nextArg).toBeUndefined();
    });

    it("returns 401 for malformed JWT (not three parts)", async () => {
      const { nextArg } = await run(jwt({ secret: SECRET }), bearer("not.a.valid.jwt.at.all"));
      expect((nextArg as HttpError).status).toBe(401);
    });

    it("returns 401 for wrong secret", async () => {
      const token = jwtSign({ sub: "u" }, "other-secret-also-32-chars-long!");
      const { nextArg } = await run(jwt({ secret: SECRET }), bearer(token));
      expect((nextArg as HttpError).status).toBe(401);
    });

    it("returns 401 for expired token", async () => {
      const token = jwtSign({ sub: "u", exp: Math.floor(Date.now() / 1000) - 3600 }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET }), bearer(token));
      expect((nextArg as HttpError).status).toBe(401);
    });

    it("returns 401 for token not yet valid (nbf in future)", async () => {
      const token = jwtSign({ sub: "u", nbf: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET }), bearer(token));
      expect((nextArg as HttpError).status).toBe(401);
    });

    it("returns 401 for wrong algorithm", async () => {
      const token = jwtSign({ sub: "u" }, SECRET, { algorithm: "HS512" });
      const { nextArg } = await run(jwt({ secret: SECRET, algorithms: ["HS256"] }), bearer(token));
      expect((nextArg as HttpError).status).toBe(401);
    });

    it("returns 401 for wrong issuer", async () => {
      const token = jwtSign({ sub: "u" }, SECRET, { issuer: "https://other.example.com" });
      const { nextArg } = await run(jwt({ secret: SECRET, issuer: "https://example.com" }), bearer(token));
      expect((nextArg as HttpError).status).toBe(401);
    });

    it("returns 401 for wrong audience", async () => {
      const token = jwtSign({ sub: "u" }, SECRET, { audience: "api-b" });
      const { nextArg } = await run(jwt({ secret: SECRET, audience: "api-a" }), bearer(token));
      expect((nextArg as HttpError).status).toBe(401);
    });

    it("WWW-Authenticate header is present on 401 (no token)", async () => {
      const { nextArg } = await run(jwt({ secret: SECRET }));
      expect((nextArg as HttpError).headers?.["WWW-Authenticate"]).toContain("Bearer");
    });
  });

  describe("role enforcement", () => {
    it("passes when role matches", async () => {
      const token = jwtSign({ sub: "u", role: "admin" }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET, role: "admin" }), bearer(token));
      expect(nextArg).toBeUndefined();
    });

    it("passes when one of multiple required roles matches", async () => {
      const token = jwtSign({ sub: "u", role: "editor" }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET, role: ["admin", "editor"] }), bearer(token));
      expect(nextArg).toBeUndefined();
    });

    it("returns 403 when role does not match", async () => {
      const token = jwtSign({ sub: "u", role: "user" }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET, role: "admin" }), bearer(token));
      expect((nextArg as HttpError).status).toBe(403);
    });

    it("passes when roles claim is an array containing required role", async () => {
      const token = jwtSign({ sub: "u", roles: ["editor", "viewer"] }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET, role: "editor" }), bearer(token));
      expect(nextArg).toBeUndefined();
    });

    it("uses custom roleField", async () => {
      const token = jwtSign({ sub: "u", permissions: "admin" }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET, role: "admin", roleField: "permissions" }), bearer(token));
      expect(nextArg).toBeUndefined();
    });
  });

  describe("scope enforcement", () => {
    it("passes when all required scopes are present (space-delimited)", async () => {
      const token = jwtSign({ sub: "u", scope: "read write delete" }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET, scope: ["read", "write"] }), bearer(token));
      expect(nextArg).toBeUndefined();
    });

    it("passes when scopes are an array", async () => {
      const token = jwtSign({ sub: "u", scopes: ["read", "write"] }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET, scope: "read" }), bearer(token));
      expect(nextArg).toBeUndefined();
    });

    it("returns 403 when a required scope is missing", async () => {
      const token = jwtSign({ sub: "u", scope: "read" }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET, scope: ["read", "write"] }), bearer(token));
      expect((nextArg as HttpError).status).toBe(403);
    });

    it("uses custom scopeField", async () => {
      const token = jwtSign({ sub: "u", perms: "orders:read" }, SECRET);
      const { nextArg } = await run(jwt({ secret: SECRET, scope: "orders:read", scopeField: "perms" }), bearer(token));
      expect(nextArg).toBeUndefined();
    });
  });

  describe("hooks", () => {
    it("isRevoked: returns 401 for revoked token", async () => {
      const token = jwtSign({ sub: "u", jti: "token-id-abc" }, SECRET);
      const { nextArg } = await run(
        jwt({ secret: SECRET, isRevoked: async (payload) => payload.jti === "token-id-abc" }),
        bearer(token)
      );
      expect((nextArg as HttpError).status).toBe(401);
    });

    it("isRevoked: passes when not revoked", async () => {
      const token = jwtSign({ sub: "u", jti: "valid-token" }, SECRET);
      const { nextArg } = await run(
        jwt({ secret: SECRET, isRevoked: async (payload) => payload.jti === "revoked-id" }),
        bearer(token)
      );
      expect(nextArg).toBeUndefined();
    });

    it("onVerified: transforms payload before setting req.user", async () => {
      const token = jwtSign({ sub: "db-user-id" }, SECRET);
      const { req } = await run(
        jwt({ secret: SECRET, onVerified: async (payload) => ({ id: payload.sub, role: "member" }) }),
        bearer(token)
      );
      expect((req as any).user.id).toBe("db-user-id");
      expect((req as any).user.role).toBe("member");
    });
  });

  describe("custom token extractor", () => {
    it("extracts token from custom location", async () => {
      const token = jwtSign({ sub: "u" }, SECRET);
      const req = createRequest({ "x-access-token": token });
      let nextArg: unknown = "sentinel";
      await jwt({
        secret: SECRET,
        getToken: (r) => r.get("x-access-token") ?? undefined,
      })(req, new BunResponse(), (err) => { nextArg = err; });
      expect(nextArg).toBeUndefined();
    });
  });

  describe("jwtSign() helper", () => {
    it("round-trips: sign then verify", async () => {
      const payload = { sub: "roundtrip", email: "a@b.com" };
      const token = jwtSign(payload, SECRET, { expiresIn: 3600, issuer: "test" });
      const { req, nextArg } = await run(jwt({ secret: SECRET, issuer: "test" }), bearer(token));
      expect(nextArg).toBeUndefined();
      expect((req as any).user.sub).toBe("roundtrip");
      expect((req as any).user.email).toBe("a@b.com");
    });

    it("includes exp when expiresIn provided", () => {
      const now = Math.floor(Date.now() / 1000);
      const token = jwtSign({ sub: "u" }, SECRET, { expiresIn: 300 });
      const payload = jwtDecode(token)!;
      expect(payload.exp).toBeGreaterThan(now);
      expect(payload.exp).toBeLessThanOrEqual(now + 300 + 1);
    });

    it("iss/aud/sub options are applied", () => {
      const token = jwtSign({ custom: "claim" }, SECRET, {
        issuer: "https://auth.example.com",
        audience: "api",
        subject: "user-99",
        expiresIn: 60,
      });
      const payload = jwtDecode(token)!;
      expect(payload.iss).toBe("https://auth.example.com");
      expect(payload.aud).toBe("api");
      expect(payload.sub).toBe("user-99");
      expect(payload.custom).toBe("claim");
    });
  });

  describe("jwtDecode() helper", () => {
    it("decodes without verifying", () => {
      const token = jwtSign({ sub: "decode-me" }, SECRET);
      const payload = jwtDecode(token);
      expect(payload?.sub).toBe("decode-me");
    });

    it("returns null for malformed token", () => {
      expect(jwtDecode("notavalidjwt")).toBeNull();
    });

    it("returns null for non-JSON parts", () => {
      expect(jwtDecode("!!!.!!!.!!!")).toBeNull();
    });
  });
});
