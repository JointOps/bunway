import type { Handler } from "../types";
import type { BunRequest } from "../core/request";
import type { BunResponse } from "../core/response";

export interface AuthenticateOptions {
  session?: boolean;
  successRedirect?: string;
  failureRedirect?: string;
  failureFlash?: boolean | string;
  successFlash?: boolean | string;
  assignProperty?: string;
  failWithError?: boolean;
  passReqToCallback?: boolean;
}

export interface Strategy {
  name: string;
  authenticate(req: BunRequest, options?: AuthenticateOptions): void;
}

export interface SerializeUserFn<TUser = any> {
  (user: TUser, done: (err: Error | null, id?: any) => void): void;
}

export interface DeserializeUserFn<TUser = any> {
  (id: any, done: (err: Error | null, user?: TUser | false | null) => void): void;
}

export class Passport {
  private strategies = new Map<string, Strategy>();
  private _serializeUser: SerializeUserFn | null = null;
  private _deserializeUser: DeserializeUserFn | null = null;
  private _userProperty = "user";

  use(strategy: Strategy): this;
  use(name: string, strategy: Strategy): this;
  use(nameOrStrategy: string | Strategy, strategy?: Strategy): this {
    if (typeof nameOrStrategy === "string") {
      this.strategies.set(nameOrStrategy, strategy!);
    } else {
      this.strategies.set(nameOrStrategy.name, nameOrStrategy);
    }
    return this;
  }

  unuse(name: string): this {
    this.strategies.delete(name);
    return this;
  }

  serializeUser<TUser = any>(fn: SerializeUserFn<TUser>): void {
    this._serializeUser = fn;
  }

  deserializeUser<TUser = any>(fn: DeserializeUserFn<TUser>): void {
    this._deserializeUser = fn;
  }

  initialize(options?: { userProperty?: string }): Handler {
    if (options?.userProperty) {
      this._userProperty = options.userProperty;
    }

    return (req, _res, next) => {
      const request = req as any;

      request._passport = {
        instance: this,
      };

      request.login = request.logIn = (
        user: any,
        options?: { session?: boolean },
        done?: (err?: Error) => void
      ) => {
        if (typeof options === "function") {
          done = options;
          options = {};
        }
        options = options || {};

        const session = options.session !== false;

        request[this._userProperty] = user;

        if (session && this._serializeUser && request.session) {
          this._serializeUser(user, (err, serializedUser) => {
            if (err) {
              request[this._userProperty] = null;
              return done?.(err);
            }
            request.session.passport = { user: serializedUser };
            done?.();
          });
        } else {
          done?.();
        }
      };

      request.logout = request.logOut = (
        options?: { keepSessionInfo?: boolean },
        done?: (err?: Error) => void
      ) => {
        if (typeof options === "function") {
          done = options;
          options = {};
        }

        request[this._userProperty] = null;

        if (request.session && request.session.passport) {
          delete request.session.passport;
        }

        done?.();
      };

      request.isAuthenticated = () => {
        return !!request[this._userProperty];
      };

      request.isUnauthenticated = () => {
        return !request.isAuthenticated();
      };

      next();
    };
  }

  session(options?: { pauseStream?: boolean }): Handler {
    return (req, _res, next) => {
      const request = req as any;

      if (!request.session) {
        next();
        return;
      }

      if (!request.session.passport || !request.session.passport.user) {
        next();
        return;
      }

      if (!this._deserializeUser) {
        next();
        return;
      }

      const serializedUser = request.session.passport.user;

      this._deserializeUser(serializedUser, (err, user) => {
        if (err) {
          next(err);
          return;
        }

        if (!user) {
          delete request.session.passport;
        } else {
          request[this._userProperty] = user;
        }

        next();
      });
    };
  }

  authenticate(
    strategyOrStrategies: string | string[],
    options?: AuthenticateOptions | ((err: Error | null, user?: any, info?: any) => void),
    callback?: (err: Error | null, user?: any, info?: any) => void
  ): Handler {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }

    const opts: AuthenticateOptions = options || {};
    const strategies = Array.isArray(strategyOrStrategies)
      ? strategyOrStrategies
      : [strategyOrStrategies];

    return (req, res, next) => {
      const request = req as any;
      const response = res as BunResponse;

      let strategyIndex = 0;
      let failures: Array<{ challenge?: string; status?: number }> = [];

      const attemptStrategy = () => {
        if (strategyIndex >= strategies.length) {
          if (callback) {
            if (failures.length === 1) {
              callback(null, false, failures[0]?.challenge);
            } else {
              const challenges = failures.map((f) => f.challenge).filter(Boolean);
              callback(null, false, challenges.length > 0 ? challenges : undefined);
            }
            return;
          }

          if (opts.failureRedirect) {
            response.redirect(opts.failureRedirect);
            return;
          }

          if (opts.failWithError) {
            const error = new Error("Unauthorized") as any;
            error.status = 401;
            next(error);
            return;
          }

          response.status(401).json({ error: "Unauthorized" });
          return;
        }

        const strategyName = strategies[strategyIndex++];
        if (!strategyName) {
          next(new Error("No strategy available"));
          return;
        }
        const strategy = this.strategies.get(strategyName);

        if (!strategy) {
          next(new Error(`Unknown authentication strategy "${strategyName}"`));
          return;
        }

        const strategyPrototype = Object.getPrototypeOf(strategy);

        const actionContext = {
          success: (user: any, info?: any) => {
            if (callback) {
              callback(null, user, info);
              return;
            }

            if (opts.assignProperty) {
              request[opts.assignProperty] = user;
              next();
              return;
            }

            request.login(user, opts, (err?: Error) => {
              if (err) {
                next(err);
                return;
              }

              if (opts.successFlash && request.session?.flash) {
                const message = typeof opts.successFlash === "string" ? opts.successFlash : "Welcome!";
                request.session.flash("success", message);
              }

              if (opts.successRedirect) {
                response.redirect(opts.successRedirect);
                return;
              }

              next();
            });
          },

          fail: (challenge?: string | number, status?: number) => {
            if (typeof challenge === "number") {
              status = challenge;
              challenge = undefined;
            }

            failures.push({ challenge: challenge as string | undefined, status });

            if (opts.failureFlash && request.session?.flash) {
              const message = typeof opts.failureFlash === "string" ? opts.failureFlash : (challenge as string) || "Authentication failed";
              request.session.flash("error", message);
            }

            attemptStrategy();
          },

          redirect: (url: string, status?: number) => {
            response.redirect(status || 302, url);
          },

          pass: () => {
            next();
          },

          error: (err: Error) => {
            if (callback) {
              callback(err);
              return;
            }
            next(err);
          },
        };

        try {
          if (strategyPrototype.authenticate) {
            const boundStrategy = Object.create(strategy);
            Object.assign(boundStrategy, actionContext);
            boundStrategy.authenticate(req, opts);
          }
        } catch (err) {
          next(err);
        }
      };

      attemptStrategy();
    };
  }

  authorize(
    strategy: string | string[],
    options?: AuthenticateOptions,
    callback?: (err: Error | null, user?: any, info?: any) => void
  ): Handler {
    const opts = { ...options, assignProperty: "account" };
    return this.authenticate(strategy, opts, callback);
  }
}

export const passport = new Passport();
