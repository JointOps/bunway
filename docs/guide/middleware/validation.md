---
title: Request Validation
description: Validate request body, query, and params with the built-in validation middleware.
---

# Request Validation

Validate incoming requests with a declarative schema — no external dependencies.

## Quick Start

```typescript
import bunway, { validate, json } from "bunway";

const app = bunway();
app.use(json());

app.post("/users",
  validate({
    body: {
      name: { required: true, type: "string", min: 2, max: 50 },
      email: { required: true, type: "email" },
      age: { type: "number", min: 18 },
    },
  }),
  (req, res) => {
    res.status(201).json({ created: true });
  }
);
```

## Validation Sources

| Source | Validates | Example |
|--------|-----------|---------|
| `body` | `req.body` | POST/PUT JSON or form data |
| `query` | `req.query` | URL query parameters |
| `params` | `req.params` | Route parameters (`:id`) |

## Field Rules

| Rule | Type | Description |
|------|------|-------------|
| `required` | `boolean` | Field must be present and non-empty |
| `type` | `string` | Type check: `"string"`, `"number"`, `"integer"`, `"boolean"`, `"email"`, `"url"`, `"uuid"` |
| `min` | `number` | Min length (strings) or min value (numbers) |
| `max` | `number` | Max length (strings) or max value (numbers) |
| `pattern` | `RegExp` | Regex the value must match |
| `enum` | `unknown[]` | Allowed values list |
| `custom` | `(value, req) => boolean \| string \| Promise<...>` | Custom validator |
| `message` | `string` | Custom error message |
| `trim` | `boolean` | Trim whitespace before validation |
| `toLowerCase` | `boolean` | Convert to lowercase before validation |
| `toNumber` | `boolean` | Convert string to number before validation |

## Examples

### Route parameter validation

```typescript
app.get("/users/:id",
  validate({
    params: { id: { required: true, pattern: /^\d+$/ } },
  }),
  (req, res) => res.json({ id: req.params.id })
);
```

### Query validation

```typescript
app.get("/search",
  validate({
    query: {
      q: { required: true, min: 1 },
      page: { toNumber: true, type: "number", min: 1 },
      limit: { toNumber: true, type: "number", min: 1, max: 100 },
    },
  }),
  (req, res) => res.json({ results: [] })
);
```

### Async custom validators

```typescript
app.post("/register",
  validate({
    body: {
      username: {
        required: true,
        custom: async (value) => {
          const exists = await db.users.findByUsername(value);
          return exists ? "Username is already taken" : true;
        },
      },
    },
  }),
  (req, res) => res.status(201).json({ ok: true })
);
```

### Custom error format

```typescript
app.post("/api",
  validate(schema, {
    statusCode: 400,
    errorFormatter: (errors) => ({
      success: false,
      issues: errors.map(e => ({
        path: `${e.source}.${e.field}`,
        message: e.message,
      })),
    }),
  }),
  handler
);
```

### Custom error handler

```typescript
app.post("/api",
  validate(schema, {
    onError: (errors, req, res, next) => {
      // Log or pass to error middleware
      next(errors);
    },
  }),
  handler
);
```

## Using with Zod / Yup / Joi

For complex schemas, use the `custom` validator or write your own middleware:

```typescript
import { z } from "zod";

const UserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

app.post("/users",
  validate({
    body: {
      name: { custom: (val) => typeof val === "string" && val.length >= 2 },
      email: { custom: (val) => typeof val === "string" && val.includes("@") },
    },
  }),
  handler
);

// Or use Zod directly in a custom middleware:
app.post("/users", (req, res, next) => {
  const result = UserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ errors: result.error.issues });
  }
  next();
}, handler);
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `abortEarly` | `boolean` | `false` | Stop at first error |
| `statusCode` | `number` | `422` | HTTP status for validation errors |
| `errorFormatter` | `(errors) => unknown` | `{ errors: [...] }` | Custom error response shape |
| `onError` | `(errors, req, res, next) => void` | — | Custom error handler |
