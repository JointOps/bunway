import { BunRequest } from "../core/request";
import type { BunResponse } from "../core/response";
import type { CookieOptions } from "../types";
import { HttpError } from "../core/errors";
import { jwtSign, jwtDecode, decodeUnsafe, verifyHmac, type JwtPayload } from "./jwt";

export type TokenPair = { accessToken: string; refreshToken: string };

export interface VaultEntry {
  familyId: string;
  sub: string;
  exp: number;
  payload: Record<string, unknown>; // original issue() payload — replayed on rotate
}

export interface VaultStore {
  /** Persist a newly issued refresh token entry. */
  set(jti: string, entry: VaultEntry): Promise<void>;

  /**
   * Atomically consume a token entry.
   * Returns the entry if valid (first use).
   * Returns null if the jti is unknown or was already revoked via revokeFamily.
   * Returns false if the jti was already consumed (reuse attack signal).
   */
  consume(jti: string): Promise<VaultEntry | null | false>;

  /** Revoke all tokens belonging to a family (breach response / logout-all). */
  revokeFamily(familyId: string): Promise<void>;
}

export interface CookieConfig {
  name: string;
  httpOnly?: boolean;  // default: true
  secure?: boolean;    // default: true
  sameSite?: "strict" | "lax" | "none";  // default: "strict"
  path?: string;       // default: "/auth/refresh"
  domain?: string;
}

export interface TokenVaultOptions {
  accessSecret: string;   // minimum 32 characters
  refreshSecret: string;  // minimum 32 characters; MUST differ from accessSecret
  accessExpiresIn: number;   // seconds (e.g. 900 = 15 min)
  refreshExpiresIn: number;  // seconds (e.g. 604800 = 7 days)
  store?: VaultStore;        // defaults to new VaultMemoryStore()
  cookie?: CookieConfig;     // if absent, cookie mode is disabled
  onReuse?: (familyId: string, req?: BunRequest) => Promise<void> | void;
}

export interface TokenVault {
  // Body mode — caller manages refresh token as a string
  issue(payload: Record<string, unknown>): Promise<TokenPair>;
  // Cookie mode — vault writes httpOnly Set-Cookie; body carries only accessToken
  issue(payload: Record<string, unknown>, res: BunResponse): Promise<{ accessToken: string }>;

  // Body mode — token is a refresh token string
  rotate(token: string): Promise<TokenPair>;
  // Cookie mode — vault reads cookie from req, writes new cookie on res
  rotate(req: BunRequest, res: BunResponse): Promise<{ accessToken: string }>;

  // Body mode — revoke by refresh token string
  revoke(token: string): Promise<void>;
  // Cookie mode — revoke from cookie, clear cookie on res
  revoke(req: BunRequest, res: BunResponse): Promise<void>;

  // Both modes — revoke all tokens in a login session family
  revokeAll(familyId: string): Promise<void>;
}

const VAULT_SWEEP_INTERVAL_MS = 60_000;

export class VaultMemoryStore implements VaultStore {
  private tokens = new Map<string, VaultEntry>();
  // Tracks exp alongside each consumed jti so the sweep can GC it once it's
  // no longer reachable via a forged/replayed token anyway.
  private consumed = new Map<string, number>();
  private sweepInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.sweepInterval = setInterval(() => this.sweep(), VAULT_SWEEP_INTERVAL_MS);
    if (this.sweepInterval.unref) {
      this.sweepInterval.unref();
    }
  }

  private sweep(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, entry] of this.tokens) {
      if (entry.exp <= now) this.tokens.delete(jti);
    }
    for (const [jti, exp] of this.consumed) {
      if (exp <= now) this.consumed.delete(jti);
    }
  }

  async set(jti: string, entry: VaultEntry): Promise<void> {
    this.tokens.set(jti, entry);
  }

  async consume(jti: string): Promise<VaultEntry | null | false> {
    if (this.consumed.has(jti)) return false;        // reuse: was consumed before
    const entry = this.tokens.get(jti);
    if (!entry) return null;                          // unknown / revoked by family
    this.tokens.delete(jti);
    this.consumed.set(jti, entry.exp);
    return entry;
  }

  async revokeFamily(familyId: string): Promise<void> {
    // Delete ONLY — do not add to `consumed`. If these jtis were added to `consumed`,
    // a later consume() would return `false` ("reuse attack") instead of `null`
    // ("unknown/revoked"), which would make rotate() fire onReuse() for every
    // legitimate logout-all / breach revocation instead of just returning 401.
    for (const [jti, entry] of this.tokens) {
      if (entry.familyId === familyId) {
        this.tokens.delete(jti);
      }
    }
  }

  /** Stop the background GC sweep and release the timer (e.g. in test teardown). */
  dispose(): void {
    clearInterval(this.sweepInterval);
  }

  // Test helpers — not part of the VaultStore interface
  size(): number          { return this.tokens.size; }
  consumedCount(): number { return this.consumed.size; }
  clear(): void           { this.tokens.clear(); this.consumed.clear(); }
}

