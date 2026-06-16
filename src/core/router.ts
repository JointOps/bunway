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
import { FastMatcher, type MatchResult } from "./fast-matcher";
import { getPathname } from "../utils/url";
import { Route } from "./route";

interface SubRouter {
  prefix: string;
  router: Router;
  prefixRegex?: RegExp;
  prefixKeys?: string[];
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

const ROUTE_SIGNAL = "__bunway_route_skip__";
const ROUTER_SIGNAL = "__bunway_router_skip__";

function make404Body(method: string, pathname: string): string {
  return `{"error":"Not Found","message":"Cannot ${method} ${pathname}"}`;
}
function make405Body(method: string, pathname: string, allow: string): string {
  return `{"error":"Method Not Allowed","message":"${method} is not allowed for ${pathname}","allowedMethods":"${allow}"}`;
}
const JSON_HEADERS = { "Content-Type": "application/json" };
const JSON_ALLOW_HEADER = (allow: string): Record<string, string> => ({
  "Content-Type": "application/json",
  "Allow": allow,
});

export class Router {
  protected routes: RouteDefinition[] = [];
  protected middlewares: Handler[] = [];
  protected prefixMiddlewares: Array<{ prefix: string; handlers: Handler[] }> = [];
  protected errorHandlers: ErrorHandler[] = [];
  protected children: SubRouter[] = [];
  protected routerOptions: RouterOptions;
  protected paramHandlers: Map<string, ParamHandler[]> = new Map();
  protected wsRoutes: WebSocketRouteDefinition[] = [];
  private readonly _mergeParams: boolean;

  // Fast matcher for O(1) static routes and compiled regex for dynamic routes
  protected fastMatcher: FastMatcher = new FastMatcher();

  // App context for direct injection (set by BunWayApp)
  protected _appContext: {
    setApp: (req: BunRequest, res: BunResponse) => void;
  } | null = null;

