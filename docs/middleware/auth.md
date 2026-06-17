---
title: Authentication Overview
description: Choosing between bunWay's built-in authentication middleware — jwt(), passport adapters, and tokenVault() — and how they compose.
---

# Authentication

bunWay ships three building blocks for authentication, each solving a different part of the problem. They're independent — pick the one(s) your app needs — but they're also designed to compose.

| Middleware | Use it when... |
|---|---|
| [JWT](./jwt) | You want stateless Bearer-token auth for an API — verify tokens issued by your own server or a third-party identity provider (Auth0, Cognito, etc.) via JWKS. |
| [Passport](./passport) | You want the real `passport` npm package's strategy ecosystem (local login, OAuth providers, etc.) and/or session-based login. |
| [Token Vault](./token-vault) | You're issuing your own access/refresh token pairs and want rotation with reuse detection (breach-resistant "remember me" / long-lived sessions). |

## How they compose

**JWT + Token Vault** — the most common pairing for a stateless API: `tokenVault()` issues access tokens that are themselves verified by [`jwt()`](./jwt) on protected routes, plus a rotating refresh token to get new access tokens without re-authenticating.

```ts
import { bunway, jwt, tokenVault } from "bunway";

const vault = tokenVault({
  accessSecret: process.env.ACCESS_SECRET!,
  refreshSecret: process.env.REFRESH_SECRET!,
  accessExpiresIn: 900,
  refreshExpiresIn: 604800,
});

app.post("/auth/login", async (req, res) => {
  // ...verify credentials...
  res.json(await vault.issue({ sub: "alice" }));
});

app.use("/api", jwt({ secret: process.env.ACCESS_SECRET! }));
```

**Passport + JWT/CSRF** — Passport handles the login strategy (e.g. `passport-local`), while `jwt()` or [`csrf()`](./csrf) protect subsequent API routes. Passport and JWT can run side by side in the same app on different routes — they don't conflict, since both just populate `req.user`/`req.auth`.

**Passport with sessions** — for traditional server-rendered login flows, pair Passport with [`session()`](./session): `session()` → `passportInitialize()` → `passportSession()`, in that order, so `req.user` is restored from the session on every request. `session()` must come first because both `passportSession()` and `req.login()` read and write `req.session`. See the [setup order](./passport#setup-order) note on the Passport page.

## Related

- [JWT](./jwt) — `jwt()`, `jwtSign()`, `jwtDecode()`
- [Passport](./passport) — `passportInitialize()`, `passportSession()`, `passportAuthenticate()`
- [Token Vault](./token-vault) — `tokenVault()`, `VaultMemoryStore`
- [Session](./session) — required for session-based Passport flows
- [CSRF Protection](./csrf) — pair with any of the above for state-changing routes
