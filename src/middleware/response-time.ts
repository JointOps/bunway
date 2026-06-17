import type { Handler } from "../types";

export interface ResponseTimeOptions {
  header?: string;
  digits?: number;
  suffix?: boolean;
}

export function responseTime(options: ResponseTimeOptions = {}): Handler {
  const header = options.header ?? "X-Response-Time";
  const digits = options.digits ?? 3;
  const suffix = options.suffix !== false;

  if (digits < 0) {
    throw new RangeError(`responseTime: digits must be >= 0, got ${digits}`);
  }

  return (_req, res, next) => {
    const start = performance.now();
    const originalToResponse = res.toResponse.bind(res);

    res.toResponse = () => {
      const elapsed = performance.now() - start;
      const value = suffix ? `${elapsed.toFixed(digits)}ms` : elapsed.toFixed(digits);
      res.set(header, value);
      return originalToResponse();
    };

    next();
  };
}
