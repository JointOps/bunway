---
title: Body Parsing Middleware
description: Understand how bunWay parses JSON, urlencoded, and text payloads automatically, and learn to customize limits and overrides.
---

# Body Parsing Middleware

bunway includes lightweight helpers for parsing common content types, just like Express. Each helper exposes the same signature and respects router-level or per-request overrides.

Every router ships with an auto parser that runs before your handlers. If a request matches a configured content type, `req.body` is already waiting for you—no manual parsing required.

::: tip Coming from Express?
These work exactly like `express.json()`, `express.urlencoded()`, and `body-parser.text()`.
:::

## Quick usage

```ts
import bunway, { json, urlencoded, text, raw } from "bunway";

const app = bunway();
app.use(json());
app.use(urlencoded({ limit: 64 * 1024 }));
app.use(text());
app.use(raw());
```

::: code-group

```ts [Server]
app.use(json());
app.post("/echo", (req, res) => res.json(req.body));
```

```bash [Client]
curl -X POST http://localhost:7070/echo \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada"}'
```

:::

::: tip Cached parsing
`req.body` caches its value for the rest of the request. Bun's zero-copy buffers keep things fast without re-reading the stream.
:::

Behind the scenes each helper calls the matching `BunRequest.tryParse*` method. Parsed bodies land on `req.body`.

## json()

```ts
app.use(json());
app.use(
  json({
    limit: 1 * 1024 * 1024,
    type: [/json$/, "application/vnd.api+json"],
  })
);
```

Options:

| Option    | Type                                             | Default              | Description                            |
| --------- | ------------------------------------------------ | -------------------- | -------------------------------------- |
| `limit`   | `number`                                         | 1 MiB                | Max payload size before returning 413  |
| `type`    | `string \| RegExp \| ((contentType) => boolean)` | `"application/json"` | Match strategy for enabling the parser |

If the payload exceeds the limit or JSON parsing fails, bunway returns a `413` or `400` response automatically.

## urlencoded()

```ts
app.use(urlencoded({ limit: 64 * 1024 }));
```

Parses `application/x-www-form-urlencoded` payloads (HTML forms) and converts them to plain objects via `Object.fromEntries(new URLSearchParams(...))`.

Options mirror `json()` (limit, type). Invalid content types are skipped gracefully.

Options:

| Option     | Type                                                | Default                               | Description                           |
| ---------- | --------------------------------------------------- | ------------------------------------- | ------------------------------------- |
| `limit`    | `number`                                            | 1 MiB                                 | Max payload size before returning 413 |
| `extended` | `boolean`                                           | `false`                               | Parse nested objects (qs-style)       |
| `type`     | `string \| RegExp \| ((contentType) => boolean)`    | `"application/x-www-form-urlencoded"` | Match strategy for enabling the parser |

## text()

```ts
app.use(text());
app.use(text({ type: /text\/(plain|csv)/ }));
```

Reads the body as text and stores it on `req.body`. Useful when accepting raw string payloads or when you want to handle serialization manually.

## raw()

```ts
app.use(raw());
app.use(
  raw({
    limit: "5mb",
    type: "application/octet-stream",
    verify: (req, res, buf, encoding) => {
      // Verify webhook signature
    },
  })
);
```

Parses request bodies as raw binary data (Buffer). This is essential for webhook endpoints that require signature verification, such as Stripe, GitHub, or PayPal webhooks.

Options:

| Option   | Type                                                    | Default                       | Description                                        |
| -------- | ------------------------------------------------------- | ----------------------------- | -------------------------------------------------- |
| `limit`  | `number \| string`                                      | `"100kb"`                     | Max payload size (supports "kb", "mb", "gb" units) |
| `type`   | `string \| RegExp \| ((contentType) => boolean)`        | `"application/octet-stream"`  | Match strategy for enabling the parser             |
| `verify` | `(req, res, buf: Buffer, encoding: string) => void`     | `undefined`                   | Callback to verify the raw body (e.g., signatures) |

The `verify` callback receives the raw Buffer before it's assigned to `req.body`, allowing you to validate webhook signatures. If the callback throws an error, bunWay responds with `403 Forbidden`.

### Webhook signature verification example

```ts
import crypto from "crypto";
import bunway, { raw } from "bunway";

const app = bunway();

app.post(
  "/webhook/stripe",
  raw({
    type: "application/json", // Stripe sends JSON but needs raw body
    verify: (req, res, buf) => {
      const signature = req.get("stripe-signature");
      const secret = process.env.STRIPE_WEBHOOK_SECRET!;

      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(buf)
        .digest("hex");

      if (signature !== expectedSig) {
        throw new Error("Invalid signature");
      }
    },
  }),
  (req, res) => {
    // req.body is a Buffer containing the raw payload
    const event = JSON.parse(req.body.toString());
    res.json({ received: true });
  }
);
```

### Size limit with string format

```ts
app.use(
  raw({
    limit: "5mb", // or "500kb", "1.5mb", "1gb"
  })
);
```

### Custom content-type matching

```ts
// Match multiple webhook providers
app.use(
  raw({
    type: /^application\/(webhook|stripe|github)/,
  })
);

// Function-based matching
app.use(
  raw({
    type: (ct) => ct.startsWith("application/") && ct.includes("webhook"),
  })
);
```

::: warning Buffer output
Unlike `json()` or `urlencoded()`, `raw()` sets `req.body` to a `Buffer` instance. Convert to string with `req.body.toString()` or parse as JSON with `JSON.parse(req.body.toString())` if needed.
:::

## Auto parsing pipeline

Each router inserts an auto body parser before your route handlers. The pipeline looks like this:

1. Global middleware you registered (`cors()`, logging, etc.).
2. Auto parser resolves router defaults and `req.body` is populated when content types match.
3. Your route-specific middleware/handlers run with the cached payload.

Skip redundant work by calling `req.isBodyParsed()` inside custom middleware to avoid duplicate parsing.

## Error handling

If parsing fails (invalid JSON, payload too large), bunway returns a `413` or `400` response automatically.

---

Next: explore the [`cors()` middleware](cors.md) or browse the [API Reference](https://bunway.jointops.dev/api/index.html) for option type definitions.
