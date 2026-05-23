---
title: Request ID Middleware
description: Attach a unique identifier to every request for tracing and correlation with bunWay's request-id middleware.
---

# Request ID Middleware

`requestId()` assigns a unique ID to each request, makes it available as `req.id`, and echoes it in the response header. If the incoming request already carries the header, that value is reused instead of generating a new one.

::: tip Coming from Express?
Works like `express-request-id`. Same passthrough behaviour for upstream-supplied IDs.
:::

## Basic usage

```ts
import { requestId } from "bunway";

app.use(requestId());

app.get("/info", (req, res) => {
  res.json({ requestId: (req as any).id });
});
```

Every response gets `X-Request-Id: <uuid>`.

## Reusing an upstream ID

If the caller sends `X-Request-Id`, that value is reused:

```ts
// Incoming: X-Request-Id: my-trace-id
// req.id === "my-trace-id"
// Response: X-Request-Id: my-trace-id
```

Useful for distributed tracing — the ID propagates end-to-end without any extra code.

## Custom header name

```ts
app.use(requestId({ header: "X-Trace-Id" }));
```

## Custom generator

```ts
app.use(requestId({ generator: () => `req-${Date.now()}` }));
```

## Suppress response header

```ts
app.use(requestId({ setHeader: false }));
// req.id is set, but no header is written to the response
```

## Options reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `header` | `string` | `"X-Request-Id"` | Header to read from the request and write to the response. |
| `generator` | `() => string` | `crypto.randomUUID` | Function that produces a new ID when none is present. |
| `setHeader` | `boolean` | `true` | Write the ID into the response header. |

For type details see `RequestIdOptions` in the API Reference.
