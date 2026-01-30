const DEFAULT_BODY_LIMIT = 1024 * 1024;

/**
 * Parse an IPv4 address into a 32-bit integer.
 * @returns The integer representation, or null if invalid
 */
function parseIPv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return null;
    result = (result << 8) | num;
  }
  return result >>> 0; // Convert to unsigned 32-bit
}

/**
 * Check if an IPv4 address is within a CIDR range.
 * @param ip - The IP address to check
 * @param cidr - The CIDR notation (e.g., "192.168.1.0/24")
 * @returns true if IP is within the range
 */
function isIPv4InCIDR(ip: string, cidr: string): boolean {
  const [subnet, bitsStr] = cidr.split("/");
  if (!subnet || !bitsStr) return false;

  const bits = parseInt(bitsStr, 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return false;

  const ipNum = parseIPv4(ip);
  const subnetNum = parseIPv4(subnet);
  if (ipNum === null || subnetNum === null) return false;

  // Create mask: e.g., /24 = 0xFFFFFF00
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;

  return (ipNum & mask) === (subnetNum & mask);
}

export type TrustProxyValue = boolean | number | string | string[] | ((ip: string, i: number) => boolean);

export interface BunWayLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
}

export interface RequestAppContext {
  get(setting: string): unknown;
  getLogger(): BunWayLogger;
}

export class BunRequest {
  private _original: Request;
  private _url: URL | null = null; // Lazy - only parsed when needed
  private _pathname: string; // Pre-computed or extracted
  private _params: Record<string, string> = {};
  private _body: unknown = undefined;
  private _rawBody: Uint8Array | null = null;
  private _bodyParsed = false;
  private _cookies: Record<string, string> | null = null;
  private _signedCookies: Record<string, string> = {};
  private _app?: RequestAppContext;
  private _socketIp: string | null = null;

  locals: Record<string, unknown> = {};

  /**
   * Create a new BunRequest.
   * @param original - The original Request object
   * @param pathname - Optional pre-computed pathname (avoids URL parsing)
   */
  constructor(original: Request, pathname?: string) {
    this._original = original;
    // Use pre-computed pathname if provided, otherwise extract lazily
    this._pathname = pathname ?? this.extractPathname(original.url);
  }

  /**
   * Fast pathname extraction without full URL parsing
   */
  private extractPathname(url: string): string {
    const protocolEnd = url.indexOf("://");
    let pathStart: number;

    if (protocolEnd !== -1) {
      pathStart = url.indexOf("/", protocolEnd + 3);
      if (pathStart === -1) return "/";
    } else {
      pathStart = url.indexOf("/");
      if (pathStart === -1) return "/";
    }

    let pathEnd = url.length;
    const queryIndex = url.indexOf("?", pathStart);
    if (queryIndex !== -1) pathEnd = queryIndex;
    const hashIndex = url.indexOf("#", pathStart);
    if (hashIndex !== -1 && hashIndex < pathEnd) pathEnd = hashIndex;

    return url.slice(pathStart, pathEnd) || "/";
  }

  /**
   * Get the parsed URL object (lazy initialization)
   */
  private get parsedUrl(): URL {
    if (this._url === null) {
      this._url = new URL(this._original.url);
    }
    return this._url;
  }

  /**
   * Set the direct socket IP address (from Bun.serve's server.requestIP).
   * This should be called by the server when creating the request.
   */
  setSocketIp(ip: string | null): void {
    this._socketIp = ip;
  }

  setApp(app: RequestAppContext): void {
    this._app = app;
  }

  get app(): RequestAppContext | undefined {
    return this._app;
  }

  private getTrustProxy(): TrustProxyValue {
    return (this._app?.get("trust proxy") as TrustProxyValue) ?? false;
  }

  private shouldTrustProxy(ip: string, hopIndex: number): boolean {
    const trust = this.getTrustProxy();

    if (trust === false) return false;
    if (trust === true) return true;

    if (typeof trust === "number") {
      return hopIndex < trust;
    }

    if (typeof trust === "string") {
      return this.matchesProxyIp(ip, [trust]);
    }

    if (Array.isArray(trust)) {
      return this.matchesProxyIp(ip, trust);
    }

    if (typeof trust === "function") {
      return trust(ip, hopIndex);
    }

    return false;
  }

