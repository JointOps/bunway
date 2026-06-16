import type { BunRequest } from "../core/request";
import type { AuthUser, Handler } from "../types";
import { HttpError } from "../core/errors";
import { timingSafeCompare } from "../utils/crypto";
import { createHmac } from "crypto";

type SubtleAlgorithm = Parameters<typeof crypto.subtle.importKey>[2];
type JwkWithKid = Record<string, unknown> & { kid?: string; alg?: string };

export interface JwtOptions {
  secret?: string | Buffer | ((header: JwtHeader) => Promise<string | Buffer>);
  jwksUri?: string;
  jwksCacheTtl?: number;
  algorithms?: JwtAlgorithm[];
  audience?: string | string[];
  issuer?: string | string[];
  credentialsRequired?: boolean;
  getToken?: (req: BunRequest) => string | undefined;
  isRevoked?: (payload: JwtPayload, token: string) => Promise<boolean>;
  onVerified?: (payload: JwtPayload, req: BunRequest) => Promise<AuthUser> | AuthUser;
  role?: string | string[];
  scope?: string | string[];
  roleField?: string;
  scopeField?: string;
  requestProperty?: string;
}

export type JwtAlgorithm =
  | "HS256" | "HS384" | "HS512"
  | "RS256" | "RS384" | "RS512"
  | "ES256" | "ES384" | "ES512"
  | "PS256" | "PS384" | "PS512";

export interface JwtHeader {
  alg: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

interface JwksCacheEntry {
  keys: Map<string, CryptoKey>;
  fetchedAt: number;
}

const jwksCache = new Map<string, JwksCacheEntry>();

async function fetchJwks(uri: string, ttl: number): Promise<Map<string, CryptoKey>> {
  const now = Date.now();
  const cached = jwksCache.get(uri);
  if (cached && now - cached.fetchedAt < ttl) {
    return cached.keys;
  }

  const res = await Bun.fetch(uri);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);

  const { keys } = await res.json() as { keys: JwkWithKid[] };
  const keyMap = new Map<string, CryptoKey>();

  for (const jwk of keys) {
    if (!jwk.kid) continue;
    const alg = jwkAlgToSubtle(jwk.alg as string);
    const key = await crypto.subtle.importKey("jwk", jwk, alg, false, ["verify"]);
    keyMap.set(jwk.kid, key);
  }

  jwksCache.set(uri, { keys: keyMap, fetchedAt: now });
  return keyMap;
}

