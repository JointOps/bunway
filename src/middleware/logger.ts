import type { Handler } from "../types";
import type { BunRequest } from "../core/request";
import type { BunResponse } from "../core/response";

// Symbol to mark response as already wrapped by logger
const LOGGER_APPLIED = Symbol("loggerApplied");

// Token function type
export type TokenFn = (req: BunRequest, res: BunResponse, meta: RequestMeta) => string;

// Request metadata captured during logging
export interface RequestMeta {
  startTime: number;
  responseTime: number;
  contentLength: number | null;
}

// Logger options
export interface LoggerOptions {
  skip?: (req: BunRequest, res: BunResponse) => boolean;
  stream?: { write: (message: string) => void };
  immediate?: boolean;
  useAppLogger?: boolean; // When true, uses app.getLogger() instead of stream
}

// Custom format function type
export type FormatFn = (
  tokens: TokenRegistry,
  req: BunRequest,
  res: BunResponse,
  meta: RequestMeta
) => string;

// Token registry interface
export interface TokenRegistry {
  method: TokenFn;
  url: TokenFn;
  path: TokenFn;
  status: TokenFn;
  "response-time": TokenFn;
  "content-length": TokenFn;
  date: TokenFn;
  referrer: TokenFn;
  "user-agent": TokenFn;
  "remote-addr": TokenFn;
  "remote-user": TokenFn;
  "http-version": TokenFn;
  [key: string]: TokenFn;
}

// Predefined format strings
const FORMATS: Record<string, string> = {
  combined:
    ':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :content-length ":referrer" ":user-agent"',
  common:
    ':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :content-length',
  dev: ":method :url :status :response-time ms - :content-length",
  short:
    ":remote-addr :remote-user :method :url HTTP/:http-version :status :content-length - :response-time ms",
  tiny: ":method :url :status :content-length - :response-time ms",
};

// Format date in CLF format
function formatDateCLF(): string {
  const now = new Date();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  const tz = -now.getTimezoneOffset();
  const tzSign = tz >= 0 ? "+" : "-";
  const tzHours = pad(Math.floor(Math.abs(tz) / 60));
  const tzMins = pad(Math.abs(tz) % 60);
  return `${pad(now.getDate())}/${months[now.getMonth()]}/${now.getFullYear()}:${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${tzSign}${tzHours}${tzMins}`;
}

// Create token registry with all built-in tokens
function createTokens(): TokenRegistry {
  return {
    method: (req) => req.method,
    url: (req) => req.originalUrl,
    path: (req) => req.path,
    status: (_, res) => String(res.statusCode),
    "response-time": (_, __, meta) => meta.responseTime.toFixed(3),
    "content-length": (_, res) => res.get("content-length") ?? "-",
    date: () => formatDateCLF(),
    referrer: (req) => req.get("referer") ?? req.get("referrer") ?? "-",
    "user-agent": (req) => req.get("user-agent") ?? "-",
    "remote-addr": (req) => req.ip,
    "remote-user": (req) => {
      const auth = req.get("authorization");
      if (!auth) return "-";
      try {
        const decoded = atob(auth.replace("Basic ", ""));
        return decoded.split(":")[0] || "-";
      } catch {
        return "-";
      }
    },
    "http-version": () => "1.1",
  };
}

// Compile format string to format function
function compileFormat(format: string, tokens: TokenRegistry): FormatFn {
  return (t, req, res, meta) => {
    return format.replace(/:(\w+[-\w]*)/g, (match, name) => {
      const token = t[name];
      if (!token) return match;
      return token(req, res, meta);
    });
  };
}

// Get ANSI color code for status
function getStatusColor(status: number): string {
  if (status >= 500) return "\x1b[31m"; // Red
  if (status >= 400) return "\x1b[33m"; // Yellow
  if (status >= 300) return "\x1b[36m"; // Cyan
  if (status >= 200) return "\x1b[32m"; // Green
  return "\x1b[0m"; // Reset
}

