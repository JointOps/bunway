import type { CookieOptions, SendFileOptions } from "../types";
import { existsSync, statSync } from "fs";
import { join, extname, basename } from "path";

type ResponseBody = string | ArrayBuffer | Uint8Array | Blob | null;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

export class BunResponse {
  private _statusCode = 200;
  private _headers: Headers = new Headers();
  private _body: ResponseBody = null;
  private _sent = false;

  locals: Record<string, unknown> = {};

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

    const mimeType = getMimeType(fullPath);
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

  toResponse(): Response {
    return new Response(this._body, {
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
}
