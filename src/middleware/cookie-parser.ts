import type { Handler } from "../types";
import { sign, unsign } from "../utils/crypto";

export interface CookieParserOptions {
  secret?: string | string[];
  decode?: (value: string) => string;
}

function jsonCookie(str: string): unknown | undefined {
  if (typeof str !== "string" || !str.startsWith("j:")) return undefined;
  try {
    return JSON.parse(str.slice(2));
  } catch {
    return undefined;
  }
}

export function cookieParser(secretOrOptions?: string | string[] | CookieParserOptions): Handler {
  let secrets: string[];
  let decode: ((v: string) => string) | undefined;

  if (typeof secretOrOptions === "string") {
    secrets = [secretOrOptions];
  } else if (Array.isArray(secretOrOptions)) {
    secrets = secretOrOptions;
  } else {
    const secret = secretOrOptions?.secret;
    secrets = secret ? (Array.isArray(secret) ? secret : [secret]) : [];
    decode = secretOrOptions?.decode;
  }

  return (req, _res, next) => {
    // Idempotency: if already run (e.g. mounted twice), skip
    if ((req as any)._cookiesParsed) {
      next();
      return;
    }
    (req as any)._cookiesParsed = true;

    if (decode) {
      const raw = req.get("cookie") ?? "";
      const reDecoded: Record<string, string> = {};
      for (const pair of raw.split(";")) {
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        const key = pair.slice(0, idx).trim();
        let val = pair.slice(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        try { reDecoded[key] = decode(val); } catch { reDecoded[key] = val; }
      }
      req.cookies = reDecoded;
    }
    // Always parse j: prefix JSON cookies — does not require a secret
    for (const [k, v] of Object.entries(req.cookies)) {
      if (typeof v === "string") {
        const parsed = jsonCookie(v);
        if (parsed !== undefined) (req.cookies as Record<string, unknown>)[k] = parsed;
      }
    }

    if (secrets.length === 0) {
      next();
      return;
    }

    req.secret = secrets[0]!;  // non-null: guarded by length check above

    const signedCookies: Record<string, string | false> = {};
    let modified = false;

    for (const [name, value] of Object.entries(req.cookies)) {
      if (typeof value === "string" && value.startsWith("s:")) {
        const unsigned = unsign(value.slice(2), secrets);
        signedCookies[name] = unsigned;  // string if valid, false if tampered
        modified = true;                 // always remove from req.cookies
      }
    }

    if (modified) {
      const cookies = { ...req.cookies };
      for (const name of Object.keys(signedCookies)) {
        delete cookies[name];
      }
      req.cookies = cookies;
    }

    req.signedCookies = signedCookies;

    // Parse j: prefix in verified signed cookies (false entries are skipped)
    for (const [k, v] of Object.entries(req.signedCookies)) {
      if (typeof v === "string") {
        const parsed = jsonCookie(v);
        if (parsed !== undefined) (req.signedCookies as Record<string, unknown>)[k] = parsed;
      }
    }
    next();
  };
}

export { sign as signCookie, unsign as unsignCookie };