function jwkAlgToSubtle(alg: string): SubtleAlgorithm {
  switch (alg) {
    case "RS256": return { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    case "RS384": return { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" };
    case "RS512": return { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" };
    case "ES256": return { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as SubtleAlgorithm;
    case "ES384": return { name: "ECDSA", namedCurve: "P-384", hash: "SHA-384" } as SubtleAlgorithm;
    case "ES512": return { name: "ECDSA", namedCurve: "P-521", hash: "SHA-512" } as SubtleAlgorithm;
    // RSA-PSS salt length follows RFC 7518 §3.5: same byte length as the hash output.
    // `hash` is used at import time; `saltLength` is used at verify time — importKey
    // ignores the extra field and verify ignores the extra `hash` field, so one object
    // safely serves both call sites (same pattern as the ECDSA cases above).
    case "PS256": return { name: "RSA-PSS", hash: "SHA-256", saltLength: 32 } as SubtleAlgorithm;
    case "PS384": return { name: "RSA-PSS", hash: "SHA-384", saltLength: 48 } as SubtleAlgorithm;
    case "PS512": return { name: "RSA-PSS", hash: "SHA-512", saltLength: 64 } as SubtleAlgorithm;
    default: throw new Error(`Unsupported JWKS alg: ${alg}`);
  }
}

function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

export function decodeUnsafe(token: string): { header: JwtHeader; payload: JwtPayload; raw: [string, string, string] } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(base64urlDecode(parts[0]!).toString("utf8")) as JwtHeader;
    const payload = JSON.parse(base64urlDecode(parts[1]!).toString("utf8")) as JwtPayload;
    return { header, payload, raw: [parts[0]!, parts[1]!, parts[2]!] };
  } catch {
    return null;
  }
}

export async function verifyHmac(
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
  secret: string | Buffer,
  alg: "HS256" | "HS384" | "HS512"
): Promise<boolean> {
  const hashAlg = alg === "HS256" ? "sha256" : alg === "HS384" ? "sha384" : "sha512";
  const expected = createHmac(hashAlg, secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
  return timingSafeCompare(signatureB64, expected);
}

async function verifyAsymmetric(
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
  key: CryptoKey,
  alg: JwtAlgorithm
): Promise<boolean> {
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = base64urlDecode(signatureB64);
  const subtleAlg = jwkAlgToSubtle(alg);
  return crypto.subtle.verify(subtleAlg, key, signature, signingInput);
}

function validateClaims(
  payload: JwtPayload,
  options: Pick<JwtOptions, "audience" | "issuer">
): string | null {
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp !== undefined && payload.exp < now) {
    return "Token expired";
  }

  if (payload.nbf !== undefined && payload.nbf > now) {
    return "Token not yet valid";
  }

  if (options.issuer) {
    const issuers = Array.isArray(options.issuer) ? options.issuer : [options.issuer];
    if (!payload.iss || !issuers.includes(payload.iss)) {
      return "Invalid issuer";
    }
  }

  if (options.audience) {
    const audiences = Array.isArray(options.audience) ? options.audience : [options.audience];
    const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud ?? ""];
    const hasAud = audiences.some((a) => tokenAud.includes(a));
    if (!hasAud) return "Invalid audience";
  }

  return null;
}

function validateRole(payload: JwtPayload, required: string | string[], field?: string): boolean {
  const roles = field
    ? payload[field]
    : (payload["role"] ?? payload["roles"]);

  const requiredArr = Array.isArray(required) ? required : [required];
  const userRoles = Array.isArray(roles)
    ? roles as string[]
    : typeof roles === "string" ? [roles] : [];

  return requiredArr.some((r) => userRoles.includes(r));
}

function validateScope(payload: JwtPayload, required: string | string[], field?: string): boolean {
  const raw = field
    ? payload[field]
    : (payload["scope"] ?? payload["scopes"]);

  const requiredArr = Array.isArray(required) ? required : [required];
  const userScopes = Array.isArray(raw)
    ? raw as string[]
    : typeof raw === "string" ? raw.split(" ") : [];

  return requiredArr.every((s) => userScopes.includes(s));
}

export function jwt(options: JwtOptions): Handler {
  if (!options.secret && !options.jwksUri) {
    throw new Error("jwt(): provide either `secret` or `jwksUri`");
  }

  const algorithms = options.algorithms ?? ["HS256"];
  const credentialsRequired = options.credentialsRequired !== false;
  const requestProperty = options.requestProperty ?? "user";
  const jwksTtl = options.jwksCacheTtl ?? 600_000;

  const getToken: (req: BunRequest) => string | undefined =
    options.getToken ?? ((req) => {
      const auth = req.get("authorization");
      if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();
      return undefined;
    });

  return async (req, res, next) => {
    const token = getToken(req);

    if (!token) {
      if (credentialsRequired) {
        return next(new HttpError(401, "No auth token", {
          headers: { "WWW-Authenticate": 'Bearer realm="api"' },
        }));
      }
      return next();
    }

    const decoded = decodeUnsafe(token);
    if (!decoded) {
      return next(new HttpError(401, "Malformed token"));
    }

    const { header, payload, raw } = decoded;
    const alg = header.alg as JwtAlgorithm;

    if (!algorithms.includes(alg)) {
      return next(new HttpError(401, `Algorithm ${alg} not accepted`));
    }

    try {
      let verified = false;

      if (options.jwksUri) {
        if (!header.kid) return next(new HttpError(401, "Token missing kid claim"));
        const keyMap = await fetchJwks(options.jwksUri, jwksTtl);
        const key = keyMap.get(header.kid);
        if (!key) return next(new HttpError(401, "Unknown kid"));
        verified = await verifyAsymmetric(raw[0], raw[1], raw[2], key, alg);
      } else if (options.secret) {
        const secret = typeof options.secret === "function"
          ? await options.secret(header)
          : options.secret;

        if (alg.startsWith("HS")) {
          verified = await verifyHmac(raw[0], raw[1], raw[2], secret, alg as "HS256" | "HS384" | "HS512");
        } else {
          const pemStr = typeof secret === "string" ? secret : secret.toString("utf8");
          const cryptoKey = await crypto.subtle.importKey(
            "spki",
            pemToDer(pemStr),
            jwkAlgToSubtle(alg),
            false,
            ["verify"]
          );
          verified = await verifyAsymmetric(raw[0], raw[1], raw[2], cryptoKey, alg);
        }
      }

      if (!verified) {
        return next(new HttpError(401, "Invalid token signature"));
      }

      const claimsError = validateClaims(payload, options);
      if (claimsError) {
        return next(new HttpError(401, claimsError));
      }

      if (options.isRevoked) {
        const revoked = await options.isRevoked(payload, token);
        if (revoked) return next(new HttpError(401, "Token revoked"));
      }

      if (options.role !== undefined) {
        if (!validateRole(payload, options.role, options.roleField)) {
          return next(new HttpError(403, "Insufficient role"));
        }
      }

      if (options.scope !== undefined) {
        if (!validateScope(payload, options.scope, options.scopeField)) {
          return next(new HttpError(403, "Insufficient scope"));
        }
      }

      const user: AuthUser = options.onVerified
        ? await options.onVerified(payload, req)
        : (payload as AuthUser);

      (req as unknown as Record<string, unknown>)[requestProperty] = user;
      req.auth = user;

      next();
    } catch (err) {
      next(new HttpError(401, "Token verification failed", { cause: err }));
    }
  };
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const buffer = Buffer.from(b64, "base64");
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export function jwtSign(
  payload: JwtPayload,
  secret: string | Buffer,
  options: { algorithm?: "HS256" | "HS384" | "HS512"; expiresIn?: number; issuer?: string; audience?: string; subject?: string } = {}
): string {
  const alg = options.algorithm ?? "HS256";
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtPayload = {
    iat: now,
    ...options.issuer && { iss: options.issuer },
    ...options.audience && { aud: options.audience },
    ...options.subject && { sub: options.subject },
    ...options.expiresIn && { exp: now + options.expiresIn },
    ...payload,
  };

  const header = Buffer.from(JSON.stringify({ alg, typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const hashAlg = alg === "HS256" ? "sha256" : alg === "HS384" ? "sha384" : "sha512";
  const sig = createHmac(hashAlg, secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function jwtDecode(token: string): JwtPayload | null {
  const decoded = decodeUnsafe(token);
  return decoded ? decoded.payload : null;
}
