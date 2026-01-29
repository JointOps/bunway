import { Router } from "./router";
import type { ListenOptions, RouterOptions } from "../types";
import { BUNWAY_DEFAULT_PORT } from "../types";

export interface BunWayOptions extends RouterOptions {}

export class BunWayApp extends Router {
  constructor(options?: BunWayOptions) {
    super(options);
  }

  listen(port?: number, callback?: () => void): ReturnType<typeof Bun.serve>;
  listen(options?: ListenOptions, callback?: () => void): ReturnType<typeof Bun.serve>;
  listen(
    portOrOptions?: number | ListenOptions,
    callback?: () => void
  ): ReturnType<typeof Bun.serve> {
    const port =
      typeof portOrOptions === "number"
        ? portOrOptions
        : portOrOptions?.port ?? BUNWAY_DEFAULT_PORT;

    const hostname = typeof portOrOptions === "object" ? portOrOptions.hostname : undefined;

    const server = Bun.serve({
      port,
      hostname,
      fetch: (req: Request) => this.handle(req),
    });

    if (callback) callback();

    return server;
  }
}

export function bunway(options?: BunWayOptions): BunWayApp {
  return new BunWayApp(options);
}