function buildCookieOpts(config: CookieConfig): Omit<CookieOptions, "maxAge"> {
  return {
    httpOnly: config.httpOnly ?? true,
    secure:   config.secure   ?? true,
    sameSite: config.sameSite ?? "strict",
    path:     config.path     ?? "/auth/refresh",
    ...(config.domain ? { domain: config.domain } : {}),
  };
}

async function verifyRefreshToken(token: string, secret: string): Promise<JwtPayload> {
  // Reuse jwt.ts's decode/verify primitives instead of reimplementing
  // base64url-JSON decode + HMAC compare — keeps both code paths in lockstep.
  const decoded = decodeUnsafe(token);
  if (!decoded) {
    throw new HttpError(401, "Invalid refresh token");
  }

  // jwtSign always uses HS256 by default — refresh tokens are HS256-only.
  const [headerB64, payloadB64, sigB64] = decoded.raw;
  const verified = await verifyHmac(headerB64, payloadB64, sigB64, secret, "HS256");
  if (!verified) {
    throw new HttpError(401, "Invalid refresh token signature");
  }

  const { payload } = decoded;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp !== undefined && payload.exp < now) {
    throw new HttpError(401, "Refresh token expired");
  }

  return payload;
}

export function tokenVault(options: TokenVaultOptions): TokenVault {
  // ── Guard rails ────────────────────────────────────────────────────────────
  if (!options.accessSecret || options.accessSecret.length < 32) {
    throw new Error("tokenVault: accessSecret must be at least 32 characters");
  }
  if (!options.refreshSecret || options.refreshSecret.length < 32) {
    throw new Error("tokenVault: refreshSecret must be at least 32 characters");
  }
  if (options.cookie !== undefined && !options.cookie.name) {
    throw new Error("tokenVault: cookie.name is required when cookie mode is enabled");
  }

  const store: VaultStore    = options.store  ?? new VaultMemoryStore();
  const onReuse              = options.onReuse ?? (async () => {});
  const cookieBase           = options.cookie  ? buildCookieOpts(options.cookie) : null;

  // ── issue ──────────────────────────────────────────────────────────────────

  function issue(payload: Record<string, unknown>): Promise<TokenPair>;
  function issue(payload: Record<string, unknown>, res: BunResponse): Promise<{ accessToken: string }>;
  async function issue(
    payload: Record<string, unknown>,
    res?: BunResponse,
  ): Promise<TokenPair | { accessToken: string }> {
    if (res !== undefined && !options.cookie) {
      throw new Error(
        "tokenVault: cookie mode not configured — do not pass `res` to issue()"
      );
    }

    const jti      = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const now      = Math.floor(Date.now() / 1000);
    const exp      = now + options.refreshExpiresIn;

    // Access token — carries full caller payload (sub, role, scope, fid, etc.)
    const accessToken = jwtSign(
      { ...payload },
      options.accessSecret,
      { expiresIn: options.accessExpiresIn }
    );

    // Refresh token — only carries sub, jti (rotation lock), fid (family for revokeAll)
    const refreshToken = jwtSign(
      { sub: String(payload.sub ?? ""), jti, fid: familyId },
      options.refreshSecret,
      { expiresIn: options.refreshExpiresIn }
    );

    // Persist — payload stored so rotate() can replay it into the new access token
    await store.set(jti, { familyId, sub: String(payload.sub ?? ""), exp, payload });

    if (res !== undefined && cookieBase) {
      res.cookie(options.cookie!.name, refreshToken, {
        ...cookieBase,
        maxAge: options.refreshExpiresIn * 1000, // CookieOptions.maxAge is ms
      });
      return { accessToken };
    }

    return { accessToken, refreshToken };
  }

  // ── rotate ─────────────────────────────────────────────────────────────────

  function rotate(token: string): Promise<TokenPair>;
  function rotate(req: BunRequest, res: BunResponse): Promise<{ accessToken: string }>;
  async function rotate(
    tokenOrReq: string | BunRequest,
    res?: BunResponse,
  ): Promise<TokenPair | { accessToken: string }> {
    let token: string;
    let req: BunRequest | undefined;

    if (typeof tokenOrReq === "string") {
      token = tokenOrReq;
    } else if (tokenOrReq instanceof BunRequest) {
      if (!options.cookie) {
        throw new Error("tokenVault: cookie mode not configured");
      }
      req   = tokenOrReq;
      const cookieVal = req.cookies[options.cookie.name];
      if (!cookieVal) throw new HttpError(401, "Missing refresh token cookie");
      token = cookieVal;
    } else {
      // Not a string and not a real BunRequest (e.g. undefined from a missing
      // `refreshToken` field in body mode) — treat as a malformed token, not
      // a misconfigured cookie mode.
      throw new HttpError(401, "Invalid refresh token");
    }

    // Verify signature + expiry; throws HttpError(401) on any failure
    const rfPayload = await verifyRefreshToken(token, options.refreshSecret);

    const jti = typeof rfPayload.jti === "string" ? rfPayload.jti : null;
    const fid = typeof rfPayload.fid === "string" ? rfPayload.fid : null;
    const sub = typeof rfPayload.sub === "string" ? rfPayload.sub : null;

    // Use `=== null` (not `!jti`) — sub may legitimately be "" if issue() was
    // called without a sub claim, and "" must not be confused with "missing".
    if (jti === null) throw new HttpError(401, "Refresh token missing jti");
    if (fid === null) throw new HttpError(401, "Refresh token missing fid");
    if (sub === null) throw new HttpError(401, "Refresh token missing sub");

    const entry = await store.consume(jti);

    if (entry === false) {
      // Token was already consumed — reuse attack
      try {
        await onReuse(fid, req);
      } catch {
        // Hook errors are swallowed; the 401 must always be returned
      }
      throw new HttpError(401, "Refresh token already used");
    }

    if (entry === null) {
      // jti unknown or was revoked via revokeFamily
      throw new HttpError(401, "Refresh token not found or revoked");
    }

    // Issue new pair — same familyId, new jti
    const newJti = crypto.randomUUID();
    const now    = Math.floor(Date.now() / 1000);
    const exp    = now + options.refreshExpiresIn;

    // Replay stored payload so access token retains all original claims
    const accessToken = jwtSign(
      { ...entry.payload },
      options.accessSecret,
      { expiresIn: options.accessExpiresIn }
    );

    const newRefreshToken = jwtSign(
      { sub, jti: newJti, fid },
      options.refreshSecret,
      { expiresIn: options.refreshExpiresIn }
    );

    await store.set(newJti, {
      familyId: fid,
      sub,
      exp,
      payload: entry.payload, // carry payload forward through the rotation chain
    });

    if (res !== undefined && cookieBase) {
      res.cookie(options.cookie!.name, newRefreshToken, {
        ...cookieBase,
        maxAge: options.refreshExpiresIn * 1000,
      });
      return { accessToken };
    }

    return { accessToken, refreshToken: newRefreshToken };
  }

  // ── revoke ─────────────────────────────────────────────────────────────────

  function revoke(token: string): Promise<void>;
  function revoke(req: BunRequest, res: BunResponse): Promise<void>;
  async function revoke(
    tokenOrReq: string | BunRequest,
    res?: BunResponse,
  ): Promise<void> {
    let token: string | undefined;

    if (typeof tokenOrReq === "string") {
      token = tokenOrReq;
    } else if (tokenOrReq instanceof BunRequest) {
      if (!options.cookie) {
        throw new Error("tokenVault: cookie mode not configured");
      }
      const req = tokenOrReq;
      token     = req.cookies[options.cookie.name];
      // Clear cookie unconditionally — even if token is missing or malformed
      if (res && cookieBase) {
        res.clearCookie(options.cookie.name, cookieBase);
      }
    } else {
      // Not a string and not a real BunRequest — nothing to revoke. revoke()'s
      // contract is idempotent-no-op on bad input, so return rather than throw.
      return;
    }

    if (!token) return; // Nothing to revoke — idempotent

    // jwtDecode does NOT verify signature — intentional, we trust the bearer holding it
    const payload = jwtDecode(token);
    if (!payload || typeof payload.jti !== "string") return;

    // consume is idempotent: returns false if already consumed, null if unknown — both are fine
    await store.consume(payload.jti);
  }

  // ── revokeAll ──────────────────────────────────────────────────────────────

  async function revokeAll(familyId: string): Promise<void> {
    await store.revokeFamily(familyId);
  }

  // ── return ─────────────────────────────────────────────────────────────────

  return {
    issue:     issue     as TokenVault["issue"],
    rotate:    rotate    as TokenVault["rotate"],
    revoke:    revoke    as TokenVault["revoke"],
    revokeAll,
  };
}
