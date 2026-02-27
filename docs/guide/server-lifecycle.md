---
title: Server Lifecycle
description: Start, stop, and configure HTTPS for your bunWay server.
---

# Server Lifecycle

## Starting the Server

### Basic

```ts
app.listen(3000);
```

### With Callback

```ts
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

### With Options

```ts
app.listen({ port: 3000, hostname: "0.0.0.0" });
```

### Random Port (Testing)

```ts
const server = app.listen(0);
console.log(`Running on port ${server.port}`);
```

## Accessing the Server

After calling `listen()`, the underlying Bun server is available via `app.server`:

```ts
app.listen(3000);
app.server;         // Bun.Server instance
app.server.port;    // 3000
```

`app.server` is `null` before `listen()` and after `close()`.

## HTTPS / TLS

### Basic HTTPS

```ts
app.listen({
  port: 443,
  tls: {
    cert: await Bun.file("./cert.pem").text(),
    key: await Bun.file("./key.pem").text(),
  },
});
```

### With Passphrase

```ts
app.listen({
  port: 443,
  tls: {
    cert: await Bun.file("./cert.pem").text(),
    key: await Bun.file("./encrypted-key.pem").text(),
    passphrase: process.env.KEY_PASSPHRASE,
  },
});
```

### With Custom CA

```ts
app.listen({
  port: 443,
  tls: {
    cert: await Bun.file("./cert.pem").text(),
    key: await Bun.file("./key.pem").text(),
    ca: await Bun.file("./ca.pem").text(),
  },
});
```

### Generating Self-Signed Certificates

```bash
openssl req -x509 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes -subj "/CN=localhost"
```

### Migrating from Express

**Express:**
```js
const https = require("https");
const fs = require("fs");
const app = require("express")();

https.createServer({
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
}, app).listen(443);
```

**bunWay:**
```ts
const app = bunway();

app.listen({
  port: 443,
  tls: {
    key: await Bun.file("key.pem").text(),
    cert: await Bun.file("cert.pem").text(),
  },
});
```

One method call. No `https.createServer` wrapper.

### Behind a Reverse Proxy

Most production apps terminate TLS at a reverse proxy (nginx, Cloudflare, AWS ALB). bunWay handles this correctly:

```ts
app.set("trust proxy", true);

app.get("/", (req, res) => {
  req.protocol; // "https" — from X-Forwarded-Proto header
  req.secure;   // true
});
```

When `trust proxy` is enabled, `req.protocol` reads the `X-Forwarded-Proto` header set by your proxy — matching Express behavior exactly.

## Graceful Shutdown

### Promise Style

```ts
await app.close();
```

### Callback Style (Express Pattern)

```ts
app.close(() => {
  console.log("Server closed");
  process.exit(0);
});
```

### Signal Handling

```ts
const app = bunway();
app.listen(3000);

process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await app.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await app.close();
  process.exit(0);
});
```

### Lifecycle States

```ts
app.server;         // null
app.listen(3000);
app.server;         // Server instance
await app.close();
app.server;         // null
```

### Restart After Close

```ts
await app.close();
app.listen(3001);   // Works
```

## Testing Patterns

```ts
import { describe, it, expect, afterEach } from "bun:test";
import bunway from "bunway";

describe("my app", () => {
  const app = bunway();
  app.get("/", (req, res) => res.text("OK"));

  afterEach(async () => {
    await app.close();
  });

  it("responds with 200", async () => {
    const server = app.listen(0);
    const res = await fetch(`http://localhost:${server.port}/`);
    expect(res.status).toBe(200);
  });
});
```
