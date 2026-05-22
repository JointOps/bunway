---
title: Method Override Middleware
description: Support PUT, DELETE, and PATCH from HTML forms using bunWay's method-override middleware.
---

# Method Override Middleware

`methodOverride()` lets HTML forms send `PUT`, `DELETE`, and `PATCH` requests by embedding the desired method in a header, query string, or body field. The browser sends a `POST`; the middleware rewrites `req.method` before the router sees it.

::: tip Coming from Express?
Drop-in for the `method-override` npm package. Same header, same query-string, same body field lookup.
:::

## Basic usage — header

```ts
import { methodOverride } from "bunway";

app.use(methodOverride());

app.delete("/items/:id", (req, res) => {
  res.json({ deleted: req.params.id });
});
```

HTML form:
```html
<form method="POST" action="/items/42">
  <input type="hidden" name="X-HTTP-Method-Override" value="DELETE">
  <button>Delete</button>
</form>
```

Or via header:
```
POST /items/42
X-HTTP-Method-Override: DELETE
```

## Query string

Pass the override as a query parameter:

```ts
app.use(methodOverride({ getter: "_method" }));
// POST /items/42?_method=DELETE  →  req.method === "DELETE"
```

## Body field

```ts
app.use(methodOverride({ getter: "_method" }));
// POST body: _method=PATCH  →  req.method === "PATCH"
```

## Custom getter function

```ts
app.use(methodOverride({
  getter: (req) => req.get("X-My-Method"),
}));
```

## Allowed methods

Only these methods can be set via override: `GET`, `HEAD`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`. Any other value is ignored and `req.method` stays `POST`.

## Original method

The original `POST` method is preserved on `req._originalMethod` before overriding.

## Options reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `getter` | `string \| (req) => string \| undefined` | `"X-HTTP-Method-Override"` | Header name to check (also checks query and body when a string is given), or a custom function. |

For type details see `MethodOverrideOptions` in the API Reference.
