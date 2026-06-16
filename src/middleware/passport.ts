import type { BunRequest } from "../core/request";
import { BunResponse } from "../core/response";
import type { Handler } from "../types";

type PassportCallback = (err?: unknown, value?: unknown) => void;
type PassportLike = {
  serializeUser(user: unknown, req: BunRequest, done: PassportCallback): void;
  deserializeUser(obj: unknown, req: BunRequest, done: PassportCallback): void;
  authenticate(strategyName: string | string[], options: Record<string, unknown>): Handler;
};

type PassportSession = {
  passport?: { user?: unknown };
  save(callback?: (err?: Error) => void): void;
};

function makeHeadersProxy(req: BunRequest, headers: Headers): Record<string, string> {
  return new Proxy(Object.create(null) as Record<string, string>, {
    get(_: Record<string, string>, prop: string | symbol) {
      if (typeof prop !== "string") return undefined;
      return req.get(prop) ?? undefined;
    },
    has(_: Record<string, string>, prop: string | symbol) {
      if (typeof prop !== "string") return false;
      return headers.has(prop);
    },
    ownKeys() {
      return [...headers.keys()];
    },
    getOwnPropertyDescriptor(_: Record<string, string>, prop: string | symbol) {
      if (typeof prop !== "string") return undefined;
      const val = req.get(prop);
      if (val === undefined) return undefined;
      return { value: val, writable: false, enumerable: true, configurable: true };
    },
  });
}

function shimResponse(res: BunResponse): void {
  const r = res as BunResponse & {
    _passportShimmed?: boolean;
    setHeader?: (name: string, value: string | string[]) => void;
    writeHead?: (status: number, headers?: Record<string, string>) => void;
  };
  if (r._passportShimmed) return;
  r._passportShimmed = true;

  r.setHeader = (name: string, value: string | string[]) => {
    const v = Array.isArray(value) ? value.join(", ") : value;
    res.set(name, v);
  };

  r.writeHead = (status: number, headers?: Record<string, string>) => {
    res.status(status);
    if (headers) {
      for (const [k, v] of Object.entries(headers)) res.set(k, v);
    }
  };

  const statusCodeDescriptor = Object.getOwnPropertyDescriptor(BunResponse.prototype, "statusCode");
  Object.defineProperty(res, "statusCode", {
    get: () => statusCodeDescriptor?.get?.call(res) as number,
    set: (code: number) => { res.status(code); },
    configurable: true,
  });
}

export function passportInitialize(passportInstance: PassportLike): Handler {
  return (req, res, next) => {
    const pp = passportInstance;
    const mutableReq = req as BunRequest & Record<string, unknown>;

    if (!mutableReq._passportHeadersProxied) {
      const headers = req.headers;
      Object.defineProperty(req, "headers", {
        get: () => makeHeadersProxy(req, headers),
        configurable: true,
      });
      mutableReq._passportHeadersProxied = true;
    }

    const conn = { remoteAddress: req.ip, encrypted: req.secure };
    mutableReq.connection = conn;
    mutableReq.socket = conn;

    mutableReq._passport = { instance: pp };

    // Passport calls req.logIn(user, options, callback) on success — the callback
    // continuation is how it hands control back to the middleware chain.
    // Also supports req.logIn(user, callback) (options omitted).
    mutableReq.login = mutableReq.logIn = async (
      user: unknown,
      optionsOrCb: { session?: boolean } | ((err?: unknown) => void) = {},
      maybeCb?: (err?: unknown) => void
    ): Promise<void> => {
      const options: { session?: boolean } =
        typeof optionsOrCb === "function" ? {} : optionsOrCb;
      const cb: ((err?: unknown) => void) | undefined =
        typeof optionsOrCb === "function" ? optionsOrCb : maybeCb;

      try {
        req.user = user as typeof req.user;
        req.auth = user as typeof req.auth;
        const passportSession = req.session as PassportSession | undefined;
        if (passportSession && typeof passportSession.save === "function" && options.session !== false) {
          await new Promise<void>((resolve, reject) => {
            pp.serializeUser(user, req, (err, obj) => {
              if (err) return reject(err);
              passportSession.passport = { user: obj };
              passportSession.save((saveErr) => {
                if (saveErr) return reject(saveErr);
                resolve();
              });
            });
          });
        }
        cb?.(undefined);
      } catch (err) {
        cb?.(err);
      }
    };

    // Supports req.logout(callback) and req.logout(options, callback).
    mutableReq.logout = mutableReq.logOut = async (
      optionsOrCb?: { keepSessionInfo?: boolean } | ((err?: unknown) => void),
      maybeCb?: (err?: unknown) => void
    ): Promise<void> => {
      const cb: ((err?: unknown) => void) | undefined =
        typeof optionsOrCb === "function" ? optionsOrCb : maybeCb;

      try {
        req.user = undefined;
        req.auth = undefined;
        const passportSession = req.session as PassportSession | undefined;
        if (passportSession?.passport) {
          delete passportSession.passport;
          await new Promise<void>((resolve, reject) => {
            passportSession.save((err) => (err ? reject(err) : resolve()));
          });
        }
        cb?.(undefined);
      } catch (err) {
        cb?.(err);
      }
    };

    req.isAuthenticated = () => !!req.user;
    req.isUnauthenticated = () => !req.isAuthenticated();

    shimResponse(res);

    next();
  };
}