  private matchesProxyIp(ip: string, trusted: string[]): boolean {
    for (const pattern of trusted) {
      if (pattern === "loopback" && (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127."))) {
        return true;
      }
      if (pattern === "linklocal" && (ip.startsWith("169.254.") || ip.startsWith("fe80:"))) {
        return true;
      }
      if (pattern === "uniquelocal" && (ip.startsWith("10.") || ip.startsWith("172.16.") || ip.startsWith("192.168.") || ip.startsWith("fc") || ip.startsWith("fd"))) {
        return true;
      }
      if (pattern === ip) {
        return true;
      }
      // Proper CIDR matching for IPv4
      if (pattern.includes("/") && isIPv4InCIDR(ip, pattern)) {
        return true;
      }
    }
    return false;
  }

  get method(): string {
    return this._original.method;
  }

  get url(): string {
    return this._original.url;
  }

  get path(): string {
    return this._pathname;
  }

  get pathname(): string {
    return this._pathname;
  }

  get originalUrl(): string {
    const search = this.parsedUrl.search;
    return this._pathname + search;
  }

  get query(): URLSearchParams {
    return this.parsedUrl.searchParams;
  }

  get headers(): Headers {
    return this._original.headers;
  }

  get params(): Record<string, string> {
    return this._params;
  }

  set params(value: Record<string, string>) {
    this._params = value;
  }

  get body(): unknown {
    return this._body;
  }

  set body(value: unknown) {
    this._body = value;
    this._bodyParsed = true;
  }

  get hostname(): string {
    return this.parsedUrl.hostname;
  }

  get subdomains(): string[] {
    const hostname = this.parsedUrl.hostname;
    // Skip IP addresses
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname === "localhost") {
      return [];
    }
    const parts = hostname.split(".");
    // Remove TLD and domain (last 2 parts typically)
    // e.g., "foo.bar.example.com" -> ["bar", "foo"]
    if (parts.length <= 2) return [];
    return parts.slice(0, -2).reverse();
  }

  private _baseUrl = "";
  get baseUrl(): string {
    return this._baseUrl;
  }

  set baseUrl(value: string) {
    this._baseUrl = value;
  }

  private _route: { path: string; method: string } | null = null;
  get route(): { path: string; method: string } | null {
    return this._route;
  }

  set route(value: { path: string; method: string } | null) {
    this._route = value;
  }

  get protocol(): string {
    return this.parsedUrl.protocol.replace(":", "");
  }

  get secure(): boolean {
    return this.parsedUrl.protocol === "https:";
  }

  get ip(): string {
    const trust = this.getTrustProxy();
    // Use socket IP as the default fallback (set by server via setSocketIp)
    const fallbackIp = this._socketIp || "127.0.0.1";

    // If trust proxy is disabled, return the direct socket IP
    if (trust === false) {
      return fallbackIp;
    }

    const forwarded = this.get("x-forwarded-for");
    if (!forwarded) {
      return fallbackIp;
    }

    const ips = forwarded.split(",").map((ip) => ip.trim());

    // Find the first untrusted IP (working backwards)
    for (let i = ips.length - 1; i >= 0; i--) {
      const ip = ips[i];
      if (ip && !this.shouldTrustProxy(ip, ips.length - 1 - i)) {
        return ip;
      }
    }

    // If all are trusted, return the leftmost (client)
    return ips[0] || fallbackIp;
  }

  get ips(): string[] {
    const trust = this.getTrustProxy();

    // If trust proxy is disabled, return empty array
    if (trust === false) {
      return [];
    }

    const forwarded = this.get("x-forwarded-for");
    if (!forwarded) return [];

    const allIps = forwarded.split(",").map((ip) => ip.trim());

    // Filter to only trusted IPs
    const trustedIps: string[] = [];
    for (let i = 0; i < allIps.length; i++) {
      const ip = allIps[i];
      if (ip && this.shouldTrustProxy(ip, allIps.length - 1 - i)) {
        trustedIps.push(ip);
      }
    }

    return trustedIps.length > 0 ? allIps : [];
  }

  get xhr(): boolean {
    const requested = this.get("x-requested-with");
    return requested?.toLowerCase() === "xmlhttprequest";
  }

  get original(): Request {
    return this._original;
  }

  get cookies(): Record<string, string> {
    if (this._cookies === null) {
      this._cookies = this.parseCookies();
    }
    return this._cookies;
  }

  set cookies(value: Record<string, string>) {
    this._cookies = value;
  }

  get signedCookies(): Record<string, string> {
    return this._signedCookies;
  }

  set signedCookies(value: Record<string, string>) {
    this._signedCookies = value;
  }

  private parseCookies(): Record<string, string> {
    const cookieHeader = this.get("cookie");
    if (!cookieHeader) return {};

    const cookies: Record<string, string> = {};
    const pairs = cookieHeader.split(";");

    for (const pair of pairs) {
      const idx = pair.indexOf("=");
      if (idx === -1) continue;

      const key = pair.slice(0, idx).trim();
      let value = pair.slice(idx + 1).trim();

      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
    }

    return cookies;
  }

