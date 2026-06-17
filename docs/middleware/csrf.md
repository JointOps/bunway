---
title: CSRF Protection
description: Protect bunWay apps against Cross-Site Request Forgery attacks using the built-in double-submit cookie pattern — zero dependencies.
---

# CSRF Protection

`csrf()` protects against Cross-Site Request Forgery attacks using the double-submit cookie pattern. Every state-changing request must include a valid token — no external packages required.

::: tip Coming from Express?
Replaces `csurf`. Same concept, same token flow — `req.csrfToken()` works identically.
:::

## Quick Start

```ts
import { bunway, csrf, cookieParser } from 'bunway';

const app = bunway();
app.use(cookieParser());
app.use(csrf({ secret: process.env.CSRF_SECRET! }));

app.get('/form', (req, res) => {
  res.html(`
    <form method="POST" action="/submit">
      <input type="hidden" name="_csrf" value="${req.csrfToken()}">
      <button type="submit">Submit</button>
    </form>
  `);
});

app.post('/submit', (req, res) => {
  res.json({ success: true });
});
```

## How It Works

1. On the first request, CSRF middleware generates a random token and stores it in a cookie
2. Your app embeds the token in each form as a hidden `_csrf` field, or passes it in the `x-csrf-token` header for API requests
3. On POST/PUT/DELETE, the middleware reads both the cookie and the submitted token and rejects the request if they don't match
4. Since cross-origin pages cannot read your cookies, an attacker cannot forge a valid token pair

## API Usage

For single-page apps and REST clients, fetch the token via a dedicated endpoint:

```ts
// Server — expose the token
app.get('/api/csrf-token', (req, res) => {
  res.json({ token: req.csrfToken() });
});

// Client — include in subsequent requests
const { token } = await fetch('/api/csrf-token').then(r => r.json());

await fetch('/api/data', {
  method: 'POST',
  headers: { 'x-csrf-token': token },
  body: JSON.stringify(payload),
});
```

## Options

```ts
interface CsrfOptions {
  secret: string;            // Required: signing secret for token generation
  cookie?: {
    name?: string;       // Cookie name (default: '_csrf')
    path?: string;       // Cookie path (default: '/')
    secure?: boolean;    // HTTPS only (default: true)
    httpOnly?: boolean;  // HTTP only — must be false for double-submit pattern
    sameSite?: 'strict' | 'lax' | 'none';  // (default: 'strict')
    maxAge?: number;      // Cookie max-age in ms (omit to use session cookie)
  };
  ignoreMethods?: string[];  // Methods to skip (default: ['GET', 'HEAD', 'OPTIONS'])
  headerName?: string;       // Header name (default: 'x-csrf-token')
  bodyField?: string;        // Body field name (default: '_csrf')
  tokenLength?: number;      // Token length in bytes (default: 32)
}
```

## Examples

### Custom cookie settings

```ts
app.use(csrf({
  secret: process.env.CSRF_SECRET!,
  cookie: {
    name: 'XSRF-TOKEN',   // Angular-compatible name
    secure: true,
    sameSite: 'lax',
  },
  headerName: 'x-xsrf-token',
}));
```

### Skip CSRF for specific routes

```ts
const csrfProtection = csrf({ secret: process.env.CSRF_SECRET! });
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks/')) return next();
  csrfProtection(req, res, next);
});
```

### React / fetch integration

```tsx
// useCsrf.ts
export async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/csrf-token');
  const { token } = await res.json();
  return token;
}

// In your component
const token = await getCsrfToken();
await fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': token,
  },
  body: JSON.stringify(newUser),
});
```

## Related

- [Security (Helmet)](./security) — security headers for your app
- [Session](./session) — store session state alongside CSRF tokens
- [Cookie Parser](./cookies) — required dependency for `csrf()`
