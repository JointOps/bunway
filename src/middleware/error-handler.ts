import type { ErrorHandler } from "../types";
import type { BunRequest } from "../core/request";
import { isHttpError } from "../core/errors";

export interface ErrorHandlerOptions {
  logger?: (error: unknown, req: BunRequest) => void;
  includeStack?: boolean;
}

export function errorHandler(options: ErrorHandlerOptions = {}): ErrorHandler {
  const { logger, includeStack = false } = options;

  return (err, req, res, next) => {
    if (logger) {
      try {
        logger(err, req);
      } catch {}
    }

    if (isHttpError(err)) {
      for (const [key, value] of Object.entries(err.headers)) {
        res.set(key, value);
      }
      res.status(err.status);
      if (err.body !== undefined) {
        res.json(err.body);
      } else {
        res.json({ error: err.message });
      }
      return;
    }

    const message = err instanceof Error ? err.message : "Internal Server Error";
    const stack = includeStack && err instanceof Error ? err.stack : undefined;

    res.status(500).json({
      error: message,
      ...(stack && { stack }),
    });
  };
}
