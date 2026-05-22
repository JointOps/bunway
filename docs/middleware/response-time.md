---
title: Response Time Middleware
description: Automatically record handler duration in a response header with bunWay's response-time middleware.
---

# Response Time Middleware

`responseTime()` measures the time from when the request enters the middleware to when the response is committed, then writes the duration into a response header.

::: tip Coming from Express?
Same behaviour as the `response-time` npm package. Same options, same header.
:::

## Basic usage

```ts
import { responseTime } from "bunway";

app.use(responseTime());
// X-Response-Time: 1.234ms
```

Mount it as early as possible so the timer starts before any other middleware runs.

## Custom header

```ts
app.use(responseTime({ header: "X-Duration" }));
```

## Controlling format

```ts
// No "ms" suffix — useful when you want a raw number
app.use(responseTime({ suffix: false }));
// X-Response-Time: 1.234

// Fewer decimal places
app.use(responseTime({ digits: 0 }));
// X-Response-Time: 1ms
```

## Options reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `header` | `string` | `"X-Response-Time"` | Response header name. |
| `digits` | `number` | `3` | Decimal places in the reported value. |
| `suffix` | `boolean` | `true` | Append `ms` to the value. |

For type details see `ResponseTimeOptions` in the API Reference.
