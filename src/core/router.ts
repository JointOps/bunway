import { BunRequest } from "./request";
import { BunResponse } from "./response";
import type { Handler, ErrorHandler, RouteDefinition, RouterOptions } from "../types";
import { isHttpError } from "./errors";

interface SubRouter {
  prefix: string;
  router: Router;
}

interface GroupOptions {
  middleware?: Handler[];
}

type GroupCallback = (router: Router) => void;

type ParamHandler = (
  req: BunRequest,
  res: BunResponse,
  next: (err?: unknown) => void,
  value: string,
  name: string
) => void;

export class Router {
  private routes: RouteDefinition[] = [];
  private middlewares: Handler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private children: SubRouter[] = [];
  private routerOptions: RouterOptions;
  private paramHandlers: Map<string, ParamHandler[]> = new Map();

  constructor(opts: RouterOptions = {}) {
    this.routerOptions = opts;
  }

  param(name: string, handler: ParamHandler): this {
    const handlers = this.paramHandlers.get(name) || [];
    handlers.push(handler);
    this.paramHandlers.set(name, handlers);
    return this;
  }

  private pathToRegex(path: string): { regex: RegExp; keys: string[] } {
    const keys: string[] = [];
    const pattern = path
      .replace(/\/:([^/]+)/g, (_, key) => {
        keys.push(key);
        return "/([^/]+)";
      })
      .replace(/\//g, "\\/");
    return { regex: new RegExp(`^${pattern}$`), keys };
  }

  private addRoute(method: string, path: string, handlers: Handler[]): void {
    const { regex, keys } = this.pathToRegex(path);
    this.routes.push({ method, path, regex, keys, handlers });
  }

  get(path: string, ...handlers: Handler[]): this {
    this.addRoute("GET", path, handlers);
    return this;
  }

  post(path: string, ...handlers: Handler[]): this {
    this.addRoute("POST", path, handlers);
    return this;
  }

  put(path: string, ...handlers: Handler[]): this {
    this.addRoute("PUT", path, handlers);
    return this;
  }

  delete(path: string, ...handlers: Handler[]): this {
    this.addRoute("DELETE", path, handlers);
    return this;
  }

  patch(path: string, ...handlers: Handler[]): this {
    this.addRoute("PATCH", path, handlers);
    return this;
  }

  options(path: string, ...handlers: Handler[]): this {
    this.addRoute("OPTIONS", path, handlers);
    return this;
  }

  head(path: string, ...handlers: Handler[]): this {
    this.addRoute("HEAD", path, handlers);
    return this;
  }

  all(path: string, ...handlers: Handler[]): this {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];
    for (const method of methods) {
      this.addRoute(method, path, handlers);
    }
    return this;
  }

  use(handler: Handler): this;
  use(path: string, router: Router): this;
  use(path: string, ...handlers: Handler[]): this;
  use(pathOrHandler: string | Handler, routerOrHandler?: Router | Handler, ...rest: Handler[]): this {
    if (typeof pathOrHandler === "function") {
      if (pathOrHandler.length === 4) {
        this.errorHandlers.push(pathOrHandler as unknown as ErrorHandler);
      } else {
        this.middlewares.push(pathOrHandler);
      }
      return this;
    }

    if (routerOrHandler instanceof Router) {
      this.children.push({ prefix: pathOrHandler, router: routerOrHandler });
      return this;
    }

    if (typeof routerOrHandler === "function") {
      const handlers = [routerOrHandler, ...rest];
      this.all(pathOrHandler, ...handlers);
    }

    return this;
  }

  group(prefix: string, callbackOrOptions?: GroupCallback | GroupOptions, callback?: GroupCallback): this {
    const subRouter = new Router(this.routerOptions);

    if (typeof callbackOrOptions === "function") {
      callbackOrOptions(subRouter);
    } else if (callbackOrOptions && callback) {
      if (callbackOrOptions.middleware) {
        for (const mw of callbackOrOptions.middleware) {
          subRouter.use(mw);
        }
      }
      callback(subRouter);
    }

    this.children.push({ prefix, router: subRouter });
    return this;
  }

  async handle(original: Request): Promise<Response> {
    const req = new BunRequest(original);
    const res = new BunResponse();
    const method = original.method.toUpperCase();
    const pathname = new URL(original.url).pathname;

    for (const { prefix, router } of this.children) {
      if (pathname.startsWith(prefix)) {
        const newUrl = new URL(original.url);
        newUrl.pathname = pathname.slice(prefix.length) || "/";
        return router.handle(new Request(newUrl.toString(), original));
      }
    }

    try {
      await this.runPipeline([...this.middlewares], req, res);
    } catch (err) {
      return this.handleError(err, req, res);
    }

    if (res.isSent()) {
      return res.toResponse();
    }

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = route.regex.exec(pathname);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.keys.forEach((key, i) => {
        params[key] = match[i + 1] ?? "";
      });
      req.params = params;

      const paramMiddleware: Handler[] = [];
      for (const [name, value] of Object.entries(params)) {
        const handlers = this.paramHandlers.get(name);
        if (handlers) {
          for (const handler of handlers) {
            paramMiddleware.push((r, s, n) => handler(r, s, n, value, name));
          }
        }
      }

      const pipeline = [...paramMiddleware, ...route.handlers];

      try {
        await this.runPipeline(pipeline, req, res);
      } catch (err) {
        return this.handleError(err, req, res);
      }

      if (res.isSent()) {
        return res.toResponse();
      }

      return new Response(null, { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  private async runPipeline(pipeline: Handler[], req: BunRequest, res: BunResponse): Promise<void> {
    let idx = 0;

    const next = async (err?: unknown): Promise<void> => {
      if (err) throw err;
      if (res.isSent()) return;

      const handler = pipeline[idx++];
      if (!handler) return;

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

      if (!res.isSent()) {
        await next();
      }
    };

    await next();
  }

  private handleError(err: unknown, req: BunRequest, res: BunResponse): Response {
    for (const handler of this.errorHandlers) {
      try {
        handler(err, req, res, () => {});
        if (res.isSent()) {
          return res.toResponse();
        }
      } catch {
        continue;
      }
    }

    if (isHttpError(err)) {
      const headers = new Headers(err.headers);
      if (err.body !== undefined) {
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify(err.body), { status: err.status, headers });
      }
      return new Response(err.message, { status: err.status, headers });
    }

    const message = err instanceof Error ? err.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
