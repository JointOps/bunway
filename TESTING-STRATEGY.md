# bunWay Testing Strategy

> Research-based testing plan inspired by Express.js, NestJS, and Elysia

---

## Executive Summary

This document outlines a comprehensive testing strategy for bunWay based on research into how major frameworks test their code:

| Framework | Test Runner | HTTP Testing | Tests | Key Pattern |
|-----------|-------------|--------------|-------|-------------|
| **Express** | Mocha + NYC | Supertest | ~700 | Integration-heavy, acceptance tests |
| **NestJS** | Mocha + Chai + Sinon | Supertest | ~2000+ | Unit + Integration, DI mocking |
| **Elysia** | bun:test | `app.handle()` | ~500+ | Direct handler testing, type tests |
| **bunWay** | bun:test | `app.handle()` | 322 | Needs more structure |

---

## Current State: bunWay Testing

### What We Have (322 tests across 25 files)

```
tests/
├── app.test.ts              # App creation and basic routing
├── app-settings.test.ts     # App configuration
├── content-negotiation.test.ts
├── cookies.test.ts
├── csrf.test.ts
├── error-improvements.test.ts
├── errors.test.ts
├── helmet.test.ts
├── logger.test.ts
├── middleware.test.ts
├── passport.test.ts
├── rate-limit.test.ts
├── render.test.ts
├── request.test.ts
├── request-route.test.ts
├── response.test.ts
├── response-methods.test.ts
├── router.test.ts
├── router-param.test.ts
├── session.test.ts
├── static.test.ts
├── streaming.test.ts
├── trust-proxy.test.ts
├── unified-logger.test.ts
├── websocket.test.ts
└── testUtils.ts             # Shared utilities
```

### Strengths
- Good coverage of middleware (CORS, helmet, compression, session, etc.)
- Tests use `app.handle()` pattern (like Elysia)
- bun:test is native and fast

### Gaps Identified
1. No clear separation between unit and integration tests
2. No acceptance/e2e tests for real-world scenarios
3. No CI/CD pipeline with matrix testing
4. No code coverage reporting
5. Limited edge case testing
6. No performance/benchmark tests
7. No cross-platform testing

---

## Proposed Test Structure

### New Directory Organization

```
tests/
├── unit/                    # Pure unit tests (no HTTP)
│   ├── core/
│   │   ├── router.spec.ts   # Router class internals
│   │   ├── route.spec.ts    # Route matching logic
│   │   ├── request.spec.ts  # BunRequest class
│   │   └── response.spec.ts # BunResponse class
│   ├── middleware/
│   │   ├── body-parser.spec.ts
│   │   ├── cors.spec.ts
│   │   └── ...
│   └── utils/
│       ├── path-to-regex.spec.ts
│       ├── cookie-parser.spec.ts
│       └── ...
│
├── integration/             # HTTP-level tests
│   ├── app/
│   │   ├── app.use.spec.ts
│   │   ├── app.get.spec.ts
│   │   ├── app.post.spec.ts
│   │   └── app.settings.spec.ts
│   ├── request/
│   │   ├── req.params.spec.ts
│   │   ├── req.query.spec.ts
│   │   ├── req.body.spec.ts
│   │   ├── req.cookies.spec.ts
│   │   └── req.headers.spec.ts
│   ├── response/
│   │   ├── res.json.spec.ts
│   │   ├── res.send.spec.ts
│   │   ├── res.redirect.spec.ts
│   │   ├── res.cookie.spec.ts
│   │   └── res.render.spec.ts
│   ├── routing/
│   │   ├── params.spec.ts
│   │   ├── wildcards.spec.ts
│   │   ├── optional-params.spec.ts
│   │   └── router-mounting.spec.ts
│   └── middleware/
│       ├── cors.spec.ts
│       ├── helmet.spec.ts
│       ├── compression.spec.ts
│       ├── session.spec.ts
│       └── csrf.spec.ts
│
├── acceptance/              # End-to-end user scenarios
│   ├── auth-flow.spec.ts    # Login, session, protected routes
│   ├── api-crud.spec.ts     # Full REST API flow
│   ├── file-upload.spec.ts  # Multipart handling
│   ├── websocket-chat.spec.ts
│   ├── sse-streaming.spec.ts
│   └── error-handling.spec.ts
│
├── compatibility/           # Express compatibility tests
│   ├── express-middleware.spec.ts  # Test popular Express middleware
│   ├── passport-strategies.spec.ts
│   └── migration.spec.ts    # Express → bunWay migration scenarios
│
├── performance/             # Benchmark tests
│   ├── routing.bench.ts
│   ├── middleware.bench.ts
│   └── response.bench.ts
│
├── types/                   # TypeScript type tests
│   ├── request.types.ts
│   ├── response.types.ts
│   └── middleware.types.ts
│
├── fixtures/                # Test data and mocks
│   ├── apps/               # Sample app configurations
│   ├── certificates/       # TLS test certs
│   └── files/              # Static file test assets
│
└── utils/
    ├── test-helpers.ts      # Shared test utilities
    ├── mock-request.ts      # Request factory
    └── assertions.ts        # Custom assertions
```