export function passportSession(passportInstance: PassportLike): Handler {
  return async (req, res, next) => {
    const pp = passportInstance;

    if (!req.session) {
      return next();
    }

    const sessionData = (req.session as PassportSession).passport;
    if (!sessionData?.user) return next();

    try {
      const user = await new Promise<unknown>((resolve, reject) => {
        pp.deserializeUser(sessionData.user, req, (err, u) => {
          err ? reject(err) : resolve(u);
        });
      });
      req.user = user as typeof req.user;
      req.auth = user as typeof req.auth;
    } catch {
      // Soft-fail intentionally: a broken/corrupt session entry should
      // degrade to "unauthenticated" rather than 500 every request for
      // that client, so the error is swallowed here rather than via next(err).
      req.user = undefined;
    }

    next();
  };
}

export function passportAuthenticate(
  passportInstance: PassportLike,
  strategyName: string | string[],
  options: Record<string, unknown> = {}
): Handler {
  return (req, res, next) => {
    if (!(req as BunRequest & Record<string, unknown>)._passport) {
      return next(new Error(
        "passportAuthenticate(): passportInitialize() middleware must be applied before authenticate(). " +
        "Add app.use(bunway.passportInitialize(passport)) before your route handlers."
      ));
    }

    // Passport's success path calls req.logIn() asynchronously (session save) then next().
    // Its failure path calls res.end() directly without next().
    // Returning a Promise lets Bunway's runPipeline await either outcome.
    return new Promise<void>((resolve) => {
      const r = res as BunResponse & Record<string, unknown>;
      const origEnd = r.end ? (r.end as (...a: unknown[]) => void).bind(res) : undefined;

      const cleanup = (): void => {
        if (origEnd) r.end = origEnd;
      };

      // Failure without failWithError: passport calls res.end() instead of next().
      r.end = (...args: unknown[]): void => {
        cleanup();
        origEnd?.(...args);
        resolve();
      };

      const wrappedNext = (err?: unknown): void => {
        cleanup();
        resolve();
        next(err);
      };

      passportInstance.authenticate(strategyName, options)(req, res, wrappedNext);

      // Synchronous response (e.g., res.redirect() for failureRedirect/successRedirect)
      // has already fired by this point — resolve immediately so the pipeline can read isSent().
      if (res.isSent()) {
        cleanup();
        resolve();
      }
    });
  };
}

export const passport = {
  initialize: passportInitialize,
  session: passportSession,
  authenticate: passportAuthenticate,
};
