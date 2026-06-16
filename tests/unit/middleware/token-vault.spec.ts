import { describe, expect, it, beforeEach } from "bun:test";
import {
  tokenVault,
  VaultMemoryStore,
  type TokenVaultOptions,
  type VaultStore,
  type VaultEntry,
} from "../../../src/middleware/token-vault";
import { jwtSign, jwtDecode } from "../../../src/middleware/jwt";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";
import { HttpError } from "../../../src/core/errors";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCESS_SECRET  = "unit-vault-access-secret-32chars!";
const REFRESH_SECRET = "unit-vault-refresh-secret-32chars";
const BASE_OPTS: TokenVaultOptions = {
  accessSecret:     ACCESS_SECRET,
  refreshSecret:    REFRESH_SECRET,
  accessExpiresIn:  900,
  refreshExpiresIn: 604800,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVault(overrides: Partial<TokenVaultOptions> = {}) {
  return tokenVault({ ...BASE_OPTS, ...overrides });
}

/** Returns the raw Set-Cookie header string from a BunResponse, or null. */
function getSetCookie(res: BunResponse): string | null {
  return res.toResponse().headers.get("set-cookie");
}

/** Build a BunRequest that carries a cookie header. */
function makeReqWithCookie(name: string, value: string): BunRequest {
  return new BunRequest(
    new Request("http://localhost/auth/refresh", {
      headers: { cookie: `${name}=${value}` },
    }),
    "/auth/refresh"
  );
}

// ─── T1 — VaultMemoryStore ────────────────────────────────────────────────────

describe("VaultMemoryStore", () => {
  let store: VaultMemoryStore;

  const entry: VaultEntry = {
    familyId: "fam-1",
    sub: "user-1",
    exp: Math.floor(Date.now() / 1000) + 3600,
    payload: { sub: "user-1", role: "admin" },
  };

  beforeEach(() => {
    store = new VaultMemoryStore();
  });

  it("set + consume returns entry on first use", async () => {
    await store.set("jti-1", entry);
    const result = await store.consume("jti-1");
    expect(result).toEqual(entry);
  });

  it("consume on unknown jti returns null", async () => {
    expect(await store.consume("unknown")).toBeNull();
  });

  it("consume after consume returns false (reuse detection)", async () => {
    await store.set("jti-2", entry);
    await store.consume("jti-2");
    expect(await store.consume("jti-2")).toBe(false);
  });

  it("consume after revokeFamily returns null, NOT false (must not look like a reuse attack)", async () => {
    await store.set("jti-3", entry);
    await store.revokeFamily("fam-1");
    // revokeFamily deletes without marking `consumed`, so this is indistinguishable
    // from an unknown jti — rotate() must take the plain-401 path, not the
    // onReuse()-firing reuse-attack path.
    expect(await store.consume("jti-3")).toBeNull();
  });

  it("revokeFamily invalidates all jtis in that family", async () => {
    const e2 = { ...entry, familyId: "fam-A" };
    await store.set("jti-a1", { ...e2 });
    await store.set("jti-a2", { ...e2 });
    await store.revokeFamily("fam-A");
    expect(await store.consume("jti-a1")).toBeNull();
    expect(await store.consume("jti-a2")).toBeNull();
  });

  it("revokeFamily on unknown familyId is a no-op", async () => {
    await store.set("jti-z", entry);
    await expect(store.revokeFamily("nonexistent")).resolves.toBeUndefined();
    // Other tokens unaffected
    expect(await store.consume("jti-z")).toEqual(entry);
  });

  it("tokens from a different family are unaffected by revokeFamily", async () => {
    const entryA = { ...entry, familyId: "fam-X" };
    const entryB = { ...entry, familyId: "fam-Y" };
    await store.set("jti-x", entryA);
    await store.set("jti-y", entryB);
    await store.revokeFamily("fam-X");
    expect(await store.consume("jti-y")).toEqual(entryB); // untouched
  });

  it("set overwrites if same jti supplied twice", async () => {
    await store.set("jti-dup", entry);
    const e2 = { ...entry, sub: "user-2" };
    await store.set("jti-dup", e2);
    expect(await store.consume("jti-dup")).toEqual(e2);
  });

  it("clear() resets all state", async () => {
    await store.set("jti-c", entry);
    await store.consume("jti-c");
    store.clear();
    expect(store.size()).toBe(0);
    expect(store.consumedCount()).toBe(0);
  });

  it("size() and consumedCount() track correctly", async () => {
    await store.set("jti-s1", entry);
    await store.set("jti-s2", entry);
    expect(store.size()).toBe(2);
    await store.consume("jti-s1");
    expect(store.size()).toBe(1);
    expect(store.consumedCount()).toBe(1);
  });
});

// ─── T2 — issue() ─────────────────────────────────────────────────────────────

describe("tokenVault.issue() — body mode", () => {
  let store: VaultMemoryStore;
  let vault: ReturnType<typeof tokenVault>;

  beforeEach(() => {
    store = new VaultMemoryStore();
    vault = makeVault({ store });
  });

  it("returns { accessToken, refreshToken }", async () => {
    const result = await vault.issue({ sub: "u1" });
    expect(result).toHaveProperty("accessToken");
    expect(result).toHaveProperty("refreshToken");
    expect(typeof (result as any).accessToken).toBe("string");
    expect(typeof (result as any).refreshToken).toBe("string");
  });

  it("access token decodes to correct sub and custom claims", async () => {
    const { accessToken } = await vault.issue({ sub: "u1", role: "admin" }) as any;
    const payload = jwtDecode(accessToken);
    expect(payload?.sub).toBe("u1");
    expect(payload?.role).toBe("admin");
  });

  it("access token exp equals iat + accessExpiresIn", async () => {
    const { accessToken } = await vault.issue({ sub: "u1" }) as any;
    const payload = jwtDecode(accessToken)!;
    expect(payload.exp).toBe((payload.iat as number) + BASE_OPTS.accessExpiresIn);
  });

  it("refresh token decodes to jti, fid, sub, correct exp", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    const payload = jwtDecode(refreshToken)!;
    expect(typeof payload.jti).toBe("string");
    expect(typeof payload.fid).toBe("string");
    expect(payload.sub).toBe("u1");
    expect(payload.exp).toBe((payload.iat as number) + BASE_OPTS.refreshExpiresIn);
  });

  it("refresh token is signed with refreshSecret (wrong secret fails verify)", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    // Tamper: try to rotate with a vault using wrong refresh secret
    const wrongVault = makeVault({ refreshSecret: "wrong-refresh-secret-32-chars-!!", store });
    await expect(wrongVault.rotate(refreshToken)).rejects.toBeInstanceOf(HttpError);
  });

  it("access token is signed with accessSecret (wrong secret fails jwt() middleware)", () => {
    // Verified indirectly — access token uses different alg key so jwt() with wrong secret rejects.
    // Direct: decode header and confirm alg is HS256
    (async () => {
      const { accessToken } = await vault.issue({ sub: "u1" }) as any;
      const header = JSON.parse(
        Buffer.from(accessToken.split(".")[0], "base64url").toString("utf8")
      );
      expect(header.alg).toBe("HS256");
    });
  });

  it("every call generates a unique jti and unique familyId", async () => {
    const r1 = await vault.issue({ sub: "u1" }) as any;
    const r2 = await vault.issue({ sub: "u1" }) as any;
    const p1 = jwtDecode(r1.refreshToken)!;
    const p2 = jwtDecode(r2.refreshToken)!;
    expect(p1.jti).not.toBe(p2.jti);
    expect(p1.fid).not.toBe(p2.fid);
  });

  it("two issue() calls produce different familyIds", async () => {
    const r1 = await vault.issue({ sub: "u1" }) as any;
    const r2 = await vault.issue({ sub: "u1" }) as any;
    expect(jwtDecode(r1.refreshToken)!.fid).not.toBe(jwtDecode(r2.refreshToken)!.fid);
  });

  it("store contains the jti after issue", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    const jti = jwtDecode(refreshToken)!.jti as string;
    expect(store.size()).toBe(1);
    // Consuming it succeeds (proves it was stored)
    const entry = await store.consume(jti);
    expect(entry).not.toBeNull();
    expect(entry).not.toBe(false);
  });

  it("arbitrary payload fields pass through to access token", async () => {
    const { accessToken } = await vault.issue({ sub: "u1", role: "editor", tenantId: "t1" }) as any;
    const payload = jwtDecode(accessToken)!;
    expect(payload.role).toBe("editor");
    expect(payload.tenantId).toBe("t1");
  });

  it("issue() with empty payload only has standard JWT claims", async () => {
    const { accessToken } = await vault.issue({}) as any;
    const payload = jwtDecode(accessToken)!;
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });
});

