import type { CookieOptions, SendFileOptions } from "../types";
import type { BunRequest } from "./request";
import { existsSync, statSync } from "fs";
import { join, extname, basename, resolve } from "path";
import { getBaseMimeType, getMimeType } from "../utils/mime";
import { generateBodyETag } from "../utils/crypto";
import { brotliCompressSync } from "zlib";

export interface RenderOptions {
  [key: string]: unknown;
}

type ResponseBody = string | ArrayBuffer | Uint8Array | Blob | null;

export interface AppContext {
  get(setting: string): unknown;
  getEngine(ext: string): ((path: string, options: Record<string, unknown>, callback: (err: Error | null, html?: string) => void) => void) | undefined;
  locals: Record<string, unknown>;
}

export type FormatHandlers = {
  [contentType: string]: (() => void) | undefined;
};

export class BunResponse {
  private _statusCode = 200;
  private _headersMap: Map<string, string> | null = null;
  private _multiHeaders: Map<string, string[]> | null = null;
  private _body: ResponseBody = null;
  private _sent = false;
  private _app?: AppContext;
  private _acceptHeader?: string;
  private _req?: BunRequest;

  // Compression support (internal only — not in public API)
  _compressionEncoding: string | null = null;
  _compressionThreshold = 1024;
  _compressionLevel = 6;
  _compressionFilter: ((contentType: string) => boolean) | null = null;

  // Streaming support
  private _streaming = false;
  private _streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private _streamPromise: Promise<ReadableStream<Uint8Array>> | null = null;
  private _headersFlushed = false;

  locals: Record<string, unknown> = {};

  private headersMap(): Map<string, string> {
    if (this._headersMap === null) this._headersMap = new Map();
    return this._headersMap;
  }

  private multiHeaders(): Map<string, string[]> {
    if (this._multiHeaders === null) this._multiHeaders = new Map();
    return this._multiHeaders;
  }

  private headerKey(name: string): string {
    return name.toLowerCase();
  }

  private hasHeader(name: string): boolean {
    const key = this.headerKey(name);
    return (this._headersMap?.has(key) ?? false) || (this._multiHeaders?.has(key) ?? false);
  }

  private toHeaders(): Headers | undefined {
    if (!this._headersMap && !this._multiHeaders) return undefined;

    const headers = new Headers();
    if (this._headersMap) {
      for (const [name, value] of this._headersMap) {
        headers.set(name, value);
      }
    }
    if (this._multiHeaders) {
      for (const [name, values] of this._multiHeaders) {
        for (const value of values) {
          headers.append(name, value);
        }
      }
    }

    return headers;
  }

  setApp(app: AppContext): void {
    this._app = app;
  }

  setAcceptHeader(accept: string | undefined): void {
    this._acceptHeader = accept;
  }

  setReq(req: BunRequest): void {
    this._req = req;
  }

  get req(): BunRequest | undefined {
    return this._req;
  }

  get app(): AppContext | undefined {
    return this._app;
  }

  get statusCode(): number {
    return this._statusCode;
  }

  get headersSent(): boolean {
    return this._sent || this._headersFlushed;
  }

  status(code: number): this {
    this._statusCode = code;
    return this;
  }

  set(name: string | Record<string, string>, value?: string): this {
    if (typeof name === "object") {
      for (const [k, v] of Object.entries(name)) {
        this.headersMap().set(this.headerKey(k), v);
      }
    } else {
      this.headersMap().set(this.headerKey(name), value!);
    }
    return this;
  }

  header(name: string | Record<string, string>, value?: string): this {
    return this.set(name as string, value!);
  }

  get(name: string): string | undefined {
    const key = this.headerKey(name);
    const multi = this._multiHeaders?.get(key);
    const single = this._headersMap?.get(key);
    if (single !== undefined && multi !== undefined) return [single, ...multi].join(", ");
    if (multi !== undefined) return multi.join(", ");
    return single;
  }

  getHeader(name: string): string | undefined {
    return this.get(name);
  }

  append(name: string, value: string): this {
    const lower = this.headerKey(name);
    const map = this.multiHeaders();
    const existing = map.get(lower);
    if (existing) {
      existing.push(value);
    } else {
      map.set(lower, [value]);
    }
    return this;
  }

