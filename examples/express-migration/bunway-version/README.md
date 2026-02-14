# TaskAPI - bunway Version

Same TaskAPI, now running on bunway with minimal changes from Express.

## What Changed?

**Express version dependencies (7+ packages):**
```json
{
  "express": "^5.2.1",
  "express-session": "^1.18.1",
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "helmet": "^8.0.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^7.5.0",
  "cookie-parser": "^1.4.7",
  "multer": "^1.4.5-lts.1"
}
```

**bunway version dependencies (1 package):**
```json
{
  "bunway": "^1.0.0"
}
```

## Code Changes

**Before (Express):**
```javascript
import express from "express";
import session from "express-session";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import multer from "multer";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static("./public"));
```

**After (bunway):**
```typescript
import bunway from "bunway";

const app = bunway();
app.use(bunway.helmet());
app.use(bunway.cors());
app.use(bunway.json());
app.use(bunway.cookieParser());
app.use(bunway.static("./public"));
```

**That's it.** Same `(req, res, next)` API. Same patterns. Faster runtime.

## Features

Features implemented in bunway v1.0.0:

- ✅ Authentication (Passport.js)
- ✅ Sessions (cookie-based)
- ✅ Security (Helmet, CORS, rate limiting)
- ✅ Static Files
- ✅ Error Handling (automatic async error catching!)
- ✅ CRUD Operations
- ⏳ File Uploads - Coming in v1.0.4 (Phase 1.4)

**Note:** The file upload endpoint uses `bunway.upload()` which will be available in v1.0.4. All other features work identically to the Express version right now.

## Installation

```bash
bun install
```

## Run

```bash
bun start
```

Server runs on http://localhost:3000

## Test Users

- `admin` / `password123`
- `user` / `userpass`

## Performance

bunway runs on Bun, which is 3-10x faster than Node.js. Same code, better performance.

## Migration Notes

- Zero breaking changes in the API surface
- All middleware patterns work identically
- Async errors are automatically caught (no try/catch needed!)
- Single package instead of many dependencies
- Full TypeScript support out of the box
