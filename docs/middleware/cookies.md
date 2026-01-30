---
title: Cookie Middleware
description: Parse and sign cookies like cookie-parser with bunWay.
---

# Cookie Middleware

Parse cookies from requests and sign/verify them for security.

## Quick Start

```ts
import { bunway, cookieParser } from 'bunway';

const app = bunway();

app.use(cookieParser());

app.get('/preferences', (req, res) => {
  const theme = req.cookies.theme || 'light';
  res.json({ theme });
});

app.post('/preferences', (req, res) => {
  res.cookie('theme', 'dark', { maxAge: 86400 });
  res.json({ saved: true });
});

app.listen(3000);
```

## Reading Cookies

Cookies are available on `req.cookies`:

```ts
app.get('/user', (req, res) => {
  const sessionId = req.cookies.sessionId;
  const preferences = req.cookies.preferences;

  res.json({ sessionId, preferences });
});
```

## Setting Cookies

Use `res.cookie()` to set cookies:

```ts
app.post('/login', (req, res) => {
  res.cookie('token', 'abc123', {
    maxAge: 86400,        // 1 day in seconds
    httpOnly: true,       // Not accessible via JavaScript
    secure: true,         // HTTPS only
    sameSite: 'strict',   // CSRF protection
    path: '/'             // Available on all paths
  });

  res.json({ loggedIn: true });
});
```

### Cookie Options

```ts
interface CookieOptions {
  maxAge?: number;      // Lifetime in seconds
  expires?: Date;       // Expiration date
  httpOnly?: boolean;   // HTTP only (default: false)
  secure?: boolean;     // HTTPS only (default: false)
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;        // Cookie path (default: '/')
  domain?: string;      // Cookie domain
}
```

## Signed Cookies

Sign cookies to detect tampering:

```ts
import { cookieParser } from 'bunway';

app.use(cookieParser({ secret: 'my-secret-key' }));
```

### Setting Signed Cookies

```ts
app.post('/login', (req, res) => {
  res.cookie('userId', '12345', { signed: true });
  res.json({ success: true });
});
```

### Reading Signed Cookies

Signed cookies are in `req.signedCookies`:

```ts
app.get('/profile', (req, res) => {
  // Unsigned cookies
  console.log(req.cookies);

  // Signed and verified cookies
  console.log(req.signedCookies);

  const userId = req.signedCookies.userId;
  res.json({ userId });
});
```

If a signed cookie has been tampered with, it won't appear in `signedCookies`.

### Multiple Secrets

Rotate secrets without invalidating existing cookies:

```ts
app.use(cookieParser({
  secret: ['new-secret', 'old-secret']  // First is used for signing
}));
```

## Clearing Cookies

```ts
app.post('/logout', (req, res) => {
  res.cookie('token', '', { maxAge: 0 });
  // Or use clearCookie if available
  res.json({ loggedOut: true });
});
```

## Examples

### Remember Me

```ts
app.post('/login', (req, res) => {
  const { username, password, rememberMe } = req.body;

  const maxAge = rememberMe
    ? 30 * 24 * 60 * 60  // 30 days
    : 24 * 60 * 60;      // 1 day

  res.cookie('session', sessionToken, {
    maxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  res.json({ success: true });
});
```

### User Preferences

```ts
app.get('/api/preferences', (req, res) => {
  res.json({
    theme: req.cookies.theme || 'light',
    language: req.cookies.language || 'en',
    fontSize: req.cookies.fontSize || 'medium'
  });
});

app.post('/api/preferences', (req, res) => {
  const { theme, language, fontSize } = req.body;

  const options = { maxAge: 365 * 24 * 60 * 60, path: '/' };

  if (theme) res.cookie('theme', theme, options);
  if (language) res.cookie('language', language, options);
  if (fontSize) res.cookie('fontSize', fontSize, options);

  res.json({ saved: true });
});
```

### Secure Cookie Configuration

```ts
const isProduction = process.env.NODE_ENV === 'production';

app.post('/login', (req, res) => {
  res.cookie('auth', token, {
    maxAge: 86400,
    httpOnly: true,          // Always
    secure: isProduction,    // HTTPS in production
    sameSite: 'strict',      // CSRF protection
    path: '/',
    // domain: '.example.com' // For subdomains
  });
});
```

## Cookie Signing Utilities

Import signing functions directly:

```ts
import { signCookie, unsignCookie } from 'bunway';

const signed = signCookie('value', 'secret');
const original = unsignCookie(signed, 'secret');
// original === 'value' or false if tampered
```

## Migration from cookie-parser

The API is identical:

```js
// Express
const cookieParser = require('cookie-parser');
app.use(cookieParser('my-secret'));

// bunWay
import { cookieParser } from 'bunway';
app.use(cookieParser({ secret: 'my-secret' }));
```

Same behavior. Just faster.
