---
title: Error Handler Middleware
description: Catch and format errors in bunWay using errorHandler(), with logging hooks and HttpError support.
---

# Error Handler Middleware

`errorHandler()` provides a catch-all layer that logs unexpected errors, respects thrown `HttpError` instances, and keeps responses Fetch-friendly.

::: tip Coming from Express?
Works like Express error middleware, but with better defaults for development mode.
:::

## Usage

Place it near the end of your middleware chain:

```ts
import bunway, { errorHandler, HttpError } from "bunway";

const app = bunway();
app.use(errorHandler({ logger: console.error }));

app.get("/secret", () => {
  throw new HttpError(403, "Forbidden");
});
```

- Thrown `HttpError`s become responses with their status, body, and headers.
- Non-HttpError exceptions yield a 500 JSON payload (`{"error":"Internal Server Error"}`) and optional logging.
- If you throw/return a native `Response`, the middleware simply passes it through.

## HttpError Class

Throw structured HTTP errors with status codes, custom headers, and body:

```ts
import { HttpError } from "bunway";

// Basic usage
throw new HttpError(404, "User not found");

// With custom headers
throw new HttpError(401, "Unauthorized", {
  headers: { "WWW-Authenticate": "Bearer" }
});

// With custom body
throw new HttpError(422, "Validation failed", {
  body: {
    error: "Validation failed",
    fields: { email: "Invalid email format" }
  }
});

// With cause for error chaining
throw new HttpError(500, "Database error", {
  cause: originalError
});
```

### HttpError Constructor

```ts
new HttpError(status: number, message?: string, options?: HttpErrorOptions)
```

### HttpErrorOptions

```ts
interface HttpErrorOptions {
  cause?: unknown;                    // Original error for chaining
  headers?: Record<string, string>;   // Custom response headers
  body?: unknown;                     // Custom response body
}
```

### HttpError Properties

| Property | Type | Description |
|----------|------|-------------|
| `status` | `number` | HTTP status code |
| `message` | `string` | Error message |
| `headers` | `Record<string, string>` | Custom headers to include |
| `body` | `unknown` | Custom body (defaults to `{ error: message }`) |
| `name` | `string` | Always `"HttpError"` |

## isHttpError Helper

Type guard to check if an error is an HttpError:

```ts
import { isHttpError, HttpError } from "bunway";

function handleError(err: unknown) {
  if (isHttpError(err)) {
    // TypeScript knows err is HttpError here
    console.log(err.status);  // e.g., 404
    console.log(err.body);    // e.g., { error: "Not found" }
  }
}
```

Useful in custom error handling middleware:

```ts
app.use((err, req, res, next) => {
  if (isHttpError(err)) {
    return res.status(err.status).json(err.body);
  }
  // Handle other error types
  res.status(500).json({ error: "Internal error" });
});
```

## Development mode

In development mode (default when `NODE_ENV !== "production"`), errors include:

- Colorized console output
- Stack traces in response
- Request method and path
- Error type name

```ts
app.use(errorHandler({ development: true }));
```

## Mapping custom errors

Use the `map` option to translate domain exceptions into `HttpError` instances:

```ts
app.use(
  errorHandler({
    logger: console.error,
    map: (err) => {
      if (err instanceof SyntaxError) return new HttpError(400, "Invalid JSON payload");
      if (err instanceof AuthError) return new HttpError(401, err.message);
      return null; // fallback to default handling
    },
  })
);
```

The mapping function may return:

- `HttpError` – used directly
- `Error` – re-thrown so the standard branch handles it
- `null`/`undefined` – skip mapping

::: tip Custom responses
Need to return a custom `Response`? Throw or return the `Response` directly inside the handler—`errorHandler()` passes it through untouched.
:::

## Logging

Provide `logger` to capture unexpected errors. bunway wraps calls in `try/catch` so logging failures don't crash the app:

```ts
app.use(
  errorHandler({
    logger: (error, req) => {
      console.error(`Error on ${req.method} ${req.path}:`, error);
    },
  })
);
```

Or use the app's built-in logger:

```ts
app.use(errorHandler({ useAppLogger: true }));
```

## Response format

When a handler throws `HttpError(404, "Not found")`:

```json
HTTP/1.1 404 Not Found
Content-Type: application/json

{"error":"Not found"}
```

In development mode, the response includes additional context:

```json
{
  "error": "Not found",
  "method": "GET",
  "path": "/users/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Options reference

| Option           | Type                              | Default                           | Description                      |
| ---------------- | --------------------------------- | --------------------------------- | -------------------------------- |
| `logger`         | `(error, req) => void`            | –                                 | Custom error logging function    |
| `useAppLogger`   | `boolean`                         | `false`                           | Use app's built-in logger        |
| `development`    | `boolean`                         | `NODE_ENV !== "production"`       | Enable verbose error responses   |
| `includeStack`   | `boolean`                         | `false` (auto in dev)             | Include stack traces             |
| `showRequestInfo`| `boolean`                         | `false` (auto in dev)             | Include method/path in response  |

## Tips

- Combine with `cors()` so even error responses contain the correct CORS headers.
- Use `req.locals` to pass debugging info to the logger.
- Keep error messages client-safe; internal stack traces shouldn't leak to users in production.

For option details see `ErrorHandlerOptions` in the [API Reference](/api/index.html).
