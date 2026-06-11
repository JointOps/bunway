# bunWay

[![npm version](https://img.shields.io/npm/v/bunway.svg?logo=npm&label=npm)](https://www.npmjs.com/package/bunway)
[![CI](https://github.com/JointOps/bunway/actions/workflows/ci.yml/badge.svg)](https://github.com/JointOps/bunway/actions/workflows/ci.yml)
[![bun only](https://img.shields.io/badge/runtime-bun%201.1+-1e7c73?logo=bun&logoColor=white)](https://bun.sh)
[![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/bunway)
[![tests](https://img.shields.io/badge/tests-1662%20passing-brightgreen)]()
[![docs](https://img.shields.io/badge/docs-bunway.jointops.dev-3fc5b7)](https://bunway.jointops.dev/)
[![license](https://img.shields.io/badge/license-MIT-lightgrey.svg)](./LICENSE)

**Express API. Bun speed. Zero dependencies.**

bunWay is a web framework for Bun that speaks Express fluently. Same `(req, res, next)` signature. Same middleware patterns. Same routing. Just faster, lighter, and with 23 middleware built right in. No rewrites. No new API to learn. Drop it in and ship.

```ts
import { bunway, cors, helmet, logger, json, session } from "bunway";

const app = bunway();

app.use(cors());
app.use(helmet());
app.use(logger("dev"));
app.use(json());
app.use(session({ secret: "keyboard cat" }));

app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

app.listen(3000);
```

If you've written Express before, you just wrote bunWay.

---

## Quick Links

[Install](#getting-started) · [Why bunWay?](#why-bunway) · [Express Compatibility](#express-compatibility) · [Middleware](#built-in-middleware-23) · [Routing](#routing) · [Docs](https://bunway.jointops.dev/)

---

## Why bunWay?

### The problem

Building a production Express app means installing 15-30 packages: `cors`, `helmet`, `express-session`, `morgan`, `compression`, `express-rate-limit`, `multer`, `cookie-parser`, `csurf`, `hpp`, `express-validator`, `connect-timeout`... each with its own version, its own types, its own maintenance burden.

bunWay ships all of that in a single import with zero dependencies.

### The comparison

| | Express + ecosystem | bunWay |
|---|---|---|
| **Runtime** | Node.js | Bun (native speed) |
| **Production dependencies** | 30+ packages for a real app | **0** |
| **Middleware** | Install, configure, and maintain separately | **23 built-in**, one import |
| **TypeScript** | `@types/express` + build step | Native. Strict types included. |
| **TLS/HTTPS** | `https.createServer(opts, app)` | `app.listen({ tls: { cert, key } })` |
| **API compatibility** | — | **97%+** Express 4.x parity |
| **Learning curve** | — | **None.** Same API. |

### By the numbers

| Metric | Value |
|--------|-------|
| Production dependencies | **0** |
| Built-in middleware | **23** |
| Express API parity | **97%+** |
| Test suite | **1,662 tests**, 3,653 assertions |
| TypeScript | **100%** strict mode, no `any` |

---

## Getting Started

```bash
bun add bunway
```

```ts
import { bunway, json, cors } from "bunway";

const app = bunway();

app.use(cors());
app.use(json());

app.get("/", (req, res) => {
  res.json({ message: "Hello from bunWay!" });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

That's it. No boilerplate. No config files. No dependency tree.

---

## Express Compatibility

bunWay implements the Express 4.x API surface. Your existing code, middleware patterns, and muscle memory all transfer directly.

### Core API — What Works Identically

| Express | bunWay | Notes |
|---------|--------|-------|
| `app.get()`, `post()`, `put()`, `delete()` | Same | All HTTP methods |
| `app.patch()`, `options()`, `head()` | Same | Additional HTTP methods |
| `app.use(middleware)` | Same | Middleware chains |
| `app.route('/path').get().post()` | Same | Chainable routes |
| `app.all('*', handler)` | Same | Catch-all routes |
| `express.Router()` | `bunway.Router()` | Sub-routers |
| `Router({ mergeParams: true })` | Same | Param inheritance |
| `app.use('/api', subApp)` | Same | Sub-app mounting |
| `app.mountpath` / `app.path()` | Same | Mount introspection |
| `app.set(setting, value)` | Same | App settings |
| `app.get(setting)` | Same | Read app settings |
| `app.enable(setting)` / `app.disable(setting)` | Same | Boolean settings |
| `app.enabled(setting)` / `app.disabled(setting)` | Same | Boolean settings check |
| `app.locals` | Same | App-level shared data |
| `app.engine(ext, fn)` | Same | Template engine registration |
| `res.render(view, locals, cb)` | Same | Template rendering |
| `router.param(name, handler)` | Same | Route parameter pre-processing |

### App Settings

`app.set(key, value)` controls framework behaviour. All settings mirror Express 4.x defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| `"trust proxy"` | `false` | `true`, number of hops, IP/CIDR string or array, or function |
| `"etag"` | `"weak"` | `false`, `"weak"`, `"strong"`, or custom function |
| `"json spaces"` | `0` | Pretty-print JSON responses (e.g. `2`) |
| `"strict routing"` | `false` | Distinguish `/foo` from `/foo/` |
| `"case sensitive routing"` | `false` | Distinguish `/Foo` from `/foo` |
| `"x-powered-by"` | `true` | Send `X-Powered-By` header |
| `"env"` | `NODE_ENV` | `"development"` or `"production"` |
| `"jsonp callback name"` | `"callback"` | Query param for JSONP callback |
| `"view engine"` | `undefined` | Default template file extension |
| `"views"` | `"./views"` | Directory to search for templates |
| `"logger"` | console | Custom `BunWayLogger` instance (see [Custom Logging](#custom-logging)) |

```ts
app.set("json spaces", 2);
app.set("trust proxy", 1);           // trust first proxy hop
app.set("trust proxy", "loopback");  // trust loopback addresses
app.set("etag", "strong");

app.enable("strict routing");        // same as app.set("strict routing", true)
app.disable("x-powered-by");

if (app.enabled("strict routing")) { /* ... */ }
```

### Request Object — Full Parity

| Express | bunWay | Notes |
|---------|--------|-------|
| `req.params`, `req.query`, `req.body` | Same | Core data access |
| `req.cookies`, `req.signedCookies` | Same | Parsed by `cookieParser()` |
| `req.session`, `req.sessionID`, `req.sessionStore` | Same | Populated by `session()` |
| `req.file`, `req.files` | Same | Populated by `upload` middleware |
| `req.ip` | Same | Proxy-aware client IP |
| `req.ips` | Same | Array of trusted proxy IPs from `X-Forwarded-For` |
| `req.get()`, `req.header()` | Same | Header access |
| `req.is('json')`, `req.is('text/*')` | Same | MIME type checking with wildcards |
| `req.accepts('json', 'html')` | Same | RFC 7231 quality-value negotiation |
| `req.acceptsCharsets()` | Same | Charset negotiation |
| `req.acceptsEncodings()` | Same | Encoding negotiation |
| `req.acceptsLanguages('en')` | Same | Language range matching (`en` matches `en-US`) |
| `req.param('name')` | Same | Checks params → body → query |
| `req.protocol`, `req.secure`, `req.hostname` | Same | Proxy-aware |
| `req.fresh`, `req.stale` | Same | ETag + Last-Modified validation |
| `req.range(size)` | Same | Range header parsing |
| `req.range(size, { combine: true })` | Same | Merge overlapping ranges |
| `req.xhr`, `req.subdomains`, `req.path` | Same | Request introspection |
| `req.url`, `req.originalUrl`, `req.baseUrl` | Same | URL variants |
| `req.method` | Same | HTTP method (may be overridden by `methodOverride()`) |
| `req.route` | Same | `{ path, method }` of matched route |
| `req.locals` | Same | Per-request shared data |
| `req.timedout` | Same | Set to `true` by `timeout()` |
| `req.id` | Same | Set by `requestId()` |
| `req.csrfToken()` | Same | Set by `csrf()` |
| `req.res`, `res.req`, `res.app` | Same | Cross-references |
| `req.rawBody()` | Async | Returns raw `Uint8Array` before body parsing |
| `req.rawText()` | Async | Returns raw body as string |

### Response Object — Full Parity

| Express | bunWay | Notes |
|---------|--------|-------|
| `res.json()` | Same | Returns `this` for chaining |
| `res.send('hello')` | Same | Auto-detects Content-Type (string→html, object→JSON, buffer→octet-stream) |
| `res.text(data)` | bunWay | Sends `text/plain` |
| `res.html(data)` | bunWay | Sends `text/html` |
| `res.status(201).json({...})` | Same | Chainable |
| `res.redirect(301, '/new')` | Same | Status + URL |
| `res.sendFile(path, opts, cb)` | Same | Callback, `lastModified`, `cacheControl`, `immutable`, range support |
| `res.download(path, name, cb)` | Same | Callback support |
| `res.attachment('file.pdf')` | Same | Auto-detects Content-Type from extension |
| `res.cookie()`, `res.clearCookie()` | Same | Cookie management |
| `res.set()`, `res.header()` | Same | Set single or object of headers |
| `res.get()`, `res.getHeader()` | Same | Read response header |
| `res.append(name, value)` | Same | Append header value |
| `res.type(mimeType)` | Same | Set Content-Type (`'json'`, `'html'`, `'text/csv'`, etc.) |
| `res.contentType(type)` | Same | Alias for `res.type()` |
| `res.vary(field)` | Same | Add field to Vary header |
| `res.location(url)` | Same | Set Location header |
| `res.links(links)` | Same | Set Link header (`{ next: url, prev: url }`) |
| `res.sendStatus()`, `res.end()` | Same | `end()` supports encoding + callback |
| `res.format()` | Same | Content negotiation responses |
| `res.jsonp()` | Same | Configurable callback name |
| `res.write()` + `res.end()` | Same | Streaming responses |
| `res.flushHeaders()` | Same | Flush headers immediately (SSE) |
| `res.headersSent` | Same | `true` after headers are flushed |
| `res.statusCode` | Same | Current status code |
| `res.locals` | Same | Per-request shared data |
| `res.render(view, locals, cb)` | Same | Render a template (requires `app.engine()`) |
| `res.ok(data?)` | bunWay | 200 with optional JSON body |
| `res.created(data?)` | bunWay | 201 with optional JSON body |
| `res.noContent()` | bunWay | 204 No Content |
| `res.badRequest(msg?)` | bunWay | 400 JSON error |
| `res.unauthorized(msg?)` | bunWay | 401 JSON error |
| `res.forbidden(msg?)` | bunWay | 403 JSON error |
| `res.notFound(msg?)` | bunWay | 404 JSON error |

### Routing — Full Parity

| Express | bunWay | Notes |
|---------|--------|-------|
| `app.get('/users/:id', handler)` | Same | Parameterized routes |
| `app.get(/\/fly$/, handler)` | Same | Regex routes with named capture groups |
| `app.all('*', handler)` | Same | Catch-all |
| `app.route('/path').get().post()` | Same | Chainable |
| `app.use(['/v1', '/v2'], router)` | Same | Array path mounting |
| `app.use('/api', express())` | Same | Sub-app mounting with `mountpath` |
| `app.use('/users/:uid', router)` | Same | Dynamic prefix on mount |
| `router.group(prefix, cb)` | bunWay | Inline sub-router grouping |
| `next('route')` | Same | Skip remaining handlers in current route |
| `next('router')` | Same | Skip remaining handlers in current router |

### What's Different

| Express | bunWay | Why |
|---------|--------|-----|
| `app.listen()` returns `http.Server` | Returns `Bun.Server` | Different runtime |
| `https.createServer(opts, app)` | `app.listen({ tls })` | Bun-native TLS |
| Install 15+ middleware packages | `import { ... } from "bunway"` | All built-in |

[Full migration guide →](https://bunway.jointops.dev/guide/express-migration.html)

---

## Built-in Middleware (23)

Every middleware Express developers reach for is built in. One import. No version conflicts. No supply chain risk.

```ts
import {
  // Body parsing
  json,           // JSON body parsing (express.json())
  urlencoded,     // URL-encoded form data (express.urlencoded())
  text,           // Text body parsing (body-parser.text())
  raw,            // Raw binary bodies — webhook signature verification

  // File handling
  upload,         // File uploads — multer-compatible API
  serveStatic,    // Static file serving (express.static())

  // Security
  helmet,         // Security headers (CSP, HSTS, X-Frame-Options, etc.)
  cors,           // CORS headers
  csrf,           // CSRF protection
  rateLimit,      // Rate limiting per IP
  hpp,            // HTTP Parameter Pollution protection
  validate,       // Schema-based request validation

  // Session & Auth
  session,        // Session management (memory + file stores)
  cookieParser,   // Cookie parsing

  // Observability
  logger,         // Request logging (morgan format strings)
  timeout,        // Request timeout with req.timedout flag
  compression,    // Brotli / gzip / deflate response compression
  responseTime,   // X-Response-Time header
  requestId,      // X-Request-Id generation and passthrough
  errorHandler,   // Error handling middleware

  // DX Utilities
  sse,            // Server-Sent Events (res.sendEvent, heartbeat, abort cleanup)
  methodOverride, // PUT/DELETE/PATCH from HTML forms via header/query/body
  favicon,        // Serve favicon.ico with ETag and Cache-Control
} from "bunway";
```

### Middleware in Action

```ts
// Production-ready security stack — one line each
app.use(helmet());
app.use(cors({ origin: "https://myapp.com" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(hpp());
app.use(csrf());

// Body parsing
app.use(json({ limit: "10mb" }));
app.use(urlencoded({ extended: true }));

// Request timeout — returns 408 if handler takes too long
app.use(timeout(5000));

// Sessions & auth
app.use(session({ secret: "my-secret", cookie: { maxAge: 86400000 } }));

// Logging (morgan format strings work)
app.use(logger("dev"));
app.use(logger(":method :url :status :response-time ms"));

// Request validation — declarative schema
app.post("/users", validate({
  body: {
    email: { required: true, type: "email" },
    age: { required: true, type: "integer", min: 18 },
  }
}), createUser);

// Webhook signature verification
app.post("/webhook/stripe", raw({
  type: "application/json",
  verify: (req, res, buf) => {
    const sig = req.get("stripe-signature");
    if (!verifySignature(buf, sig)) throw new Error("Bad signature");
  },
}), handleWebhook);

// File uploads (multer API)
app.post("/upload", upload.single("avatar"), (req, res) => {
  res.json({ file: req.file.originalname, size: req.file.size });
});

// Static files
app.use(serveStatic("public"));
app.use("/assets", serveStatic("assets", { maxAge: 86400000 }));

// Favicon — cached at startup, ETag + Cache-Control out of the box
app.use(favicon("./public/favicon.ico"));

// Request ID — generates UUID, sets req.id and X-Request-Id header
app.use(requestId());

// Response time — writes X-Response-Time on every response
app.use(responseTime());

// Method override — PUT/DELETE from HTML forms
app.use(methodOverride()); // reads X-HTTP-Method-Override header

// Server-Sent Events
app.get("/events", sse({ heartbeatInterval: 15_000 }), (req, res) => {
  res.sendEvent("update", { data: "hello" });
  res.end();
});
```

---

## Middleware Reference

### `json(options?)`

Parses `application/json` request bodies.

| Option | Default | Description |
|--------|---------|-------------|
| `limit` | `1mb` | Maximum body size (number of bytes or string like `"10mb"`) |
| `type` | `"application/json"` | Content-Type to match (string, RegExp, or function) |

### `urlencoded(options?)`

Parses `application/x-www-form-urlencoded` request bodies.

| Option | Default | Description |
|--------|---------|-------------|
| `limit` | `1mb` | Maximum body size |
| `extended` | — | Accepted for compatibility; bunWay always uses `URLSearchParams` |
| `type` | `"application/x-www-form-urlencoded"` | Content-Type to match |

### `text(options?)`

Parses text bodies into `req.body` as a string.

| Option | Default | Description |
|--------|---------|-------------|
| `limit` | `1mb` | Maximum body size |
| `type` | `"text/plain"` | Content-Type to match |

### `raw(options?)`

Parses raw binary bodies into `req.body` as a `Buffer`.

| Option | Default | Description |
|--------|---------|-------------|
| `limit` | `100kb` | Maximum body size |
| `type` | `"application/octet-stream"` | Content-Type to match |
| `verify` | — | `(req, res, buf, encoding) => void` — throw to reject |

### `cors(options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `origin` | `"*"` | `"*"`, `true` (reflect), string, RegExp, array, or `(origin, req) => string \| false` |
| `methods` | All standard | Allowed HTTP methods |
| `allowedHeaders` | — | Allowed request headers (mirrors request headers if omitted) |
| `exposedHeaders` | — | Headers exposed to the browser |
| `credentials` | `false` | Send `Access-Control-Allow-Credentials` |
| `maxAge` | `600` | Preflight cache duration in seconds |
| `preflightContinue` | `false` | Pass preflight to next handler instead of auto-responding 204 |

```ts
// Dynamic origin
app.use(cors({
  origin: (origin, req) => {
    if (ALLOWED.includes(origin)) return origin;
    return false;  // reject
  },
  credentials: true,
}));
```

### `helmet(options?)`

Sets 13 security headers by default. All can be individually disabled or configured:

| Option | Default | Headers set |
|--------|---------|-------------|
| `contentSecurityPolicy` | on | `Content-Security-Policy` with safe defaults |
| `crossOriginEmbedderPolicy` | `"require-corp"` | `Cross-Origin-Embedder-Policy` |
| `crossOriginOpenerPolicy` | `"same-origin"` | `Cross-Origin-Opener-Policy` |
| `crossOriginResourcePolicy` | `"same-origin"` | `Cross-Origin-Resource-Policy` |
| `dnsPrefetchControl` | `"off"` | `X-DNS-Prefetch-Control` |
| `frameguard` | `"sameorigin"` | `X-Frame-Options` |
| `hidePoweredBy` | on | Removes `X-Powered-By` |
| `hsts` | `max-age=15552000; includeSubDomains` | `Strict-Transport-Security` |
| `ieNoOpen` | on | `X-Download-Options: noopen` |
| `noSniff` | on | `X-Content-Type-Options: nosniff` |
| `originAgentCluster` | `"?1"` | `Origin-Agent-Cluster` |
| `permittedCrossDomainPolicies` | `"none"` | `X-Permitted-Cross-Domain-Policies` |
| `referrerPolicy` | `"no-referrer"` | `Referrer-Policy` |
| `xssFilter` | `"0"` | `X-XSS-Protection` |

```ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://cdn.example.com"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: "deny" },
  crossOriginEmbedderPolicy: false,  // disable individual option
}));
```

### `rateLimit(options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `windowMs` | `60000` | Time window in ms |
| `max` | `100` | Max requests per window per key |
| `message` | `{ error: "Too many requests..." }` | Response body (string or object) |
| `statusCode` | `429` | Response status |
| `headers` | `true` | Send `X-RateLimit-*` and `Retry-After` headers |
| `keyGenerator` | `req.ip` | `(req) => string` — custom key |
| `skip` | — | `(req) => boolean` — return `true` to bypass |
| `onLimitReached` | — | `(req) => void` — fired when limit is hit |

The returned handler has two extra properties: `.reset()` clears the store, `.size` returns current store size.

Response headers set when `headers: true`: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (on rejection).

### `session(options)`

| Option | Default | Description |
|--------|---------|-------------|
| `secret` | required | String or array of strings for HMAC signing. First is active, rest verify old sessions. |
| `name` | `"connect.sid"` | Cookie name |
| `store` | `MemoryStore` | Session store (any `SessionStore`-compatible object) |
| `cookie.maxAge` | `86400000` | Session TTL in ms |
| `cookie.secure` | `false` | HTTPS-only cookie |
| `cookie.httpOnly` | `true` | Not accessible from JS |
| `cookie.sameSite` | `"lax"` | CSRF protection level |
| `cookie.path` | `"/"` | Cookie path |
| `resave` | `true` | Re-save unchanged sessions on every response |
| `saveUninitialized` | `true` | Save new sessions that haven't been modified |
| `rolling` | `false` | Re-send Set-Cookie on every response to extend TTL |
| `genid` | `() => uuid` | Custom session ID generator `(req) => string` |

**Session methods** — available on `req.session`:

```ts
req.session.userId = 42;                     // auto-persisted
req.session.regenerate(cb?);                 // new ID, same data reset
req.session.destroy(cb?);                    // delete session + clear cookie
req.session.reload(cb?);                     // reload from store
req.session.save(cb?);                       // force-save now
req.session.touch();                         // extend expiry
req.session.flash("error", "Bad password");  // write flash message
req.session.flash("error");                  // read & clear flash message
```

**Session stores:**

```ts
import { MemoryStore, FileStore, fromExpressStore } from "bunway";

// In-memory (development only — warns in production)
const store = new MemoryStore();

// File-based persistence
const store = new FileStore({ path: "./sessions", ttl: 86400000 });

// Wrap any Express-compatible (callback-based) store
const store = fromExpressStore(expressCompatibleStore);

app.use(session({ secret: "s3cr3t", store }));
```

> **Warning**: `MemoryStore` logs a warning in `NODE_ENV=production`. Use `FileStore` or a Redis-backed store for production.

### `cookieParser(secretOrOptions?)`

```ts
app.use(cookieParser());                         // no signing
app.use(cookieParser("secret"));                 // single secret
app.use(cookieParser(["new-secret", "old-secret"])); // key rotation
app.use(cookieParser({ secret: "s", decode: customDecode }));
```

- **Unsigned cookies** → `req.cookies`
- **Signed cookies** (`s:` prefix) → `req.signedCookies` (value is `false` if tampered)
- **JSON cookies** (`j:` prefix) → automatically parsed back to objects in both `req.cookies` and `req.signedCookies`
- Cookies signed with `s:` are removed from `req.cookies` and moved to `req.signedCookies`

```ts
import { signCookie, unsignCookie } from "bunway";

const signed = signCookie("value", "secret");
const original = unsignCookie(signed, "secret"); // "value" or false
```

### `csrf(options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `cookie.name` | `"_csrf"` | Cookie that stores the token |
| `cookie.secure` | `true` | HTTPS-only |
| `cookie.httpOnly` | `false` | Readable by JS (needed for SPA form submission) |
| `cookie.sameSite` | `"strict"` | SameSite attribute |
| `ignoreMethods` | `["GET","HEAD","OPTIONS"]` | Methods that skip CSRF check |
| `headerName` | `"x-csrf-token"` | Request header to read token from |
| `bodyField` | `"_csrf"` | Request body field to read token from |
| `tokenLength` | `32` | Token byte length |

`req.csrfToken()` returns the current token. Submit it via the `x-csrf-token` header or `_csrf` body field.

### `compression(options?)`

Negotiates `Accept-Encoding` and compresses string responses. Encoding priority: `br` (Brotli) → `gzip` → `deflate`.

| Option | Default | Description |
|--------|---------|-------------|
| `level` | `6` | Compression level (0–9) |
| `threshold` | `1024` | Minimum byte size to compress |
| `filter` | text/html, json, js, xml, svg | `(contentType) => boolean` |

### `logger(format?, options?)`

Morgan-compatible request logger.

**Predefined format names:** `combined`, `common`, `dev`, `short`, `tiny`

**Format tokens:** `:method`, `:url`, `:path`, `:status`, `:response-time`, `:content-length`, `:date`, `:referrer`, `:user-agent`, `:remote-addr`, `:remote-user`, `:http-version`

| Option | Default | Description |
|--------|---------|-------------|
| `skip` | — | `(req, res) => boolean` — return `true` to skip logging |
| `stream` | `process.stdout` | Object with `.write(msg)` — write to file, etc. |
| `immediate` | `false` | Log on request instead of response |
| `useAppLogger` | `false` | Use `app.getLogger()` instead of `stream` |

```ts
// Custom format function
app.use(logger((tokens, req, res, meta) => {
  return `${req.method} ${req.path} ${res.statusCode} ${meta.responseTime.toFixed(2)}ms`;
}));

// Skip health checks
app.use(logger("combined", { skip: (req) => req.path === "/health" }));

// Write to file
app.use(logger("combined", {
  stream: { write: (msg) => Bun.write("access.log", msg, { append: true }) },
}));
```

`dev` format adds ANSI colour-coded status codes when writing to a TTY.

### `timeout(ms, options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `statusCode` | `408` | Status code on timeout |
| `message` | `"Request Timeout"` | String or JSON object body |
| `respond` | `true` | If `false`, sets `req.timedout` but does not send a response |
| `skip` | — | `(req) => boolean` — bypass timeout for certain requests |

Sets `req.timedout = true` when the timer fires. Calls `next(error)` with `code: "ETIMEDOUT"`.

### `upload`

Multer-compatible multipart/form-data parser. Defaults to in-memory storage.

```ts
// Default (memory storage)
upload.single("avatar")       // req.file
upload.array("photos", 5)     // req.files (array)
upload.fields([{ name: "avatar", maxCount: 1 }, { name: "docs", maxCount: 3 }])
upload.none()                 // fields only, reject any file
upload.any()                  // accept all files, req.files (array)

// Custom storage/limits
const multer = upload({ storage: diskStorage({ destination: "./uploads" }), limits: { fileSize: 5 * 1024 * 1024 } });
app.post("/upload", multer.single("file"), handler);
```

**Storage engines:**

```ts
import { memoryStorage, diskStorage } from "bunway";

// Memory — req.file.buffer contains the data
const mem = memoryStorage();

// Disk — req.file.path, req.file.filename, req.file.destination
const disk = diskStorage({
  destination: "./uploads",                // or (req, file, cb) => cb(null, dir)
  filename: (req, file, cb) => cb(null, crypto.randomUUID()),
});
```

**Upload limits:**

| Limit | Default | Description |
|-------|---------|-------------|
| `fileSize` | unlimited | Max file size in bytes |
| `files` | unlimited | Max number of files |
| `fields` | unlimited | Max number of non-file fields |
| `fieldSize` | 1mb | Max field value size |
| `fieldNameSize` | 100 | Max field name length |
| `parts` | unlimited | Max total parts (files + fields) |

**Custom file filter:**

```ts
const multer = upload({
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Images only"), false);
  },
});
```

### `validate(schema, options?)`

Declarative schema validation for `body`, `query`, and `params`.

**Field rules:**

| Rule | Description |
|------|-------------|
| `required` | Field must be present and non-empty |
| `type` | `"string"`, `"number"`, `"integer"`, `"boolean"`, `"email"`, `"url"`, `"uuid"` |
| `min` / `max` | Min/max length (strings) or value (numbers) |
| `pattern` | RegExp the value must match |
| `enum` | Array of allowed values |
| `custom` | `(value, req) => boolean \| string \| Promise<...>` |
| `message` | Override default error message |
| `trim` | Trim whitespace before validation |
| `toLowerCase` | Lowercase before validation |
| `toNumber` | Convert string to number before validation |

**Validation options:**

| Option | Default | Description |
|--------|---------|-------------|
| `abortEarly` | `false` | Stop on first error |
| `statusCode` | `422` | HTTP status for errors |
| `errorFormatter` | `(errors) => ({ errors })` | Custom error response shape |
| `onError` | — | `(errors, req, res, next) => void` — full error control |

### `hpp(options?)`

Protects against HTTP Parameter Pollution.

| Option | Default | Description |
|--------|---------|-------------|
| `whitelist` | `[]` | Parameter names that may have multiple values |
| `checkQuery` | `true` | Sanitize `req.query` |
| `checkBody` | `true` | Sanitize `req.body` (urlencoded) |

Polluted values are stored in `req.locals.queryPolluted` and `req.locals.bodyPolluted` for inspection.

### `responseTime(options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `header` | `"X-Response-Time"` | Header name |
| `digits` | `3` | Decimal places |
| `suffix` | `true` | Append `ms` to the value |

### `requestId(options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `header` | `"X-Request-Id"` | Header to read/write |
| `generator` | `crypto.randomUUID` | Custom ID generator `() => string` |
| `setHeader` | `true` | Write the ID to the response header |

If the incoming request already has the header, its value is used (passthrough).

### `methodOverride(options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `getter` | `"X-HTTP-Method-Override"` | Header name, query/body field, or `(req) => string \| undefined` |

Only overrides `POST` requests. Allowed override values: `GET`, `HEAD`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`.

The `getter` string is checked in order: request header → query parameter → request body field.

### `serveStatic(root, options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `index` | `"index.html"` | Directory index file(s), or `false` to disable |
| `extensions` | `[]` | Try these extensions for extensionless URLs (e.g. `["html"]`) |
| `dotfiles` | `"ignore"` | `"allow"`, `"deny"`, or `"ignore"` |
| `maxAge` | `0` | `Cache-Control max-age` in ms |
| `immutable` | `false` | Add `immutable` to `Cache-Control` |
| `etag` | `true` | Generate and validate `ETag` |
| `lastModified` | `true` | Set and validate `Last-Modified` |
| `fallthrough` | `true` | Pass to `next()` on 404 instead of responding |
| `statCacheTtl` | `5000` | Stat cache TTL in ms. Set `0` to disable. |

Path traversal attacks are blocked using `realpathSync` in addition to prefix checking.

### `favicon(path, options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `maxAge` | `86400000` | Cache-Control max-age in ms (default 1 day) |

The favicon is read into memory at startup. `If-None-Match` / ETag cache validation is handled automatically. HEAD requests are supported.

### `errorHandler(options?)`

4-argument error handling middleware. Must be registered last.

| Option | Default | Description |
|--------|---------|-------------|
| `development` | `NODE_ENV !== "production"` | Include stack trace and request info |
| `includeStack` | `false` | Always include stack trace |
| `showRequestInfo` | `false` | Include `method` and `path` in response |
| `logger` | — | `(error, req) => void` custom logging function |
| `useAppLogger` | `false` | Use `app.getLogger()` for error logging |

When `development` is `true` and output is a TTY, errors are printed with ANSI colour-coded stack traces.

Integrates with `HttpError` — status, custom headers, and body are forwarded automatically.

```ts
app.use(errorHandler({ development: true }));

// Custom logger
app.use(errorHandler({
  logger: (err, req) => myLogger.error(err.message, { path: req.path }),
}));
```

### `sse(options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `heartbeatInterval` | `15000` | Ping interval in ms. Set `0` to disable. |

Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.

Adds `res.sendEvent(event, data, id?)` to the response object. Automatically cleans up the heartbeat timer when the client disconnects.

```ts
app.get("/events", sse(), (req, res) => {
  res.sendEvent("message", { text: "hello" });
  res.sendEvent("update", { id: 1 }, "evt-1");  // with event ID
  // connection stays open until client disconnects or res.end()
});
```

---

## Routing

### Basic Routes

```ts
app.get("/users", listUsers);
app.post("/users", createUser);
app.put("/users/:id", updateUser);
app.delete("/users/:id", deleteUser);
app.patch("/users/:id", patchUser);
app.options("/users", optionsHandler);
app.head("/users", headHandler);
app.all("/health", healthCheck);
```

### Regex Routes

```ts
// Match any path ending in /fly
app.get(/\/fly$/, (req, res) => {
  res.send("matched!");
});

// Named capture groups become req.params
app.get(/\/users\/(?<id>\d+)/, (req, res) => {
  res.json({ userId: req.params.id });
});
```

### Chainable Routes

```ts
app.route("/users")
  .get(listUsers)
  .post(requireAuth, createUser);

app.route("/users/:id")
  .get(getUser)
  .put(requireAuth, updateUser)
  .delete(requireAuth, requireAdmin, deleteUser);
```

### Sub-Routers & Mounting

```ts
import { Router } from "bunway";

const api = new Router();
api.get("/health", (req, res) => res.json({ ok: true }));
api.get("/users", listUsers);

app.use("/api", api);

// Array paths — mount on multiple prefixes
app.use(["/v1", "/v2"], api);
```

### Route Groups

```ts
// Inline group — no separate Router variable needed
app.group("/admin", (router) => {
  router.get("/dashboard", dashboardHandler);
  router.get("/users", adminUsersHandler);
});

// Group with shared middleware
app.group("/api", { middleware: [authenticate] }, (router) => {
  router.get("/profile", profileHandler);
});
```

### Param Inheritance

```ts
const posts = new Router({ mergeParams: true });

posts.get("/", (req, res) => {
  // req.params.userId inherited from parent
  res.json({ userId: req.params.userId });
});

app.use("/users/:userId/posts", posts);
// GET /users/42/posts → { "userId": "42" }
```

### Dynamic Mount Prefix

```ts
const comments = new Router({ mergeParams: true });
comments.get("/", (req, res) => {
  // req.params.postId from parent, req.params.commentId from own route
  res.json(req.params);
});
app.use("/posts/:postId/comments", comments);
```

### Route Parameter Pre-processing

```ts
// Called once per request per param name, before route handlers
app.param("userId", async (req, res, next, value, name) => {
  req.locals.user = await db.users.find(value);
  if (!req.locals.user) return res.status(404).json({ error: "Not Found" });
  next();
});

app.get("/users/:userId", (req, res) => {
  res.json(req.locals.user);  // already loaded by param handler
});
```

### Sub-App Mounting

```ts
const admin = bunway();
admin.get("/dashboard", (req, res) => {
  res.json({
    mountpath: admin.mountpath,  // "/admin"
    fullPath: admin.path(),      // "/admin"
  });
});

app.use("/admin", admin);
```

### Skip Signals

```ts
// next("route") — skip remaining handlers on the current route
app.get("/users/:id",
  (req, res, next) => {
    if (req.params.id === "me") return next("route");
    // handle numeric IDs
    next();
  },
  (req, res) => res.json({ type: "numeric" })
);
app.get("/users/:id", (req, res) => res.json({ type: "alias" }));

// next("router") — skip the rest of this router entirely
router.use((req, res, next) => {
  if (!req.headers.authorization) return next("router");
  next();
});
```

### Debugging Routes

```ts
// Print all registered routes (coloured by method in TTY)
app.printRoutes();
// GET    /
// GET    /users
// POST   /users
// GET    /users/:id
// WS     /chat

// Programmatic access
const routes = app.getRegisteredRoutes();
// [{ method: 'GET', path: '/', fullPath: '/' }, ...]
```

### Content Negotiation

```ts
app.get("/data", (req, res) => {
  // RFC 7231 quality-value parsing — picks the best match
  const best = req.accepts("json", "html", "xml");

  res.format({
    json: () => res.json({ data: "value" }),
    html: () => res.send("<p>value</p>"),
    default: () => res.status(406).send("Not Acceptable"),
  });
});
```

### Cache Validation & Range Requests

```ts
app.get("/data", (req, res) => {
  res.set("ETag", '"v1"');
  if (req.fresh) return res.status(304).end();
  res.json({ data: "expensive computation" });
});

// sendFile handles Range headers automatically
app.get("/video/:id", async (req, res) => {
  await res.sendFile(`./videos/${req.params.id}`, {
    lastModified: true,
    cacheControl: true,
    immutable: true,
  });
  // 200 full file, 206 partial content, 416 unsatisfiable — all automatic
});
```

### HTTPS / TLS

```ts
app.listen({
  port: 443,
  tls: {
    cert: await Bun.file("cert.pem").text(),
    key: await Bun.file("key.pem").text(),
    ca: await Bun.file("ca.pem").text(),   // optional
  },
});
```

### Graceful Shutdown

```ts
process.on("SIGTERM", async () => {
  await app.close();
  process.exit(0);
});
```

### WebSockets

```ts
// Basic WebSocket
app.ws("/chat", {
  open(ws) { ws.send("connected"); },
  message(ws, msg) { ws.send(`echo: ${msg}`); },
  close(ws, code, reason) { /* cleanup */ },
  drain(ws) { /* backpressure */ },
});

// WebSocket with middleware
app.ws("/secure", authenticate, rateLimiter, {
  open(ws) { ws.send("authenticated"); },
  message(ws, msg) { /* ... */ },
});

// WebSocket params
app.ws("/rooms/:roomId", {
  open(ws) {
    const { roomId } = ws.data.params;
    ws.subscribe(roomId);
  },
  message(ws, msg) {
    ws.publish(ws.data.params.roomId, msg);
  },
});
```

---

## Error Handling

### `HttpError`

Throw an `HttpError` anywhere in a handler or middleware — the router catches it and responds correctly.

```ts
import { HttpError, isHttpError } from "bunway";

app.get("/admin", (req, res, next) => {
  if (!req.session.user?.isAdmin) {
    throw new HttpError(403, "Forbidden");
  }
  res.json({ ok: true });
});

// Custom body and headers
throw new HttpError(422, "Validation failed", {
  body: { errors: [{ field: "email", message: "Invalid" }] },
  headers: { "X-Request-Id": req.id },
});

// Error guard
if (isHttpError(err)) {
  res.status(err.status).json({ error: err.message });
}
```

### Error Middleware

```ts
// 4-argument signature — Express error handler pattern
app.use((err, req, res, next) => {
  if (isHttpError(err)) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Or use the built-in errorHandler
app.use(errorHandler({ development: process.env.NODE_ENV !== "production" }));
```

---

## Template Rendering

Register a template engine and use `res.render()`:

```ts
import Eta from "eta";

app.set("view engine", "eta");
app.set("views", "./views");

app.engine("eta", (path, options, callback) => {
  Eta.renderFile(path, options)
    .then(html => callback(null, html))
    .catch(err => callback(err));
});

// app.locals is merged into every render call
app.locals.siteName = "My App";
app.locals.year = new Date().getFullYear();

app.get("/", (req, res) => {
  res.render("home", { title: "Welcome" });
});
```

---

## App Locals & Request Locals

```ts
// app.locals — available in every request handler and template render
app.locals.version = "1.0.0";

// res.locals — per-request, available in middleware chain and templates
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// req.locals — per-request, no special framework meaning
app.use((req, res, next) => {
  req.locals.startedAt = Date.now();
  next();
});
```

---

## Trust Proxy

Configure `trust proxy` to correctly resolve `req.ip`, `req.protocol`, and `req.hostname` behind a reverse proxy:

```ts
app.set("trust proxy", 1);                  // trust first hop
app.set("trust proxy", true);               // trust all (development only)
app.set("trust proxy", "loopback");         // 127.x.x.x, ::1
app.set("trust proxy", "linklocal");        // 169.254.x.x, fe80:
app.set("trust proxy", "uniquelocal");      // 10.x, 172.16–31.x, 192.168.x, fc00::/7
app.set("trust proxy", "192.168.1.0/24");  // CIDR notation
app.set("trust proxy", ["10.0.0.1", "192.168.1.0/24"]); // array
app.set("trust proxy", (ip, i) => i < 2);  // function: i = hop distance from client
```

---

## Custom Logging

Inject a custom logger (Pino, Winston, etc.) via the `"logger"` app setting. Any object matching the `BunWayLogger` interface is accepted:

```ts
import pino from "pino";

const log = pino();

app.set("logger", {
  info: (msg, meta) => log.info(meta, msg),
  warn: (msg, meta) => log.warn(meta, msg),
  error: (msg, meta) => log.error(meta, msg),
  debug: (msg, meta) => log.debug(meta, msg),
});

// Then enable logger middleware to use it
app.use(logger("combined", { useAppLogger: true }));
app.use(errorHandler({ useAppLogger: true }));
```

---

## Architecture

### Request Flow

```
Client Request
    │
    ▼
┌──────────────────────────────────────┐
│            Bun.serve()               │
│  (native HTTP, no Node.js polyfills) │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│         BunWayApp.dispatch()         │
│  - Wraps into BunRequest/BunResponse │
│  - Sets cross-refs (req.res, res.req)│
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│       Global Middleware Stack        │
│  cors → helmet → logger → json → …  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│         Router (fast-matcher)        │
│  - Static routes (O(1) lookup)       │
│  - Parameterized routes (:id)        │
│  - Regex routes (/pattern/)          │
│  - Sub-routers with mergeParams      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│           Route Handler              │
│     (req, res, next) => { ... }      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│    BunResponse → native Response     │
│  (headers merged, body serialized)   │
└──────────────────────────────────────┘
```

### Key Design Decisions

- **No Node.js polyfills** — Uses `Bun.serve()`, `Bun.file()`, native `Request`/`Response`
- **Mutable response pattern** — `BunResponse` collects headers/status/body, builds native `Response` at the end
- **Zero-copy file serving** — `res.sendFile()` uses `Bun.file()` for kernel-level efficiency
- **Three-tier route matching** — Static routes (hash lookup) → parameterized → regex, fastest match wins
- **Range request support** — `res.sendFile()` automatically handles `Range` headers (206 Partial Content)
- **405 Method Not Allowed** — Router distinguishes "path exists, wrong method" from "path not found"
- **Auto ETag** — Weak ETag generated automatically for 200 string responses (controlled by `etag` setting)

### Project Structure

```
src/
├── index.ts              # Public exports & factory function
├── types.ts              # Shared TypeScript types
├── core/
│   ├── app.ts            # BunWayApp — Bun.serve integration, dispatch
│   ├── router.ts         # Router — route matching, sub-routers, groups
│   ├── request.ts        # BunRequest — Express-compatible request object
│   ├── response.ts       # BunResponse — mutable response builder
│   ├── route.ts          # Chainable route definitions
│   ├── fast-matcher.ts   # Three-tier route pattern matching
│   └── errors.ts         # HttpError class + isHttpError guard
├── utils/
│   ├── content-negotiation.ts  # RFC 7231 quality-value parsing
│   ├── crypto.ts               # HMAC signing, ETag generation
│   ├── mime.ts                 # MIME type lookup
│   ├── url.ts                  # Fast pathname extraction
│   └── index.ts                # Util re-exports
└── middleware/
    ├── body-parser.ts    # json(), urlencoded(), text(), raw()
    ├── cors.ts           # CORS middleware
    ├── static.ts         # Static file serving
    ├── cookie-parser.ts  # Cookie parsing + signed cookies
    ├── session.ts        # Session management (MemoryStore, FileStore)
    ├── logger.ts         # Request logging (morgan-compatible)
    ├── csrf.ts           # CSRF protection
    ├── helmet.ts         # Security headers (CSP, HSTS, etc.)
    ├── compression.ts    # Response compression (br/gzip/deflate)
    ├── rate-limit.ts     # Rate limiting
    ├── upload.ts         # File uploads (multipart)
    ├── timeout.ts        # Request timeout
    ├── hpp.ts            # HTTP Parameter Pollution protection
    ├── validation.ts     # Request validation
    ├── favicon.ts        # Serve favicon.ico with ETag caching
    ├── method-override.ts # PUT/DELETE/PATCH from HTML forms
    ├── request-id.ts     # X-Request-Id generation
    ├── response-time.ts  # X-Response-Time header
    ├── sse.ts            # Server-Sent Events with heartbeat
    └── error-handler.ts  # Error handling middleware
```

---

## TypeScript

bunWay ships complete TypeScript types. All public types are importable:

```ts
import type {
  Handler,            // (req, res, next) => void
  ErrorHandler,       // (err, req, res, next) => void
  NextFunction,       // (err?: unknown) => void
  RouterOptions,      // { caseSensitive?, strict?, mergeParams? }
  ListenOptions,      // { port?, hostname?, tls? }
  TlsOptions,         // { key, cert, ca?, passphrase? }
  CookieOptions,      // { domain?, expires?, httpOnly?, maxAge?, path?, sameSite?, secure?, signed? }
  SendFileOptions,    // { maxAge?, root?, headers?, dotfiles?, lastModified?, cacheControl?, immutable?, acceptRanges? }
  BunWayOptions,      // RouterOptions & { settings? }
  BunWayLogger,       // { info, warn, error, debug? }
  WebSocketHandlers,  // { open?, message?, close?, drain? }
  BunWebSocket,       // ServerWebSocket<WebSocketData>
  RangeResult,        // RangeSpec[] & { type } | -1 | -2
  RangeSpec,          // { start: number; end: number }
  UploadedFile,       // { fieldname, originalname, encoding, mimetype, size, buffer?, path?, ... }

  // Middleware option types
  JsonOptions, UrlencodedOptions, TextOptions, RawOptions,
  CorsOptions, StaticOptions, CookieParserOptions, CompressionOptions,
  HelmetOptions, RateLimitOptions, CsrfOptions,
  SessionOptions, SessionStore, SessionData, Session, FileStoreOptions, LegacySessionStore,
  LoggerOptions, FormatFn, TokenFn, RequestMeta, TokenRegistry,
  UploadOptions, UploadLimits, DiskStorageOptions, FieldSpec, StorageEngine, UploadInstance,
  TimeoutOptions, HppOptions,
  ValidationSchema, ValidationOptions, ValidationError, FieldRule, ValidationSource,
  SseOptions, ResponseTimeOptions, RequestIdOptions, MethodOverrideOptions, FaviconOptions,
  ErrorHandlerOptions, HttpErrorOptions,
} from "bunway";
```

The constant `BUNWAY_DEFAULT_PORT` (value: `3000`) is also exported.

---

## Testing

```
1,662 tests | 3,653 assertions | 91 test files | ~4s on M-series Mac
```

Test categories:
- **Unit tests** — Every method on BunRequest, BunResponse, Router, and all middleware
- **Integration tests** — Full HTTP round-trips through `Bun.serve()`
- **Acceptance tests** — End-to-end feature validation
- **Express compatibility tests** — Behavior parity with Express.js

```bash
bun test                    # Run all tests
bun test tests/unit         # Unit tests only
bun test tests/integration  # Integration tests only
bun test tests/acceptance   # Acceptance tests only
bun test --watch            # Watch mode
```

---

## Development

```bash
git clone https://github.com/JointOps/bunway.git
cd bunway
bun install

bun test              # Run tests
bun run typecheck     # TypeScript validation
bun run build         # Compile to dist/
bun run docs:dev      # Run docs locally
bun run benchmark     # Performance benchmarks
```

---

## Contributing

bunWay is open source and community-driven. All contributions are welcome.

**Guidelines:**
1. **Stay Bun-native** — No Node.js-only dependencies
2. **Test everything** — Add tests for new features, maintain coverage
3. **Keep Express compatibility** — Same patterns, same API signatures
4. **TypeScript strict** — Full type safety, no `any` escapes

See the [Contributing Guide](https://bunway.jointops.dev/community/build-together.html) for details.

---

## Documentation

| Resource | Link |
|----------|------|
| Getting Started | [bunway.jointops.dev/guide/getting-started](https://bunway.jointops.dev/guide/getting-started.html) |
| Express Migration | [bunway.jointops.dev/guide/express-migration](https://bunway.jointops.dev/guide/express-migration.html) |
| Request & Response | [bunway.jointops.dev/guide/request-response](https://bunway.jointops.dev/guide/request-response.html) |
| Middleware Reference | [bunway.jointops.dev/middleware](https://bunway.jointops.dev/middleware/index.html) |
| API Reference | [bunway.jointops.dev/api](https://bunway.jointops.dev/api/index.html) |

---

## License

MIT © [JointOps](https://jointops.dev)

---

[Documentation](https://bunway.jointops.dev/) · [GitHub](https://github.com/JointOps/bunway) · [npm](https://www.npmjs.com/package/bunway) · [Discord](https://discord.gg/fTF4qjaMFT) · [Discussions](https://github.com/JointOps/bunway/discussions)
