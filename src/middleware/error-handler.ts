import type { ErrorHandler } from "../types";
import type { BunRequest } from "../core/request";
import { isHttpError } from "../core/errors";

export interface ErrorHandlerOptions {
  logger?: (error: unknown, req: BunRequest) => void;
  includeStack?: boolean;
  useAppLogger?: boolean; // When true, uses app.getLogger() for error logging
  development?: boolean; // When true, includes detailed error info (auto-detected from NODE_ENV)
  showRequestInfo?: boolean; // Include request method/path in error response
}

// ANSI color codes for console output
const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

/**
 * Format error for console output with colors (development mode)
 */
function formatConsoleError(err: unknown, req: BunRequest): string {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  let output = `\n${colors.red}ERROR${colors.reset} ${colors.dim}${timestamp}${colors.reset}\n`;
  output += `${colors.cyan}${method} ${path}${colors.reset}\n`;
  output += `${colors.yellow}${message}${colors.reset}\n`;

  if (stack) {
    // Format stack trace with dimmed file paths
    const stackLines = stack.split("\n").slice(1);
    output += `${colors.dim}${stackLines.join("\n")}${colors.reset}\n`;
  }

  return output;
}

/**
 * Error handling middleware with improved developer experience
 *
 * @example
 * // Basic usage
 * app.use(bunway.errorHandler());
 *
 * @example
 * // Development mode with full details
 * app.use(bunway.errorHandler({ development: true }));
 *
 * @example
 * // With app logger integration
 * app.use(bunway.errorHandler({ useAppLogger: true }));
 */
export function errorHandler(options: ErrorHandlerOptions = {}): ErrorHandler {
  const {
    logger,
    includeStack = false,
    useAppLogger = false,
    development = process.env.NODE_ENV !== "production",
    showRequestInfo = false,
  } = options;

  // Auto-enable stack traces in development
  const shouldIncludeStack = includeStack || development;

  return (err, req, res, next) => {
    // Log the error to console in development mode with colors
    if (development && process.stdout.isTTY && !logger && !useAppLogger) {
      console.error(formatConsoleError(err, req));
    }

    // Log the error using custom logger, app logger, or skip
    if (logger) {
      try {
        logger(err, req);
      } catch {}
    } else if (useAppLogger && req.app) {
      try {
        const appLogger = req.app.getLogger();
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        appLogger.error(message, {
          path: req.path,
          method: req.method,
          ...(stack && { stack }),
        });
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
        const response: Record<string, unknown> = { error: err.message };
        if (showRequestInfo || development) {
          response.method = req.method;
          response.path = req.path;
        }
        res.json(response);
      }
      return;
    }

    const message = err instanceof Error ? err.message : "Internal Server Error";
    const stack = shouldIncludeStack && err instanceof Error ? err.stack : undefined;

    const response: Record<string, unknown> = {
      error: message,
    };

    if (showRequestInfo || development) {
      response.method = req.method;
      response.path = req.path;
      response.timestamp = new Date().toISOString();
    }

    if (stack) {
      response.stack = stack;
    }

    // Add error type in development
    if (development && err instanceof Error) {
      response.type = err.constructor.name;
    }

    res.status(500).json(response);
  };
}
