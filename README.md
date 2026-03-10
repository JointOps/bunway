# bunWay

[![npm version](https://img.shields.io/npm/v/bunway.svg?logo=npm&label=npm)](https://www.npmjs.com/package/bunway)
[![CI](https://github.com/JointOps/bunway/actions/workflows/ci.yml/badge.svg)](https://github.com/JointOps/bunway/actions/workflows/ci.yml)
[![bun only](https://img.shields.io/badge/runtime-bun%201.1+-1e7c73?logo=bun&logoColor=white)](https://bun.sh)
[![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/bunway)
[![tests](https://img.shields.io/badge/tests-1662%20passing-brightgreen)]()
[![docs](https://img.shields.io/badge/docs-bunway.jointops.dev-3fc5b7)](https://bunway.jointops.dev/)
[![license](https://img.shields.io/badge/license-MIT-lightgrey.svg)](./LICENSE)

**Express API. Bun speed. Zero dependencies.**

bunWay is a web framework for Bun that speaks Express fluently. Same `(req, res, next)` signature. Same middleware patterns. Same routing. Just faster, lighter, and with 19 middleware built right in. No rewrites. No new API to learn. Drop it in and ship.

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

[Install](#getting-started) · [Why bunWay?](#why-bunway) · [Express Compatibility](#express-compatibility) · [Middleware](#built-in-middleware-19) · [Routing](#routing) · [Docs](https://bunway.jointops.dev/)

---

## Why bunWay?

### The problem

Building a production Express app means installing 15-30 packages: `cors`, `helmet`, `express-session`, `passport`, `morgan`, `compression`, `express-rate-limit`, `multer`, `cookie-parser`, `csurf`, `hpp`, `express-validator`, `connect-timeout`... each with its own version, its own types, its own maintenance burden.

bunWay ships all of that in a single import with zero dependencies.

### The comparison

| | Express + ecosystem | bunWay |
|---|---|---|
| **Runtime** | Node.js | Bun (native speed) |
| **Production dependencies** | 30+ packages for a real app | **0** |
| **Middleware** | Install, configure, and maintain separately | **19 built-in**, one import |
| **TypeScript** | `@types/express` + build step | Native. Strict types included. |
| **TLS/HTTPS** | `https.createServer(opts, app)` | `app.listen({ tls: { cert, key } })` |
| **API compatibility** | — | **97%+** Express 4.x parity |
| **Learning curve** | — | **None.** Same API. |

### By the numbers

| Metric | Value |
|--------|-------|
| Production dependencies | **0** |
| Built-in middleware | **19** |
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
| `app.use(middleware)` | Same | Middleware chains |
| `app.route('/path').get().post()` | Same | Chainable routes |
| `app.all('*', handler)` | Same | Catch-all routes |
| `express.Router()` | `bunway.Router()` | Sub-routers |
| `Router({ mergeParams: true })` | Same | Param inheritance |
| `app.use('/api', subApp)` | Same | Sub-app mounting |
| `app.mountpath` / `app.path()` | Same | Mount introspection |

### Request Object — Full Parity

| Express | bunWay | Notes |
|---------|--------|-------|
| `req.params`, `req.query`, `req.body` | Same | Core data access |
| `req.cookies`, `req.session`, `req.ip` | Same | Session & client info |
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
| `req.xhr`, `req.subdomains`, `req.path` | Same | Request introspection |
| `req.res`, `res.req`, `res.app` | Same | Cross-references |

### Response Object — Full Parity

| Express | bunWay | Notes |
|---------|--------|-------|
| `res.json()` | Same | Returns `this` for chaining |
| `res.send('hello')` | Same | Auto-detects Content-Type (string→html, object→JSON, buffer→octet-stream) |
| `res.status(201).json({...})` | Same | Chainable |
| `res.redirect(301, '/new')` | Same | Status + URL |
| `res.sendFile(path, opts, cb)` | Same | Callback, `lastModified`, `cacheControl`, `immutable`, range support |
| `res.download(path, name, cb)` | Same | Callback support |
| `res.attachment('file.pdf')` | Same | Auto-detects Content-Type from extension |
| `res.cookie()`, `res.clearCookie()` | Same | Cookie management |
| `res.set()`, `res.get()`, `res.type()` | Same | Header management |
| `res.sendStatus()`, `res.end()` | Same | `end()` supports encoding + callback |
| `res.format()` | Same | Content negotiation responses |
| `res.jsonp()` | Same | Configurable callback name |
| `res.write()` + `res.end()` | Same | Streaming responses |

### Routing — Full Parity

| Express | bunWay | Notes |
|---------|--------|-------|
| `app.get('/users/:id', handler)` | Same | Parameterized routes |
| `app.get(/\/fly$/, handler)` | Same | Regex routes with named capture groups |
| `app.all('*', handler)` | Same | Catch-all |
| `app.route('/path').get().post()` | Same | Chainable |
| `app.use(['/v1', '/v2'], router)` | Same | Array path mounting |
| `app.use('/api', express())` | Same | Sub-app mounting with `mountpath` |

### What's Different

| Express | bunWay | Why |
|---------|--------|-----|
| `app.listen()` returns `http.Server` | Returns `Bun.Server` | Different runtime |
| `https.createServer(opts, app)` | `app.listen({ tls })` | Bun-native TLS |
| Install 15+ middleware packages | `import { ... } from "bunway"` | All built-in |

[Full migration guide →](https://bunway.jointops.dev/guide/express-migration.html)

---

## Built-in Middleware (19)

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
  passport,       // Authentication strategies
  cookieParser,   // Cookie parsing

  // Observability
  logger,         // Request logging (morgan format strings)
  timeout,        // Request timeout with req.timedout flag
  compression,    // Gzip/deflate response compression
  errorHandler,   // Error handling middleware
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
app.use(passport.initialize());
app.use(passport.session());

// Logging (morgan format strings work)
app.use(logger("dev"));
app.use(logger(":method :url :status :response-time ms"));

// Request validation — declarative schema
app.post("/users", validate({
  body: {
    email: { required: true, isEmail: true },
    age: { required: true, isInt: { min: 18 } },
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
```

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
│   ├── fast-matcher.ts   # Three-tier route pattern matching
│   ├── errors.ts         # HttpError class
│   └── types.ts          # TypeScript definitions
├── utils/
│   └── content-negotiation.ts  # RFC 7231 quality-value parsing
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
