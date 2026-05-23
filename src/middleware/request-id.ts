import type { Handler } from "../types";

export interface RequestIdOptions {
  header?: string;
  generator?: () => string;
  setHeader?: boolean;
}

export function requestId(options: RequestIdOptions = {}): Handler {
  const header = options.header ?? "X-Request-Id";
  const generator = options.generator ?? (() => crypto.randomUUID());
  const setHeader = options.setHeader !== false;

  return (req, res, next) => {
    const id = req.get(header) ?? generator();
    Object.defineProperty(req, "id", {
      configurable: true,
      enumerable: true,
      value: id,
      writable: true,
    });
    if (setHeader) res.set(header, id);
    next();
  };
}
