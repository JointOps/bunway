import type { Handler } from "../types";
import type { BunRequest } from "../core/request";

const DEFAULT_METHODS = ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"];
const DEFAULT_MAX_AGE = 600;

type OriginFn = (origin: string | null, req: BunRequest) => string | false;
type OriginOption = "*" | true | string | RegExp | (string | RegExp)[] | OriginFn;

export interface CorsOptions {
  origin?: OriginOption;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
}

function matchPattern(origin: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") return origin === pattern;
  return pattern.test(origin);
}

function resolveOrigin(requestOrigin: string, option: OriginOption, credentials: boolean, req: BunRequest): string | null {
  if (option === "*" || option === undefined) {
    return credentials ? requestOrigin : "*";
  }

  if (option === true) return requestOrigin;

  if (typeof option === "string") {
    return matchPattern(requestOrigin, option) ? requestOrigin : null;
  }

  if (option instanceof RegExp) {
    return option.test(requestOrigin) ? requestOrigin : null;
  }

  if (Array.isArray(option)) {
    for (const entry of option) {
      if (matchPattern(requestOrigin, entry)) return requestOrigin;
    }
    return null;
  }

  if (typeof option === "function") {
    const result = option(requestOrigin, req);
    if (result === false) return null;
    return result === "*" && credentials ? requestOrigin : result;
  }

  return null;
}

export function cors(options: CorsOptions = {}): Handler {
  const {
    origin: originOption = "*",
    methods = DEFAULT_METHODS,
    allowedHeaders,
    exposedHeaders,
    credentials = false,
    maxAge = DEFAULT_MAX_AGE,
    preflightContinue = false,
  } = options;

  // Pre-compute static header strings
  const methodsStr = methods.join(", ");
  const allowedHeadersStr = allowedHeaders?.join(", ") ?? null;
  const exposedHeadersStr = exposedHeaders?.join(", ") ?? null;
  const maxAgeStr = String(maxAge);

  // Fast path: static wildcard origin with no credentials —
  // headers are identical for every response, so pre-build them once
  const isStaticWildcard = originOption === "*" && !credentials;

  // Pre-built preflight entries for tight loop application (excludes Allow-Headers
  // when not configured, since those must be mirrored per-request)
  const staticPreflightEntries: [string, string][] = isStaticWildcard ? [
    ["Access-Control-Allow-Origin", "*"],
    ["Access-Control-Allow-Methods", methodsStr],
    ...(allowedHeadersStr ? [["Access-Control-Allow-Headers", allowedHeadersStr] as [string, string]] : []),
    ["Access-Control-Max-Age", maxAgeStr],
    ["Vary", "Origin"],
  ] : [];

  return (req, res, next) => {
    const requestOrigin = req.get("origin");

    // Non-CORS request: skip immediately — no allocation, no matching
    if (!requestOrigin) {
      next();
      return;
    }

    // Fast path: static wildcard
    if (isStaticWildcard) {
      if (req.method === "OPTIONS") {
        for (let i = 0; i < staticPreflightEntries.length; i++) {
          const entry = staticPreflightEntries[i]!;
          res.set(entry[0], entry[1]);
        }
        // Mirror request headers when allowedHeaders not statically configured
        if (!allowedHeadersStr) {
          const requested = req.get("access-control-request-headers");
          if (requested) res.set("Access-Control-Allow-Headers", requested);
        }
        if (!preflightContinue) {
          res.status(204).send(null);
          return;
        }
      } else {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Vary", "Origin");
        if (exposedHeadersStr) res.set("Access-Control-Expose-Headers", exposedHeadersStr);
      }
      next();
      return;
    }

    // Dynamic origin matching path (non-wildcard configs)
    const resolved = resolveOrigin(requestOrigin, originOption, credentials, req);
    if (!resolved) {
      next();
      return;
    }

    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Origin", resolved);

    if (credentials) {
      res.set("Access-Control-Allow-Credentials", "true");
    }

    const isPreflight = req.method === "OPTIONS" && req.get("access-control-request-method");

    if (isPreflight) {
      res.set("Access-Control-Allow-Methods", methodsStr);

      if (allowedHeadersStr) {
        res.set("Access-Control-Allow-Headers", allowedHeadersStr);
      } else {
        const requested = req.get("access-control-request-headers");
        if (requested) res.set("Access-Control-Allow-Headers", requested);
      }

      res.set("Access-Control-Max-Age", maxAgeStr);

      if (!preflightContinue) {
        res.status(204).send(null);
        return;
      }
    }

    if (exposedHeadersStr) {
      res.set("Access-Control-Expose-Headers", exposedHeadersStr);
    }

    next();
  };
}