---

## Testing Patterns to Adopt

### 1. From Express: Integration Testing Pattern

```typescript
// tests/integration/app/app.use.spec.ts
import { describe, expect, it } from "bun:test";
import bunway from "../../src";

describe("app.use()", () => {
  it("should invoke middleware for all requests", async () => {
    const app = bunway();
    const calls: string[] = [];

    app.use((req, res, next) => {
      calls.push("a");
      next();
    });

    app.use((req, res, next) => {
      calls.push("b");
      next();
    });

    app.use((req, res) => {
      calls.push("c");
      res.end();
    });

    await app.handle(new Request("http://localhost/"));
    expect(calls).toEqual(["a", "b", "c"]);
  });

  it("should only invoke middleware after path", async () => {
    const app = bunway();
    const calls: string[] = [];

    app.use("/foo", (req, res, next) => {
      calls.push("foo");
      next();
    });

    app.use((req, res) => {
      calls.push("root");
      res.end();
    });

    await app.handle(new Request("http://localhost/bar"));
    expect(calls).toEqual(["root"]);
  });
});
```

### 2. From Express: Acceptance Testing Pattern

```typescript
// tests/acceptance/auth-flow.spec.ts
import { describe, expect, it } from "bun:test";
import bunway from "../../src";

describe("Authentication Flow", () => {
  const createAuthApp = () => {
    const app = bunway();

    app.use(bunway.json());
    app.use(bunway.cookieParser());
    app.use(bunway.session({ secret: "test-secret" }));

    app.post("/login", (req, res) => {
      const { username, password } = req.body;
      if (username === "admin" && password === "secret") {
        req.session.user = { username };
        res.redirect("/dashboard");
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    });

    app.get("/dashboard", (req, res) => {
      if (!req.session.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      res.json({ message: `Welcome, ${req.session.user.username}` });
    });

    app.post("/logout", (req, res) => {
      req.session.destroy();
      res.redirect("/");
    });

    return app;
  };

  it("should complete full login flow", async () => {
    const app = createAuthApp();

    // 1. Login
    const loginRes = await app.handle(
      new Request("http://localhost/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "secret" }),
      })
    );

    expect(loginRes.status).toBe(302);
    const sessionCookie = loginRes.headers.get("Set-Cookie");
    expect(sessionCookie).toBeTruthy();

    // 2. Access protected route with session
    const dashboardRes = await app.handle(
      new Request("http://localhost/dashboard", {
        headers: { Cookie: sessionCookie!.split(";")[0] },
      })
    );

    expect(dashboardRes.status).toBe(200);
    const body = await dashboardRes.json();
    expect(body.message).toContain("Welcome, admin");
  });

  it("should reject invalid credentials", async () => {
    const app = createAuthApp();

    const res = await app.handle(
      new Request("http://localhost/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "wrong" }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("should reject unauthenticated access to protected routes", async () => {
    const app = createAuthApp();

    const res = await app.handle(
      new Request("http://localhost/dashboard")
    );

    expect(res.status).toBe(401);
  });
});
```

### 3. From NestJS: Unit Testing with Mocks

```typescript
// tests/unit/core/router.spec.ts
import { describe, expect, it, mock } from "bun:test";
import { Router } from "../../src/core/router";

describe("Router (Unit)", () => {
  describe("route matching", () => {
    it("should match static paths", () => {
      const router = new Router();
      let matched = false;

      router.get("/users", () => {
        matched = true;
      });

      // Direct method call without HTTP
      const match = router.matchRoute("GET", "/users");
      expect(match).toBeTruthy();
      expect(match?.route.path).toBe("/users");
    });

    it("should extract named parameters", () => {
      const router = new Router();
      router.get("/users/:id", () => {});

      const match = router.matchRoute("GET", "/users/123");
      expect(match?.params.id).toBe("123");
    });

    it("should handle wildcards", () => {
      const router = new Router();
      router.get("/files/*", () => {});

      const match = router.matchRoute("GET", "/files/a/b/c.txt");
      expect(match).toBeTruthy();
      expect(match?.params["0"]).toBe("a/b/c.txt");
    });

    it("should handle optional parameters", () => {
      const router = new Router();
      router.get("/users/:id?", () => {});

      expect(router.matchRoute("GET", "/users")).toBeTruthy();
      expect(router.matchRoute("GET", "/users/123")).toBeTruthy();
    });
  });

  describe("middleware chain", () => {
    it("should execute middleware in order", async () => {
      const router = new Router();
      const order: number[] = [];

      router.use(() => order.push(1));
      router.use(() => order.push(2));
      router.get("/", () => order.push(3));

      // Simulate request handling
      const mockReq = { method: "GET", url: new URL("http://localhost/") };
      const mockRes = { end: () => {} };

      await router.handle(mockReq, mockRes);
      expect(order).toEqual([1, 2, 3]);
    });
  });
});
```

