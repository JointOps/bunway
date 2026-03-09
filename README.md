# bunWay

[![npm version](https://img.shields.io/npm/v/bunway.svg?logo=npm&label=npm)](https://www.npmjs.com/package/bunway)
[![CI](https://github.com/JointOps/bunway/actions/workflows/ci.yml/badge.svg)](https://github.com/JointOps/bunway/actions/workflows/ci.yml)
[![bun only](https://img.shields.io/badge/runtime-bun%201.1+-1e7c73?logo=bun&logoColor=white)](https://bun.sh)
[![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/bunway)
[![tests](https://img.shields.io/badge/tests-1642%20passing-brightgreen)]()
[![docs](https://img.shields.io/badge/docs-bunway.jointops.dev-3fc5b7)](https://bunway.jointops.dev/)
[![license](https://img.shields.io/badge/license-MIT-lightgrey.svg)](./LICENSE)

**Express API. Bun speed. Zero dependencies.**

bunWay is an Express-compatible web framework built natively for Bun. Same `(req, res, next)` signature, same middleware patterns, same routing — just faster. No rewrites. No new API to learn. Drop it in and go.

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

[Install](#getting-started) · [Express Migration](#express-compatibility) · [Middleware](#built-in-middleware-19) · [Architecture](#architecture) · [Docs](https://bunway.jointops.dev/)

---

## Why bunWay?

| | Express | bunWay |
|---|---------|--------|
| **Runtime** | Node.js | Bun (3-4x faster) |
| **Dependencies** | 30+ packages for a production stack | **0** production dependencies |
| **Middleware** | Install separately from npm | 19 built-in, ready to import |
| **TypeScript** | Needs `@types/express` + build step | Native, strict types included |
| **TLS/HTTPS** | `https.createServer(opts, app)` | `app.listen({ tls: { cert, key } })` |
| **Learning curve** | — | **None.** Same API. |

### By the Numbers

| Metric | Value |
|--------|-------|
| Production dependencies | **0** |
| Built-in middleware | **19** |
| Test suite | **1,642 tests**, 3,623 assertions |
| Express API coverage | **97%+** (req, res, router, middleware) |
| TypeScript coverage | **100%** strict mode |

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

---

## Express Compatibility

bunWay implements the Express API surface. Your existing code works.

### Core API

| Express | bunWay | Status |
|---------|--------|--------|
| `app.get()`, `post()`, `put()`, `delete()` | Same | Identical |
| `app.use(middleware)` | Same | Identical |
| `app.route('/path').get().post()` | Same | Identical |
| `express.Router()` | `bunway.Router()` | Same pattern |
| `Router({ mergeParams: true })` | Same | Identical |
| `req.params`, `req.query`, `req.body` | Same | Identical |
| `req.cookies`, `req.session`, `req.ip` | Same | Identical |
| `req.get()`, `req.is()`, `req.accepts()` | Same | RFC 7231 quality-value parsing |
| `req.protocol`, `req.secure`, `req.hostname` | Same | Identical |
| `req.fresh`, `req.stale` | Same | ETag + Last-Modified |
| `req.range(size)` | Same | Range header parsing |
| `req.res`, `res.req`, `res.app` | Same | Cross-references |
| `res.json()`, `res.send()`, `res.status()` | Same | Identical |
| `res.redirect()`, `res.sendFile()`, `res.download()` | Same | Identical |
| `res.cookie()`, `res.clearCookie()`, `res.type()` | Same | Identical |
| `res.set()`, `res.get()`, `res.sendStatus()` | Same | Identical |
| `res.jsonp()` | Same | Configurable callback name |
| `res.sendFile()` + Range | Same | Automatic 206 Partial Content |
| `app.use([paths], handler)` | Same | Array path mounting |
| `https.createServer(opts, app)` | `app.listen({ tls })` | Native TLS |
| `server.close(cb)` | `app.close(cb)` | Graceful shutdown |
| Content Negotiation | Same | RFC 7231 quality-value parsing (replaces `accepts` + `type-is`) |
| Regex Routes | Same | `app.get(/pattern/, handler)` with named capture groups |
| `res.send()` Auto-detect | Same | String→text/html, Object→JSON, Buffer→octet-stream |
| `app.mountpath` | Same | Set on sub-app mount |
| `res.sendFile()` Callback | Same | `res.sendFile(path, options, callback)` |

### Middleware Mapping

Every Express middleware has a built-in bunWay equivalent:

| Express Package | bunWay Import | What It Does |
|----------------|---------------|--------------|
| `express.json()` | `json()` | Parse JSON bodies |
| `express.urlencoded()` | `urlencoded()` | Parse form data |
| `express.text()` | `text()` | Parse text bodies |
| `express.raw()` | `raw()` | Parse raw binary (webhooks) |
| `express.static()` | `serveStatic()` | Static file serving |
| `cors` | `cors()` | CORS headers |
| `helmet` | `helmet()` | Security headers |
| `morgan` | `logger()` | Request logging |
| `express-session` | `session()` | Session management |
| `passport` | `passport()` | Authentication |
| `csurf` | `csrf()` | CSRF protection |
| `compression` | `compression()` | Gzip/deflate |
| `express-rate-limit` | `rateLimit()` | Rate limiting |
| `cookie-parser` | `cookieParser()` | Cookie parsing |
| `multer` | `upload()` | File uploads (multipart) |
| Custom | `errorHandler()` | Error handling |
| `connect-timeout` | `timeout()` | Request timeout |
| `hpp` | `hpp()` | HPP protection |
| `express-validator` | `validate()` | Request validation |

No `npm install`. No version conflicts. One import.

[Full migration guide →](https://bunway.jointops.dev/guide/express-migration.html)

---

## Built-in Middleware (19)

```ts
import {
  json,           // JSON body parsing
  urlencoded,     // URL-encoded form data
  text,           // Text body parsing
  raw,            // Raw binary bodies (webhook signatures)
  upload,         // File uploads (multer-compatible)
  cors,           // CORS headers
  helmet,         // Security headers (CSP, HSTS, etc.)
  session,        // Session management (memory + file stores)
  passport,       // Authentication strategies
  logger,         // Request logging (morgan format strings)
  csrf,           // CSRF protection
  compression,    // Gzip/deflate response compression
  rateLimit,      // Rate limiting per IP
  serveStatic,    // Static file serving
  cookieParser,   // Cookie parsing
  errorHandler,   // Error handling middleware
  timeout,        // Request timeout with req.timedout flag
  hpp,            // HTTP Parameter Pollution protection
  validate,       // Schema-based request validation
} from "bunway";
```

### Usage Examples

```ts
// Body parsing
app.use(json({ limit: "10mb" }));
app.use(urlencoded({ extended: true }));

// Webhook signature verification
app.post("/webhook/stripe", raw({
  type: "application/json",
  verify: (req, res, buf) => {
    const sig = req.get("stripe-signature");
    if (!verifySignature(buf, sig)) throw new Error("Bad signature");
  },
}), handler);

// File uploads (multer API)
app.post("/upload", upload.single("avatar"), (req, res) => {
  res.json({ file: req.file.originalname, size: req.file.size });
});

// Sessions
app.use(session({ secret: "my-secret", cookie: { maxAge: 86400000 } }));

// Logging (morgan format strings work)
app.use(logger("dev"));
app.use(logger(":method :url :status :response-time ms"));

// Security
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(csrf());

// Static files
app.use(serveStatic("public"));
app.use("/assets", serveStatic("assets", { maxAge: 86400000 }));
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
│  - Parameterized routes (:id, *)     │
│  - Sub-routers with mergeParams      │
│  - Array path mounting               │
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

### Project Structure

```
src/
├── index.ts              # Public exports & factory function
├── core/
│   ├── app.ts            # BunWayApp — Bun.serve integration, dispatch
│   ├── router.ts         # Router — route matching, sub-routers
│   ├── request.ts        # BunRequest — Express-compatible request object
│   ├── response.ts       # BunResponse — mutable response builder
│   ├── route.ts          # Chainable route definitions
│   ├── fast-matcher.ts   # High-performance route pattern matching
│   ├── errors.ts         # HttpError class
│   └── types.ts          # TypeScript definitions
└── middleware/
    ├── body-parser.ts    # json(), urlencoded(), text(), raw()
    ├── cors.ts           # CORS middleware
    ├── static.ts         # Static file serving
    ├── cookie-parser.ts  # Cookie parsing
    ├── session.ts        # Session management
    ├── auth.ts           # Passport-style authentication
    ├── logger.ts         # Request logging
    ├── csrf.ts           # CSRF protection
    ├── security.ts       # Helmet security headers
    ├── compression.ts    # Response compression
    ├── rate-limit.ts     # Rate limiting
    ├── upload.ts         # File uploads (multipart)
    ├── timeout.ts        # Request timeout
    ├── hpp.ts            # HTTP Parameter Pollution protection
    ├── validation.ts     # Request validation
    └── error-handler.ts  # Error handling
```

### Key Design Decisions

- **No Node.js polyfills** — Uses `Bun.serve()`, `Bun.file()`, native `Request`/`Response`
- **Mutable response pattern** — `BunResponse` collects headers/status/body, builds native `Response` at the end
- **Middleware header merging** — Router finalizer merges headers from all middleware in the chain
- **Zero-copy file serving** — `res.sendFile()` uses `Bun.file()` for kernel-level efficiency
- **Range request support** — `res.sendFile()` automatically handles `Range` headers (206 Partial Content)

---

## Routing

### Basic Routes

```ts
app.get("/users", listUsers);
app.post("/users", createUser);
app.put("/users/:id", updateUser);
app.delete("/users/:id", deleteUser);
app.all("/health", healthCheck);
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

### Sub-Routers

```ts
import { Router } from "bunway";

const api = new Router();
api.get("/health", (req, res) => res.json({ ok: true }));
api.get("/users", listUsers);

app.use("/api", api);

// Array paths — mount on multiple prefixes
app.use(["/v1", "/v2"], api);
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

### Cache Validation

```ts
app.get("/data", (req, res) => {
  res.set("ETag", '"v1"');
  if (req.fresh) {
    res.status(304).end();
    return;
  }
  res.json({ data: "expensive computation" });
});
```

### Range Requests & Streaming

```ts
// Automatic — sendFile handles Range headers
app.get("/video/:id", async (req, res) => {
  await res.sendFile(`./videos/${req.params.id}`);
  // 200 full file, 206 partial content, 416 unsatisfiable — all automatic
});

// Manual range parsing
app.get("/custom", (req, res) => {
  const ranges = req.range(fileSize);
  if (ranges === -1) return res.status(416).end();
  if (ranges === -2) return res.status(400).end();
  // ranges[0].start, ranges[0].end
});
```

### JSONP

```ts
app.set("jsonp callback name", "cb");
app.get("/api/data", (req, res) => {
  res.jsonp({ name: "bunway" });
});
// GET /api/data?cb=fn → fn({"name":"bunway"});
// GET /api/data → {"name":"bunway"}
```

### HTTPS / TLS

```ts
app.listen({
  port: 443,
  tls: {
    cert: await Bun.file("cert.pem").text(),
    key: await Bun.file("key.pem").text(),
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
app.ws("/chat", {
  open(ws) { ws.send("connected"); },
  message(ws, msg) { ws.send(`echo: ${msg}`); },
  close(ws) { /* cleanup */ },
});
```

---

## Testing

```
1,642 tests | 3,623 assertions | 91 test files | ~4s on M-series Mac
```

Test categories:
- **Unit tests** — Every method on BunRequest, BunResponse, Router
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
