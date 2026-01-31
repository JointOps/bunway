import type { Server as BunServer } from "bun";
import { BunRequest } from "./request";
import { BunResponse } from "./response";
import type {
  Handler,
  ErrorHandler,
  RouteDefinition,
  RouterOptions,
  WebSocketHandlers,
  WebSocketRouteDefinition,
} from "../types";
import { isHttpError } from "./errors";
import { FastMatcher } from "./fast-matcher";
import { getPathname } from "../utils/url";

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
  protected routes: RouteDefinition[] = [];
  protected middlewares: Handler[] = [];
  protected errorHandlers: ErrorHandler[] = [];
  protected children: SubRouter[] = [];
  protected routerOptions: RouterOptions;
  protected paramHandlers: Map<string, ParamHandler[]> = new Map();
  protected wsRoutes: WebSocketRouteDefinition[] = [];

  // Fast matcher for O(1) static routes and compiled regex for dynamic routes
  protected fastMatcher: FastMatcher = new FastMatcher();

  // App context for direct injection (set by BunWayApp)
  protected _appContext: {
    setApp: (req: BunRequest, res: BunResponse) => void;
  } | null = null;

  constructor(opts: RouterOptions = {}) {
    this.routerOptions = opts;
  }

  /**
   * Set the app context for direct injection (used by BunWayApp)
   */
  setAppContext(context: { setApp: (req: BunRequest, res: BunResponse) => void }): void {
    this._appContext = context;
  }

  protected getRoutes(): RouteDefinition[] {
    return this.routes;
  }

  protected getMiddlewares(): Handler[] {
    return this.middlewares;
  }

  protected getErrorHandlers(): ErrorHandler[] {
    return this.errorHandlers;
  }

  protected getChildren(): SubRouter[] {
    return this.children;
  }

  param(name: string, handler: ParamHandler): this {
    const handlers = this.paramHandlers.get(name) || [];
    handlers.push(handler);
    this.paramHandlers.set(name, handlers);
    return this;
  }

  /**
   * Check if any param handlers are registered for the given params
   */
  private hasParamHandlersFor(params: Record<string, string>): boolean {
    for (const name of Object.keys(params)) {
      if (this.paramHandlers.has(name)) {
        return true;
      }
    }
    return false;
  }

  private pathToRegex(path: string): { regex: RegExp; keys: string[] } {
    const keys: string[] = [];
    let wildcardIndex = 0;

    const pattern = path
      .replace(/\/(\*(\w*)|:(\w+)(\?)?)/g, (_, _full, wildcardName, paramName, optional) => {
        if (wildcardName !== undefined) {
          keys.push(wildcardName || String(wildcardIndex++));
          return "/(.*)";
        }
        keys.push(paramName);
        if (optional) {
          return "(?:/([^/]+))?";
        }
        return "/([^/]+)";
      })
      .replace(/\//g, "\\/");

    return { regex: new RegExp(`^${pattern}$`), keys };
  }

  private addRoute(method: string, path: string, handlers: Handler[]): void {
    const { regex, keys } = this.pathToRegex(path);
    this.routes.push({ method, path, regex, keys, handlers });

    // Also register with fast matcher for O(1) lookup
    this.fastMatcher.add(method, path, handlers);
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

  ws(path: string, handlers: WebSocketHandlers): this;
  ws(path: string, ...args: [...Handler[], WebSocketHandlers]): this;
  ws(path: string, ...args: (Handler | WebSocketHandlers)[]): this {
    const { regex, keys } = this.pathToRegex(path);

    // Last argument is always WebSocketHandlers
    const handlersObj = args[args.length - 1] as WebSocketHandlers;
    // Everything before is middleware
    const middlewares = args.slice(0, -1) as Handler[];

    this.wsRoutes.push({
      path,
      regex,
      keys,
      handlers: handlersObj,
      middlewares,
    });

    return this;
  }

  getWsRoutes(): WebSocketRouteDefinition[] {
    return this.wsRoutes;
  }

  matchWebSocketRoute(pathname: string): { route: WebSocketRouteDefinition; params: Record<string, string> } | null {
    for (const route of this.wsRoutes) {
      const match = route.regex.exec(pathname);
      if (match) {
        const params: Record<string, string> = {};
        route.keys.forEach((key, i) => {
          params[key] = match[i + 1] ?? "";
        });
        return { route, params };
      }
    }

    // Check child routers
    for (const { prefix, router } of this.children) {
      if (pathname.startsWith(prefix)) {
        const childPathname = pathname.slice(prefix.length) || "/";
        const childMatch = router.matchWebSocketRoute(childPathname);
        if (childMatch) {
          return childMatch;
        }
      }
    }

    return null;
  }

  /**
   * Print all registered routes for debugging.
   * Useful during development to see what routes are available.
   *
   * @example
   * app.printRoutes();
   * // Output:
   * // GET     /
   * // GET     /users
   * // POST    /users
   * // GET     /users/:id
   * // WS      /chat
   */
  printRoutes(prefix = ""): void {
    const methodColors: Record<string, string> = {
      GET: "\x1b[32m",    // Green
      POST: "\x1b[33m",   // Yellow
      PUT: "\x1b[34m",    // Blue
      DELETE: "\x1b[31m", // Red
      PATCH: "\x1b[35m",  // Magenta
      OPTIONS: "\x1b[36m",// Cyan
      HEAD: "\x1b[90m",   // Gray
      ALL: "\x1b[37m",    // White
      WS: "\x1b[95m",     // Light Magenta
    };
    const reset = "\x1b[0m";
    const dim = "\x1b[2m";

    // Print HTTP routes
    for (const route of this.routes) {
      const color = methodColors[route.method] || reset;
      const fullPath = prefix + route.path;
      const method = route.method.padEnd(7);
      console.log(`${color}${method}${reset} ${fullPath}`);
    }

    // Print WebSocket routes
    for (const route of this.wsRoutes) {
      const color = methodColors.WS;
      const fullPath = prefix + route.path;
      console.log(`${color}WS     ${reset} ${fullPath}`);
    }

    // Print child router routes
    for (const { prefix: childPrefix, router } of this.children) {
      console.log(`${dim}── Router: ${prefix}${childPrefix}${reset}`);
      router.printRoutes(prefix + childPrefix);
    }
  }

  /**
   * Get all registered routes as an array (for programmatic access).
   *
   * @example
   * const routes = app.getRegisteredRoutes();
   * // [{ method: 'GET', path: '/', ... }, ...]
   */
  getRegisteredRoutes(prefix = ""): Array<{ method: string; path: string; fullPath: string }> {
    const result: Array<{ method: string; path: string; fullPath: string }> = [];

    // HTTP routes
    for (const route of this.routes) {
      result.push({
        method: route.method,
        path: route.path,
        fullPath: prefix + route.path,
      });
    }

    // WebSocket routes
    for (const route of this.wsRoutes) {
      result.push({
        method: "WS",
        path: route.path,
        fullPath: prefix + route.path,
      });
    }

    // Child router routes
    for (const { prefix: childPrefix, router } of this.children) {
      result.push(...router.getRegisteredRoutes(prefix + childPrefix));
    }

    return result;
  }

  async handle(original: Request, server?: BunServer<unknown>): Promise<Response> {
    // Fast pathname extraction - avoids full URL parsing
    const pathname = getPathname(original.url);
    const method = original.method.toUpperCase();

    // Check child routers first - optimized to avoid creating new Request/URL
    for (const { prefix, router } of this.children) {
      if (pathname.startsWith(prefix)) {
        const childPathname = pathname.slice(prefix.length) || "/";
        return router.handleInternal(original, childPathname, method, server);
      }
    }

    // FAST PATH: If no middleware, check route existence before creating objects
    if (this.middlewares.length === 0 && this.errorHandlers.length === 0) {
      const matchResult = this.fastMatcher.match(method, pathname);

      if (!matchResult) {
        // No route match - return 404/405 without creating req/res
        const matchingMethods = this.fastMatcher.getMatchingMethods(pathname);
        if (matchingMethods.length > 0) {
          const allowedMethods = matchingMethods.join(", ");
          return new Response(
            JSON.stringify({
              error: "Method Not Allowed",
              message: `${method} is not allowed for ${pathname}`,
              allowedMethods,
            }),
            {
              status: 405,
              headers: {
                "Content-Type": "application/json",
                Allow: allowedMethods,
              },
            }
          );
        }
        return new Response(
          JSON.stringify({
            error: "Not Found",
            message: `Cannot ${method} ${pathname}`,
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Route found - now create req/res for handlers
      const req = new BunRequest(original, pathname);
      const res = new BunResponse();

      if (server?.requestIP) {
        const socketAddr = server.requestIP(original);
        req.setSocketIp(socketAddr?.address ?? null);
      }

      // Inject app context directly (avoids middleware overhead)
      if (this._appContext) {
        this._appContext.setApp(req, res);
      }

      req.params = matchResult.params;
      req.route = { path: matchResult.path, method };

      // FAST PATH: Single handler, no param handlers - direct invocation
      const hasParamHandlers = this.hasParamHandlersFor(matchResult.params);
      const singleHandler = matchResult.handlers.length === 1 ? matchResult.handlers[0] : null;
      if (singleHandler && !hasParamHandlers) {
        try {
          const result = singleHandler(req, res, () => {}) as unknown;
          if (result && typeof (result as Promise<void>).then === "function") {
            await (result as Promise<void>);
          }
        } catch (err) {
          return this.handleError(err, req, res);
        }

        if (res.isSent()) {
          if (res.isStreaming()) {
            return res.toStreamingResponse();
          }
          return res.toResponse();
        }
        return new Response(null, { status: 200 });
      }

      // Build param middleware handlers
      const paramMiddleware: Handler[] = [];
      for (const [name, value] of Object.entries(matchResult.params)) {
        const handlers = this.paramHandlers.get(name);
        if (handlers) {
          for (const handler of handlers) {
            paramMiddleware.push((r, s, n) => handler(r, s, n, value, name));
          }
        }
      }

      const pipeline = [...paramMiddleware, ...matchResult.handlers];

      try {
        await this.runPipeline(pipeline, req, res);
      } catch (err) {
        return this.handleError(err, req, res);
      }

      if (res.isSent()) {
        if (res.isStreaming()) {
          return res.toStreamingResponse();
        }
        return res.toResponse();
      }

      return new Response(null, { status: 200 });
    }

    // STANDARD PATH: Has middleware, need req/res upfront
    return this.handleWithMiddleware(original, pathname, method, server);
  }

  /**
   * Internal handle method for child router delegation - avoids creating new Request/URL objects
   */
  protected async handleInternal(
    original: Request,
    pathname: string,
    method: string,
    server?: BunServer<unknown>
  ): Promise<Response> {
    // Check child routers first
    for (const { prefix, router } of this.children) {
      if (pathname.startsWith(prefix)) {
        const childPathname = pathname.slice(prefix.length) || "/";
        return router.handleInternal(original, childPathname, method, server);
      }
    }

    // Fast path for no middleware
    if (this.middlewares.length === 0 && this.errorHandlers.length === 0) {
      const matchResult = this.fastMatcher.match(method, pathname);

      if (!matchResult) {
        const matchingMethods = this.fastMatcher.getMatchingMethods(pathname);
        if (matchingMethods.length > 0) {
          const allowedMethods = matchingMethods.join(", ");
          return new Response(
            JSON.stringify({
              error: "Method Not Allowed",
              message: `${method} is not allowed for ${pathname}`,
              allowedMethods,
            }),
            {
              status: 405,
              headers: {
                "Content-Type": "application/json",
                Allow: allowedMethods,
              },
            }
          );
        }
        return new Response(
          JSON.stringify({
            error: "Not Found",
            message: `Cannot ${method} ${pathname}`,
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const req = new BunRequest(original, pathname);
      const res = new BunResponse();

      if (server?.requestIP) {
        const socketAddr = server.requestIP(original);
        req.setSocketIp(socketAddr?.address ?? null);
      }

      // Inject app context directly (avoids middleware overhead)
      if (this._appContext) {
        this._appContext.setApp(req, res);
      }

      req.params = matchResult.params;
      req.route = { path: matchResult.path, method };

      // FAST PATH: Single handler, no param handlers - direct invocation
      const hasParamHandlers = this.hasParamHandlersFor(matchResult.params);
      const singleHandler = matchResult.handlers.length === 1 ? matchResult.handlers[0] : null;
      if (singleHandler && !hasParamHandlers) {
        try {
          const result = singleHandler(req, res, () => {}) as unknown;
          if (result && typeof (result as Promise<void>).then === "function") {
            await (result as Promise<void>);
          }
        } catch (err) {
          return this.handleError(err, req, res);
        }

        if (res.isSent()) {
          if (res.isStreaming()) {
            return res.toStreamingResponse();
          }
          return res.toResponse();
        }
        return new Response(null, { status: 200 });
      }

      const paramMiddleware: Handler[] = [];
      for (const [name, value] of Object.entries(matchResult.params)) {
        const handlers = this.paramHandlers.get(name);
        if (handlers) {
          for (const handler of handlers) {
            paramMiddleware.push((r, s, n) => handler(r, s, n, value, name));
          }
        }
      }

      const pipeline = [...paramMiddleware, ...matchResult.handlers];

      try {
        await this.runPipeline(pipeline, req, res);
      } catch (err) {
        return this.handleError(err, req, res);
      }

      if (res.isSent()) {
        if (res.isStreaming()) {
          return res.toStreamingResponse();
        }
        return res.toResponse();
      }

      return new Response(null, { status: 200 });
    }

    return this.handleWithMiddleware(original, pathname, method, server);
  }

  /**
   * Handle request with middleware pipeline - creates req/res upfront
   */
  private async handleWithMiddleware(
    original: Request,
    pathname: string,
    method: string,
    server?: BunServer<unknown>
  ): Promise<Response> {
    const req = new BunRequest(original, pathname);
    const res = new BunResponse();

    // Inject app context directly (avoids middleware overhead)
    if (this._appContext) {
      this._appContext.setApp(req, res);
    }

    if (server?.requestIP) {
      const socketAddr = server.requestIP(original);
      req.setSocketIp(socketAddr?.address ?? null);
    }

    // Run global middleware
    try {
      await this.runPipeline([...this.middlewares], req, res);
    } catch (err) {
      return this.handleError(err, req, res);
    }

    if (res.isSent()) {
      if (res.isStreaming()) {
        return res.toStreamingResponse();
      }
      return res.toResponse();
    }

    // Fast route matching - O(1) for static routes, single regex for dynamic
    const matchResult = this.fastMatcher.match(method, pathname);

    if (matchResult) {
      req.params = matchResult.params;
      req.route = { path: matchResult.path, method };

      // Build param middleware handlers
      const paramMiddleware: Handler[] = [];
      for (const [name, value] of Object.entries(matchResult.params)) {
        const handlers = this.paramHandlers.get(name);
        if (handlers) {
          for (const handler of handlers) {
            paramMiddleware.push((r, s, n) => handler(r, s, n, value, name));
          }
        }
      }

      const pipeline = [...paramMiddleware, ...matchResult.handlers];

      try {
        await this.runPipeline(pipeline, req, res);
      } catch (err) {
        return this.handleError(err, req, res);
      }

      if (res.isSent()) {
        if (res.isStreaming()) {
          return res.toStreamingResponse();
        }
        return res.toResponse();
      }

      return new Response(null, { status: 200 });
    }

    // No match found - check for 405 Method Not Allowed
    const matchingMethods = this.fastMatcher.getMatchingMethods(pathname);
    if (matchingMethods.length > 0) {
      const allowedMethods = matchingMethods.join(", ");
      return new Response(
        JSON.stringify({
          error: "Method Not Allowed",
          message: `${method} is not allowed for ${pathname}`,
          allowedMethods,
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            Allow: allowedMethods,
          },
        }
      );
    }

    // True 404 - path doesn't exist
    return new Response(
      JSON.stringify({
        error: "Not Found",
        message: `Cannot ${method} ${pathname}`,
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
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
