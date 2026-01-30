import type { Server as BunServer } from "bun";
import { Router } from "./router";
import { BunRequest } from "./request";
import { BunResponse } from "./response";
import type { Handler, ListenOptions, RouterOptions, WebSocketData, BunWayLogger } from "../types";
import { BUNWAY_DEFAULT_PORT } from "../types";

export interface BunWayOptions extends RouterOptions {
  settings?: Record<string, unknown>;
}

export type TrustProxyValue = boolean | number | string | string[] | ((ip: string, i: number) => boolean);

export interface AppSettings {
  "view engine"?: string;
  "views"?: string;
  "trust proxy"?: TrustProxyValue;
  "json spaces"?: number;
  "case sensitive routing"?: boolean;
  "strict routing"?: boolean;
  "etag"?: boolean | "weak" | "strong" | ((body: string | Buffer, encoding?: string) => string);
  "x-powered-by"?: boolean;
  "env"?: string;
  "logger"?: BunWayLogger;
  [key: string]: unknown;
}

// Default console-based logger
const defaultLogger: BunWayLogger = {
  info: (msg, meta) => console.log(meta ? `${msg} ${JSON.stringify(meta)}` : msg),
  warn: (msg, meta) => console.warn(meta ? `${msg} ${JSON.stringify(meta)}` : msg),
  error: (msg, meta) => console.error(meta ? `${msg} ${JSON.stringify(meta)}` : msg),
  debug: (msg, meta) => console.debug(meta ? `${msg} ${JSON.stringify(meta)}` : msg),
};

const DEFAULT_SETTINGS: AppSettings = {
  "view engine": undefined,
  "views": "./views",
  "trust proxy": false,
  "json spaces": 0,
  "case sensitive routing": false,
  "strict routing": false,
  "etag": "weak",
  "x-powered-by": true,
  "env": process.env.NODE_ENV || "development",
};

export class BunWayApp extends Router {
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  public locals: Record<string, unknown> = {};
  private engines: Map<string, (path: string, options: Record<string, unknown>, callback: (err: Error | null, html?: string) => void) => void> = new Map();

  constructor(options?: BunWayOptions) {
    super(options);
    if (options?.settings) {
      Object.assign(this.settings, options.settings);
    }

    // Set up direct app context injection (avoids middleware overhead)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.setAppContext({
      setApp: (req, res) => {
        req.setApp(self);
        res.setApp(self);
        res.setAcceptHeader(req.get("accept"));
      },
    });
  }

  set(setting: string, value: unknown): this {
    this.settings[setting] = value;
    return this;
  }

  override get(setting: string): unknown;
  override get(path: string, ...handlers: Handler[]): this;
  override get(pathOrSetting: string, ...handlers: Handler[]): this | unknown {
    if (handlers.length === 0) {
      return this.settings[pathOrSetting];
    }
    return super.get(pathOrSetting, ...handlers);
  }

  enable(setting: string): this {
    this.settings[setting] = true;
    return this;
  }

  disable(setting: string): this {
    this.settings[setting] = false;
    return this;
  }

  enabled(setting: string): boolean {
    return !!this.settings[setting];
  }

  disabled(setting: string): boolean {
    return !this.settings[setting];
  }

  engine(ext: string, fn: (path: string, options: Record<string, unknown>, callback: (err: Error | null, html?: string) => void) => void): this {
    const extension = ext.startsWith(".") ? ext.slice(1) : ext;
    this.engines.set(extension, fn);
    return this;
  }

  getEngine(ext: string): ((path: string, options: Record<string, unknown>, callback: (err: Error | null, html?: string) => void) => void) | undefined {
    const extension = ext.startsWith(".") ? ext.slice(1) : ext;
    return this.engines.get(extension);
  }

  getSettings(): Readonly<AppSettings> {
    return this.settings;
  }

  getLogger(): BunWayLogger {
    return (this.settings.logger as BunWayLogger) || defaultLogger;
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

    const self = this;

    const server = Bun.serve<WebSocketData>({
      port,
      hostname,
      fetch: async (req: Request, server: BunServer<WebSocketData>) => {
        // Check for WebSocket upgrade
        if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
          return self.handleWebSocketUpgrade(req, server);
        }
        return self.handle(req, server);
      },
      websocket: {
        open(ws) {
          ws.data.handlers.open?.(ws);
        },
        message(ws, message) {
          ws.data.handlers.message?.(ws, message);
        },
        close(ws, code, reason) {
          ws.data.handlers.close?.(ws, code, reason);
        },
        drain(ws) {
          ws.data.handlers.drain?.(ws);
        },
      },
    });

    if (callback) callback();

    return server;
  }

  private async handleWebSocketUpgrade(req: Request, server: BunServer<WebSocketData>): Promise<Response | undefined> {
    const pathname = new URL(req.url).pathname;
    const matched = this.matchWebSocketRoute(pathname);

    if (!matched) {
      return new Response("WebSocket route not found", { status: 404 });
    }

    const { route, params } = matched;
    const bunReq = new BunRequest(req);
    bunReq.params = params;
    bunReq.setApp(this);

    // Set socket IP for rate limiting and logging
    if (server.requestIP) {
      const socketAddr = server.requestIP(req);
      bunReq.setSocketIp(socketAddr?.address ?? null);
    }

    // Run pre-upgrade middlewares
    const res = new BunResponse();
    res.setApp(this);

    const pipeline = [...this.getMiddlewares(), ...route.middlewares];

    try {
      await this.runUpgradePipeline(pipeline, bunReq, res);
    } catch {
      // Middleware rejected the upgrade
      return new Response("Upgrade rejected", { status: 403 });
    }

    if (res.isSent()) {
      // Middleware already sent a response (rejected upgrade)
      return res.toResponse();
    }

    // Perform the upgrade
    const upgraded = server.upgrade(req, {
      data: {
        routePath: route.path,
        params,
        handlers: route.handlers,
        req: bunReq,
      },
    });

    if (!upgraded) {
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return undefined; // Signals successful upgrade to Bun
  }

  private async runUpgradePipeline(pipeline: Handler[], req: BunRequest, res: BunResponse): Promise<void> {
    for (const handler of pipeline) {
      if (res.isSent()) return;

      await new Promise<void>((resolve, reject) => {
        let resolved = false;
        const done = (error?: unknown) => {
          if (resolved) return;
          resolved = true;
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };

        try {
          const result = handler(req, res, done) as unknown;
          if (result && typeof (result as Promise<void>).then === "function") {
            (result as Promise<void>).then(() => done()).catch(reject);
          } else if (!resolved && res.isSent()) {
            done();
          }
        } catch (e) {
          reject(e);
        }
      });
    }
  }
}

export function bunway(options?: BunWayOptions): BunWayApp {
  return new BunWayApp(options);
}
