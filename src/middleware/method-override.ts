import type { BunRequest } from "../core/request";
import type { Handler } from "../types";

export interface MethodOverrideOptions {
  getter?: string | ((req: BunRequest) => string | undefined);
}

const ALLOWED_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "PATCH", "OPTIONS"]);

function getBodyOverride(req: BunRequest, key: string): string | undefined {
  if (!req.body || typeof req.body !== "object") return undefined;
  const value = (req.body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function getQueryOverride(req: BunRequest, key: string): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function normalizeMethod(value: string | undefined): string | null {
  if (!value) return null;
  const method = value.toUpperCase();
  return ALLOWED_METHODS.has(method) ? method : null;
}

export function methodOverride(options: MethodOverrideOptions = {}): Handler {
  const getter = options.getter ?? "X-HTTP-Method-Override";

  return (req, _res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }

    let override: string | undefined;
    if (typeof getter === "string") {
      override = req.get(getter) ?? getQueryOverride(req, getter) ?? getBodyOverride(req, getter);
    } else {
      override = getter(req);
    }

    const method = normalizeMethod(override);
    if (method) {
      Object.defineProperty(req, "_originalMethod", {
        configurable: true,
        enumerable: false,
        value: req.method,
        writable: true,
      });
      Object.defineProperty(req, "method", {
        configurable: true,
        enumerable: true,
        value: method,
        writable: true,
      });
    }

    next();
  };
}