### 4. From NestJS: DI/Context Testing

```typescript
// tests/unit/core/request.spec.ts
import { describe, expect, it } from "bun:test";
import { BunRequest } from "../../src/core/request";

describe("BunRequest (Unit)", () => {
  const createMockRequest = (url: string, options?: RequestInit) => {
    return new Request(url, options);
  };

  describe("query parsing", () => {
    it("should parse simple query params", () => {
      const original = createMockRequest("http://localhost/?name=john&age=25");
      const req = new BunRequest(original);

      expect(req.query.get("name")).toBe("john");
      expect(req.query.get("age")).toBe("25");
    });

    it("should handle array query params", () => {
      const original = createMockRequest("http://localhost/?tags=a&tags=b");
      const req = new BunRequest(original);

      expect(req.query.getAll("tags")).toEqual(["a", "b"]);
    });

    it("should handle encoded query params", () => {
      const original = createMockRequest("http://localhost/?q=hello%20world");
      const req = new BunRequest(original);

      expect(req.query.get("q")).toBe("hello world");
    });
  });

  describe("header access", () => {
    it("should provide case-insensitive header access", () => {
      const original = createMockRequest("http://localhost/", {
        headers: { "Content-Type": "application/json" },
      });
      const req = new BunRequest(original);

      expect(req.get("content-type")).toBe("application/json");
      expect(req.get("Content-Type")).toBe("application/json");
      expect(req.get("CONTENT-TYPE")).toBe("application/json");
    });
  });

  describe("body parsing", () => {
    it("should parse JSON body", async () => {
      const original = createMockRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "john" }),
      });
      const req = new BunRequest(original);

      await req.parseJson();
      expect(req.body).toEqual({ name: "john" });
    });

    it("should handle invalid JSON gracefully", async () => {
      const original = createMockRequest("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });
      const req = new BunRequest(original);

      await expect(req.parseJson()).rejects.toThrow();
    });
  });
});
```

### 5. From Elysia: WebSocket Testing

```typescript
// tests/integration/websocket/connection.spec.ts
import { describe, expect, it, afterEach } from "bun:test";
import bunway from "../../src";
import type { Server } from "bun";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const wsOpen = (ws: WebSocket) =>
  new Promise((resolve) => { ws.onopen = resolve; });

const wsMessage = (ws: WebSocket) =>
  new Promise<MessageEvent>((resolve) => { ws.onmessage = resolve; });

const wsClosed = async (ws: WebSocket) => {
  const closed = new Promise((resolve) => { ws.onclose = resolve; });
  ws.close();
  return closed;
};

describe("WebSocket", () => {
  let server: Server | null = null;

  afterEach(() => {
    if (server) {
      server.stop();
      server = null;
    }
  });

  it("should establish connection", async () => {
    const app = bunway();
    let connected = false;

    app.ws("/ws", {
      open() { connected = true; },
      message() {},
    });

    server = app.listen(0);
    const ws = new WebSocket(`ws://localhost:${server.port}/ws`);

    await wsOpen(ws);
    expect(connected).toBe(true);

    await wsClosed(ws);
  });

  it("should echo messages", async () => {
    const app = bunway();

    app.ws("/ws", {
      message(ws, msg) {
        ws.send(`Echo: ${msg}`);
      },
    });

    server = app.listen(0);
    const ws = new WebSocket(`ws://localhost:${server.port}/ws`);

    await wsOpen(ws);

    const messagePromise = wsMessage(ws);
    ws.send("Hello");

    const { data } = await messagePromise;
    expect(data).toBe("Echo: Hello");

    await wsClosed(ws);
  });

  it("should access route params", async () => {
    const app = bunway();
    let roomId: string | undefined;

    app.ws("/rooms/:id", {
      open(ws) {
        roomId = ws.data.params.id;
      },
      message() {},
    });

    server = app.listen(0);
    const ws = new WebSocket(`ws://localhost:${server.port}/rooms/chat-123`);

    await wsOpen(ws);
    expect(roomId).toBe("chat-123");

    await wsClosed(ws);
  });
});
```

### 6. From Elysia: Type Testing

```typescript
// tests/types/request.types.ts
import { expectTypeOf } from "expect-type";
import type { BunRequest } from "../../src/core/request";
import type { Handler } from "../../src/types";

