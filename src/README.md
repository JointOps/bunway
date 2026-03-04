# bunWay

**Your Express code. Bun's speed. Zero changes.**

bunWay exists for one reason: **you shouldn't have to rewrite your backend to get faster performance.** If you know Express, you already know bunWay. Same middleware. Same routing. Same `(req, res, next)`. Just swap the import and you're running on Bun.

## The Problem

Migrating to Bun means choosing between:
- **Rewriting everything** for a new framework's API
- **Staying on Node.js** and missing out on Bun's speed

bunWay gives you a third option: **change nothing.**

## Install

```bash
bun add bunway
```

## 30-Second Setup

```ts
import { bunway, json, cors, helmet, logger } from "bunway";

const app = bunway();

app.use(cors());
app.use(helmet());
app.use(logger("dev"));
app.use(json());

app.get("/", (req, res) => {
  res.json({ message: "Hello from bunWay!" });
});

app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

app.listen(3000);
```

That's real, working code. If it looks like Express, that's the point.

## What You Get

### 16 Built-in Middleware — No npm Install Required

| What You Need | Express (separate package) | bunWay (built-in) |
|--------------|---------------------------|-------------------|
| JSON parsing | `express.json()` | `json()` |
| Form data | `express.urlencoded()` | `urlencoded()` |
| File uploads | `multer` | `upload()` |
| CORS | `cors` | `cors()` |
| Security headers | `helmet` | `helmet()` |
| Sessions | `express-session` | `session()` |
| Auth | `passport` | `passport()` |
| Logging | `morgan` | `logger()` |
| CSRF protection | `csurf` | `csrf()` |
| Compression | `compression` | `compression()` |
| Rate limiting | `express-rate-limit` | `rateLimit()` |
| Static files | `express.static()` | `serveStatic()` |
| Cookies | `cookie-parser` | `cookieParser()` |
| Raw bodies | `body-parser.raw()` | `raw()` |
| Text bodies | `body-parser.text()` | `text()` |
| Error handling | Custom middleware | `errorHandler()` |

One import. No version conflicts. No `node_modules` sprawl.

### Express API — Fully Compatible

Everything you expect from Express works:

```ts
// Routing
app.get("/users/:id", handler);
app.route("/posts").get(list).post(auth, create);

// Sub-routers
const api = new Router({ mergeParams: true });
app.use("/api", api);

// Array paths
app.use(["/v1", "/v2"], apiRouter);

// Cache validation
if (req.fresh) { res.status(304).end(); return; }

// File streaming with automatic range support
await res.sendFile("./video.mp4"); // Handles 206 Partial Content

// JSONP
res.jsonp({ data: "value" }); // ?callback=fn → fn({"data":"value"})

// Native HTTPS
app.listen({ port: 443, tls: { cert, key } });

// Graceful shutdown
await app.close();
```

## Who Is bunWay For?

- **Express developers** who want Bun's speed without learning a new framework
- **Teams migrating to Bun** who don't want to rewrite their backend
- **New projects** that want Express patterns with modern performance
- **Anyone tired** of installing 15 separate middleware packages

## Our Mission

**Make Bun accessible to every Express developer.** No rewrites. No new patterns to memorize. No breaking changes to your mental model. You bring your Express knowledge — we bring Bun's performance.

## Learn More

- **Documentation**: [bunway.jointops.dev](https://bunway.jointops.dev/)
- **Express Migration Guide**: [bunway.jointops.dev/guide/express-migration](https://bunway.jointops.dev/guide/express-migration.html)
- **GitHub**: [github.com/JointOps/bunway](https://github.com/JointOps/bunway)
- **Discord**: [discord.gg/fTF4qjaMFT](https://discord.gg/fTF4qjaMFT)

## License

MIT © [JointOps](https://jointops.dev)
