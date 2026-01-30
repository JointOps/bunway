---
title: CORS Middleware
description: Configure bunWay's Bun-native CORS middleware to handle simple and preflight requests with granular origin policies.
---

# CORS Middleware

`cors()` brings fine-grained CORS control to bunway while keeping everything Bun-native. The middleware examines the incoming Origin/Access-Control headers, decides whether to allow the request, and sets the appropriate response headers.

::: tip Coming from Express?
This works just like the `cors` npm package. Same options, same patterns.
:::

## Basic usage

```ts
import { cors } from "bunway";

app.use(cors()); // wildcard
app.use(cors({ origin: true })); // reflect request origin
app.use(cors({ origin: "https://app.example.com" }));
```

Set `credentials: true` to allow cookies/authorization headers—bunway automatically prevents `*` when credentials are enabled by reflecting the incoming origin instead.

```ts
app.use(cors({ origin: true, credentials: true }));
```

::: tip Credentials
When `credentials: true`, bunway automatically reflects the request origin instead of using `*`. Ensure your allow list covers every origin that should receive credentialed responses.
:::

## Allow list patterns

- `string` – match exact origin
- `RegExp` – pattern match
- `(origin, req) => string | false` – custom logic (return the origin to allow, `false` to block)
- Arrays combine multiple strings/regexes

```ts
app.use(
  cors({
    origin: (origin, req) => {
      // Custom logic with access to the request
      if (origin?.startsWith("http://localhost")) return origin;
      if (req.get("X-Internal-Request")) return origin;
      return false;
    },
  })
);
```

## Preflight requests

Preflight (`OPTIONS`) requests are answered automatically with:

- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods` (customizable via `methods` option)
- `Access-Control-Allow-Headers` (explicit list or echo request header)
- `Access-Control-Allow-Credentials` when `credentials: true`
- `Access-Control-Max-Age` (default 600 seconds)

The middleware also ensures the proper `Vary` header is set to keep caches honest.

## Header merging

CORS headers are set directly on the response. bunway's router finalizer preserves these headers even if your handler returns a native `Response` object:

```ts
app.get("/raw", () => new Response("raw", { status: 202 }));
// CORS headers still applied!
```

## Options reference

:::details CORS Options reference

- **`origin`**: `"*"` | `true` | `string` | `RegExp` | `(string | RegExp)[]` | `(origin, req) => string | false`
  - Decide which origins are allowed. Returning `false` blocks the request; when `credentials: true`, bunWay reflects the approved origin instead of `"*"`.
- **`credentials`**: `boolean` (default `false`)
  - Allow credentialed requests. bunWay automatically prevents `"*"` when enabled.
- **`methods`**: `string[]` (default `['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS']`)
  - Whitelist methods used in preflight responses.
- **`allowedHeaders`**: `string[]`
  - Force a specific allow-list instead of echoing `Access-Control-Request-Headers`.
- **`exposedHeaders`**: `string[]`
  - Populate `Access-Control-Expose-Headers`.
- **`maxAge`**: `number` (default `600`)
  - Cache duration (seconds) for successful preflight responses.
- **`preflightContinue`**: `boolean` (default `false`)
  - Pass preflight requests to the next handler instead of responding immediately.

:::

## Recommendations

- Reflect (`origin: true`) when you need credentials.
- Keep the allow-list tight in production—prefer regex/string arrays over wildcards.

::: warning Production allow list
Audit CORS settings regularly. Accidentally allowing `*` with credentials or forgetting to restrict origins can expose sensitive endpoints.
:::

- Combine with `errorHandler()` to log disallowed origins or unexpected headers.

For type details see `CorsOptions` in the [API Reference](/api/index.html).
