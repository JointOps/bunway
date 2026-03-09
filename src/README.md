# bunWay

**Express API. Bun speed. Zero dependencies. 19 middleware built in.**

Stop choosing between rewriting your backend and missing out on Bun's performance. bunWay gives you a third option: **change your import and ship.**

```ts
// before
const express = require("express");
const app = express();

// after
import { bunway } from "bunway";
const app = bunway();

// everything else stays the same.
```

Same `(req, res, next)`. Same middleware. Same routing. Same muscle memory. **97% Express API parity** — verified by 1,662 tests.

---

## Install

```bash
bun add bunway
```

## 30 Seconds to Production-Ready

```ts
import { bunway, json, cors, helmet, logger, session, rateLimit, hpp } from "bunway";

const app = bunway();

app.use(cors());
app.use(helmet());
app.use(hpp());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(logger("dev"));
app.use(json());
app.use(session({ secret: "keyboard cat" }));

app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

app.listen(3000);
```

That's CORS, security headers, parameter pollution protection, rate limiting, logging, body parsing, and sessions. **One import. Zero npm packages to install.**

In Express, that's 8 separate `npm install` commands, 8 packages to audit, 8 sets of types to maintain.

---

## What Express Takes 8 Packages to Do, bunWay Does With One Import

| What You Need | Express Ecosystem | bunWay |
|---|---|---|
| JSON & form parsing | `express.json()` + `express.urlencoded()` | `json()` + `urlencoded()` |
| Text & binary bodies | `body-parser` | `text()` + `raw()` |
| File uploads | `multer` | `upload()` — same API |
| CORS | `cors` | `cors()` |
| Security headers | `helmet` | `helmet()` |
| Sessions | `express-session` | `session()` |
| Authentication | `passport` | `passport()` |
| Logging | `morgan` | `logger()` — same format strings |
| CSRF protection | `csurf` | `csrf()` |
| Compression | `compression` | `compression()` |
| Rate limiting | `express-rate-limit` | `rateLimit()` |
| Static files | `express.static()` | `serveStatic()` |
| Cookies | `cookie-parser` | `cookieParser()` |
| Request timeout | `connect-timeout` | `timeout()` |
| HPP protection | `hpp` | `hpp()` |
| Request validation | `express-validator` | `validate()` |
| Error handling | Custom middleware | `errorHandler()` |

**19 middleware. Zero dependencies. One `import` statement.**

---

## Everything You Know About Express Works Here

### Routing — All of It

```ts
// Parameterized routes
app.get("/users/:id", getUser);

// Chainable routes
app.route("/posts").get(list).post(auth, create).delete(auth, admin, remove);

// Regex routes with named capture groups
app.get(/\/users\/(?<id>\d+)/, (req, res) => {
  res.json({ id: req.params.id }); // captured from regex
});

// Sub-routers with param inheritance
const posts = new Router({ mergeParams: true });
posts.get("/", (req, res) => res.json({ userId: req.params.userId }));
app.use("/users/:userId/posts", posts);

// Array path mounting
app.use(["/v1", "/v2"], apiRouter);

// Catch-all
app.all("*", (req, res) => res.status(404).json({ error: "Not found" }));
```

### Content Negotiation — RFC 7231 Compliant

```ts
// Quality-value parsing, not substring matching
const best = req.accepts("json", "html", "xml"); // picks highest q-value match
req.is("text/*");                                 // wildcard MIME matching
req.acceptsLanguages("en");                       // matches en-US, en-GB
```

### Response — Express-Identical Behavior

```ts
res.send("hello");          // → text/html; charset=utf-8
res.send({ ok: true });     // → application/json
res.send(buffer);           // → application/octet-stream
res.status(201).json(data); // chainable

// File serving with range support, caching, and callbacks
await res.sendFile("./video.mp4", {
  lastModified: true,
  cacheControl: true,
  immutable: true,
}, (err) => { if (err) console.error(err); });
// 200 full, 206 partial, 416 unsatisfiable — automatic

res.download("./report.pdf", "Q1-Report.pdf", (err) => { /* ... */ });
res.attachment("invoice.pdf"); // sets Content-Disposition + Content-Type
```

### Sub-App Mounting

```ts
const admin = bunway();
admin.get("/dashboard", handler);
app.use("/admin", admin);

console.log(admin.mountpath); // "/admin"
console.log(admin.path());    // "/admin"
```

### Request Validation — Declarative

```ts
app.post("/users", validate({
  body: {
    email: { required: true, isEmail: true },
    age: { required: true, isInt: { min: 18 } },
    name: { required: true, isLength: { min: 2, max: 50 } },
  }
}), createUser);
// Invalid? → 422 with structured error response. No boilerplate.
```

### Security — Production-Ready Out of the Box

```ts
app.use(helmet());                                         // 11 security headers
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })); // per-IP rate limiting
app.use(hpp());                                             // parameter pollution protection
app.use(csrf());                                            // CSRF tokens
app.use(timeout(5000));                                     // 408 on slow requests
```

### Beyond Express

```ts
// Native HTTPS — no http.createServer ceremony
app.listen({ port: 443, tls: { cert, key } });

// WebSockets — built in
app.ws("/chat", {
  open(ws) { ws.send("connected"); },
  message(ws, msg) { ws.send(`echo: ${msg}`); },
});

// Graceful shutdown
process.on("SIGTERM", () => app.close());
```

---

## The Numbers

| | Value |
|---|---|
| Production dependencies | **0** |
| Built-in middleware | **19** |
| Express API parity | **97%+** |
| Test suite | **1,662 tests** · 3,653 assertions |
| TypeScript | **Strict mode** · no `any` · types included |

---

## Who Is bunWay For?

- **Express developers** who want Bun's speed without learning a new API
- **Teams migrating to Bun** who refuse to rewrite working code
- **New projects** that want Express patterns without the dependency tree
- **Anyone tired** of `npm install`-ing 15 packages before writing a single route

---

## The Mission

**Make Bun accessible to every Express developer on earth.** No rewrites. No new patterns to memorize. You bring your Express knowledge — bunWay brings Bun's performance.

---

[Documentation](https://bunway.jointops.dev/) · [Express Migration Guide](https://bunway.jointops.dev/guide/express-migration.html) · [GitHub](https://github.com/JointOps/bunway) · [Discord](https://discord.gg/fTF4qjaMFT)

MIT © [JointOps](https://jointops.dev)
