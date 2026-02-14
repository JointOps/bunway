# bunWay

[![npm version](https://img.shields.io/npm/v/bunway.svg?logo=npm&label=npm)](https://www.npmjs.com/package/bunway)
[![CI](https://github.com/JointOps/bunway/actions/workflows/ci.yml/badge.svg)](https://github.com/JointOps/bunway/actions/workflows/ci.yml)
[![bun only](https://img.shields.io/badge/runtime-bun%201.1+-1e7c73?logo=bun&logoColor=white)](https://bun.sh)
[![docs](https://img.shields.io/badge/docs-bunway.jointops.dev-3fc5b7)](https://bunway.jointops.dev/)
[![license](https://img.shields.io/badge/license-MIT-lightgrey.svg)](./LICENSE)

**If you know Express, you know bunWay.** Same middleware, same routing, same `(req, res, next)` flow—just faster on Bun.

```ts
import { bunway, cors, helmet, logger, json, session } from "bunway";

const app = bunway();

app.use(cors());
app.use(helmet());
app.use(logger('dev'));
app.use(json());
app.use(session({ secret: 'my-secret' }));

app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

app.listen(3000);
```

Same code you'd write in Express. Just faster.

## Quick links

- 🚀 [Install](#getting-started)
- 🔄 [Coming from Express?](#express-compatibility)
- 📚 [Docs](https://bunway.jointops.dev/)
- 🧩 [Middleware](#built-in-middleware)
- 🤝 [Contributing](#contributing)

## Why bunWay?

- **Zero learning curve** — Same API patterns as Express
- **Batteries included** — Sessions, security, logging, rate limiting—all built-in
- **Bun-native** — Built on Bun.serve, no Node polyfills
- **Fast** — Bun is 3-4x faster than Node.js

## Express Compatibility

bunWay is designed for Express developers who want Bun's speed without learning a new framework.

| Express | bunWay |
|---------|--------|
| `app.get('/users/:id', (req, res) => {...})` | Same |
| `app.route('/path').get(...).post(...)` | Same |
| `req.params`, `req.query`, `req.body` | Same |
| `res.json()`, `res.send()`, `res.status()` | Same |
| `app.use(middleware)` | Same |
| `express.Router()` | `bunway.Router()` |

### Middleware Mapping

| Express | bunWay | Description |
|---------|--------|-------------|
| `express.json()` | `json()` | Parse JSON bodies |
| `express.urlencoded()` | `urlencoded()` | Parse form data |
| `express.static()` | `serveStatic()` | Static files |
| `cors` | `cors()` | CORS headers |
| `helmet` | `helmet()` | Security headers |
| `morgan` | `logger()` | Request logging |
| `express-session` | `session()` | Sessions |
| `csurf` | `csrf()` | CSRF protection |
| `compression` | `compression()` | Gzip responses |
| `express-rate-limit` | `rateLimit()` | Rate limiting |
| `cookie-parser` | `cookieParser()` | Cookie parsing |
| `passport` | `passport()` | Authentication |

[Full migration guide →](https://bunway.jointops.dev/guide/express-migration.html)

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

## Built-in Middleware

All Express-compatible, all built-in:

```ts
import {
  json,           // Parse JSON bodies
  urlencoded,     // Parse form data
  cors,           // CORS headers
  helmet,         // Security headers
  session,        // Session management
  passport,       // Authentication
  logger,         // Request logging (morgan-compatible)
  csrf,           // CSRF protection
  compression,    // Gzip/deflate
  rateLimit,      // Rate limiting
  serveStatic,    // Static files
  cookieParser,   // Cookie parsing
  errorHandler    // Error handling
} from "bunway";
```

### Quick Examples

```ts
// Sessions
app.use(session({ secret: 'my-secret' }));
app.get('/profile', (req, res) => {
  req.session.views = (req.session.views || 0) + 1;
  res.json({ views: req.session.views });
});

// Logging
app.use(logger('dev'));              // Morgan formats work
app.use(logger(':method :url :status'));

// Security
app.use(helmet());
app.use(rateLimit({ windowMs: 60000, max: 100 }));

// Static files
app.use(serveStatic('public'));
```

## Documentation

- [Getting Started](https://bunway.jointops.dev/guide/getting-started.html)
- [Express Migration Guide](https://bunway.jointops.dev/guide/express-migration.html)
- [Middleware Reference](https://bunway.jointops.dev/middleware/index.html)
- [API Reference](https://bunway.jointops.dev/api/index.html)

## Project Setup

```bash
bun install        # Install dependencies
bun test           # Run tests
bun run typecheck  # TypeScript check
bun run build      # Build to dist/
bun run docs:dev   # Run docs locally
```

## Contributing

bunWay belongs to the community. Contributions welcome!

1. **Stay Bun-native** — No Node-only dependencies
2. **Test & document** — Add tests, update docs
3. **Keep it Express-compatible** — Same patterns, same APIs

See [Contributing Guide](https://bunway.jointops.dev/community/build-together.html).

## License

MIT © bunWay contributors

## Links

- [Documentation](https://bunway.jointops.dev/)
- [GitHub](https://github.com/JointOps/bunway)
- [npm](https://www.npmjs.com/package/bunway)
- [Discussions](https://github.com/JointOps/bunway/discussions)
