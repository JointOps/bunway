---
title: HPP Protection
description: Prevent HTTP Parameter Pollution attacks in bunWay with the built-in hpp() middleware — sanitize duplicate query and body parameters automatically.
---

# HTTP Parameter Pollution (HPP) Protection

`hpp()` prevents attackers from exploiting duplicate HTTP parameters to bypass security checks or cause unexpected behavior.

::: tip Coming from Express?
Replaces the `hpp` npm package. Same API, zero dependencies.
:::

## The Problem

```
GET /search?role=user&role=admin
```

Some frameworks parse duplicate params as arrays. If your code does `req.query.role === 'user'` expecting a string, an attacker can send two `role` params to make it an array — causing the check to silently fail.

## Quick Start

```typescript
import bunway, { hpp } from "bunway";

const app = bunway();
app.use(hpp());
```

## How It Works

1. **Query params**: De-duplicates to the last value; original multi-value array moved to `req.locals.queryPolluted`
2. **Body params**: De-duplicates to the last value; original multi-value array moved to `req.locals.bodyPolluted`
3. **URLSearchParams safety**: bunWay's `req.query.get()` already returns the last value — HPP adds detection and body sanitization

Original multi-value params are preserved in `req.locals.queryPolluted` and `req.locals.bodyPolluted` for inspection — whitelisted params are left untouched in both places.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `whitelist` | `string[]` | `[]` | Params allowed to have multiple values |
| `checkQuery` | `boolean` | `true` | Check query parameters |
| `checkBody` | `boolean` | `true` | Check body parameters |

## Examples

### Allow specific array params

```typescript
app.use(hpp({
  whitelist: ["tags", "categories"],
}));

// GET /search?tags=js&tags=bun → tags stays as array
// GET /search?role=user&role=admin → role sanitized, stored in queryPolluted
```

### Inspect polluted parameters

```typescript
app.use(hpp());

app.get("/search", (req, res) => {
  if (req.locals.queryPolluted) {
    console.warn("HPP detected:", req.locals.queryPolluted);
  }
  res.json({ q: req.query.get("q") });
});
```

## Related

- [Security (Helmet)](./security) — security headers
- [Rate Limiting](./rate-limit) — protect against abuse
- [CSRF Protection](./csrf) — cross-site request forgery protection