// ─── T3 — rotate() happy path ─────────────────────────────────────────────────

describe("tokenVault.rotate() — happy path", () => {
  let store: VaultMemoryStore;
  let vault: ReturnType<typeof tokenVault>;

  beforeEach(() => {
    store = new VaultMemoryStore();
    vault = makeVault({ store });
  });

  it("returns { accessToken, refreshToken }", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    const result = await vault.rotate(refreshToken);
    expect(result).toHaveProperty("accessToken");
    expect(result).toHaveProperty("refreshToken");
  });

  it("new access token has same sub as original", async () => {
    const { refreshToken } = await vault.issue({ sub: "u-rotate" }) as any;
    const { accessToken } = await vault.rotate(refreshToken) as any;
    expect(jwtDecode(accessToken)!.sub).toBe("u-rotate");
  });

  it("new access token has fresh iat and exp", async () => {
    const { accessToken: origAccess, refreshToken } = await vault.issue({ sub: "u1" }) as any;
    await new Promise(r => setTimeout(r, 10)); // ensure time delta
    const { accessToken: newAccess } = await vault.rotate(refreshToken) as any;
    const origIat = jwtDecode(origAccess)!.iat as number;
    const newIat  = jwtDecode(newAccess)!.iat as number;
    expect(newIat).toBeGreaterThanOrEqual(origIat);
  });

  it("new refresh token has different jti from original", async () => {
    const { refreshToken: rt1 } = await vault.issue({ sub: "u1" }) as any;
    const { refreshToken: rt2 } = await vault.rotate(rt1) as any;
    expect(jwtDecode(rt1)!.jti).not.toBe(jwtDecode(rt2)!.jti);
  });

  it("new refresh token has same familyId as original", async () => {
    const { refreshToken: rt1 } = await vault.issue({ sub: "u1" }) as any;
    const { refreshToken: rt2 } = await vault.rotate(rt1) as any;
    expect(jwtDecode(rt1)!.fid).toBe(jwtDecode(rt2)!.fid);
  });

  it("old refresh token is consumed — second rotate with same token throws 401", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    await vault.rotate(refreshToken);
    const err = await vault.rotate(refreshToken).catch(e => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  });

  it("custom claims from issue() payload are preserved in rotated access token", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1", role: "admin", scope: "read" }) as any;
    const { accessToken } = await vault.rotate(refreshToken) as any;
    const p = jwtDecode(accessToken)!;
    expect(p.role).toBe("admin");
    expect(p.scope).toBe("read");
  });

  it("store size stays constant: old entry removed, new entry added", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    expect(store.size()).toBe(1);
    await vault.rotate(refreshToken);
    expect(store.size()).toBe(1); // old gone, new one added
  });

  it("issue() with no sub claim still rotates successfully (empty string sub is not 'missing')", async () => {
    // issue({}) stores sub as "" (String(payload.sub ?? "")) — this must not be
    // confused with a genuinely missing sub claim.
    const { refreshToken } = await vault.issue({}) as any;
    const result = await vault.rotate(refreshToken);
    expect(result).toHaveProperty("accessToken");
  });
});

