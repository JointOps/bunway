import type { Handler, NextFunction } from "../types";
import type { BunRequest } from "../core/request";
import type { BunResponse } from "../core/response";

export interface TimeoutOptions {
  /**
   * Timeout duration in milliseconds.
   */
  ms: number;

  /**
   * HTTP status code to send on timeout. Default: 408.
   */
  statusCode?: number;

  /**
   * Custom message or JSON body for the timeout response.
   * Default: "Request Timeout"
   */
  message?: string | Record<string, unknown>;

  /**
   * If false, the middleware sets req.timedout but does NOT send a response.
   * The downstream handler must check req.timedout and respond itself.
   * Default: true
   */
  respond?: boolean;

  /**
   * Optional function to skip timeout for certain requests.
   * Return true to skip (no timeout applied).
   */
  skip?: (req: BunRequest) => boolean;
}

export function timeout(ms: number, options: Omit<TimeoutOptions, "ms"> = {}): Handler {
  const statusCode = options.statusCode ?? 408;
  const message = options.message ?? "Request Timeout";
  const respond = options.respond !== false;
  const skip = options.skip;

  return (req: BunRequest, res: BunResponse, next: NextFunction) => {
    req.timedout = false;

    if (skip?.(req)) return next();

    const timer = setTimeout(() => {
      if (res.headersSent) return;
      req.timedout = true;

      if (respond) {
        res.status(statusCode);
        if (typeof message === "string") {
          res.set("Content-Type", "text/plain");
          res.send(message);
        } else {
          res.json(message);
        }
      }

      next(Object.assign(new Error("Request timeout"), { status: statusCode, code: "ETIMEDOUT" }));
    }, ms);

    const orig = res.toResponse.bind(res);
    (res as any).toResponse = () => {
      clearTimeout(timer);
      return orig();
    };

    next();
  };
}
