---
title: HTTP Parameter Pollution
description: Protect against HPP attacks with built-in parameter sanitization.
---

# HTTP Parameter Pollution (HPP) Protection

Prevents attackers from exploiting duplicate HTTP parameters.

## The Problem

```
GET /search?role=user&role=admin
```

Some frameworks parse duplicate params as arrays, which can bypass security checks that expect a single string.

## Quick Start

```typescript
import bunway, { hpp } from "bunway";

const app = bunway();
app.use(hpp());
```

## How It Works

1. **Query params**: Detects duplicates and stores them in `req.locals.queryPolluted`
2. **Body params**: Reduces array values to their last element
3. **URLSearchParams safety**: bunWay's `req.query.get()` already returns the last value — HPP adds detection and body sanitization

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
