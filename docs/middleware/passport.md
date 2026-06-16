---
title: Passport Authentication
description: Use the real passport.js strategies and ecosystem with bunWay via passportInitialize/passportSession/passportAuthenticate adapters.
---

# Passport Authentication

bunWay doesn't reimplement Passport — it adapts the real [`passport`](https://www.npmjs.com/package/passport) package (and any Passport strategy, like `passport-local`) to run on top of bunWay's request/response objects. You bring your own `passport` instance and strategies; bunWay provides the three middleware functions that wire them into the request pipeline.

::: tip Coming from Express?
`passportInitialize`/`passportSession`/`passportAuthenticate` are bunWay's equivalents of `passport.initialize()`/`passport.session()`/`passport.authenticate()`. They take a `passport` instance as their first argument instead of being methods on it — `bunway` does not export a callable `passport()` factory.
:::

## Quick Start

```ts
import { bunway, passportInitialize, passportAuthenticate, session } from 'bunway';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

passport.use(new LocalStrategy((username, password, done) => {
  const user = findUser(username);
  if (!user || user.password !== password) return done(null, false);
  done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, findUserById(id)));

const app = bunway();
app.use(bunway.json());
app.use(passportInitialize(passport));

app.post('/login',
  passportAuthenticate(passport, 'local', { session: false }),
  (req, res) => res.json({ id: req.user?.id })
);

app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ id: req.user?.id });
});
```

## Setup Order

`passportInitialize()` must be applied before `passportAuthenticate()` — it sets up the internal state (`req._passport`) that `passportAuthenticate()` requires. Calling `passportAuthenticate()` without it first throws and passes the error to `next()`:

```
passportAuthenticate(): passportInitialize() middleware must be applied before authenticate().
Add app.use(bunway.passportInitialize(passport)) before your route handlers.
```

If you're using session-based (rather than stateless) authentication, mount [`session()`](./session) and `passportSession()` before any route that needs `req.user` restored from a previous login — `passportSession()` reads `req.session.passport.user` and calls `passport.deserializeUser()` to populate `req.user`:

```ts
app.use(bunway.cookieParser());
app.use(session({ secret: process.env.SESSION_SECRET! }));
app.use(passportInitialize(passport));
app.use(passportSession(passport));
```

The conventional order is: `passportInitialize` → `passportSession` → your routes (with `passportAuthenticate` on the specific login route). `session()` must come before both, since `passportSession()` and `req.login()`'s session-save path both read/write `req.session`.

## `passportInitialize(passportInstance)`

Adapts the request/response objects so Passport's internals (which expect a Node.js-style `req`/`res`) work against bunWay's `BunRequest`/`BunResponse`. Specifically, it:

- Proxies `req.headers` so case-insensitive header lookups (`req.headers['content-type']` or `req.headers['Content-Type']`) work the way Passport strategies expect
- Sets `req.connection`/`req.socket` shims exposing `remoteAddress` and `encrypted`
- Adds `res.setHeader()`, `res.writeHead()`, and a writable `res.statusCode` to `res`
- Adds `req.login()` / `req.logIn()` (aliases of each other)
- Adds `req.logout()` / `req.logOut()` (aliases of each other)
- Adds `req.isAuthenticated()` and `req.isUnauthenticated()`

## `passportSession(passportInstance)`

Restores `req.user` from a previously-saved session on each request. If `req.session` doesn't exist (no `session()` middleware mounted) or has no stored Passport user, it calls `next()` without doing anything. If `passport.deserializeUser()` fails or the stored data is invalid, `req.user` is set to `undefined` and the request proceeds as unauthenticated rather than erroring — a broken session entry degrades to "logged out," not a `500`.

## `passportAuthenticate(passportInstance, strategy, options?)`

Runs one (or, given an array, the first matching) registered strategy by name. On success, Passport's strategy calls `req.login()` internally (saving to session unless `{ session: false }`) and the route handler runs. On failure, Passport responds directly (typically `401`) without calling `next()` — `passportAuthenticate()` detects this and resolves the pipeline either way, so you don't need extra glue code:

```ts
app.post('/login', passportAuthenticate(passport, 'local', { session: false }), (req, res) => {
  res.json({ id: req.user?.id });
});
```

Pass `{ failWithError: true }` to have authentication failures flow through `next(err)` instead of Passport's default direct response, so you can handle them with [`errorHandler()`](./error-handler) or custom error middleware.

For manual control over the success/failure callback (mirroring Express's `passport.authenticate(strategy, options, callback)` form), call the strategy function returned by `passportInstance.authenticate()` directly inside your own handler:

```ts
app.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message ?? 'Unauthorized' });
    res.json({ id: user.id });
  })(req, res, next);
});
```

## `req.login()` / `req.logout()`

```ts
req.login(user: AuthUser, options?: { session?: boolean }): Promise<void>;
req.login(user: AuthUser, callback: (err?: unknown) => void): Promise<void>;
req.login(user: AuthUser, options: { session?: boolean }, callback: (err?: unknown) => void): Promise<void>;

req.logout(options?: { keepSessionInfo?: boolean }): Promise<void>;
req.logout(callback: (err?: unknown) => void): Promise<void>;
```

`req.login()` sets `req.user`/`req.auth` and, unless `{ session: false }` is passed, serializes the user into `req.session.passport.user` via `passport.serializeUser()` and saves the session. `req.logout()` clears `req.user`/`req.auth` and removes `req.session.passport` if present.

Both return a Promise and also accept an optional Node-style `(err?) => void` callback for drop-in compatibility with Express Passport code — call whichever form fits your code.

::: warning `keepSessionInfo` is a no-op
`req.logout()`'s `keepSessionInfo` option is accepted for Express API compatibility but is not read anywhere — session data outside of `req.session.passport` is never specially preserved or cleared based on this flag.
:::

## `req.isAuthenticated()` / `req.isUnauthenticated()`

Both are added by `passportInitialize()`. `req.isAuthenticated()` returns `true` whenever `req.user` is set (by login, by `passportSession()` restoring it, or by any other middleware such as [`jwt()`](./jwt)); `req.isUnauthenticated()` is its inverse.

## Related

- [JWT Authentication](./jwt) — stateless Bearer-token auth as an alternative to session-based Passport login
- [Session](./session) — required for session-based (non-`{ session: false }`) Passport flows
- [Token Vault](./token-vault) — refresh-token rotation, often paired with Passport's initial login step
