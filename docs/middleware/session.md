---
title: Session Middleware
description: Express-session compatible session management for bunWay with memory and file stores.
---

# Session Middleware

Session management compatible with `express-session`. Store user data across requests with built-in memory and file stores.

## Quick Start

```ts
import { bunway, session } from 'bunway';

const app = bunway();

app.use(session({
  secret: 'your-secret-key',
  cookie: { maxAge: 86400000 } // 24 hours
}));

app.get('/profile', (req, res) => {
  req.session.views = (req.session.views || 0) + 1;
  res.json({ views: req.session.views });
});

app.listen(3000);
```

## Options

```ts
interface SessionOptions {
  secret: string;              // Required: signing secret
  name?: string;               // Cookie name (default: 'connect.sid')
  cookie?: {
    maxAge?: number;           // Cookie lifetime in ms (default: 86400000)
    secure?: boolean;          // HTTPS only (default: false)
    httpOnly?: boolean;        // HTTP only (default: true)
    path?: string;             // Cookie path (default: '/')
    sameSite?: 'strict' | 'lax' | 'none';  // SameSite (default: 'lax')
  };
  store?: SessionStore;        // Custom store (default: MemoryStore)
  resave?: boolean;            // Force save unchanged sessions
  saveUninitialized?: boolean; // Save new empty sessions (default: true)
  rolling?: boolean;           // Reset cookie on each request
  genid?: () => string;        // Custom session ID generator
}
```

## Session Object

The session is available on `req.session`:

```ts
app.get('/user', (req, res) => {
  // Read session data
  const userId = req.session.userId;

  // Write session data
  req.session.lastAccess = Date.now();

  // Session methods
  req.session.regenerate();  // New session ID
  req.session.destroy();     // Delete session
  req.session.reload();      // Reload from store
  req.session.save();        // Force save
  req.session.touch();       // Update expiration

  res.json({ userId });
});
```

### Flash Messages

Built-in flash message support:

```ts
app.post('/login', (req, res) => {
  if (authFailed) {
    req.session.flash('error', 'Invalid credentials');
    return res.redirect('/login');
  }
  res.redirect('/dashboard');
});

app.get('/login', (req, res) => {
  const errors = req.session.flash('error'); // Returns and clears
  res.render('login', { errors });
});
```

## Session Stores

### MemoryStore (Default)

In-memory storage. Good for development, not for production.

```ts
import { session, MemoryStore } from 'bunway';

const store = new MemoryStore();

app.use(session({
  secret: 'my-secret',
  store
}));

// Store methods
store.clear();    // Clear all sessions
store.size;       // Number of sessions
```

### FileStore

Persist sessions to the filesystem.

```ts
import { session, FileStore } from 'bunway';

const store = new FileStore({
  path: './sessions',  // Directory for session files
  ttl: 86400000        // TTL in ms (default: 24 hours)
});

app.use(session({
  secret: 'my-secret',
  store
}));

// Store methods
await store.clear();           // Clear all sessions
await store.length();          // Number of sessions
```

### Custom Store

Implement the `SessionStore` interface:

```ts
interface SessionStore {
  get(sid: string): Promise<SessionData | null>;
  set(sid: string, session: SessionData, maxAge?: number): Promise<void>;
  destroy(sid: string): Promise<void>;
  touch?(sid: string, session: SessionData): Promise<void>;
}
```

Example Redis store:

```ts
class RedisStore implements SessionStore {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async get(sid: string) {
    const data = await this.redis.get(`sess:${sid}`);
    return data ? JSON.parse(data) : null;
  }

  async set(sid: string, session: SessionData, maxAge?: number) {
    const ttl = maxAge ? Math.ceil(maxAge / 1000) : 86400;
    await this.redis.setex(`sess:${sid}`, ttl, JSON.stringify(session));
  }

  async destroy(sid: string) {
    await this.redis.del(`sess:${sid}`);
  }

  async touch(sid: string, session: SessionData) {
    await this.redis.expire(`sess:${sid}`, 86400);
  }
}
```

## Examples

### Login Flow

```ts
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await authenticate(username, password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Regenerate session to prevent fixation
  req.session.regenerate(() => {
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true });
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});
```

### Protected Routes

```ts
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

app.get('/dashboard', requireAuth, (req, res) => {
  res.json({ user: req.session.username });
});
```

### Session Expiration

```ts
app.use(session({
  secret: 'my-secret',
  cookie: {
    maxAge: 30 * 60 * 1000,  // 30 minutes
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  },
  rolling: true  // Reset expiration on each request
}));
```

## Migration from express-session

The API is identical:

```js
// Express
const session = require('express-session');
app.use(session({ secret: 'my-secret' }));

// bunWay
import { session } from 'bunway';
app.use(session({ secret: 'my-secret' }));
```

Same code. Same behavior. Just faster.
