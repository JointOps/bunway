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
}

export interface ListenOptions {
  port?: number;
  hostname?: string;
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
}

export const BUNWAY_DEFAULT_PORT = 3000;
