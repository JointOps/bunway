import type { CookieOptions, Handler } from "../types";
import { sign, unsign, generateToken, timingSafeCompare } from "../utils/crypto";
import { HttpError } from "../core/errors";

export interface CsrfOptions {
  secret: string;
  cookie?: {
    name?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "strict" | "lax" | "none";
    maxAge?: number;
  };
  ignoreMethods?: string[];
  headerName?: string;
  bodyField?: string;
  tokenLength?: number;
}

export function csrf(options: CsrfOptions): Handler {
  if (!options?.secret) throw new Error("csrf(): `secret` is required");

  const {
    secret,
    cookie = {},
    ignoreMethods = ["GET", "HEAD", "OPTIONS"],
    headerName = "x-csrf-token",
    bodyField = "_csrf",
    tokenLength = 32,
  } = options;

  const cookieName = cookie.name ?? "_csrf";
  const cookiePath = cookie.path ?? "/";
  const cookieSecure = cookie.secure ?? true;
  const cookieHttpOnly = cookie.httpOnly ?? false;
  const cookieSameSite = cookie.sameSite ?? "strict";
  const cookieMaxAge = cookie.maxAge;

  return (req, res, next) => {
    let rawToken = req.cookies[cookieName] as string | undefined;

    if (!rawToken || typeof rawToken !== "string") {
      rawToken = generateToken(tokenLength);
      const cookieOpts: CookieOptions = {
        path: cookiePath,
        secure: cookieSecure,
        httpOnly: cookieHttpOnly,
        sameSite: cookieSameSite,
      };
      if (cookieMaxAge !== undefined) cookieOpts.maxAge = cookieMaxAge;
      res.cookie(cookieName, rawToken, cookieOpts);
    }

    const capturedRaw = rawToken;

    (req as unknown as Record<string, unknown>).csrfToken = () => sign(capturedRaw, secret);

    if (ignoreMethods.includes(req.method.toUpperCase())) {
      next();
      return;
    }

    const headerToken = req.get(headerName) ?? undefined;
    const bodyToken =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)[bodyField]
        : undefined;

    const submitted =
      headerToken ?? (typeof bodyToken === "string" ? bodyToken : undefined);

    if (!submitted) {
      next(new HttpError(403, "CSRF token missing"));
      return;
    }

    const extracted = unsign(submitted, [secret]);
    if (extracted === false || !timingSafeCompare(extracted, capturedRaw)) {
      next(new HttpError(403, "Invalid CSRF token"));
      return;
    }

    next();
  };
}