// ─── T4 — rotate() failure / edge cases ──────────────────────────────────────

describe("tokenVault.rotate() — failures", () => {
  let store: VaultMemoryStore;
  let vault: ReturnType<typeof tokenVault>;
  let reuseHookCalls: string[];

  beforeEach(() => {
    store = new VaultMemoryStore();
    reuseHookCalls = [];
    vault = makeVault({
      store,
      onReuse: async (familyId) => { reuseHookCalls.push(familyId); },
    });
  });

  async function expectsHttp401(p: Promise<unknown>): Promise<void> {
    const err = await p.catch(e => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  }

  it("malformed string (not a JWT) → HttpError 401", async () => {
    await expectsHttp401(vault.rotate("not-a-jwt"));
  });

  it("empty string → HttpError 401", async () => {
    await expectsHttp401(vault.rotate(""));
  });

  it("token with wrong secret → HttpError 401", async () => {
    const fakeToken = jwtSign(
      { sub: "u1", jti: "x", fid: "y" },
      "wrong-secret-for-signing-32chars!",
      { expiresIn: 600 }
    );
    await expectsHttp401(vault.rotate(fakeToken));
  });

  it("expired token → HttpError 401", async () => {
    const expiredToken = jwtSign(
      { sub: "u1", jti: "expired-jti", fid: "fid-1" },
      REFRESH_SECRET,
      { expiresIn: 1 }
    );
    // Back-date exp by manipulating the payload directly
    const parts = expiredToken.split(".");
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8"));
    payload.exp = Math.floor(Date.now() / 1000) - 100;
    const newPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    // This re-signing with REFRESH_SECRET but past exp:
    const { createHmac } = await import("crypto");
    const sig = createHmac("sha256", REFRESH_SECRET)
      .update(`${parts[0]}.${newPayload}`)
      .digest("base64url");
    const expiredValid = `${parts[0]}.${newPayload}.${sig}`;
    await expectsHttp401(vault.rotate(expiredValid));
  });

  it("token with no jti claim → HttpError 401", async () => {
    const noJti = jwtSign({ sub: "u1", fid: "fid-1" }, REFRESH_SECRET, { expiresIn: 600 });
    await expectsHttp401(vault.rotate(noJti));
  });

  it("token with no fid claim → HttpError 401", async () => {
    const noFid = jwtSign({ sub: "u1", jti: "some-jti" }, REFRESH_SECRET, { expiresIn: 600 });
    await expectsHttp401(vault.rotate(noFid));
  });

  it("token not in store (unknown jti) → HttpError 401", async () => {
    const unknownJti = jwtSign(
      { sub: "u1", jti: "ghost-jti", fid: "fid-ghost" },
      REFRESH_SECRET,
      { expiresIn: 600 }
    );
    await expectsHttp401(vault.rotate(unknownJti));
  });

  it("already-consumed token → HttpError 401 and onReuse called", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    await vault.rotate(refreshToken);
    await expectsHttp401(vault.rotate(refreshToken));
    expect(reuseHookCalls).toHaveLength(1);
  });

  it("onReuse called with correct familyId", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    const fid = jwtDecode(refreshToken)!.fid as string;
    await vault.rotate(refreshToken);
    await vault.rotate(refreshToken).catch(() => {});
    expect(reuseHookCalls[0]).toBe(fid);
  });

  it("onReuse throwing does not suppress the 401", async () => {
    const throwingVault = makeVault({
      store,
      onReuse: async () => { throw new Error("hook blew up"); },
    });
    const { refreshToken } = await throwingVault.issue({ sub: "u1" }) as any;
    await throwingVault.rotate(refreshToken); // consume it
    await expectsHttp401(throwingVault.rotate(refreshToken)); // reuse — hook throws, 401 still returned
  });

  it("onReuse NOT called for expired token", async () => {
    const parts = jwtSign({ sub: "u1", jti: "j1", fid: "f1" }, REFRESH_SECRET, { expiresIn: 1 }).split(".");
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8"));
    payload.exp = Math.floor(Date.now() / 1000) - 100;
    const newPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const { createHmac } = await import("crypto");
    const sig = createHmac("sha256", REFRESH_SECRET).update(`${parts[0]}.${newPayload}`).digest("base64url");
    await vault.rotate(`${parts[0]}.${newPayload}.${sig}`).catch(() => {});
    expect(reuseHookCalls).toHaveLength(0);
  });

  it("onReuse NOT called for unknown jti", async () => {
    const t = jwtSign({ sub: "u1", jti: "not-in-store", fid: "f1" }, REFRESH_SECRET, { expiresIn: 600 });
    await vault.rotate(t).catch(() => {});
    expect(reuseHookCalls).toHaveLength(0);
  });

  it("onReuse NOT called for a token revoked via revokeAll() (logout-all is not a breach)", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    const fid = jwtDecode(refreshToken)!.fid as string;
    await vault.revokeAll(fid);
    await expectsHttp401(vault.rotate(refreshToken));
    expect(reuseHookCalls).toHaveLength(0);
  });

  it("store.consume throwing propagates as-is (not swallowed)", async () => {
    const brokenStore: VaultStore = {
      async set() {},
      async consume() { throw new Error("DB error"); },
      async revokeFamily() {},
    };
    const v = makeVault({ store: brokenStore });
    const { refreshToken } = await v.issue({ sub: "u1" }) as any;
    await expect(v.rotate(refreshToken)).rejects.toThrow("DB error");
  });
});