  type(mimeType: string): this {
    // Express: shorthand like "json" → look up MIME type, full type "a/b" used as-is
    const resolved = mimeType.includes("/")
      ? mimeType
      : getMimeType("x." + mimeType);
    this.headersMap().set("content-type", resolved);
    return this;
  }

  contentType(type: string): this {
    return this.type(type);
  }

  vary(field: string | string[]): this {
    const fields = Array.isArray(field) ? field : [field];
    const existing = this.get("Vary");

    if (existing) {
      const existingFields = existing.split(",").map((f) => f.trim().toLowerCase());
      const newFields = fields.filter((f) => !existingFields.includes(f.toLowerCase()));
      if (newFields.length > 0) {
        this.headersMap().set("vary", `${existing}, ${newFields.join(", ")}`);
      }
    } else {
      this.headersMap().set("vary", fields.join(", "));
    }

    return this;
  }

  location(url: string): this {
    this.headersMap().set("location", url);
    return this;
  }

  links(links: Record<string, string>): this {
    const linkHeader = Object.entries(links)
      .map(([rel, url]) => `<${url}>; rel="${rel}"`)
      .join(", ");
    this.headersMap().set("link", linkHeader);
    return this;
  }

  attachment(filename?: string): this {
    if (filename) {
      this.headersMap().set("content-disposition", `attachment; filename="${filename}"`);
      // Set Content-Type based on extension (Express behavior)
      const mimeType = getBaseMimeType(filename);
      if (mimeType && mimeType !== "application/octet-stream") {
        this.headersMap().set("content-type", mimeType);
      }
    } else {
      this.headersMap().set("content-disposition", "attachment");
    }
    return this;
  }

  json(data: unknown): this {
    const spaces = this._app?.get("json spaces") as number | undefined;
    this.headersMap().set("content-type", "application/json");
    this._body = spaces ? JSON.stringify(data, null, spaces) : JSON.stringify(data);
    this._sent = true;
    return this;
  }

  jsonp(data: unknown): void {
    const callbackName = (this._app?.get("jsonp callback name") as string) ?? "callback";

    const spaces = this._app?.get("json spaces") as number | undefined;
    const replacer = this._app?.get("json replacer") as ((key: string, value: unknown) => unknown) | undefined;

    let body = replacer || spaces
      ? JSON.stringify(data, replacer, spaces)
      : JSON.stringify(data);

    let callback: string | undefined;
    const rawCallback = this._req?.query.get(callbackName) ?? undefined;
    if (rawCallback !== undefined) {
      callback = rawCallback;
    }

    if (!this.hasHeader("Content-Type")) {
      this.headersMap().set("x-content-type-options", "nosniff");
      this.headersMap().set("content-type", "application/json");
    }

    if (typeof callback === "string" && callback.length !== 0) {
      this.headersMap().set("x-content-type-options", "nosniff");
      this.headersMap().set("content-type", "text/javascript; charset=utf-8");

      callback = callback.replace(/[^\[\]\w$.]/g, "");

      if (callback && body !== undefined) {
        if (typeof body === "string") {
          body = body
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029");
        }

        body = `/**/ typeof ${callback} === 'function' && ${callback}(${body});`;
      } else if (!body) {
        body = "";
      }
    }

    this._body = body ?? "";
    this._sent = true;
  }

  send(body?: unknown): this {
    // Express auto-detection: object → json(), string → text/html, Buffer/Uint8Array → octet-stream
    if (body === undefined || body === null) {
      this._body = "";
      this._sent = true;
      return this;
    }

    if (typeof body === "object" && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer) && !(body instanceof Blob)) {
      // Object/array → delegate to json()
      this.json(body);
      return this;
    }

