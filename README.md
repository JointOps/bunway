# bunWay

[![npm version](https://img.shields.io/npm/v/bunway.svg?logo=npm&label=npm)](https://www.npmjs.com/package/bunway)
[![CI](https://github.com/JointOps/bunway/actions/workflows/ci.yml/badge.svg)](https://github.com/JointOps/bunway/actions/workflows/ci.yml)
[![bun only](https://img.shields.io/badge/runtime-bun%201.1+-1e7c73?logo=bun&logoColor=white)](https://bun.sh)
[![docs](https://img.shields.io/badge/docs-The%20Bun%20way-3fc5b7)](https://bunway.jointops.dev/)
[![license](https://img.shields.io/badge/license-MIT-lightgrey.svg)](./LICENSE)

**Run everything. The Bun way.** bunWay is a Bun-native router & middleware toolkit with Express ergonomics. If you switched to Bun for speed but miss the familiar `(req, res, next)` flow, bunWay keeps you home—no Node polyfills, just Fetch-friendly APIs.

> Fun fact: bunWay’s first commit was literally `console.log("hello bun")`. We’ve come a *long* way—still intentionally Bun-only.

## Quick links

- 🚀 [Install](#getting-started-usage)
- 📚 [Docs](https://bunway.jointops.dev/)
- 🛣️ [Roadmap snapshot](#roadmap-snapshot)
- 🤝 [Contributing](#contributing)
- 🧪 [Tests & scripts](#project-setup-contributors)

## Why bunWay?

- No Bun router felt like home for Express developers—so we built one.
- Batteries included (body parsing, CORS, error handling) without leaving Fetch semantics.
- We believe Bun can be an all-in-one backend platform if the community builds it together.

## Highlights (Phase 0)

- `bunway()` factory → `app.listen()` via Bun’s `Bun.serve`
- Familiar middleware pipeline `(ctx, next)` with support for nested routers
- `WayRequest` / `WayResponse` helpers for params, locals, JSON/text responses, and body parsing
- Built-in middleware: `json()`, `urlencoded()`, `text()`, `cors()`, `errorHandler()`
- Response finalizer merges middleware header bags onto raw `Response` values
- Bun-native test suite covering routes, errors, CORS, and payload limits

See the [Roadmap & Contributions](https://bunway.jointops.dev/community/build-together.html) for upcoming phases (cookies, sessions, streaming, security, observability, …).

## Getting started (usage)

Install from npm (Bun-only runtime):

```bash
bun add bunway
```

```ts
import { bunway, cors, json, errorHandler, HttpError } from "bunway";

const app = bunway();

app.use(cors({ origin: true }));
app.use(json());
app.use(errorHandler({ logger: console.error }));

app.get("/", (ctx) => ctx.res.text("Hello from bunway"));

app.get("/users/:id", async (ctx) => {
  const id = ctx.req.param("id");
  if (!id) throw new HttpError(404, "User not found");
  return ctx.res.json({ id, body: await ctx.req.parseBody() });
});

app.listen({ port: 7070 }, () => {
  console.log("bunway listening on http://localhost:7070");
});
```

For deep usage docs visit <a href="https://bunway.jointops.dev/">bunWay Docs</a>.

<details>
<summary><strong>What’s new?</strong></summary>

- Latest release notes live on the [GitHub Releases tab](https://github.com/JointOps/bunway/releases).
- Want an early peek? Check the `docs/community/build-together.md` roadmap for in-flight work.

</details>

### bunWay superpower: per-request overrides

```ts
app.post("/webhooks", async (ctx) => {
  ctx.req.applyBodyParserOverrides({ text: { enabled: true }, json: { enabled: false } });
  const payload = await ctx.req.parseBody();
  return ctx.res.ok({ received: payload, parsedAs: ctx.req.bodyType });
});
```

> Fun fact: bunWay caches the raw body, so you can flip parsing strategies mid-flight without re-reading streams.

## Project setup (contributors)

| Path             | What lives here                                      |
| ---------------- | ----------------------------------------------------- |
| `src/core/`      | `WayRequest`, `WayResponse`, router internals         |
| `src/middlewares/` | Built-in middleware (body parsing, CORS, error handler) |
| `src/server.ts`  | `bunway()` factory + `app.listen()` helper            |
| `examples/`      | Runnable demos (`bun run examples/basic.ts`)          |
| `tests/`         | Bun tests (`bun test`)                                |
| `docs/`          | VitePress guides + TypeDoc API output                 |

Scripts (Bun-native unless noted):

| Command                | Description                                   |
| ---------------------- | --------------------------------------------- |
| `bun install`          | install dependencies                          |
| `bun run test`         | Bun test suite                                |
| `bun run typecheck`    | TypeScript strict check                       |
| `bun run build`        | compile TS → `dist/` (JS + d.ts + sourcemaps) |
| `bun run docs`         | generate TypeDoc HTML into `docs/public/api`  |
| `bun run docs:dev`     | run VitePress docs locally                    |
| `bun run docs:build`   | build static docs site                        |
| `bun run format`       | Prettier formatting                           |
| `npm run prepare:dist` | build + shape `dist/` for publishing          |

## Documentation

- Guide overview: <a href="https://bunway.jointops.dev/guide/overview.html">why bunWay exists</a>
- Quick start: <a href="https://bunway.jointops.dev/guide/getting-started.html">ship your first Bun server</a>
- Middleware reference: <a href="https://bunway.jointops.dev/middleware/index.html">body parsing, CORS, error handling</a>
- API reference: <a href="https://bunway.jointops.dev/api/index.html">TypeDoc, always up to date</a>
- Roadmap: <a href="https://bunway.jointops.dev/community/build-together.html">Build Together</a>

### Roadmap snapshot

| Phase | Theme                   | Highlights                                 |
| ----- | ----------------------- | ------------------------------------------ |
| 0     | Core ergonomics (now)   | Router, middleware pipeline, body parsing  |
| 1     | HTTP niceties           | Cookies, security headers, compression     |
| 2     | Sessions & auth glue    | Session middleware, CSRF, auth helpers     |
| 3     | Streaming & uploads     | Multipart parsing, SSE, WebSocket sugar    |

> Want something sooner? Open an issue—community votes move items up the queue.

## Contributing

bunWay belongs to the community—anyone can use it, shape it, and help prove Bun can be an all-in-one backend platform.

1. **Stay Bun-native** – rely on Bun’s standard library; avoid Node-only dependencies.
2. **Pick a phase** – grab an item from the roadmap and open an issue/PR to discuss approach.
3. **Prototype boldly** – rough PRs welcome; iterate together.
4. **Test & document** – add Bun tests, update TypeDoc comments, expand VitePress guides.
5. **Keep it fun** – bunWay is a playground. Share ideas, experiment, and help fellow Bun developers feel at home.

Guidelines, scripts, and workflow tips live in <a href="https://bunway.jointops.dev/community/build-together.html">Community Roadmap</a>.

## License

MIT © bunWay contributors


## Learn more

- Documentation: <a href="https://bunway.jointops.dev/">bunWay Docs</a>
- GitHub: <a href="https://github.com/JointOps/bunway">JointOps/bunway</a>
- npm package: <a href="https://www.npmjs.com/package/bunway">bunway on npm</a>
- Discussions & support: <a href="https://github.com/JointOps/bunway/discussions">GitHub Discussions</a>