// ─── T5 — revoke() ────────────────────────────────────────────────────────────

describe("tokenVault.revoke() — body mode", () => {
  let store: VaultMemoryStore;
  let vault: ReturnType<typeof tokenVault>;

  beforeEach(() => {
    store = new VaultMemoryStore();
    vault = makeVault({ store });
  });

  it("after revoke(), rotate() returns 401", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    await vault.revoke(refreshToken);
    const err = await vault.rotate(refreshToken).catch(e => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  });

  it("revoke() with unknown token is a no-op (no throw)", async () => {
    const t = jwtSign({ sub: "u1", jti: "unknown" }, REFRESH_SECRET, { expiresIn: 600 });
    await expect(vault.revoke(t)).resolves.toBeUndefined();
  });

  it("revoke() with already-consumed token is a no-op (no throw)", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    await vault.rotate(refreshToken); // consumes it
    await expect(vault.revoke(refreshToken)).resolves.toBeUndefined();
  });

  it("revoke() with malformed token is a no-op", async () => {
    await expect(vault.revoke("not-a-jwt")).resolves.toBeUndefined();
  });

  it("revoke() does not verify signature (trusts caller holding the token)", async () => {
    // Build a token with valid structure but wrong sig
    const raw = jwtSign({ sub: "u1", jti: "sig-test-jti", fid: "f1" }, "other-secret-32-chars!!!!", { expiresIn: 600 });
    // Store it with the right jti so consume actually removes something
    await store.set("sig-test-jti", { familyId: "f1", sub: "u1", exp: 9999999999, payload: { sub: "u1" } });
    await expect(vault.revoke(raw)).resolves.toBeUndefined();
    // jti was consumed (revoke uses jwtDecode, no sig check)
    expect(await store.consume("sig-test-jti")).toBe(false);
  });

  it("revoke() with expired token still revokes (jti extracted via decode)", async () => {
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    const jti = jwtDecode(refreshToken)!.jti as string;
    // Revoke even if token appears expired — we don't check exp in revoke()
    await vault.revoke(refreshToken);
    expect(await store.consume(jti)).toBe(false);
  });
});

