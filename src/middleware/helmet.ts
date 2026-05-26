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
  // ── Build header map ONCE at registration time ─────────────────────
  const headers = new Map<string, string>();

  if (options.contentSecurityPolicy !== false) {
    const cspOptions = typeof options.contentSecurityPolicy === "object"
      ? options.contentSecurityPolicy : {};
    const directives = cspOptions.directives || DEFAULT_DIRECTIVES;
    const headerName = cspOptions.reportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";
    headers.set(headerName, formatDirectives(directives));
  }

  if (options.crossOriginEmbedderPolicy !== false) {
    const policy = typeof options.crossOriginEmbedderPolicy === "object"
      ? options.crossOriginEmbedderPolicy.policy || "require-corp"
      : "require-corp";
    headers.set("Cross-Origin-Embedder-Policy", policy);
  }

  if (options.crossOriginOpenerPolicy !== false) {
    const policy = typeof options.crossOriginOpenerPolicy === "object"
      ? options.crossOriginOpenerPolicy.policy || "same-origin"
      : "same-origin";
    headers.set("Cross-Origin-Opener-Policy", policy);
  }

  if (options.crossOriginResourcePolicy !== false) {
    const policy = typeof options.crossOriginResourcePolicy === "object"
      ? options.crossOriginResourcePolicy.policy || "same-origin"
      : "same-origin";
    headers.set("Cross-Origin-Resource-Policy", policy);
  }

  if (options.dnsPrefetchControl !== false) {
    const allow = typeof options.dnsPrefetchControl === "object"
      ? options.dnsPrefetchControl.allow
      : false;
    headers.set("X-DNS-Prefetch-Control", allow ? "on" : "off");
  }

  if (options.frameguard !== false) {
    const action = typeof options.frameguard === "object"
      ? options.frameguard.action || "sameorigin"
      : "sameorigin";
    headers.set("X-Frame-Options", action.toUpperCase());
  }

  if (options.hidePoweredBy !== false) {
    headers.set("X-Powered-By", "");
  }

  if (options.hsts !== false) {
    const hstsOptions = typeof options.hsts === "object" ? options.hsts : {};
    const maxAge = hstsOptions.maxAge ?? 15552000;
    let value = `max-age=${maxAge}`;
    if (hstsOptions.includeSubDomains !== false) value += "; includeSubDomains";
    if (hstsOptions.preload) value += "; preload";
    headers.set("Strict-Transport-Security", value);
  }

  if (options.ieNoOpen !== false) {
    headers.set("X-Download-Options", "noopen");
  }

  if (options.noSniff !== false) {
    headers.set("X-Content-Type-Options", "nosniff");
  }

  if (options.originAgentCluster !== false) {
    headers.set("Origin-Agent-Cluster", "?1");
  }

  if (options.permittedCrossDomainPolicies !== false) {
    const policy = typeof options.permittedCrossDomainPolicies === "object"
      ? options.permittedCrossDomainPolicies.permittedPolicies || "none"
      : "none";
    headers.set("X-Permitted-Cross-Domain-Policies", policy);
  }

  if (options.referrerPolicy !== false) {
    const policy = typeof options.referrerPolicy === "object"
      ? Array.isArray(options.referrerPolicy.policy)
        ? options.referrerPolicy.policy.join(", ")
        : options.referrerPolicy.policy || "no-referrer"
      : "no-referrer";
    headers.set("Referrer-Policy", policy);
  }

  if (options.xssFilter !== false) {
    headers.set("X-XSS-Protection", "0");
  }

  // ── Pre-bake as an array of [name, value] pairs for fastest iteration ──
  const headerEntries = [...headers.entries()];
  const headerCount = headerEntries.length;

  // ── Per-request handler: just apply the pre-built headers ──────────
  return (_req, res, next) => {
    for (let i = 0; i < headerCount; i++) {
      const entry = headerEntries[i]!;
      res.set(entry[0], entry[1]);
    }
    next();
  };
}
