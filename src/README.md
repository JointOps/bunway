# bunWay

**If you know Express, you know bunWay.** Same middleware, same routing, same `(req, res, next)` flow—just faster on Bun.

## Quick Start

```bash
bun add bunway
```

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

## Built-in Middleware

All Express-compatible, all built-in:

| bunWay | Express Equivalent |
|--------|-------------------|
| `json()` | `express.json()` |
| `urlencoded()` | `express.urlencoded()` |
| `serveStatic()` | `express.static()` |
| `cors()` | `cors` |
| `helmet()` | `helmet` |
| `logger()` | `morgan` |
| `session()` | `express-session` |
| `csrf()` | `csurf` |
| `compression()` | `compression` |
| `rateLimit()` | `express-rate-limit` |
| `cookieParser()` | `cookie-parser` |

## Why bunWay?

- **Zero learning curve** — Same API patterns as Express
- **Batteries included** — Sessions, security, logging, rate limiting—all built-in
- **Bun-native** — Built on Bun.serve, no Node polyfills
- **Fast** — Bun is 3-4x faster than Node.js

## Learn More

- Documentation: https://bunway.jointops.dev/
- Express Migration: https://bunway.jointops.dev/guide/express-migration.html
- GitHub: https://github.com/JointOps/bunway
- npm: https://www.npmjs.com/package/bunway

## License

MIT © bunWay contributors
