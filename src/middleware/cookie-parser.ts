import type { Handler } from "../types";
import { createHmac, timingSafeEqual } from "crypto";

export interface CookieParserOptions {
  secret?: string | string[];
}

function sign(value: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${signature}`;
}

function unsign(signedValue: string, secrets: string[]): string | false {
  const idx = signedValue.lastIndexOf(".");
  if (idx === -1) return false;

  const value = signedValue.slice(0, idx);
  const signature = signedValue.slice(idx + 1);

  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(value).digest("base64url");
    try {
      if (timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return value;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export function cookieParser(options: CookieParserOptions = {}): Handler {
  const secrets = options.secret
    ? Array.isArray(options.secret)
      ? options.secret
      : [options.secret]
    : [];

  return (req, res, next) => {
    if (secrets.length > 0) {
      const signedCookies: Record<string, string> = {};
      const cookies = { ...req.cookies };

      for (const [name, value] of Object.entries(cookies)) {
        if (value.startsWith("s:")) {
          const unsigned = unsign(value.slice(2), secrets);
          if (unsigned !== false) {
            signedCookies[name] = unsigned;
            delete cookies[name];
          }
        }
      }

      req.cookies = cookies;
      req.signedCookies = signedCookies;
    }

    next();
  };
}

export { sign as signCookie, unsign as unsignCookie };
