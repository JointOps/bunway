import type { Handler } from "../types";

/**
 * Result of a route match operation
 */
export interface MatchResult {
  handlers: Handler[];
  params: Record<string, string>;
  path: string;
  keys: string[];
}

/**
 * Internal route storage for dynamic routes
 */
interface DynamicRoute {
  path: string;
  pattern: string;
  keys: string[];
  handlers: Handler[];
}

/**
 * Pre-computed route info for efficient lookup after regex match
 */
interface RouteInfo {
  route: DynamicRoute;
  paramOffset: number;
  markerPosition: number;
}

/**
 * Compiled matcher for dynamic routes
 */
interface CompiledMatcher {
  regex: RegExp;
  // Dense array of route info - enables fast iteration
  routeInfos: RouteInfo[];
}

/**
 * FastMatcher - High-performance route matcher using hybrid strategy
 *
 * Strategy:
 * 1. Static routes (no params/wildcards) -> O(1) hashmap lookup
 * 2. Dynamic routes -> Single compiled regex matching
 *
 * This approach mirrors Hono's RegExpRouter for maximum performance.
 */
export class FastMatcher {
  // Static routes: method -> path -> handlers
  // O(1) lookup for routes like /json, /users, /health
  private staticRoutes: Map<string, Map<string, { handlers: Handler[]; path: string }>> =
    new Map();

  // Dynamic routes storage (before compilation)
  private dynamicRoutes: Map<string, DynamicRoute[]> = new Map();

  // Compiled matchers per method
  private compiledMatchers: Map<string, CompiledMatcher> = new Map();

  // Flag to track if routes have changed since last compilation
  private needsRebuild = true;

  /**
   * Add a route to the matcher
   */
  add(method: string, path: string, handlers: Handler[]): void {
    this.needsRebuild = true;

    // Classify: static vs dynamic
    if (this.isStaticPath(path)) {
      this.addStaticRoute(method, path, handlers);
    } else {
      this.addDynamicRoute(method, path, handlers);
    }
  }

  /**
   * Check if a path is static (no parameters or wildcards)
   */
  private isStaticPath(path: string): boolean {
    return !/[:\*]/.test(path);
  }

  /**
   * Add a static route to the hashmap
   */
  private addStaticRoute(method: string, path: string, handlers: Handler[]): void {
    let methodRoutes = this.staticRoutes.get(method);
    if (!methodRoutes) {
      methodRoutes = new Map();
      this.staticRoutes.set(method, methodRoutes);
    }

    const existing = methodRoutes.get(path);
    if (existing) {
      existing.handlers.push(...handlers);
    } else {
      methodRoutes.set(path, { handlers: [...handlers], path });
    }
  }

  /**
   * Add a dynamic route to be compiled later
   */
  private addDynamicRoute(method: string, path: string, handlers: Handler[]): void {
    let methodRoutes = this.dynamicRoutes.get(method);
    if (!methodRoutes) {
      methodRoutes = [];
      this.dynamicRoutes.set(method, methodRoutes);
    }

    const { pattern, keys } = this.pathToPattern(path);
    methodRoutes.push({ path, pattern, keys, handlers: [...handlers] });
  }

  /**
   * Convert a path pattern to regex components
   */
  private pathToPattern(path: string): { pattern: string; keys: string[] } {
    const keys: string[] = [];
    let wildcardIndex = 0;

    const pattern = path
      .replace(/[.+^${}|[\]\\]/g, "\\$&")
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
      });

    return { pattern, keys };
  }

  /**
   * Build compiled matchers for all methods
   */
  private buildMatchers(): void {
    if (!this.needsRebuild) return;

    this.compiledMatchers.clear();

    for (const [method, routes] of this.dynamicRoutes) {
      if (routes.length === 0) continue;

      const patterns: string[] = [];
      const routeInfos: RouteInfo[] = [];
      let captureOffset = 1;

      for (const route of routes) {
        const markerPosition = captureOffset + route.keys.length;

        routeInfos.push({
          route,
          paramOffset: captureOffset,
          markerPosition,
        });

        patterns.push(`(?:${route.pattern})($)`);
        captureOffset += route.keys.length + 1;
      }

      const combinedPattern = `^(?:${patterns.join("|")})`;
      const regex = new RegExp(combinedPattern);

      this.compiledMatchers.set(method, { regex, routeInfos });
    }

    this.needsRebuild = false;
  }

  /**
   * Match a request path against registered routes
   */
  match(method: string, pathname: string): MatchResult | null {
    this.buildMatchers();

    // 1. Try static routes first - O(1) hashmap lookup
    const staticResult = this.matchStatic(method, pathname);
    if (staticResult) return staticResult;

    if (method !== "ALL") {
      const staticAllResult = this.matchStatic("ALL", pathname);
      if (staticAllResult) return staticAllResult;
    }

    // 2. Try dynamic routes
    const dynamicResult = this.matchDynamic(method, pathname);
    if (dynamicResult) return dynamicResult;

    if (method !== "ALL") {
      const dynamicAllResult = this.matchDynamic("ALL", pathname);
      if (dynamicAllResult) return dynamicAllResult;
    }

    return null;
  }

  /**
   * Match against static routes - O(1)
   */
  private matchStatic(method: string, pathname: string): MatchResult | null {
    const methodRoutes = this.staticRoutes.get(method);
    if (!methodRoutes) return null;

    const route = methodRoutes.get(pathname);
    if (!route) return null;

    return {
      handlers: route.handlers,
      params: {},
      path: route.path,
      keys: [],
    };
  }

  /**
   * Match against dynamic routes using compiled regex
   */
  private matchDynamic(method: string, pathname: string): MatchResult | null {
    const matcher = this.compiledMatchers.get(method);
    if (!matcher) return null;

    const match = matcher.regex.exec(pathname);
    if (!match) return null;

    // Find which route matched by checking marker positions
    const routeInfos = matcher.routeInfos;
    const len = routeInfos.length;

    for (let i = 0; i < len; i++) {
      const info = routeInfos[i];
      if (!info) continue;

      // Check if this route's marker is defined (route matched)
      if (match[info.markerPosition] !== undefined) {
        const { route, paramOffset } = info;

        // Extract parameters
        const params: Record<string, string> = {};
        const keys = route.keys;
        const keyLen = keys.length;

        for (let j = 0; j < keyLen; j++) {
          const key = keys[j];
          const value = match[paramOffset + j];
          if (key !== undefined && value !== undefined) {
            params[key] = value;
          }
        }

        return {
          handlers: route.handlers,
          params,
          path: route.path,
          keys: route.keys,
        };
      }
    }

    return null;
  }

  /**
   * Get all routes that match the pathname (for 405 detection)
   */
  getMatchingMethods(pathname: string): string[] {
    this.buildMatchers();

    const methods: string[] = [];

    for (const [method, routes] of this.staticRoutes) {
      if (routes.has(pathname)) {
        methods.push(method);
      }
    }

    for (const [method, matcher] of this.compiledMatchers) {
      if (matcher.regex.test(pathname)) {
        if (!methods.includes(method)) {
          methods.push(method);
        }
      }
    }

    return methods;
  }

  hasRoutes(): boolean {
    return this.staticRoutes.size > 0 || this.dynamicRoutes.size > 0;
  }

  clear(): void {
    this.staticRoutes.clear();
    this.dynamicRoutes.clear();
    this.compiledMatchers.clear();
    this.needsRebuild = true;
  }
}
