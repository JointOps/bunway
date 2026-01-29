import type { Handler } from "../types";

export interface HelmetOptions {
  contentSecurityPolicy?: boolean | ContentSecurityPolicyOptions;
  crossOriginEmbedderPolicy?: boolean | { policy?: string };
  crossOriginOpenerPolicy?: boolean | { policy?: string };
  crossOriginResourcePolicy?: boolean | { policy?: string };
  dnsPrefetchControl?: boolean | { allow?: boolean };
  frameguard?: boolean | { action?: "deny" | "sameorigin" };
  hidePoweredBy?: boolean;
  hsts?: boolean | HstsOptions;
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean | { permittedPolicies?: string };
  referrerPolicy?: boolean | { policy?: string | string[] };
  xssFilter?: boolean;
}

interface ContentSecurityPolicyOptions {
  directives?: Record<string, string | string[]>;
  reportOnly?: boolean;
}

interface HstsOptions {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

const DEFAULT_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "font-src": ["'self'", "https:", "data:"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'self'"],
  "img-src": ["'self'", "data:"],
  "object-src": ["'none'"],
  "script-src": ["'self'"],
  "script-src-attr": ["'none'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "upgrade-insecure-requests": [],
};

function formatDirectives(directives: Record<string, string | string[]>): string {
  return Object.entries(directives)
    .map(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      return values.length > 0 ? `${key} ${values.join(" ")}` : key;
    })
    .join("; ");
}

export function helmet(options: HelmetOptions = {}): Handler {
  const {
    contentSecurityPolicy = true,
    crossOriginEmbedderPolicy = true,
    crossOriginOpenerPolicy = true,
    crossOriginResourcePolicy = true,
    dnsPrefetchControl = true,
    frameguard = true,
    hidePoweredBy = true,
    hsts = true,
    ieNoOpen = true,
    noSniff = true,
    originAgentCluster = true,
    permittedCrossDomainPolicies = true,
    referrerPolicy = true,
    xssFilter = true,
  } = options;

  return (req, res, next) => {
    if (contentSecurityPolicy !== false) {
      const cspOptions =
        typeof contentSecurityPolicy === "object" ? contentSecurityPolicy : {};
      const directives = cspOptions.directives || DEFAULT_DIRECTIVES;
      const headerName = cspOptions.reportOnly
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy";
      res.set(headerName, formatDirectives(directives));
    }

    if (crossOriginEmbedderPolicy !== false) {
      const policy =
        typeof crossOriginEmbedderPolicy === "object"
          ? crossOriginEmbedderPolicy.policy || "require-corp"
          : "require-corp";
      res.set("Cross-Origin-Embedder-Policy", policy);
    }

    if (crossOriginOpenerPolicy !== false) {
      const policy =
        typeof crossOriginOpenerPolicy === "object"
          ? crossOriginOpenerPolicy.policy || "same-origin"
          : "same-origin";
      res.set("Cross-Origin-Opener-Policy", policy);
    }

    if (crossOriginResourcePolicy !== false) {
      const policy =
        typeof crossOriginResourcePolicy === "object"
          ? crossOriginResourcePolicy.policy || "same-origin"
          : "same-origin";
      res.set("Cross-Origin-Resource-Policy", policy);
    }

    if (dnsPrefetchControl !== false) {
      const allow =
        typeof dnsPrefetchControl === "object" ? dnsPrefetchControl.allow : false;
      res.set("X-DNS-Prefetch-Control", allow ? "on" : "off");
    }

    if (frameguard !== false) {
      const action =
        typeof frameguard === "object" ? frameguard.action || "sameorigin" : "sameorigin";
      res.set("X-Frame-Options", action.toUpperCase());
    }

    if (hidePoweredBy !== false) {
      res.set("X-Powered-By", "");
    }

    if (hsts !== false) {
      const hstsOptions = typeof hsts === "object" ? hsts : {};
      const maxAge = hstsOptions.maxAge ?? 15552000;
      let value = `max-age=${maxAge}`;
      if (hstsOptions.includeSubDomains !== false) {
        value += "; includeSubDomains";
      }
      if (hstsOptions.preload) {
        value += "; preload";
      }
      res.set("Strict-Transport-Security", value);
    }

    if (ieNoOpen !== false) {
      res.set("X-Download-Options", "noopen");
    }

    if (noSniff !== false) {
      res.set("X-Content-Type-Options", "nosniff");
    }

    if (originAgentCluster !== false) {
      res.set("Origin-Agent-Cluster", "?1");
    }

    if (permittedCrossDomainPolicies !== false) {
      const policy =
        typeof permittedCrossDomainPolicies === "object"
          ? permittedCrossDomainPolicies.permittedPolicies || "none"
          : "none";
      res.set("X-Permitted-Cross-Domain-Policies", policy);
    }

    if (referrerPolicy !== false) {
      const policy =
        typeof referrerPolicy === "object"
          ? Array.isArray(referrerPolicy.policy)
            ? referrerPolicy.policy.join(", ")
            : referrerPolicy.policy || "no-referrer"
          : "no-referrer";
      res.set("Referrer-Policy", policy);
    }

    if (xssFilter !== false) {
      res.set("X-XSS-Protection", "0");
    }

    next();
  };
}
