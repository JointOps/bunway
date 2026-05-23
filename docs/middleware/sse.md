---
title: SSE Middleware
description: Server-Sent Events middleware for bunWay — streaming events to clients with heartbeat and clean abort handling.
---

# SSE Middleware

`sse()` sets up a response for Server-Sent Events (SSE). It configures the correct headers, starts an optional heartbeat, attaches `res.sendEvent()` for dispatching named events, and cleans up automatically when the client disconnects.

::: tip Coming from Express?
Drop-in replacement for the `sse` / `express-sse` pattern. Mount it as route middleware, then call `res.sendEvent()` inside your handler.
:::

## Basic usage

```ts
import { sse } from "bunway";

app.get("/events", sse(), (req, res) => {
  res.sendEvent("update", { count: 1 });
  res.sendEvent("update", { count: 2 }, "msg-42"); // with id
  res.end();
});
```

The middleware sets:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no` (disables nginx proxy buffering)

## Sending events

`res.sendEvent(event, data, id?)` writes a formatted SSE frame:

```
id: msg-42
event: update
data: {"count":1}

```

`id` is optional. If omitted, the `id:` line is not written.

## Heartbeat

A keepalive comment (`: ping`) is sent on an interval to prevent proxies and load balancers from closing idle connections.

```ts
app.get("/events", sse({ heartbeatInterval: 30_000 }), handler);
// Set to 0 to disable
app.get("/events", sse({ heartbeatInterval: 0 }), handler);
```

Default: `15000` ms (15 seconds).

## Client disconnects

When the client closes the connection, the abort signal fires, the heartbeat timer is cleared, and `res.end()` is called automatically. No cleanup code needed in your handler.

## Options reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `heartbeatInterval` | `number` | `15000` | ms between keepalive pings. Set to `0` to disable. |

For type details see `SseOptions` in the API Reference.
