---
title: Token Vault
description: Access/refresh token issuance with rotation and reuse detection for bunWay — body or httpOnly-cookie refresh tokens, zero dependencies.
---

# Token Vault

`tokenVault()` issues short-lived access tokens and long-lived refresh tokens, and rotates the refresh token on every use — detecting reuse of a stolen or replayed refresh token. It's not Express middleware in the `(req, res, next)` sense; it returns a small `TokenVault` object with `issue()`/`rotate()`/`revoke()`/`revokeAll()` methods that you call from your own auth routes.

## Quick Start

```ts
import { bunway, tokenVault } from 'bunway';

const vault = tokenVault({
  accessSecret:     process.env.ACCESS_SECRET!,   // >= 32 characters
  refreshSecret:     process.env.REFRESH_SECRET!,  // >= 32 characters
  accessExpiresIn:  900,      // 15 minutes
  refreshExpiresIn: 604800,   // 7 days
});

const app = bunway();
app.use(bunway.json());

app.post('/auth/login', async (req, res) => {
  // ...verify credentials...
  const pair = await vault.issue({ sub: 'alice', role: 'admin' });
  res.json(pair); // { accessToken, refreshToken }
});

app.post('/auth/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    res.json(await vault.rotate(refreshToken));
  } catch (err) { next(err); }
});

app.post('/auth/logout', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken: string };
  await vault.revoke(refreshToken);
  res.json({ ok: true });
});
```

Access tokens issued by `tokenVault()` are standard HS256 JWTs — verify them with [`jwt()`](./jwt) using the same `accessSecret`:

```ts
app.get('/api/profile', jwt({ secret: process.env.ACCESS_SECRET! }), (req, res) => {
  res.json({ sub: req.user?.sub });
});
```

## Options

```ts
interface TokenVaultOptions {
  accessSecret: string;    // Required, >= 32 characters
  refreshSecret: string;   // Required, >= 32 characters — should differ from accessSecret
  accessExpiresIn: number;   // Access token lifetime in seconds (e.g. 900 = 15 min)
  refreshExpiresIn: number;  // Refresh token lifetime in seconds (e.g. 604800 = 7 days)
  store?: VaultStore;         // Custom store (default: new VaultMemoryStore())
  cookie?: {
    name: string;                              // Required if `cookie` is set
    httpOnly?: boolean;                        // default: true
    secure?: boolean;                          // default: true
    sameSite?: 'strict' | 'lax' | 'none';      // default: 'strict'
    path?: string;                             // default: '/auth/refresh'
    domain?: string;
  };
  onReuse?: (familyId: string, req?: BunRequest) => Promise<void> | void;
}
```

`tokenVault()` throws synchronously at creation time if `accessSecret`/`refreshSecret` are missing or under 32 characters, or if `cookie` is provided without a `name`. The two secrets are not checked against each other — using the same value for both is allowed but not recommended.

If `cookie` is omitted, **cookie mode is disabled** entirely: calling `issue()`/`rotate()`/`revoke()` with a `res`/`req` argument throws, since there's no cookie configuration to write to.

## Body Mode vs. Cookie Mode

Each method is overloaded for two calling conventions:

```ts
// Body mode — caller stores and sends back the refresh token explicitly
issue(payload): Promise<{ accessToken, refreshToken }>
rotate(token): Promise<{ accessToken, refreshToken }>
revoke(token): Promise<void>

// Cookie mode — vault manages the refresh token as an httpOnly cookie
issue(payload, res): Promise<{ accessToken }>
rotate(req, res): Promise<{ accessToken }>
revoke(req, res): Promise<void>
```

In cookie mode, the refresh token never appears in a JSON response body — `issue()`/`rotate()` write it directly via `res.cookie()` and only return `{ accessToken }`. `rotate()`/`revoke()` read the refresh token from `req.cookies[cookie.name]`; a missing cookie throws `HttpError(401, "Missing refresh token cookie")`. `revoke()` in cookie mode clears the cookie on `res` even if the token turns out to be missing or malformed.

`revokeAll(familyId)` has no body/cookie distinction — it always takes the family ID directly (see Rotation & Reuse Detection below for where that ID comes from).

## Rotation & Reuse Detection

Every refresh token carries a unique `jti` and a `familyId` (`fid`) shared across the whole rotation chain. `rotate()`:

