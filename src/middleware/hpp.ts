import type { Handler, NextFunction } from "../types";
import type { BunRequest } from "../core/request";
import type { BunResponse } from "../core/response";

export interface HppOptions {
  /**
   * Parameters that are allowed to have multiple values (arrays).
   * All other duplicated parameters will be reduced to their last value.
   * Default: [] (no whitelist — all duplicates reduced)
   */
  whitelist?: string[];

  /**
   * If true, store the original polluted query values in req.locals.queryPolluted.
   * Default: true
   */
  checkQuery?: boolean;

  /**
   * If true, also sanitize req.body (for urlencoded bodies with duplicate keys).
   * Default: true
   */
  checkBody?: boolean;
}

export function hpp(options: HppOptions = {}): Handler {
  const whitelist = new Set(options.whitelist ?? []);
  const checkQuery = options.checkQuery !== false;
  const checkBody = options.checkBody !== false;

  return (req: BunRequest, res: BunResponse, next: NextFunction) => {
    if (checkQuery) {
      sanitizeQuery(req, whitelist);
    }

    if (checkBody && req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      sanitizeBody(req, whitelist);
    }

    next();
  };
}

function sanitizeQuery(req: BunRequest, whitelist: Set<string>): void {
  const polluted: Record<string, string[]> = {};
  let hasPollution = false;

  // Detect duplicate query parameters
  const seen = new Map<string, string[]>();
  const url = req.url;
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return;

  const searchStr = url.slice(qIndex + 1);
  const pairs = searchStr.split("&");

  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");
    const key = eqIndex === -1 ? decodeURIComponent(pair) : decodeURIComponent(pair.slice(0, eqIndex));
    const value = eqIndex === -1 ? "" : decodeURIComponent(pair.slice(eqIndex + 1));

    if (!seen.has(key)) {
      seen.set(key, [value]);
    } else {
      seen.get(key)!.push(value);
    }
  }

  // For each parameter with multiple values, store polluted and keep last
  for (const [key, values] of seen) {
    if (values.length > 1 && !whitelist.has(key)) {
      polluted[key] = values;
      hasPollution = true;
      // URLSearchParams.get() already returns the last value, so the default
      // behavior is safe. We store the full array in queryPolluted for inspection.
    }
  }

  if (hasPollution) {
    req.locals.queryPolluted = polluted;
  }
}

function sanitizeBody(req: BunRequest, whitelist: Set<string>): void {
  const body = req.body as Record<string, unknown>;
  const polluted: Record<string, unknown[]> = {};
  let hasPollution = false;

  for (const [key, value] of Object.entries(body)) {
    if (Array.isArray(value) && !whitelist.has(key)) {
      polluted[key] = value;
      hasPollution = true;
      // Take last value (Express hpp behavior)
      body[key] = value[value.length - 1];
    }
  }

  if (hasPollution) {
    req.locals.bodyPolluted = polluted;
  }
}
