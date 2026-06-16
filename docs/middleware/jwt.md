---
title: JWT Authentication
description: Verify Bearer JWTs with HMAC secrets or a remote JWKS endpoint, gate routes by role/scope, and sign/decode tokens — zero dependencies.
---

# JWT Authentication

`jwt()` verifies JSON Web Tokens sent as `Authorization: Bearer <token>` headers. It supports HMAC secrets, asymmetric keys, and remote JWKS endpoints, plus optional role/scope gating. `jwtSign()` and `jwtDecode()` are standalone helpers for issuing and reading tokens without going through the middleware.

::: tip Coming from Express?
Replaces `express-jwt`. Same Bearer-token model — verified claims land on `req.user` (and `req.auth`, an `express-jwt`-compatible alias).
:::

## Quick Start

```ts
import { bunway, jwt, jwtSign } from 'bunway';

const app = bunway();

const SECRET = process.env.JWT_SECRET!; // must be a strong, private value

app.post('/login', (req, res) => {
  // ...verify credentials...
  const token = jwtSign({ sub: 'alice', role: 'admin' }, SECRET, { expiresIn: 3600 });
  res.json({ token });
});

app.use('/api', jwt({ secret: SECRET }));

app.get('/api/profile', (req, res) => {
  res.json({ sub: req.user?.sub });
});
```

## How It Works

1. `jwt()` reads the token from the `Authorization: Bearer <token>` header by default (override with `getToken`)
2. The token's header, payload, and signature are decoded and the signature is verified against `secret` (HMAC/asymmetric) or a key fetched from `jwksUri`
3. Standard claims (`exp`, `nbf`, `issuer`, `audience`) are validated
4. If configured, `isRevoked`, `role`, and `scope` checks run against the verified payload
5. The verified payload (or the result of `onVerified`) is assigned to `req.user` (or `req[requestProperty]`) and `req.auth`

If no token is present and `credentialsRequired` is `true` (the default), the request is rejected with `401` before any verification runs.

## Options

```ts
interface JwtOptions {
  secret?: string | Buffer | ((header: JwtHeader) => Promise<string | Buffer>);
  jwksUri?: string;                 // Remote JWKS endpoint — alternative to `secret`
  jwksCacheTtl?: number;            // JWKS cache lifetime in ms (default: 600000 = 10 min)
  algorithms?: JwtAlgorithm[];      // Accepted algorithms (default: ['HS256'])
  audience?: string | string[];     // Required `aud` claim value(s)
  issuer?: string | string[];       // Required `iss` claim value(s)
  credentialsRequired?: boolean;    // Reject requests with no token (default: true)
  getToken?: (req: BunRequest) => string | undefined; // Custom token extraction
  isRevoked?: (payload: JwtPayload, token: string) => Promise<boolean>;
  onVerified?: (payload: JwtPayload, req: BunRequest) => Promise<AuthUser> | AuthUser;
  role?: string | string[];         // Required role(s) — see Role Gating
  scope?: string | string[];        // Required scope(s) — see Scope Gating
  roleField?: string;               // Payload field to read roles from (default: 'role' or 'roles')
  scopeField?: string;              // Payload field to read scopes from (default: 'scope' or 'scopes')
  requestProperty?: string;         // Where to attach the verified payload (default: 'user')
}
```

Exactly one of `secret` or `jwksUri` must be provided — `jwt()` throws synchronously at middleware-creation time if both are missing.

`secret` can be a string, a `Buffer`, or an async function `(header) => secret`, letting you select a key per-token (e.g. by inspecting `header.kid`) without a full JWKS setup.

## HS-Secret Setup

The simplest setup uses a single shared HMAC secret. This is the only mode `jwtSign()` supports, so it pairs naturally with tokens your own server issues:

```ts
app.use(jwt({ secret: process.env.JWT_SECRET! }));
```

## JWKS / Asymmetric Setup

For tokens issued by a third-party identity provider (Auth0, Cognito, Okta, etc.), point `jwt()` at the provider's JWKS endpoint instead of a shared secret:

```ts
app.use(jwt({
  jwksUri: 'https://your-tenant.auth0.com/.well-known/jwks.json',
  algorithms: ['RS256'],
  audience: 'https://api.example.com',
  issuer: 'https://your-tenant.auth0.com/',
}));
```

