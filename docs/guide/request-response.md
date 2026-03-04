---
title: Request & Response
description: Advanced request/response features — cache validation, range requests, JSONP, and cross-references.
---

# Request & Response

bunWay provides Express-compatible request and response objects with all the methods you expect.

## Cache Validation

### `req.fresh` / `req.stale`

Check if the client's cached version is still valid:

```typescript
app.get("/data", (req, res) => {
  // Set cache headers
  res.set("ETag", '"v1"');

  // Check if client cache is fresh
  if (req.fresh) {
    res.status(304).end();
    return;
  }

  res.json({ data: computeExpensiveData() });
});
```

**How it works:**
- Only GET and HEAD requests can be fresh
- Compares `If-None-Match` against response `ETag` (weak comparison)
- Compares `If-Modified-Since` against response `Last-Modified`
- When `If-None-Match` is present, it takes full precedence — `If-Modified-Since` is ignored
- `Cache-Control: no-cache` always returns stale
- `req.stale` is the inverse of `req.fresh`

## Range Requests

### `req.range(size, options?)`

Parse the `Range` header for partial content support:

```typescript
app.get("/video/:id", (req, res) => {
  const fileSize = getFileSize(req.params.id);
  const ranges = req.range(fileSize);

  if (ranges === -1) return res.status(416).end(); // Unsatisfiable
  if (ranges === -2) return res.status(400).end(); // Malformed
  if (!ranges) {
    // No Range header — send full file
    return res.sendFile(`./videos/${req.params.id}`);
  }

  // Handle first range
  const { start, end } = ranges[0];
  // ... serve partial content
});
```

**Return values:**
- `undefined` — no Range header present
- `-2` — malformed Range header
- `-1` — unsatisfiable range (all ranges invalid)
- `Array<{ start, end }>` — parsed ranges with `.type` property (`"bytes"`)

**Options:**
- `combine: true` — merge overlapping/adjacent ranges

### Automatic Range Support in `res.sendFile()`

`res.sendFile()` automatically handles Range requests:

```typescript
app.get("/download/:file", async (req, res) => {
  await res.sendFile(`./files/${req.params.file}`);
  // Automatically:
  // - Sets Accept-Ranges: bytes
  // - Returns 206 with Content-Range for range requests
  // - Returns 416 for unsatisfiable ranges
  // - Returns 200 with full file when no Range header
});
```

## JSONP

### `res.jsonp(data)`

Send a JSONP response for legacy cross-domain clients:

```typescript
app.get("/api/data", (req, res) => {
  res.jsonp({ name: "bunway" });
});
// GET /api/data?callback=myFunc → myFunc({"name":"bunway"});
// GET /api/data → {"name":"bunway"} (plain JSON fallback)
```

**Configure callback parameter name:**

```typescript
app.set("jsonp callback name", "cb");
// Now: GET /api/data?cb=myFunc
```

Default callback parameter name is `"callback"`.

## Cross-References

### `req.res` / `res.req` / `res.app`

Access the paired objects from either side:

```typescript
app.get("/test", (req, res) => {
  req.res === res;    // true — access response from request
  res.req === req;    // true — access request from response
  res.app !== undefined; // true — access app from response
});
```

These are set automatically during request dispatch.

## Array Paths

### `app.use([path1, path2], handler)`

Register middleware or routers for multiple paths at once:

```typescript
// Middleware on multiple paths
app.use(["/api", "/rest"], corsMiddleware);

// Sub-router on multiple paths
const apiRouter = new Router();
apiRouter.get("/health", (req, res) => res.json({ ok: true }));
app.use(["/v1", "/v2"], apiRouter);
// Both /v1/health and /v2/health work
```
