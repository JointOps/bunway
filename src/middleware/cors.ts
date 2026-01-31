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

  const methodsStr = methods.join(", ");
  const allowedHeadersStr = allowedHeaders?.join(", ");
  const exposedHeadersStr = exposedHeaders?.join(", ");

  return (req, res, next) => {
    const requestOrigin = req.get("origin");
    if (!requestOrigin) {
      next();
      return;
    }

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

      res.set("Access-Control-Max-Age", String(maxAge));

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
