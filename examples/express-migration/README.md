# Express → bunway Migration Example

This directory demonstrates how easy it is to migrate an Express application to bunway.

## The Promise

> "If you know Express, you know bunway. Change one import line. Your app runs on Bun. Faster."

## What's Inside

- **`express-version/`** - Full-featured Express app with auth, CRUD, uploads, sessions
- **`bunway-version/`** - Same app migrated to bunway with minimal changes

## Side-by-Side Comparison

### Dependencies

| Express | bunway |
|---------|--------|
| 7+ npm packages | 1 package |
| express, express-session, passport, helmet, cors, express-rate-limit, cookie-parser, multer | bunway |
| ~1.5MB node_modules | ~150KB |

### Code Changes

**Express:**
```javascript
import express from "express";
import session from "express-session";
import helmet from "helmet";
import cors from "cors";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
```

**bunway:**
```typescript
import bunway from "bunway";

const app = bunway();
app.use(bunway.helmet());
app.use(bunway.cors());
app.use(bunway.json());
```

**Everything else stays the same.**

### Features That Just Work

Both versions have identical functionality:

- ✅ Passport authentication with sessions
- ✅ CRUD operations with validation
- ✅ File uploads (multipart/form-data)
- ✅ Static file serving
- ✅ Security middleware (Helmet, CORS, rate limiting)
- ✅ Cookie parsing
- ✅ Error handling (sync + async)
- ✅ Request/response API (`req.params`, `res.json()`, etc.)

### What You Gain

- **3-10x faster** request throughput (Bun vs Node.js)
- **Smaller bundle** - single package vs dependency tree
- **Automatic async error handling** - no try/catch needed
- **Native TypeScript** - built-in, not bolted-on
- **Faster cold start** - < 10ms vs ~100ms

## Try It Yourself

### Run Express Version

```bash
cd express-version
npm install
npm start
```

Visit http://localhost:3000

### Run bunway Version

```bash
cd bunway-version
bun install
bun start
```

Visit http://localhost:3000

**Same endpoints. Same behavior. Faster runtime.**

## Migration Checklist

Migrating your Express app to bunway:

1. ✅ Replace Express + middleware packages with `bunway`
2. ✅ Change `import express from "express"` → `import bunway from "bunway"`
3. ✅ Change `const app = express()` → `const app = bunway()`
4. ✅ Update middleware: `helmet()` → `bunway.helmet()`, etc.
5. ✅ Test your app - routes, middleware, error handling should work identically

That's it. No rewrite needed.

## Validation

This example serves as our canary - proof that bunway delivers on the "just migrate" promise. If this example works, your Express app will too.

## Next Steps

See the [bunway documentation](https://bunway.jointops.dev) for:
- Full API reference
- Migration guide
- Performance benchmarks
- Advanced patterns
