import type { Handler } from "../types";
import { generateToken, timingSafeCompare } from "../utils/crypto";

export interface CsrfOptions {
  cookie?: {
    name?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "strict" | "lax" | "none";
  };
  ignoreMethods?: string[];
  headerName?: string;
  bodyField?: string;
  tokenLength?: number;
}

export function csrf(options: CsrfOptions = {}): Handler {
  const {
    cookie = {},
    ignoreMethods = ["GET", "HEAD", "OPTIONS"],
    headerName = "x-csrf-token",
    bodyField = "_csrf",
    tokenLength = 32,
  } = options;

  const cookieName = cookie.name || "_csrf";
  const cookiePath = cookie.path || "/";
  const cookieSecure = cookie.secure ?? true;
  const cookieHttpOnly = cookie.httpOnly ?? true;
  const cookieSameSite = cookie.sameSite || "strict";

  return (req, res, next) => {
    let token = req.cookies[cookieName];

    if (!token) {
      token = generateToken(tokenLength);
      res.cookie(cookieName, token, {
        path: cookiePath,
        secure: cookieSecure,
        httpOnly: cookieHttpOnly,
        sameSite: cookieSameSite,
      });
    }

    (req as any).csrfToken = () => token;

    if (ignoreMethods.includes(req.method.toUpperCase())) {
      next();
      return;
    }

    const headerToken = req.get(headerName);
    const bodyToken =
      req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>)[bodyField] : undefined;

    const submittedToken = headerToken || bodyToken;

    // Use timing-safe comparison to prevent timing attacks
    if (!submittedToken || typeof submittedToken !== "string" || !timingSafeCompare(submittedToken, token)) {
      res.status(403).json({ error: "Invalid CSRF token" });
      return;
    }

    next();
  };
}
