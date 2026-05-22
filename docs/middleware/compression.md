---
title: Compression Middleware
description: Brotli, gzip, and deflate response compression for bunWay — zero npm dependencies, Bun-native.
---

# Compression Middleware

`compression()` compresses `res.json()`, `res.text()`, and `res.html()` responses based on the client's `Accept-Encoding` header. Brotli is preferred when supported, falling back to gzip, then deflate.

::: tip Coming from Express?
Works like the `compression` npm package. Same threshold, same filter, same level option.
:::

## Basic usage

```ts
import { compression } from "bunway";

app.use(compression());
```

Clients that send `Accept-Encoding: br, gzip` receive Brotli-compressed responses. Clients that only send `gzip` receive gzip. Responses below the threshold (default 1 KB) are sent uncompressed.

## Encoding priority

1. **Brotli** (`br`) — best ratio, used when the client supports it
2. **gzip** — wide compatibility fallback
3. **deflate** — last resort

## Threshold

Responses smaller than the threshold are never compressed:

```ts
app.use(compression({ threshold: 2048 })); // 2 KB minimum
```

Default: `1024` bytes.

## Compression level

Controls the gzip/deflate compression level (1–9). Brotli uses its own default:

```ts
app.use(compression({ level: 9 })); // maximum compression
```

Default: `6`.

## Custom filter

Skip compression for specific content types:

```ts
app.use(compression({
  filter: (contentType) => contentType.includes("text/"),
}));
```

The default filter compresses: `text/*`, `application/json`, `application/javascript`, `application/xml`, `application/xhtml+xml`, `image/svg+xml`.

## Options reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `number` | `6` | gzip/deflate compression level (1–9). |
| `threshold` | `number` | `1024` | Minimum response size in bytes to compress. |
| `filter` | `(contentType: string) => boolean` | compressible types | Return `true` to compress this content type. |

For type details see `CompressionOptions` in the API Reference.