  constructor(opts: RouterOptions = {}) {
    this.routerOptions = opts;
    this._mergeParams = opts.mergeParams === true;
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

  private collectRouteMatches(
    method: string,
    pathname: string
  ): Array<{ route: RouteDefinition; params: Record<string, string> }> {
    const methods = method === "HEAD" ? ["HEAD", "GET"] : [method];
    const pathnames = (pathname === "/" || this.routerOptions.strict)
      ? [pathname]
      : [pathname, pathname.endsWith("/") ? pathname.slice(0, -1) : pathname + "/"];
    const matches: Array<{ route: RouteDefinition; params: Record<string, string> }> = [];
    let matchedHead = false;

    for (const route of this.routes) {
      if (!methods.includes(route.method) && route.method !== "ALL") continue;
      if (method === "HEAD" && matchedHead && route.method === "GET") continue;

      let match: RegExpExecArray | null = null;
      for (const candidate of pathnames) {
        route.regex.lastIndex = 0;
        match = route.regex.exec(candidate);
        if (match) break;
      }
      if (!match) continue;

      if (method === "HEAD" && route.method === "HEAD") matchedHead = true;

      const params: Record<string, string> = {};
      route.keys.forEach((key, i) => {
        params[key] = match[i + 1] ?? "";
      });
      matches.push({ route, params });
    }

    return matches.filter(({ route }) => {
      if (method !== "HEAD") return true;
      return matchedHead ? route.method === "HEAD" || route.method === "ALL" : true;
    });
  }

  private async dispatchMatchingRoutes(
    req: BunRequest,
    res: BunResponse,
    method: string,
    pathname: string,
    mergeWith?: Record<string, string>,
    calledParams: Set<string> = new Set(),
    errorBubble?: (err: unknown, req: BunRequest, res: BunResponse) => Promise<Response>
  ): Promise<Response | null> {
    const matches = this.collectRouteMatches(method, pathname);

    for (const { route, params } of matches) {
      req.params = mergeWith ? { ...mergeWith, ...params } : params;
      req.route = { path: route.path, method };

      const paramMiddleware: Handler[] = [];
      for (const [name, value] of Object.entries(params)) {
        if (calledParams.has(name)) continue;
        const handlers = this.paramHandlers.get(name);
        if (handlers) {
          calledParams.add(name);
          for (const handler of handlers) {
            paramMiddleware.push((r, s, n) => handler(r, s, n, value, name));
          }
        }
      }

      try {
        await this.runPipeline([...paramMiddleware, ...route.handlers], req, res);
      } catch (err) {
        if (err === ROUTE_SIGNAL) continue;
        if (err === ROUTER_SIGNAL) break;
        return await this.handleError(err, req, res, errorBubble);
      }

      if (res.isSent()) {
        if (res.isStreaming()) {
          return res.toStreamingResponse();
        }
        return res.toResponse();
      }

      return new Response(null, { status: 200 });
    }

    return null;
  }

  private async dispatchFromMatch(
    req: BunRequest,
    res: BunResponse,
    method: string,
    match: MatchResult,
    mergeWith?: Record<string, string>,
    calledParams?: Set<string>,
    errorBubble?: (err: unknown, req: BunRequest, res: BunResponse) => Promise<Response>
  ): Promise<Response | null> {
    req.params = mergeWith ? { ...mergeWith, ...match.params } : match.params;
    req.route = { path: match.path, method };

    // Build param middleware only if there are param handlers registered
    // and the match has params — avoids allocation in the common case
    let pipeline: Handler[];
    if (this.paramHandlers.size > 0 && match.keys.length > 0) {
      const paramMiddleware: Handler[] = [];
      for (const [name, value] of Object.entries(match.params)) {
        const handlers = this.paramHandlers.get(name);
        if (handlers) {
          calledParams?.add(name);
          for (const h of handlers) {
            paramMiddleware.push((r, s, n) => h(r, s, n, value, name));
          }
        }
      }
      pipeline = paramMiddleware.length > 0
        ? paramMiddleware.concat(match.handlers)
        : match.handlers; // zero-alloc hot path: reference, no copy
    } else {
      pipeline = match.handlers; // zero-alloc hot path
    }

    try {
      await this.runPipeline(pipeline, req, res);
    } catch (err) {
      if (err === ROUTE_SIGNAL || err === ROUTER_SIGNAL) return null;
      return await this.handleError(err, req, res, errorBubble);
    }

    if (res.isSent()) {
      return res.isStreaming() ? res.toStreamingResponse() : res.toResponse();
    }

    return new Response(null, { status: 200 });
  }

  private matchChild(
    child: SubRouter,
    pathname: string
  ): { childPathname: string; parentParams: Record<string, string> } | null {
    if (child.prefixRegex && child.prefixKeys) {
      const match = child.prefixRegex.exec(pathname);
      if (!match) return null;
      const params: Record<string, string> = {};
      for (let i = 0; i < child.prefixKeys.length; i++) {
        const key = child.prefixKeys[i];
        if (key) params[key] = match[i + 1] ?? "";
      }
      const childPathname = pathname.slice(match[0].length) || "/";
      return { childPathname, parentParams: params };
    }
    if (pathname.startsWith(child.prefix)) {
      return { childPathname: pathname.slice(child.prefix.length) || "/", parentParams: {} };
    }
    return null;
  }

  private prefixToRegex(prefix: string): { regex: RegExp; keys: string[] } {
    const keys: string[] = [];
    const pattern = prefix
      .replace(/\/:(\w+)/g, (_, paramName) => {
        keys.push(paramName);
        return "/([^/]+)";
      })
      .replace(/\//g, "\\/");
    return { regex: new RegExp(`^${pattern}`), keys };
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

  private addRegexRoute(method: string, regex: RegExp, handlers: Handler[]): void {
    // Extract named capture groups if any
    const keys: string[] = [];
    const source = regex.source;
    const namedGroupRegex = /\(\?<(\w+)>/g;
    let match: RegExpExecArray | null;
    while ((match = namedGroupRegex.exec(source)) !== null) {
      keys.push(match[1]!);
    }

    const route: RouteDefinition = {
      method,
      path: regex.source,
      regex,
      keys,
      handlers,
    };

    this.routes.push(route);

    // Also add to fast matcher
    this.fastMatcher.addRegexRoute(method, regex, keys, handlers);
  }

  get(path: string | RegExp, ...handlers: Handler[]): this {
    if (path instanceof RegExp) {
      this.addRegexRoute("GET", path, handlers);
      return this;
    }
    if (path === "*") path = "/*";
    this.addRoute("GET", path, handlers);
    return this;
  }

  post(path: string | RegExp, ...handlers: Handler[]): this {
    if (path instanceof RegExp) {
      this.addRegexRoute("POST", path, handlers);
      return this;
    }
    if (path === "*") path = "/*";
    this.addRoute("POST", path, handlers);
    return this;
  }

  put(path: string | RegExp, ...handlers: Handler[]): this {
    if (path instanceof RegExp) {
      this.addRegexRoute("PUT", path, handlers);
      return this;
    }
    if (path === "*") path = "/*";
    this.addRoute("PUT", path, handlers);
    return this;
  }

  delete(path: string | RegExp, ...handlers: Handler[]): this {
    if (path instanceof RegExp) {
      this.addRegexRoute("DELETE", path, handlers);
      return this;
    }
    if (path === "*") path = "/*";
    this.addRoute("DELETE", path, handlers);
    return this;
  }

  patch(path: string | RegExp, ...handlers: Handler[]): this {
    if (path instanceof RegExp) {
      this.addRegexRoute("PATCH", path, handlers);
      return this;
    }
    if (path === "*") path = "/*";
    this.addRoute("PATCH", path, handlers);
    return this;
  }

  options(path: string | RegExp, ...handlers: Handler[]): this {
    if (path instanceof RegExp) {
      this.addRegexRoute("OPTIONS", path, handlers);
      return this;
    }
    if (path === "*") path = "/*";
    this.addRoute("OPTIONS", path, handlers);
    return this;
  }

  head(path: string | RegExp, ...handlers: Handler[]): this {
    if (path instanceof RegExp) {
      this.addRegexRoute("HEAD", path, handlers);
      return this;
    }
    if (path === "*") path = "/*";
    this.addRoute("HEAD", path, handlers);
    return this;
  }

  all(path: string | RegExp, ...handlers: Handler[]): this {
    // Normalize bare '*' to '/*' for catch-all (Express compat)
    if (path === "*") path = "/*";
    if (path instanceof RegExp) {
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];
      for (const method of methods) {
        this.addRegexRoute(method, path, handlers);
      }
      return this;
    }
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];
    for (const method of methods) {
      this.addRoute(method, path, handlers);
    }
    return this;
  }

  route(path: string): Route {
    return new Route(path, this);
  }

  use(handler: Handler): this;
  use(paths: string[], router: Router): this;
  use(paths: string[], ...handlers: Handler[]): this;
  use(path: string, router: Router): this;
  use(path: string, ...handlers: Handler[]): this;
  use(pathOrHandler: string | string[] | Handler, routerOrHandler?: Router | Handler, ...rest: Handler[]): this {
    // Array of paths — register for each path
    if (Array.isArray(pathOrHandler)) {
      for (const path of pathOrHandler) {
        if (routerOrHandler instanceof Router) {
          this.use(path, routerOrHandler);
        } else if (routerOrHandler !== undefined) {
          this.use(path, routerOrHandler as Handler, ...rest);
        }
      }
      return this;
    }

    if (typeof pathOrHandler === "function") {
      if (pathOrHandler.length === 4) {
        this.errorHandlers.push(pathOrHandler as unknown as ErrorHandler);
      } else {
        this.middlewares.push(pathOrHandler);
      }
      return this;
    }

    if (routerOrHandler instanceof Router) {
      // Set mountpath and parent for sub-apps (Express compat: app.mountpath, app.path())
      if ("mountpath" in routerOrHandler && "_parent" in routerOrHandler) {
        (routerOrHandler as Record<string, unknown>).mountpath = pathOrHandler;
        (routerOrHandler as Record<string, unknown>)._parent = this;
      }
      if (pathOrHandler.includes(":")) {
        const { regex, keys } = this.prefixToRegex(pathOrHandler);
        this.children.push({ prefix: pathOrHandler, router: routerOrHandler, prefixRegex: regex, prefixKeys: keys });
      } else {
        this.children.push({ prefix: pathOrHandler, router: routerOrHandler });
      }
      return this;
    }

    if (typeof routerOrHandler === "function") {
      const handlers = [routerOrHandler, ...rest];
      this.prefixMiddlewares.push({ prefix: pathOrHandler, handlers });
    }

    return this;
  }

  group(prefix: string, callbackOrOptions?: GroupCallback | GroupOptions, callback?: GroupCallback): this {
    const subRouter = new Router({ ...this.routerOptions, mergeParams: true });

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

    if (prefix.includes(":")) {
      const { regex, keys } = this.prefixToRegex(prefix);
      this.children.push({ prefix, router: subRouter, prefixRegex: regex, prefixKeys: keys });
    } else {
      this.children.push({ prefix, router: subRouter });
    }
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
    const method = original.method;

    // Check child routers first - optimized to avoid creating new Request/URL
    for (const child of this.children) {
      const delegated = this.matchChild(child, pathname);
      if (delegated) {
        const parentBubble = this.errorHandlers.length > 0
          ? (e: unknown, rq: BunRequest, rs: BunResponse) => this.handleError(e, rq, rs)
          : undefined;
        return child.router.handleInternal(original, delegated.childPathname, method, server, delegated.parentParams, child.prefix, parentBubble);
      }
    }

    // FAST PATH: If no middleware, check route existence before creating objects
    if (this.middlewares.length === 0 && this.prefixMiddlewares.length === 0 && this.errorHandlers.length === 0) {
      const matchResult = this.fastMatcher.match(method, pathname);

      if (!matchResult) {
        // No route match - return 404/405 without creating req/res
        const matchingMethods = this.fastMatcher.getMatchingMethods(pathname);
        if (matchingMethods.length > 0) {
          const allowedMethods = matchingMethods.join(", ");
          return new Response(make405Body(method, pathname, allowedMethods), {
            status: 405,
            headers: JSON_ALLOW_HEADER(allowedMethods),
          });
        }
        return new Response(make404Body(method, pathname), {
          status: 404,
          headers: JSON_HEADERS,
        });
      }

      // Route found - now create req/res for handlers
      const req = new BunRequest(original, pathname);
      const res = new BunResponse();
      res.setReq(req);

      if (server?.requestIP) {
        const socketAddr = server.requestIP(original);
        req.setSocketIp(socketAddr?.address ?? null);
      }

      // Inject app context directly (avoids middleware overhead)
      if (this._appContext) {
        this._appContext.setApp(req, res);
      }

      const paramsSeen = new Set<string>();
      const routed = await this.dispatchFromMatch(req, res, method, matchResult, undefined, paramsSeen);
      if (routed) return routed;

      const fallback = await this.dispatchMatchingRoutes(req, res, method, pathname, undefined, paramsSeen);
      if (fallback) return fallback;

      return new Response(make404Body(method, pathname), {
        status: 404,
        headers: JSON_HEADERS,
      });
    }

    // STANDARD PATH: Has middleware, need req/res upfront
    return this.handleWithMiddleware(original, pathname, server);
  }

  /**
   * Internal handle method for child router delegation - avoids creating new Request/URL objects
   */
  protected async handleInternal(
    original: Request,
    pathname: string,
    method: string,
    server?: BunServer<unknown>,
    parentParams?: Record<string, string>,
    baseUrl?: string,
    errorBubble?: (err: unknown, req: BunRequest, res: BunResponse) => Promise<Response>
  ): Promise<Response> {
    // Check child routers first
    for (const child of this.children) {
      const delegated = this.matchChild(child, pathname);
      if (delegated) {
        const accumulated = this._mergeParams && parentParams
          ? { ...parentParams, ...delegated.parentParams }
          : delegated.parentParams;
        const childBaseUrl = (baseUrl ?? "") + child.prefix;
        // Bubble: child's own handlers first, then this router's handlers, then parent's bubble
        const childBubble = this.errorHandlers.length > 0
          ? (e: unknown, rq: BunRequest, rs: BunResponse) => this.handleError(e, rq, rs, errorBubble)
          : errorBubble;
        return child.router.handleInternal(original, delegated.childPathname, method, server, accumulated, childBaseUrl, childBubble);
      }
    }

    // Determine merged params helper
    const mergeWith = this._mergeParams && parentParams ? parentParams : undefined;

    // Fast path for no middleware
    if (this.middlewares.length === 0 && this.prefixMiddlewares.length === 0 && this.errorHandlers.length === 0) {
      const matchResult = this.fastMatcher.match(method, pathname);

      if (!matchResult) {
        const matchingMethods = this.fastMatcher.getMatchingMethods(pathname);
        if (matchingMethods.length > 0) {
          const allowedMethods = matchingMethods.join(", ");
          return new Response(make405Body(method, pathname, allowedMethods), {
            status: 405,
            headers: JSON_ALLOW_HEADER(allowedMethods),
          });
        }
        return new Response(make404Body(method, pathname), {
          status: 404,
          headers: JSON_HEADERS,
        });
      }

      const req = new BunRequest(original, pathname);
      if (baseUrl !== undefined) req.setBaseUrl(baseUrl);
      const res = new BunResponse();
      res.setReq(req);

      if (server?.requestIP) {
        const socketAddr = server.requestIP(original);
        req.setSocketIp(socketAddr?.address ?? null);
      }

      // Inject app context directly (avoids middleware overhead)
      if (this._appContext) {
        this._appContext.setApp(req, res);
      }

      const paramsSeen = new Set<string>();
      try {
        const routed = await this.dispatchFromMatch(req, res, method, matchResult, mergeWith, paramsSeen, errorBubble);
        if (routed) return routed;

        const fallback = await this.dispatchMatchingRoutes(req, res, method, pathname, mergeWith, paramsSeen, errorBubble);
        if (fallback) return fallback;
      } catch (err) {
        return await this.handleError(err, req, res, errorBubble);
      }

      return new Response(make404Body(method, pathname), {
        status: 404,
        headers: JSON_HEADERS,
      });
    }

    return this.handleWithMiddleware(original, pathname, server, mergeWith, baseUrl, errorBubble);
  }

  /**
   * Handle request with middleware pipeline - creates req/res upfront
   */
  private async handleWithMiddleware(
    original: Request,
    pathname: string,
    server?: BunServer<unknown>,
    mergeWith?: Record<string, string>,
    baseUrl?: string,
    errorBubble?: (err: unknown, req: BunRequest, res: BunResponse) => Promise<Response>
  ): Promise<Response> {
    const req = new BunRequest(original, pathname);
    if (baseUrl !== undefined) req.setBaseUrl(baseUrl);
    const res = new BunResponse();
    res.setReq(req);

    // Inject app context directly (avoids middleware overhead)
    if (this._appContext) {
      this._appContext.setApp(req, res);
    }

    if (server?.requestIP) {
      const socketAddr = server.requestIP(original);
      req.setSocketIp(socketAddr?.address ?? null);
    }

    if (mergeWith) {
      req.params = { ...mergeWith };
    }

    // Run global middleware
    try {
      await this.runPipeline([...this.middlewares], req, res);
    } catch (err) {
      return await this.handleError(err, req, res, errorBubble);
    }

    if (res.isSent()) {
      if (res.isStreaming()) {
        return res.toStreamingResponse();
      }
      return res.toResponse();
    }

    for (const { prefix, handlers } of this.prefixMiddlewares) {
      const norm = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
      if (pathname === norm || pathname.startsWith(norm + "/")) {
        const savedPath = (req as any)._pathname;
        (req as any)._pathname = pathname.slice(norm.length) || "/";
        try {
          await this.runPipeline(handlers, req, res);
        } catch (err) {
          return await this.handleError(err, req, res, errorBubble);
        } finally {
          (req as any)._pathname = savedPath;
        }
        if (res.isSent()) {
          if (res.isStreaming()) {
            return res.toStreamingResponse();
          }
          return res.toResponse();
        }
      }
    }

    // Re-read method after middleware — e.g. methodOverride may have changed it
    const effectiveMethod = req.method;

    // Fast route matching - O(1) for static routes, single regex for dynamic
    const matchResult = this.fastMatcher.match(effectiveMethod, pathname);

    if (matchResult) {
      const paramsSeen = new Set<string>();
      try {
        const routed = await this.dispatchFromMatch(req, res, effectiveMethod, matchResult, mergeWith, paramsSeen, errorBubble);
        if (routed) return routed;

        const fallback = await this.dispatchMatchingRoutes(req, res, effectiveMethod, pathname, mergeWith, paramsSeen, errorBubble);
        if (fallback) return fallback;
      } catch (err) {
        return await this.handleError(err, req, res, errorBubble);
      }

      return new Response(make404Body(effectiveMethod, pathname), {
        status: 404,
        headers: JSON_HEADERS,
      });
    }

    // No match found - check for 405 Method Not Allowed
    const matchingMethods = this.fastMatcher.getMatchingMethods(pathname);
    if (matchingMethods.length > 0) {
      const allowedMethods = matchingMethods.join(", ");
      return new Response(make405Body(effectiveMethod, pathname, allowedMethods), {
        status: 405,
        headers: JSON_ALLOW_HEADER(allowedMethods),
      });
    }

    // True 404 - path doesn't exist
    return new Response(make404Body(effectiveMethod, pathname), {
      status: 404,
      headers: JSON_HEADERS,
    });
  }

  private async runPipeline(pipeline: Handler[], req: BunRequest, res: BunResponse): Promise<void> {
    const len = pipeline.length;
    let idx = 0;

    const next = async (err?: unknown): Promise<void> => {
      if (err !== undefined) {
        if (err === "route") throw ROUTE_SIGNAL;
        if (err === "router") throw ROUTER_SIGNAL;
        throw err;
      }
      if (idx >= len || res.isSent()) return;

      const handler = pipeline[idx++]!;

      // Track whether next() was called synchronously
      let nextCalledSync = false;
      let syncErr: unknown = undefined;

      const done = (error?: unknown): void => {
        nextCalledSync = true;
        syncErr = error;
      };

      let result: unknown;
      try {
        result = handler(req, res, done);
      } catch (e) {
        throw e;
      }

      // Fast path: sync handler called next() inline
      if (nextCalledSync) {
        if (syncErr !== undefined) {
          if (syncErr === "route") throw ROUTE_SIGNAL;
          if (syncErr === "router") throw ROUTER_SIGNAL;
          throw syncErr;
        }
        // Recurse only if response not yet sent
        if (!res.isSent()) return next();
        return;
      }

      // Slow path: async handler returned a Promise
      if (
        result !== null &&
        result !== undefined &&
        typeof (result as Promise<void>).then === "function"
      ) {
        await (result as Promise<void>);
        if (nextCalledSync) {
          if (syncErr !== undefined) {
            if (syncErr === "route") throw ROUTE_SIGNAL;
            if (syncErr === "router") throw ROUTER_SIGNAL;
            throw syncErr;
          }
          if (!res.isSent()) return next();
        }
        return;
      }

      // Handler didn't call next() and didn't return a Promise.
      // If response was sent, we're done. Otherwise request will hang (matches Express).
    };

    return next();
  }

  private async handleError(
    err: unknown,
    req: BunRequest,
    res: BunResponse,
    errorBubble?: (err: unknown, req: BunRequest, res: BunResponse) => Promise<Response>
  ): Promise<Response> {
    for (const handler of this.errorHandlers) {
      try {
        const result = handler(err, req, res, () => {}) as unknown;
        if (result instanceof Promise) await result;
        if (res.isSent()) {
          return res.toResponse();
        }
      } catch {
        continue;
      }
    }

    // No local handler handled it — bubble to parent if available
    if (errorBubble) {
      return errorBubble(err, req, res);
    }

    if (isHttpError(err)) {
      const headers = new Headers(err.headers);
      if (err.body !== undefined) {
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify(err.body), { status: err.status, headers });
      }
      return new Response(err.message, { status: err.status, headers });
    }

    const errStatus =
      typeof (err as any)?.status === "number" ? (err as any).status :
      typeof (err as any)?.statusCode === "number" ? (err as any).statusCode : 500;

    const expose = (err as any)?.expose === true || errStatus < 500;
    const message = expose && err instanceof Error ? err.message : "Internal Server Error";

    return new Response(JSON.stringify({ error: message }), {
      status: errStatus,
      headers: { "Content-Type": "application/json" },
    });
  }
}