1. Verifies the refresh token's signature and expiry
2. Calls `store.consume(jti)`, which atomically marks that `jti` as used
3. If the `jti` was **already** consumed, this is treated as **reuse** — `onReuse(familyId, req)` fires (errors from the hook are swallowed) and `rotate()` throws `HttpError(401, "Refresh token already used")`
4. If the `jti` is unknown or was wiped by `revokeAll()`, `rotate()` throws `HttpError(401, "Refresh token not found or revoked")`
5. Otherwise, a new access/refresh token pair is issued, the new refresh token's `jti` is stored under the **same** `familyId`, and the old entry stays consumed

This makes `rotate()` single-use per refresh token: rotating a token, then trying to rotate the same token again, always fails — which is exactly the signal that distinguishes a legitimate client racing for a new token from an attacker replaying a stolen one. `onReuse` is the place to react to a real breach, e.g. by calling `vault.revokeAll(familyId)` to invalidate every token in the family.

`rotate()` throws a distinct `HttpError(401, ...)` for each of: missing/invalid token, expired token, bad signature, missing `jti`/`fid`/`sub` claims, already-used token, and unknown/revoked token — all surfaced the same way via `next(err)` if you `await` it inside a try/catch and forward the error.

`revoke()` is intentionally more lenient than `rotate()`: it's a no-op (not an error) on a missing token, a malformed token, or a token with no `jti` — revocation is meant to be safely callable from a logout handler without needing to validate the token first.

Access tokens are not individually revocable — they're stateless JWTs valid until `accessExpiresIn` elapses, even after the corresponding refresh token has been revoked. Keep `accessExpiresIn` short if you need fast-acting revocation.

## `revokeAll(familyId)`

Revokes every refresh token in a family — use this for "log out of all devices" or as a breach response from inside `onReuse`:

```ts
const vault = tokenVault({
  accessSecret: ACCESS_SECRET,
  refreshSecret: REFRESH_SECRET,
  accessExpiresIn: 900,
  refreshExpiresIn: 604800,
  onReuse: async (familyId) => {
    await vault.revokeAll(familyId);
  },
});
```

The family ID is available on the access token payload (it's included automatically as `fid` whenever you pass it through your own `payload` to `issue()`), so a "log out everywhere" route can read it straight from `req.user` after verifying the access token with `jwt()`.

## `VaultMemoryStore`

The default `store` if none is provided. Keeps tokens in memory with a background sweep that runs every 60 seconds to garbage-collect expired entries.

```ts
import { VaultMemoryStore } from 'bunway';

const store = new VaultMemoryStore();
const vault = tokenVault({ accessSecret, refreshSecret, accessExpiresIn: 900, refreshExpiresIn: 604800, store });
```

::: warning Call `.dispose()` to stop the background sweep
`VaultMemoryStore`'s constructor starts a `setInterval` GC loop immediately. If you create a `VaultMemoryStore` per-test or per-request-scope (rather than once at app startup), call `store.dispose()` when you're done with it to clear the interval — otherwise it keeps running (and, in tests, can keep the process alive) for as long as the timer would naturally continue firing.
:::

Like memory-backed stores elsewhere in bunWay, `VaultMemoryStore` is not suitable for production across multiple server instances — tokens issued on one instance won't be visible for rotation/revocation on another. Implement `VaultStore` against Redis or a database for production deployments.

## Custom `VaultStore`

```ts
interface VaultStore {
  set(jti: string, entry: VaultEntry): Promise<void>;
  // Returns the entry on first use, null if unknown/revoked, false if already consumed (reuse signal)
  consume(jti: string): Promise<VaultEntry | null | false>;
  revokeFamily(familyId: string): Promise<void>;
}

interface VaultEntry {
  familyId: string;
  sub: string;
  exp: number;
  payload: Record<string, unknown>; // replayed into the access token on rotate()
}
```

`consume()` must be atomic — it is the mechanism that turns a race between two simultaneous refresh requests with the same token into "one wins, one gets reuse-detected" rather than both succeeding.

## Related

- [JWT Authentication](./jwt) — verify the access tokens `tokenVault()` issues
- [Passport](./passport) — often paired for the initial login step before issuing a token pair
- [Cookie Parser](./cookies) — required to read `req.cookies` when using `cookie` mode
