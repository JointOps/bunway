export interface HttpErrorOptions {
  cause?: unknown;
  headers?: Record<string, string>;
  body?: unknown;
}

export class HttpError extends Error {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body?: unknown;

  constructor(status: number, message?: string, options: HttpErrorOptions = {}) {
    super(message ?? `HTTP ${status}`, options.cause ? { cause: options.cause } : undefined);
    this.name = "HttpError";
    this.status = status;
    this.headers = options.headers ? { ...options.headers } : {};
    this.body = options.body ?? (message ? { error: message } : undefined);
  }
}

export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}
