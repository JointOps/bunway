const DEFAULT_BODY_LIMIT = 1024 * 1024;

export class BunRequest {
  private _original: Request;
  private _url: URL;
  private _params: Record<string, string> = {};
  private _body: unknown = undefined;
  private _rawBody: Uint8Array | null = null;
  private _bodyParsed = false;
  private _cookies: Record<string, string> | null = null;
  private _signedCookies: Record<string, string> = {};

  locals: Record<string, unknown> = {};

  constructor(original: Request) {
    this._original = original;
    this._url = new URL(original.url);
  }

  get method(): string {
    return this._original.method;
  }

  get url(): string {
    return this._original.url;
  }

  get path(): string {
    return this._url.pathname;
  }

  get pathname(): string {
    return this._url.pathname;
  }

  get originalUrl(): string {
    const search = this._url.search;
    return this._url.pathname + search;
  }

  get query(): URLSearchParams {
    return this._url.searchParams;
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
    return this._url.hostname;
  }

  get protocol(): string {
    return this._url.protocol.replace(":", "");
  }

  get secure(): boolean {
    return this._url.protocol === "https:";
  }

  get ip(): string {
    return this.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  }

  get ips(): string[] {
    const forwarded = this.get("x-forwarded-for");
    if (!forwarded) return [];
    return forwarded.split(",").map((ip) => ip.trim());
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
    return this._params[name] ?? this._url.searchParams.get(name) ?? undefined;
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
    this._body = JSON.parse(text);
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
