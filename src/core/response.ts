import type { CookieOptions, SendFileOptions } from "../types";
import { existsSync, statSync } from "fs";
import { join, extname, basename, resolve } from "path";
import { getBaseMimeType } from "../utils/mime";

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
  private _headers: Headers = new Headers();
  private _body: ResponseBody = null;
  private _sent = false;
  private _app?: AppContext;
  private _acceptHeader?: string;

  // Streaming support
  private _streaming = false;
  private _streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private _streamPromise: Promise<ReadableStream<Uint8Array>> | null = null;
  private _headersFlushed = false;

  locals: Record<string, unknown> = {};

  setApp(app: AppContext): void {
    this._app = app;
  }

  setAcceptHeader(accept: string | undefined): void {
    this._acceptHeader = accept;
  }

  get statusCode(): number {
    return this._statusCode;
  }

  get headersSent(): boolean {
    return this._sent;
  }

  status(code: number): this {
    this._statusCode = code;
    return this;
  }

  set(name: string, value: string): this {
    this._headers.set(name, value);
    return this;
  }

  header(name: string, value: string): this {
    return this.set(name, value);
  }

  get(name: string): string | undefined {
    return this._headers.get(name) ?? undefined;
  }

  append(name: string, value: string): this {
    this._headers.append(name, value);
    return this;
  }

  type(mimeType: string): this {
    this._headers.set("Content-Type", mimeType);
    return this;
  }

  contentType(type: string): this {
    return this.type(type);
  }

  vary(field: string | string[]): this {
    const fields = Array.isArray(field) ? field : [field];
    const existing = this._headers.get("Vary");

    if (existing) {
      const existingFields = existing.split(",").map((f) => f.trim().toLowerCase());
      const newFields = fields.filter((f) => !existingFields.includes(f.toLowerCase()));
      if (newFields.length > 0) {
        this._headers.set("Vary", `${existing}, ${newFields.join(", ")}`);
      }
    } else {
      this._headers.set("Vary", fields.join(", "));
    }

    return this;
  }

  location(url: string): this {
    this._headers.set("Location", url);
    return this;
  }

  links(links: Record<string, string>): this {
    const linkHeader = Object.entries(links)
      .map(([rel, url]) => `<${url}>; rel="${rel}"`)
      .join(", ");
    this._headers.set("Link", linkHeader);
    return this;
  }

  attachment(filename?: string): this {
    if (filename) {
      this._headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    } else {
      this._headers.set("Content-Disposition", "attachment");
    }
    return this;
  }

  json(data: unknown): void {
    this._headers.set("Content-Type", "application/json");
    this._body = JSON.stringify(data);
    this._sent = true;
  }

  send(body: ResponseBody): void {
    this._body = body;
    this._sent = true;
  }

  text(data: string): void {
    this._headers.set("Content-Type", "text/plain");
    this._body = data;
    this._sent = true;
  }

  html(data: string): void {
    this._headers.set("Content-Type", "text/html");
    this._body = data;
    this._sent = true;
  }

  sendStatus(code: number): void {
    this._statusCode = code;
    this._body = String(code);
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
          this._headers.set("Content-Type", mimeType);
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
            this._headers.set("Content-Type", mimeType);
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
      this._headers.set("Location", url);
    } else if (typeof urlOrStatus === "string") {
      this._statusCode = 302;
      this._headers.set("Location", urlOrStatus);
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
    if (options.path) {
      cookie += `; Path=${options.path}`;
    }
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

    this._headers.append("Set-Cookie", cookie);
    return this;
  }

  clearCookie(name: string, options: CookieOptions = {}): this {
    return this.cookie(name, "", {
      ...options,
      expires: new Date(0),
    });
  }

  async sendFile(filePath: string, options: SendFileOptions = {}): Promise<void> {
    const root = options.root || process.cwd();
    const fullPath = filePath.startsWith("/") ? filePath : join(root, filePath);

    if (options.dotfiles !== "allow" && basename(fullPath).startsWith(".")) {
      if (options.dotfiles === "deny") {
        this._statusCode = 403;
        this.json({ error: "Forbidden" });
        return;
      }
      this._statusCode = 404;
      this.json({ error: "Not Found" });
      return;
    }

    if (!existsSync(fullPath)) {
      this._statusCode = 404;
      this.json({ error: "Not Found" });
      return;
    }

    const stat = statSync(fullPath);
    if (!stat.isFile()) {
      this._statusCode = 404;
      this.json({ error: "Not Found" });
      return;
    }

    const mimeType = getBaseMimeType(fullPath);
    this._headers.set("Content-Type", mimeType);
    this._headers.set("Content-Length", String(stat.size));

    if (options.maxAge !== undefined) {
      this._headers.set("Cache-Control", `max-age=${options.maxAge}`);
    }

    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        this._headers.set(key, value);
      }
    }

    const file = Bun.file(fullPath);
    this._body = await file.arrayBuffer();
    this._sent = true;
  }

  async download(filePath: string, filename?: string): Promise<void> {
    const downloadName = filename || basename(filePath);
    this._headers.set("Content-Disposition", `attachment; filename="${downloadName}"`);
    await this.sendFile(filePath);
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
  end(chunk?: string | Uint8Array | ArrayBuffer): void {
    if (this._sent && !this._streaming) {
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
    // If streaming, we need to handle this differently
    // The stream is already set up, but we return a placeholder
    // The actual streaming response is handled by toStreamingResponse()
    return new Response(this._body, {
      status: this._statusCode,
      headers: this._headers,
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
      headers: this._headers,
    });
  }

  getHeaders(): Headers {
    return this._headers;
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
          this._headers.set("Content-Type", "text/html");
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