// Test handler types
const handler: Handler = (req, res, next) => {
  // req.params should be Record<string, string>
  expectTypeOf(req.params).toEqualTypeOf<Record<string, string>>();

  // req.query should be URLSearchParams
  expectTypeOf(req.query).toEqualTypeOf<URLSearchParams>();

  // req.body should be unknown initially
  expectTypeOf(req.body).toBeUnknown();

  // req.cookies should be Record<string, string> | undefined
  expectTypeOf(req.cookies).toEqualTypeOf<Record<string, string> | undefined>();

  // res.json should accept any object
  expectTypeOf(res.json).toBeCallableWith({ data: "test" });

  // next should be callable with no args or error
  expectTypeOf(next).toBeCallableWith();
  expectTypeOf(next).toBeCallableWith(new Error("test"));
};
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint

  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        bun-version: [latest, canary]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ matrix.bun-version }}

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: bun test

      - name: Upload coverage
        if: matrix.os == 'ubuntu-latest' && matrix.bun-version == 'latest'
        uses: codecov/codecov-action@v3

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck

  build:
    runs-on: ubuntu-latest
    needs: [lint, test, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
```

---

## Test Commands

Add to `package.json`:

```json
{
  "scripts": {
    "test": "bun test",
    "test:unit": "bun test tests/unit",
    "test:integration": "bun test tests/integration",
    "test:acceptance": "bun test tests/acceptance",
    "test:compatibility": "bun test tests/compatibility",
    "test:types": "tsc --project tsconfig.test.json --noEmit",
    "test:coverage": "bun test --coverage",
    "test:watch": "bun test --watch",
    "bench": "bun run tests/performance/*.bench.ts"
  }
}
```

---

## Code Coverage Goals

| Category | Current | Target |
|----------|---------|--------|
| Statements | Unknown | 90% |
| Branches | Unknown | 85% |
| Functions | Unknown | 90% |
| Lines | Unknown | 90% |

---

## Implementation Phases

### Phase 1: Reorganize Tests (1 week)
- [ ] Create new directory structure
- [ ] Move existing tests to appropriate categories
- [ ] Create shared test utilities

### Phase 2: Add Unit Tests (2 weeks)
- [ ] Router/Route class unit tests
- [ ] BunRequest/BunResponse unit tests
- [ ] Middleware unit tests (isolated)
- [ ] Utility function tests

### Phase 3: Add Acceptance Tests (1 week)
- [ ] Authentication flow
- [ ] API CRUD operations
- [ ] WebSocket scenarios
- [ ] Error handling scenarios

### Phase 4: Add CI/CD (1 week)
- [ ] GitHub Actions workflow
- [ ] Code coverage reporting
- [ ] Multi-platform testing

### Phase 5: Add Performance Tests (1 week)
- [ ] Routing benchmarks
- [ ] Middleware chain benchmarks
- [ ] Compare with Express/Elysia

---

## Key Takeaways from Research

### From Express
1. **Heavy integration testing** - Most tests are full HTTP round-trips
2. **Acceptance tests** - Real user scenarios (auth, multi-router)
3. **Configuration variation testing** - Different settings produce different behaviors
4. **Supertest** for clean HTTP assertions
5. **Multi-version Node.js testing** in CI

### From NestJS
1. **Clear separation** between unit and integration tests
2. **Heavy mocking with Sinon** for DI testing
3. **TestingModule pattern** for isolated testing
4. **Override patterns** for swapping implementations
5. **Docker-based** external service testing

### From Elysia
1. **Direct `app.handle()` testing** - No server needed
2. **Type testing** with expect-type
3. **Multi-runtime testing** (Bun, Node, Cloudflare)
4. **Lifecycle hook order verification** with arrays
5. **WebSocket testing utilities** with promise wrappers

### For bunWay
1. Use `app.handle()` for most tests (fast, no server)
2. Spin up real server only for WebSocket tests
3. Add acceptance tests for real-world scenarios
4. Add type tests with expect-type
5. Matrix test across Bun versions and OS
6. Track code coverage with targets

---

## References

- [Express.js Test Suite](https://github.com/expressjs/express/tree/master/test)
- [NestJS Test Suite](https://github.com/nestjs/nest/tree/master/packages)
- [Elysia Test Suite](https://github.com/elysiajs/elysia/tree/main/test)
- [Bun Test Documentation](https://bun.sh/docs/cli/test)