/**
 * Request logging middleware similar to morgan
 *
 * @param format - Predefined format name ('combined', 'common', 'dev', 'short', 'tiny')
 *                 or custom format string using tokens like :method :url :status
 *                 or custom format function
 * @param options - Logger options
 *
 * @example
 * // Using predefined format
 * app.use(bunway.logger('dev'));
 *
 * @example
 * // Using custom format string
 * app.use(bunway.logger(':method :url :status :response-time ms'));
 *
 * @example
 * // Using custom format function
 * app.use(bunway.logger((tokens, req, res, meta) => {
 *   return `${req.method} ${req.path} ${res.statusCode} ${meta.responseTime}ms`;
 * }));
 *
 * @example
 * // With options
 * app.use(bunway.logger('combined', {
 *   skip: (req) => req.path === '/health',
 *   stream: { write: (msg) => Bun.write('access.log', msg, { append: true }) }
 * }));
 */
export function logger(
  format?: string | FormatFn,
  options: LoggerOptions = {}
): Handler {
  const {
    skip,
    stream,
    immediate = false,
    useAppLogger = false,
  } = options;

  // Helper to get the write function - uses app logger if available and no custom stream
  const getWriter = (req: BunRequest) => {
    if (stream) {
      return stream.write.bind(stream);
    }
    if (useAppLogger && req.app) {
      const appLogger = req.app.getLogger();
      return (msg: string) => appLogger.info(msg.trimEnd());
    }
    return (msg: string) => console.log(msg.trimEnd());
  };

  const tokens = createTokens();

  let formatFn: FormatFn;

  if (typeof format === "function") {
    formatFn = format;
  } else {
    const formatStr: string = format ? (FORMATS[format] ?? format) : FORMATS.dev!;
    formatFn = compileFormat(formatStr, tokens);
  }

  return (req, res, next) => {
    // Prevent double-wrapping if logger middleware is applied multiple times
    if ((res as any)[LOGGER_APPLIED]) {
      next();
      return;
    }
    (res as any)[LOGGER_APPLIED] = true;

    const startTime = performance.now();

    // For immediate logging (on request)
    if (immediate) {
      const meta: RequestMeta = {
        startTime,
        responseTime: 0,
        contentLength: null,
      };
      const line = formatFn(tokens, req, res, meta);
      const write = getWriter(req);
      write(line + "\n");
      next();
      return;
    }

    // Store original methods to intercept response
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalText = res.text.bind(res);
    const originalHtml = res.html.bind(res);
    const originalRedirect = res.redirect.bind(res);
    const originalSendStatus = res.sendStatus.bind(res);

    let logged = false;

    const logRequest = () => {
      if (logged) return;
      logged = true;

      if (skip && skip(req, res)) return;

      const endTime = performance.now();
      const meta: RequestMeta = {
        startTime,
        responseTime: endTime - startTime,
        contentLength: parseInt(res.get("content-length") || "0", 10) || null,
      };

      let line = formatFn(tokens, req, res, meta);

      // Add color for dev format in TTY
      if (
        process.stdout.isTTY &&
        (format === "dev" || format === undefined)
      ) {
        const color = getStatusColor(res.statusCode);
        const reset = "\x1b[0m";
        line = line.replace(/(\d{3})/, `${color}$1${reset}`);
      }

      const write = getWriter(req);
      write(line + "\n");
    };

    // Wrap response methods
    res.json = (data: unknown) => {
      originalJson(data);
      logRequest();
    };

    res.send = (body: string | ArrayBuffer | Uint8Array | Blob | null) => {
      originalSend(body);
      logRequest();
    };

    res.text = (data: string) => {
      originalText(data);
      logRequest();
    };

    res.html = (data: string) => {
      originalHtml(data);
      logRequest();
    };

    res.redirect = (urlOrStatus: string | number, url?: string) => {
      originalRedirect(urlOrStatus as string, url);
      logRequest();
    };

    res.sendStatus = (code: number) => {
      originalSendStatus(code);
      logRequest();
    };

    next();
  };
}
