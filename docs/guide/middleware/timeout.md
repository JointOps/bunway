---
title: Request Timeout
description: Protect your server from slow requests with the built-in timeout middleware.
---

# Request Timeout

Prevent slow requests from holding connections open indefinitely.

## Quick Start

```typescript
import bunway, { timeout } from "bunway";

const app = bunway();

// 30 second timeout for all routes
app.use(timeout(30000));

app.get("/api/data", async (req, res) => {
  const data = await fetchExternalAPI();
  if (!req.timedout) {
    res.json(data);
  }
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ms` | `number` | (required) | Timeout in milliseconds |
| `statusCode` | `number` | `408` | HTTP status on timeout |
| `message` | `string \| object` | `"Request Timeout"` | Response body on timeout |
| `respond` | `boolean` | `true` | Auto-send response on timeout |
| `skip` | `(req) => boolean` | — | Skip timeout for specific requests |

## Examples

### Custom timeout response

```typescript
app.use(timeout(5000, {
  statusCode: 504,
  message: { error: "Gateway Timeout", code: "ETIMEDOUT" },
}));
```

### Skip timeout for uploads

```typescript
app.use(timeout(5000, {
  skip: (req) => req.path.startsWith("/upload"),
}));
```

### Manual timeout handling

```typescript
app.use(timeout(5000, { respond: false }));

app.get("/api", async (req, res) => {
  const result = await longOperation();
  if (req.timedout) return; // Don't respond if timed out
  res.json(result);
});
```

## Checking `req.timedout`

Always check `req.timedout` in async handlers:

```typescript
app.get("/process", async (req, res) => {
  await step1();
  if (req.timedout) return;

  await step2();
  if (req.timedout) return;

  res.json({ done: true });
});
```
