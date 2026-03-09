import type { ServerWebSocket } from "bun";
import type { BunRequest } from "./core/request";
import type { BunResponse } from "./core/response";

export type NextFunction = (err?: unknown) => void;

export type Handler = (req: BunRequest, res: BunResponse, next: NextFunction) => void;

export type ErrorHandler = (
  err: unknown,
  req: BunRequest,
  res: BunResponse,
  next: NextFunction
) => void;

export interface RouteDefinition {
  method: string;
  path: string;
  regex: RegExp;
  keys: string[];
  handlers: Handler[];
}

export interface RouterOptions {
  caseSensitive?: boolean;
  strict?: boolean;
  mergeParams?: boolean;
}

export interface TlsOptions {
  key: string | Buffer;
  cert: string | Buffer;
  ca?: string | Buffer | (string | Buffer)[];
  passphrase?: string;
}

export interface ListenOptions {
  port?: number;
  hostname?: string;
  tls?: TlsOptions;
}

export interface CookieOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "strict" | "lax" | "none" | boolean;
  secure?: boolean;
  signed?: boolean;
}

export interface SendFileOptions {
  maxAge?: number;
  root?: string;
  headers?: Record<string, string>;
  dotfiles?: "allow" | "deny" | "ignore";
  lastModified?: boolean;
  cacheControl?: boolean;
  immutable?: boolean;
  acceptRanges?: boolean;
}

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

export const BUNWAY_DEFAULT_PORT = 3000;

// WebSocket Types
export interface WebSocketData {
  routePath: string;
  params: Record<string, string>;
  handlers: WebSocketHandlers;
  req: BunRequest;
}

export type BunWebSocket = ServerWebSocket<WebSocketData>;

export interface WebSocketHandlers {
  open?: (ws: BunWebSocket) => void;
  message?: (ws: BunWebSocket, message: string | Buffer) => void;
  close?: (ws: BunWebSocket, code: number, reason: string) => void;
  drain?: (ws: BunWebSocket) => void;
}

export interface WebSocketRouteDefinition {
  path: string;
  regex: RegExp;
  keys: string[];
  handlers: WebSocketHandlers;
  middlewares: Handler[];
}

// Unified Logger Interface
// Users provide their own logger implementation (Pino, Winston, console, etc.)
export interface BunWayLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
}
