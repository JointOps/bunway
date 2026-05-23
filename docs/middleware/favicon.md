---
title: Favicon Middleware
description: Serve favicon.ico with caching and ETag support using bunWay's favicon middleware.
---

# Favicon Middleware

`favicon()` reads your icon file at startup, caches it in memory, and serves it for every `GET /favicon.ico` request with proper `Cache-Control` and `ETag` headers. All other paths are passed to the next middleware.

::: tip Coming from Express?
Works like `serve-favicon`. Same ETag / conditional-GET behaviour, same cache-max-age default.
:::

## Basic usage

```ts
import { favicon } from "bunway";

app.use(favicon("./public/favicon.ico"));
```

The path is resolved at startup. If the file does not exist, `favicon()` throws immediately — you'll catch the misconfiguration at boot, not at runtime.

## Custom cache duration

`maxAge` is in milliseconds (same units as Express):

```ts
// Cache for 7 days
app.use(favicon("./public/favicon.ico", { maxAge: 7 * 24 * 60 * 60 * 1000 }));

// No caching
app.use(favicon("./public/favicon.ico", { maxAge: 0 }));
```

Default: `86_400_000` ms (24 hours).

## ETag / conditional GET

The ETag is generated from the file size and load time. Clients that send a matching `If-None-Match` receive `304 Not Modified` with no body.

## HEAD requests

`HEAD /favicon.ico` returns `200` with all headers but no body.

## Options reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxAge` | `number` | `86400000` | `Cache-Control: max-age` in milliseconds. |

For type details see `FaviconOptions` in the API Reference.
