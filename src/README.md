# bunWay

**Run everything. The Bun way.** bunWay is an open-source experiment to recreate the ergonomics of Express on top of Bun’s native runtime. If you moved to Bun for its speed and modern APIs but miss the familiar middleware/route flow, this toolkit is for you.

## Overview

- Built entirely on Bun’s `Request`/`Response` objects.
- Familiar `(ctx, next)` middleware signature and `bunway()` factory.
- Ships batteries included: `json`, `urlencoded`, `text`, `cors`, and `errorHandler` middleware.
- TypeScript-first with generated `.d.ts` files and TypeDoc reference.

## Goal

Give Bun developers the nostalgic Express flow without leaving the Bun runtime. No Node polyfills, no surprises—just Bun-native speed with a welcoming API.

## Quick usage

```ts
import { bunway, cors, json, errorHandler, HttpError } from "bunway";

const app = bunway();
app.use(cors({ origin: true }));
app.use(json());
app.use(errorHandler({ logger: console.error }));

app.get("/", (ctx) => ctx.res.text("Hello from bunway"));
app.get("/users/:id", (ctx) => {
  const id = ctx.req.param("id");
  if (!id) throw new HttpError(404, "User not found");
  return ctx.res.json({ id });
});

app.listen({ port: 7070 });
```

Install via:

```bash
bun add bunway
```

## Learn more

- Documentation: <https://bunway.jointops.dev/>
- GitHub: <https://github.com/JointOps/bunway>
- npm package: <https://www.npmjs.com/package/bunway>

## License

MIT © bunway contributors