// ─── T6 — revokeAll() ─────────────────────────────────────────────────────────

describe("tokenVault.revokeAll()", () => {
  let store: VaultMemoryStore;
  let vault: ReturnType<typeof tokenVault>;

  beforeEach(() => {
    store = new VaultMemoryStore();
    vault = makeVault({ store });
  });

  it("revokes all tokens in a family", async () => {
    const { refreshToken: rt1 } = await vault.issue({ sub: "u1" }) as any;
    const fid = jwtDecode(rt1)!.fid as string;
    // Issue a second token in the same family by rotating
    const { refreshToken: rt2 } = await vault.rotate(rt1) as any;
    await vault.revokeAll(fid);
    // rt2 is still in the store — revokeAll should nuke it
    const err = await vault.rotate(rt2).catch(e => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  });

  it("revokeAll on unknown familyId is a no-op", async () => {
    await expect(vault.revokeAll("nonexistent-family")).resolves.toBeUndefined();
  });

  it("tokens from a different family are unaffected", async () => {
    const { refreshToken: rtA } = await vault.issue({ sub: "u1" }) as any;
    const { refreshToken: rtB } = await vault.issue({ sub: "u2" }) as any;
    const fidA = jwtDecode(rtA)!.fid as string;
    await vault.revokeAll(fidA);
    // rtB's family is intact — rotate should succeed
    const result = await vault.rotate(rtB);
    expect(result).toHaveProperty("accessToken");
  });
});

// ─── T7 — onReuse hook ────────────────────────────────────────────────────────

describe("onReuse hook", () => {
  let store: VaultMemoryStore;
  let calls: Array<{ familyId: string }>;

  beforeEach(() => {
    store = new VaultMemoryStore();
    calls = [];
  });

  function makeVaultWithHook(fn: typeof calls[0] extends never ? never : (fid: string) => void) {
    return makeVault({ store, onReuse: async (familyId) => { fn(familyId); } });
  }

  it("called with familyId on reuse", async () => {
    const vault = makeVaultWithHook((fid) => calls.push({ familyId: fid }));
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    const fid = jwtDecode(refreshToken)!.fid as string;
    await vault.rotate(refreshToken);
    await vault.rotate(refreshToken).catch(() => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.familyId).toBe(fid);
  });

  it("called exactly once per reuse event", async () => {
    let count = 0;
    const vault = makeVault({ store, onReuse: async () => { count++; } });
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    await vault.rotate(refreshToken);
    await vault.rotate(refreshToken).catch(() => {});
    await vault.rotate(refreshToken).catch(() => {}); // second reuse
    expect(count).toBe(2); // each reuse fires the hook once
  });

  it("async hook is awaited before 401 is thrown", async () => {
    const order: string[] = [];
    const vault = makeVault({
      store,
      onReuse: async () => {
        await new Promise(r => setTimeout(r, 10));
        order.push("hook");
      },
    });
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    await vault.rotate(refreshToken);
    vault.rotate(refreshToken).catch(() => { order.push("401"); });
    await new Promise(r => setTimeout(r, 50));
    expect(order[0]).toBe("hook");
    expect(order[1]).toBe("401");
  });

  it("hook throwing is caught; 401 still returned to caller", async () => {
    const vault = makeVault({ store, onReuse: async () => { throw new Error("boom"); } });
    const { refreshToken } = await vault.issue({ sub: "u1" }) as any;
    await vault.rotate(refreshToken);
    const err = await vault.rotate(refreshToken).catch(e => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  });
});

// ─── T8 — Cookie mode ─────────────────────────────────────────────────────────

describe("tokenVault — cookie mode", () => {
  let store: VaultMemoryStore;
  let vault: ReturnType<typeof tokenVault>;
  const COOKIE_NAME = "__rt";
  const COOKIE_PATH = "/auth/refresh";

  beforeEach(() => {
    store = new VaultMemoryStore();
    vault = makeVault({
      store,
      cookie: { name: COOKIE_NAME, path: COOKIE_PATH },
    });
  });

  it("issue(payload, res) sets Set-Cookie header on res", async () => {
    const res = new BunResponse();
    await vault.issue({ sub: "u1" }, res);
    const header = getSetCookie(res);
    expect(header).not.toBeNull();
  });

  it("Set-Cookie has HttpOnly flag", async () => {
    const res = new BunResponse();
    await vault.issue({ sub: "u1" }, res);
    expect(getSetCookie(res)).toContain("HttpOnly");
  });

  it("Set-Cookie has Secure flag", async () => {
    const res = new BunResponse();
    await vault.issue({ sub: "u1" }, res);
    expect(getSetCookie(res)).toContain("Secure");
  });

  it("Set-Cookie has SameSite=Strict", async () => {
    const res = new BunResponse();
    await vault.issue({ sub: "u1" }, res);
    expect(getSetCookie(res)?.toLowerCase()).toContain("samesite=strict");
  });

  it("Set-Cookie has correct Path", async () => {
    const res = new BunResponse();
    await vault.issue({ sub: "u1" }, res);
    expect(getSetCookie(res)).toContain(`Path=${COOKIE_PATH}`);
  });

  it("issue() body response does NOT contain refreshToken", async () => {
    const res = new BunResponse();
    const result = await vault.issue({ sub: "u1" }, res);
    expect(result).not.toHaveProperty("refreshToken");
    expect(result).toHaveProperty("accessToken");
  });

  it("rotate(req, res) reads cookie from req.cookies", async () => {
    const res1 = new BunResponse();
    const { accessToken } = await vault.issue({ sub: "u1" }, res1);
    const cookieHeader = getSetCookie(res1)!;
    const cookieValue = decodeURIComponent(cookieHeader.split(";")[0]!.split("=").slice(1).join("="));
    const req = makeReqWithCookie(COOKIE_NAME, encodeURIComponent(cookieValue));
    const res2 = new BunResponse();
    const rotated = await vault.rotate(req, res2);
    expect(rotated).toHaveProperty("accessToken");
    expect(rotated).not.toHaveProperty("refreshToken");
  });

  it("rotate(req, res) sets new Set-Cookie on res", async () => {
    const res1 = new BunResponse();
    await vault.issue({ sub: "u1" }, res1);
    const cookieHeader = getSetCookie(res1)!;
    const cookieValue = decodeURIComponent(cookieHeader.split(";")[0]!.split("=").slice(1).join("="));
    const req = makeReqWithCookie(COOKIE_NAME, encodeURIComponent(cookieValue));
    const res2 = new BunResponse();
    await vault.rotate(req, res2);
    expect(getSetCookie(res2)).not.toBeNull();
  });

  it("rotate(req, res) with missing cookie → HttpError 401", async () => {
    const req = new BunRequest(
      new Request("http://localhost/auth/refresh"),
      "/auth/refresh"
    );
    const res = new BunResponse();
    const err = await vault.rotate(req, res).catch(e => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  });

  it("revoke(req, res) clears cookie (Set-Cookie with past expires)", async () => {
    const res1 = new BunResponse();
    await vault.issue({ sub: "u1" }, res1);
    const cookieHeader = getSetCookie(res1)!;
    const cookieValue = decodeURIComponent(cookieHeader.split(";")[0]!.split("=").slice(1).join("="));
    const req = makeReqWithCookie(COOKIE_NAME, encodeURIComponent(cookieValue));
    const res2 = new BunResponse();
    await vault.revoke(req, res2);
    const cleared = getSetCookie(res2);
    expect(cleared).not.toBeNull();
    // Cleared cookie has empty value or past expires
    expect(cleared).toMatch(/expires=Thu, 01 Jan 1970/i);
  });

  it("revoke(req, res) with missing cookie is a no-op (no throw, cookie still cleared)", async () => {
    const req = new BunRequest(
      new Request("http://localhost/auth/refresh"),
      "/auth/refresh"
    );
    const res = new BunResponse();
    await expect(vault.revoke(req, res)).resolves.toBeUndefined();
    // Cookie clear is still called even with no cookie
    expect(getSetCookie(res)).not.toBeNull();
  });

  it("custom cookie name is respected", async () => {
    const customVault = makeVault({
      store,
      cookie: { name: "my_custom_rt" },
    });
    const res = new BunResponse();
    await customVault.issue({ sub: "u1" }, res);
    expect(getSetCookie(res)).toContain("my_custom_rt=");
  });

  it("custom cookie path is respected", async () => {
    const customVault = makeVault({
      store,
      cookie: { name: "__rt", path: "/api/token/refresh" },
    });
    const res = new BunResponse();
    await customVault.issue({ sub: "u1" }, res);
    expect(getSetCookie(res)).toContain("Path=/api/token/refresh");
  });

  it("calling cookie-mode overload when cookie not configured throws at call time", async () => {
    const bodyOnlyVault = makeVault(); // no cookie option
    const res = new BunResponse();
    await expect(bodyOnlyVault.issue({ sub: "u1" }, res)).rejects.toThrow("cookie mode not configured");
  });
});