Keys are fetched lazily on first use and cached in memory, keyed by `jwksUri`, for `jwksCacheTtl` milliseconds (default 10 minutes). The token's header must include a `kid` (key ID) so `jwt()` can pick the matching key out of the JWKS response — tokens without a `kid` are rejected with `401`.

Supported asymmetric algorithms are `RS256`/`RS384`/`RS512`, `ES256`/`ES384`/`ES512`, and `PS256`/`PS384`/`PS512` (RSA-PSS, using a salt length equal to the hash output size per RFC 7518 §3.5) — for both JWKS-based and PEM-`secret`-based verification.

## Role Gating

Require a specific role (or one of several) on the verified payload before allowing the request through:

```ts
app.get('/admin/dashboard',
  jwt({ secret: SECRET, role: 'admin' }),
  (req, res) => res.json({ ok: true })
);
```

By default, roles are read from the payload's `role` or `roles` field (string or array of strings). Use `roleField` to read from a custom claim. A mismatch returns `403` (the token is valid — the caller just lacks permission), as opposed to `401` for invalid/missing tokens.

## Scope Gating

Require all of a set of scopes (space-separated string or array) on the verified payload:

```ts
app.get('/api/orders',
  jwt({ secret: SECRET, scope: ['read', 'write'] }),
  (req, res) => res.json({ orders: [] })
);
```

Scopes are read from `scope` or `scopes` by default; use `scopeField` to read from a custom claim. Unlike role gating (any-of), scope gating requires **every** listed scope to be present, and also returns `403` on failure.

## Revocation

`isRevoked` is checked after signature and claim validation succeed, letting you maintain a deny-list (e.g. for logged-out tokens) without re-verifying the signature on every check:

```ts
const revokedTokens = new Set<string>();

app.use(jwt({
  secret: SECRET,
  isRevoked: async (payload, token) => revokedTokens.has(token),
}));

app.post('/auth/logout', (req, res) => {
  const token = req.get('authorization')?.slice(7);
  if (token) revokedTokens.add(token);
  res.json({ ok: true });
});
```

## `jwtSign(payload, secret, options?)`

Signs an HS256/HS384/HS512 token. This is a standalone helper — it has no dependency on the `jwt()` middleware and can be used anywhere you need to issue a token (login routes, tests, etc.).

```ts
function jwtSign(
  payload: JwtPayload,
  secret: string | Buffer,
  options?: {
    algorithm?: 'HS256' | 'HS384' | 'HS512'; // default: 'HS256'
    expiresIn?: number;   // seconds from now, sets `exp`
    issuer?: string;      // sets `iss`
    audience?: string;    // sets `aud`
    subject?: string;     // sets `sub`
  }
): string
```

`iat` is always set to the current time. Fields in `payload` take precedence over the `issuer`/`audience`/`subject`/`expiresIn` shorthand options if both are supplied.

## `jwtDecode(token)`

Decodes a token's payload **without verifying its signature**. Use this only when you already trust the bearer of the token (e.g. reading claims out of your own previously-verified token) — never use it as a substitute for `jwt()` on untrusted input.

```ts
function jwtDecode(token: string): JwtPayload | null
```

Returns `null` if the token isn't well-formed (not three base64url segments, or invalid JSON in header/payload).

## Error Responses

| Condition | Status | Notes |
|---|---|---|
| No token, `credentialsRequired: true` | 401 | Includes `WWW-Authenticate: Bearer realm="api"` header |
| No token, `credentialsRequired: false` | — | Request proceeds; `req.user` is left unset |
| Malformed token (not 3 segments / bad JSON) | 401 | |
| Algorithm not in `algorithms` list | 401 | |
| Missing/unknown `kid` (JWKS mode) | 401 | |
| Invalid signature | 401 | |
| Expired (`exp`) / not-yet-valid (`nbf`) / bad `iss`/`aud` | 401 | |
| `isRevoked` returns `true` | 401 | |
| Role/scope check fails | 403 | Token is valid; caller lacks permission |
| Unexpected error during verification | 401 | Wrapped as `Token verification failed` |

## Related

- [Token Vault](./token-vault) — access/refresh token rotation built on the same JWT primitives
- [Passport](./passport) — session/strategy-based authentication
- [CSRF Protection](./csrf) — pair with `jwt()` for state-changing API routes
