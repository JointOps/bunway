import type { Handler } from "../types";
import { sign, unsign } from "../utils/crypto";

export interface CookieParserOptions {
  secret?: string | string[];
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