  param(name: string): string | undefined {
    return this._params[name] ?? this.parsedUrl.searchParams.get(name) ?? undefined;
  }

  get(header: string): string | undefined {
    return this._original.headers.get(header) ?? undefined;
  }

  header(name: string): string | undefined {
    return this.get(name);
  }

  is(...types: string[]): string | false {
    const contentType = this.get("content-type");
    if (!contentType) return false;
    for (const type of types) {
      if (contentType.includes(type)) return type;
    }
    return false;
  }

  accepts(...types: string[]): string | false {
    const accept = this.get("accept");
    if (!accept) return types[0] || false;
    for (const type of types) {
      if (accept.includes(type) || accept.includes("*/*")) return type;
    }
    return false;
  }

  acceptsCharsets(...charsets: string[]): string | false {
    const acceptCharset = this.get("accept-charset");
    if (!acceptCharset) return charsets[0] || false;
    for (const charset of charsets) {
      if (acceptCharset.toLowerCase().includes(charset.toLowerCase()) || acceptCharset.includes("*")) {
        return charset;
      }
    }
    return false;
  }

  acceptsEncodings(...encodings: string[]): string | false {
    const acceptEncoding = this.get("accept-encoding");
    if (!acceptEncoding) return encodings[0] || false;
    for (const encoding of encodings) {
      if (acceptEncoding.toLowerCase().includes(encoding.toLowerCase()) || acceptEncoding.includes("*")) {
        return encoding;
      }
    }
    return false;
  }

  acceptsLanguages(...languages: string[]): string | false {
    const acceptLanguage = this.get("accept-language");
    if (!acceptLanguage) return languages[0] || false;
    for (const lang of languages) {
      const normalized = lang.toLowerCase();
      if (acceptLanguage.toLowerCase().includes(normalized) || acceptLanguage.includes("*")) {
        return lang;
      }
    }
    return false;
  }

  isBodyParsed(): boolean {
    return this._bodyParsed;
  }

  async rawBody(): Promise<Uint8Array> {
    if (this._rawBody) return this._rawBody;
    const buf = await this._original.arrayBuffer();
    this._rawBody = new Uint8Array(buf);
    return this._rawBody;
  }

  async rawText(): Promise<string> {
    const raw = await this.rawBody();
    return new TextDecoder().decode(raw);
  }

  async parseJson(limit = DEFAULT_BODY_LIMIT): Promise<unknown> {
    if (this._bodyParsed) return this._body;
    const raw = await this.rawBody();
    if (raw.byteLength > limit) {
      throw Object.assign(new Error("Payload Too Large"), { status: 413 });
    }
    const text = new TextDecoder().decode(raw);
    if (!text) {
      this._body = {};
      this._bodyParsed = true;
      return this._body;
    }
    try {
      this._body = JSON.parse(text);
    } catch (err) {
      // Improve JSON parse error messages
      if (err instanceof SyntaxError) {
        // Try to extract position from error message
        const posMatch = err.message.match(/position (\d+)/i);
        const pos = posMatch && posMatch[1] ? parseInt(posMatch[1], 10) : null;

        let message = "Invalid JSON: " + err.message;

        // Add context around the error position
        if (pos !== null && pos < text.length) {
          const start = Math.max(0, pos - 20);
          const end = Math.min(text.length, pos + 20);
          const context = text.slice(start, end);
          const pointer = " ".repeat(Math.min(20, pos - start)) + "^";
          message += `\n  Near: "${context}"\n        ${pointer}`;
        }

        throw Object.assign(new Error(message), { status: 400, type: "JsonParseError" });
      }
      throw err;
    }
    this._bodyParsed = true;
    return this._body;
  }

  async parseUrlencoded(limit = DEFAULT_BODY_LIMIT): Promise<Record<string, string>> {
    if (this._bodyParsed) return this._body as Record<string, string>;
    const raw = await this.rawBody();
    if (raw.byteLength > limit) {
      throw Object.assign(new Error("Payload Too Large"), { status: 413 });
    }
    const text = new TextDecoder().decode(raw);
    const params = new URLSearchParams(text);
    this._body = Object.fromEntries(params.entries());
    this._bodyParsed = true;
    return this._body as Record<string, string>;
  }

  async parseText(limit = DEFAULT_BODY_LIMIT): Promise<string> {
    if (this._bodyParsed) return this._body as string;
    const raw = await this.rawBody();
    if (raw.byteLength > limit) {
      throw Object.assign(new Error("Payload Too Large"), { status: 413 });
    }
    this._body = new TextDecoder().decode(raw);
    this._bodyParsed = true;
    return this._body as string;
  }
}