    if (typeof body === "string") {
      // Only set Content-Type if not already set
      if (!this.hasHeader("Content-Type")) {
        // Express sets text/html for strings
        this.headersMap().set("content-type", "text/html; charset=utf-8");
      }
      this._body = body;
    } else if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
      if (!this.hasHeader("Content-Type")) {
        this.headersMap().set("content-type", "application/octet-stream");
      }
      const len = body instanceof Uint8Array ? body.byteLength : body.byteLength;
      this.headersMap().set("content-length", String(len));
      this._body = body;
    } else {
      this._body = body as ResponseBody;
    }

    this._sent = true;
    return this;
  }

  text(data: string): void {
    this.headersMap().set("content-type", "text/plain");
    this._body = data;
    this._sent = true;
  }

  html(data: string): void {
    this.headersMap().set("content-type", "text/html");
    this._body = data;
    this._sent = true;
  }

  sendStatus(code: number): void {
    const STATUS_TEXTS: Record<number, string> = {
      100: "Continue",
      101: "Switching Protocols",
      200: "OK",
      201: "Created",
      202: "Accepted",
      204: "No Content",
      301: "Moved Permanently",
      302: "Found",
      304: "Not Modified",
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      405: "Method Not Allowed",
      408: "Request Timeout",
      409: "Conflict",
      410: "Gone",
      422: "Unprocessable Entity",
      429: "Too Many Requests",
      500: "Internal Server Error",
      502: "Bad Gateway",
      503: "Service Unavailable",
      504: "Gateway Timeout",
    };
    this._statusCode = code;
    this.headersMap().set("content-type", "text/plain; charset=utf-8");
    this._body = STATUS_TEXTS[code] ?? String(code);
    this._sent = true;
  }

  format(handlers: FormatHandlers): void {
    const accept = this._acceptHeader || "*/*";
    const types = Object.keys(handlers).filter((k) => k !== "default");

    // Map short types to full MIME types
    const typeMap: Record<string, string> = {
      html: "text/html",
      text: "text/plain",
      json: "application/json",
      xml: "application/xml",
    };

    // Find the best matching type
    for (const type of types) {
      const mimeType = typeMap[type] || type;
      if (accept.includes(mimeType) || accept.includes("*/*") || accept.includes(type)) {
        const handler = handlers[type];
        if (handler) {
          this.headersMap().set("content-type", mimeType);
          handler();
          return;
        }
      }
    }

    // Check for specific MIME type matches
    for (const type of types) {
      const mimeType = typeMap[type] || type;
      const acceptParts = accept.split(",").map((p) => p.trim().split(";")[0]);
      for (const acceptType of acceptParts) {
        if (acceptType === mimeType || acceptType === `${mimeType.split("/")[0]}/*`) {
          const handler = handlers[type];
          if (handler) {
            this.headersMap().set("content-type", mimeType);
            handler();
            return;
          }
        }
      }
    }

    // Fall back to default handler
    const defaultHandler = handlers["default"];
    if (defaultHandler) {
      defaultHandler();
      return;
    }

    // No acceptable format found
    this._statusCode = 406;
    this._body = "Not Acceptable";
    this._sent = true;
  }

  redirect(urlOrStatus: string | number, url?: string): void {
    if (typeof urlOrStatus === "number" && url) {
      this._statusCode = urlOrStatus;
      this.headersMap().set("location", url);
    } else if (typeof urlOrStatus === "string") {
      this._statusCode = 302;
      this.headersMap().set("location", urlOrStatus);
    }
    this._body = null;
    this._sent = true;
  }

  cookie(name: string, value: string, options: CookieOptions = {}): this {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options.maxAge !== undefined) {
      cookie += `; Max-Age=${options.maxAge}`;
    }
    if (options.expires) {
      cookie += `; Expires=${options.expires.toUTCString()}`;
    }
    cookie += `; Path=${options.path ?? "/"}`;
    if (options.domain) {
      cookie += `; Domain=${options.domain}`;
    }
    if (options.secure) {
      cookie += "; Secure";
    }
    if (options.httpOnly) {
      cookie += "; HttpOnly";
    }
    if (options.sameSite) {
      const sameSite =
        options.sameSite === true ? "Strict" : options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1);
      cookie += `; SameSite=${sameSite}`;
    }

    this.append("Set-Cookie", cookie);
    return this;
  }

  clearCookie(name: string, options: CookieOptions = {}): this {
    return this.cookie(name, "", {
      ...options,
      expires: new Date(0),
    });
  }

  async sendFile(filePath: string, options?: SendFileOptions): Promise<void>;
  async sendFile(filePath: string, callback: (err?: Error) => void): Promise<void>;
  async sendFile(filePath: string, options: SendFileOptions, callback: (err?: Error) => void): Promise<void>;
  async sendFile(
    filePath: string,
    optionsOrCallback?: SendFileOptions | ((err?: Error) => void),
    maybeCallback?: (err?: Error) => void
  ): Promise<void> {
    let options: SendFileOptions = {};
    let callback: ((err?: Error) => void) | undefined;

    if (typeof optionsOrCallback === "function") {
      callback = optionsOrCallback;
    } else if (optionsOrCallback) {
      options = optionsOrCallback;
      callback = maybeCallback;
    }

    try {
      const root = options.root || process.cwd();
      const fullPath = filePath.startsWith("/") ? filePath : join(root, filePath);

      if (options.dotfiles !== "allow" && basename(fullPath).startsWith(".")) {
        if (options.dotfiles === "deny") {
          this._statusCode = 403;
          this.json({ error: "Forbidden" });
          if (callback) callback();
          return;
        }
        this._statusCode = 404;
        this.json({ error: "Not Found" });
        if (callback) callback();
        return;
      }

      if (!existsSync(fullPath)) {
        throw new Error(`ENOENT: no such file or directory, stat '${fullPath}'`);
      }

      const stat = statSync(fullPath);
      if (!stat.isFile()) {
        throw new Error(`ENOENT: not a file, stat '${fullPath}'`);
      }

      const fileSize = stat.size;
      const mimeType = getBaseMimeType(fullPath);
      this.headersMap().set("content-type", mimeType);

      // Add Accept-Ranges if acceptRanges !== false
      if (options.acceptRanges !== false) {
        this.headersMap().set("accept-ranges", "bytes");
      }

      // Add Last-Modified header if lastModified !== false
      if (options.lastModified !== false) {
        const file = Bun.file(fullPath);
        if (file.lastModified) {
          this.headersMap().set("last-modified", new Date(file.lastModified).toUTCString());
        }
      }

      // Add Cache-Control header if cacheControl !== false
      if (options.cacheControl !== false) {
        const maxAge = options.maxAge !== undefined ? Math.floor(options.maxAge / 1000) : 0;
        let cacheValue = `public, max-age=${maxAge}`;
        if (options.immutable) cacheValue += ", immutable";
        this.headersMap().set("cache-control", cacheValue);
      }

      if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          this.headersMap().set(this.headerKey(key), value);
        }
      }

      // Check for Range header
      const rangeHeader = this._req?.get("range");
      if (rangeHeader && fileSize > 0) {
        const index = rangeHeader.indexOf("=");
        if (index !== -1 && rangeHeader.slice(0, index) === "bytes") {
          const rangesStr = rangeHeader.slice(index + 1);
          const firstRange = rangesStr.split(",")[0]?.trim();

          if (firstRange) {
            const dashIndex = firstRange.indexOf("-");
            if (dashIndex !== -1) {
              const startStr = firstRange.slice(0, dashIndex);
              const endStr = firstRange.slice(dashIndex + 1);

              let start: number;
              let end: number;

              if (startStr === "") {
                const suffixLength = parseInt(endStr, 10);
                if (!isNaN(suffixLength) && suffixLength > 0) {
                  start = Math.max(0, fileSize - suffixLength);
                  end = fileSize - 1;
                } else {
                  start = 0;
                  end = fileSize - 1;
                }
              } else {
                start = parseInt(startStr, 10);
                end = endStr === "" ? fileSize - 1 : parseInt(endStr, 10);
              }

              if (!isNaN(start) && !isNaN(end) && start <= end && start < fileSize) {
                if (end >= fileSize) end = fileSize - 1;

                const file = Bun.file(fullPath);
                this._statusCode = 206;
                this.headersMap().set("content-range", `bytes ${start}-${end}/${fileSize}`);
                this.headersMap().set("content-length", String(end - start + 1));
                this._body = await file.slice(start, end + 1).arrayBuffer();
                this._sent = true;
                if (callback) callback();
                return;
              }

              // Unsatisfiable range
              this._statusCode = 416;
              this.headersMap().set("content-range", `bytes */${fileSize}`);
              this._body = null;
              this._sent = true;
              if (callback) callback();
              return;
            }
          }
        }
      }

      // No range or non-bytes range — send full file
      this.headersMap().set("content-length", String(fileSize));
      const file = Bun.file(fullPath);
      this._body = await file.arrayBuffer();
      this._sent = true;
      if (callback) callback();
    } catch (err) {
      if (callback) {
        callback(err instanceof Error ? err : new Error(String(err)));
      } else {
        throw err;
      }
    }
  }

  async download(filePath: string, filename?: string, options?: SendFileOptions | ((err?: Error) => void), callback?: (err?: Error) => void): Promise<void> {
    let downloadName: string;
    let opts: SendFileOptions = {};
    let cb: ((err?: Error) => void) | undefined;

    // Handle overloads: download(path), download(path, fn), download(path, name),
    // download(path, name, fn), download(path, name, opts, fn)
    if (typeof filename === "function") {
      cb = filename as unknown as (err?: Error) => void;
      downloadName = basename(filePath);
    } else if (typeof filename === "object" && filename !== null) {
      opts = filename as SendFileOptions;
      downloadName = basename(filePath);
    } else {
      downloadName = filename || basename(filePath);
      if (typeof options === "function") {
        cb = options;
      } else if (options) {
        opts = options;
        cb = callback;
      }
    }

    this.headersMap().set("content-disposition", `attachment; filename="${downloadName}"`);

    if (cb) {
      await this.sendFile(filePath, opts, cb);
    } else {
      await this.sendFile(filePath, opts);
    }
  }

  ok(data?: unknown): void {
    this._statusCode = 200;
    if (data !== undefined) {
      this.json(data);
    } else {
      this._body = "";
      this._sent = true;
    }
  }

  created(data?: unknown): void {
    this._statusCode = 201;
    if (data !== undefined) {
      this.json(data);
    } else {
      this._body = "";
      this._sent = true;
    }
  }

  noContent(): void {
    this._statusCode = 204;
    this._body = null;
    this._sent = true;
  }

  badRequest(message = "Bad Request"): void {
    this._statusCode = 400;
    this.json({ error: message });
  }

  unauthorized(message = "Unauthorized"): void {
    this._statusCode = 401;
    this.json({ error: message });
  }

  forbidden(message = "Forbidden"): void {
    this._statusCode = 403;
    this.json({ error: message });
  }

  notFound(message = "Not Found"): void {
    this._statusCode = 404;
    this.json({ error: message });
  }

  /**
   * Initialize streaming mode and return the stream for the response.
   * Call this internally when write() is first called.
   */
  private _initStream(): void {
    if (this._streaming) return;

    this._streaming = true;

    // Create the stream with a stored controller
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        self._streamController = controller;
      },
    });

    // Store the stream directly as a resolved promise
    this._streamPromise = Promise.resolve(stream);
  }

  /**
   * Write a chunk to the response stream (Express-compatible).
   * This enables streaming responses for large data.
   *
   * @example
   * app.get('/stream', (req, res) => {
   *   res.set('Content-Type', 'text/plain');
   *   res.write('Hello ');
   *   res.write('World');
   *   res.end('!');
   * });
   */
  write(chunk: string | Uint8Array | ArrayBuffer): boolean {
    if (this._sent && !this._streaming) {
      return false;
    }

    this._initStream();

    if (!this._streamController) {
      return false;
    }

    let data: Uint8Array;
    if (typeof chunk === "string") {
      data = new TextEncoder().encode(chunk);
    } else if (chunk instanceof ArrayBuffer) {
      data = new Uint8Array(chunk);
    } else {
      data = chunk;
    }

    try {
      this._streamController.enqueue(data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * End the response stream (Express-compatible).
   * Optionally write final data before closing.
   *
   * @example
   * res.end(); // Just close
   * res.end('Final chunk'); // Write and close
   */
  end(chunk?: string | Uint8Array | ArrayBuffer, encoding?: string | (() => void), callback?: () => void): void {
    // Handle overloads: end(), end(chunk), end(chunk, encoding), end(chunk, cb), end(chunk, encoding, cb)
    if (typeof encoding === "function") {
      callback = encoding;
      encoding = undefined;
    }

    if (this._sent && !this._streaming) {
      if (callback) callback();
      return;
    }

    if (this._streaming && this._streamController) {
      // Write final chunk if provided
      if (chunk !== undefined) {
        this.write(chunk);
      }
      // Close the stream
      try {
        this._streamController.close();
      } catch {
        // Stream may already be closed
      }
      this._sent = true;
    } else {
      // Non-streaming mode - just set the body and mark as sent
      if (chunk !== undefined) {
        if (typeof chunk === "string") {
          this._body = chunk;
        } else if (chunk instanceof ArrayBuffer) {
          this._body = chunk;
        } else {
          this._body = chunk;
        }
      }
      this._sent = true;
    }

    if (callback) callback();
  }

  /**
   * Flush the response headers immediately (Express-compatible).
   * Useful for SSE or when you want headers sent before body.
   */
  flushHeaders(): void {
    this._headersFlushed = true;
    // In streaming mode, headers are flushed when the response is created
    // This flag indicates headers should be sent immediately
  }

  /**
   * Check if response is in streaming mode
   */
  isStreaming(): boolean {
    return this._streaming;
  }

  /**
   * Get the stream promise for streaming responses
   */
  getStream(): Promise<ReadableStream<Uint8Array>> | null {
    return this._streamPromise;
  }

  toResponse(): Response {
    let body: ResponseBody = this._body;

    // Auto-ETag: add weak ETag for 200 string-body responses when enabled (Express default)
    if (
      this._statusCode === 200 &&
      typeof body === "string" &&
      body.length > 0 &&
      !this.hasHeader("etag")
    ) {
      const etagSetting = this._app?.get("etag");
      if (etagSetting !== false) {
        this.headersMap().set("etag", generateBodyETag(body));
      }
    }

    if (
      this._compressionEncoding &&
      typeof body === "string" &&
      body.length >= this._compressionThreshold
    ) {
      const contentType = this._headersMap?.get("content-type") || "";
      if (!this._compressionFilter || this._compressionFilter(contentType)) {
        const buf = Buffer.from(body, "utf-8");
        let compressed: Buffer;

        if (this._compressionEncoding === "br") {
          compressed = Buffer.from(brotliCompressSync(buf));
        } else if (this._compressionEncoding === "gzip") {
          compressed = Buffer.from(Bun.gzipSync(buf, { level: this._compressionLevel } as Parameters<typeof Bun.gzipSync>[1]));
        } else {
          compressed = Buffer.from(Bun.deflateSync(buf, { level: this._compressionLevel } as Parameters<typeof Bun.deflateSync>[1]));
        }

        body = compressed;
        this.headersMap().set("content-encoding", this._compressionEncoding);
        this.headersMap().set("content-length", String(compressed.byteLength));
        this.headersMap().set("vary", "Accept-Encoding");
      }
    }

    return new Response(body, {
      status: this._statusCode,
      headers: this.toHeaders(),
    });
  }

  /**
   * Create a streaming response. Used internally by the router.
   */
  async toStreamingResponse(): Promise<Response> {
    if (!this._streaming || !this._streamPromise) {
      return this.toResponse();
    }

    const stream = await this._streamPromise;
    return new Response(stream, {
      status: this._statusCode,
      headers: this.toHeaders(),
    });
  }

  getHeaders(): Headers {
    return this.toHeaders() ?? new Headers();
  }

  isSent(): boolean {
    return this._sent;
  }

  async render(view: string, options?: RenderOptions, callback?: (err: Error | null, html?: string) => void): Promise<void> {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }

    const opts = options || {};

    if (!this._app) {
      const err = new Error("No app context available for render. Use BunWayApp instead of Router for template rendering.");
      if (callback) {
        callback(err);
        return;
      }
      throw err;
    }

    const viewEngine = this._app.get("view engine") as string | undefined;
    const viewsDir = this._app.get("views") as string || "./views";

    // Determine file extension
    let viewPath = view;
    let ext = extname(view);

    if (!ext && viewEngine) {
      ext = `.${viewEngine}`;
      viewPath = `${view}${ext}`;
    }

    if (!ext) {
      const err = new Error("No view engine specified and no file extension provided");
      if (callback) {
        callback(err);
        return;
      }
      throw err;
    }

    // Get the engine
    const engine = this._app.getEngine(ext);
    if (!engine) {
      const err = new Error(`No engine registered for extension "${ext}"`);
      if (callback) {
        callback(err);
        return;
      }
      throw err;
    }

    // Resolve view path
    const fullPath = resolve(viewsDir, viewPath);

    if (!existsSync(fullPath)) {
      const err = new Error(`View "${view}" not found at ${fullPath}`);
      if (callback) {
        callback(err);
        return;
      }
      throw err;
    }

    // Merge locals
    const renderOptions: Record<string, unknown> = {
      ...this._app.locals,
      ...this.locals,
      ...opts,
    };

    return new Promise((resolvePromise, rejectPromise) => {
      engine(fullPath, renderOptions, (err, html) => {
        if (err) {
          if (callback) {
            callback(err);
            resolvePromise();
            return;
          }
          rejectPromise(err);
          return;
        }

        if (html) {
          this.headersMap().set("content-type", "text/html");
          this._body = html;
          this._sent = true;
        }

        if (callback) {
          callback(null, html);
        }
        resolvePromise();
      });
    });
  }
}
