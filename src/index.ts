import { BunWayApp, bunway as createBunway, type BunWayOptions } from "./core/app";
import { json, urlencoded, text } from "./middleware/body-parser";
import { cors } from "./middleware/cors";
import { serveStatic } from "./middleware/static";
import { cookieParser } from "./middleware/cookie-parser";
import { compression } from "./middleware/compression";
import { helmet } from "./middleware/helmet";
import { rateLimit } from "./middleware/rate-limit";

interface BunwayFactory {
  (options?: BunWayOptions): BunWayApp;
  json: typeof json;
  urlencoded: typeof urlencoded;
  text: typeof text;
  cors: typeof cors;
  static: typeof serveStatic;
  cookieParser: typeof cookieParser;
  compression: typeof compression;
  helmet: typeof helmet;
  rateLimit: typeof rateLimit;
}

const bunway = ((options?: BunWayOptions) => createBunway(options)) as BunwayFactory;

bunway.json = json;
bunway.urlencoded = urlencoded;
bunway.text = text;
bunway.cors = cors;
bunway.static = serveStatic;
bunway.cookieParser = cookieParser;
bunway.compression = compression;
bunway.helmet = helmet;
bunway.rateLimit = rateLimit;

export default bunway;
export { bunway };

export { BunWayApp } from "./core/app";
export { Router } from "./core/router";
export { BunRequest } from "./core/request";
export { BunResponse } from "./core/response";
export { HttpError, isHttpError } from "./core/errors";

export { json, urlencoded, text } from "./middleware/body-parser";
export { cors } from "./middleware/cors";
export { errorHandler } from "./middleware/error-handler";
export { serveStatic } from "./middleware/static";
export { cookieParser, signCookie, unsignCookie } from "./middleware/cookie-parser";
export { compression } from "./middleware/compression";
export { helmet } from "./middleware/helmet";
export { rateLimit } from "./middleware/rate-limit";

export type { Handler, ErrorHandler, NextFunction, RouterOptions, ListenOptions, CookieOptions, SendFileOptions } from "./types";
export type { BunWayOptions } from "./core/app";
export type { HttpErrorOptions } from "./core/errors";
export type { JsonOptions, UrlencodedOptions, TextOptions } from "./middleware/body-parser";
export type { CorsOptions } from "./middleware/cors";
export type { ErrorHandlerOptions } from "./middleware/error-handler";
export type { StaticOptions } from "./middleware/static";
export type { CookieParserOptions } from "./middleware/cookie-parser";
export type { CompressionOptions } from "./middleware/compression";
export type { HelmetOptions } from "./middleware/helmet";
export type { RateLimitOptions } from "./middleware/rate-limit";

export { BUNWAY_DEFAULT_PORT } from "./types";
