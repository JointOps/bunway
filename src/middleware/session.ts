import type { Handler } from "../types";
import type { BunRequest } from "../core/request";
import { generateSessionId, signSessionId, unsignSessionId } from "../utils/crypto";
import { createHash } from "crypto";

/**
 * Extend this interface to add typed session data fields with full autocomplete.
 * @example
 * declare module "bunway" {
 *   interface SessionData {
 *     user: User;
 *     cart: CartItem[];
 *   }
 * }
 */
export interface SessionData {
  [key: string]: unknown;
}

export interface Session extends SessionData {
  id: string;
  cookie: SessionCookieData;
  regenerate(callback?: (err?: Error) => void): void;
  destroy(callback?: (err?: Error) => void): void;
  reload(callback?: (err?: Error) => void): void;
  save(callback?: (err?: Error) => void): void;
  touch(): void;
  flash(type: string, message?: string): string | string[] | undefined;
}

interface SessionCookieData {
  maxAge?: number;
  expires?: Date;
  secure?: boolean;
  httpOnly?: boolean;
  path?: string;
  sameSite?: "strict" | "lax" | "none";
}

export interface SessionStore {
  get(sid: string): Promise<SessionData | null>;
  set(sid: string, session: SessionData, maxAge?: number): Promise<void>;
  destroy(sid: string): Promise<void>;
  touch?(sid: string, session: SessionData): Promise<void>;
  // Utility methods — optional, never called by session() core
  all?(): Promise<SessionData[]>;
  length?(): Promise<number>;
  clear?(): Promise<void>;
  // EventEmitter subset — optional, forwarded by fromExpressStore()
  on?(event: string, listener: (...args: any[]) => void): this;
  emit?(event: string, ...args: any[]): boolean;
}

export interface LegacySessionStore {
  get(sid: string, cb: (err: any, session?: SessionData | null) => void): void;
  set(sid: string, session: SessionData, cb?: (err?: any) => void): void;
  destroy(sid: string, cb?: (err?: any) => void): void;
  touch?(sid: string, session: SessionData, cb?: (err?: any) => void): void;
}

export function fromExpressStore(store: LegacySessionStore): SessionStore {
  const adapted: SessionStore = {
    get: (sid) =>
      new Promise((resolve, reject) =>
        store.get(sid, (err, session) => {
          if (err) reject(err);
          else resolve(session ?? null);
        })
      ),
    set: (sid, session, _maxAge) =>
      new Promise((resolve, reject) =>
        store.set(sid, session, (err) => {
          if (err) reject(err);
          else resolve();
        })
      ),
    destroy: (sid) =>
      new Promise((resolve, reject) =>
        store.destroy(sid, (err) => {
          if (err) reject(err);
          else resolve();
        })
      ),
  };

  if (store.touch) {
    adapted.touch = (sid, session) =>
      new Promise((resolve, reject) =>
        store.touch!(sid, session, (err) => {
          if (err) reject(err);
          else resolve();
        })
      );
  }

  if (typeof (store as any).on === "function") {
    adapted.on = function(this: SessionStore, event: string, listener: (...args: any[]) => void) {
      (store as any).on(event, listener);
      return this;
    };
  }
  if (typeof (store as any).emit === "function") {
    adapted.emit = (event: string, ...args: any[]) => (store as any).emit(event, ...args);
  }

  return adapted;
}

export interface SessionOptions {
  secret: string | string[];
  name?: string;
  cookie?: {
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    path?: string;
    sameSite?: "strict" | "lax" | "none";
  };
  store?: SessionStore;
  resave?: boolean;
  saveUninitialized?: boolean;
  rolling?: boolean;
  genid?: (req: BunRequest) => string;
}

function hashSession(data: SessionData): string {
  return createHash("sha1")
    .update(
      JSON.stringify(data, (key, val) =>
        key === "_flash" ? undefined : val
      )
    )
    .digest("hex");
}

export class MemoryStore implements SessionStore {
  private sessions = new Map<string, { data: SessionData; expires?: number; ttl?: number }>();

  async get(sid: string): Promise<SessionData | null> {
    const entry = this.sessions.get(sid);
    if (!entry) return null;

    if (entry.expires && Date.now() > entry.expires) {
      this.sessions.delete(sid);
      return null;
    }

    return { ...entry.data };
  }

  async set(sid: string, session: SessionData, maxAge?: number): Promise<void> {
    const expires = maxAge ? Date.now() + maxAge : undefined;
    this.sessions.set(sid, { data: { ...session }, expires, ttl: maxAge });
  }

  async destroy(sid: string): Promise<void> {
    this.sessions.delete(sid);
  }

  async touch(sid: string, _session: SessionData): Promise<void> {
    const entry = this.sessions.get(sid);
    if (entry && entry.ttl) {
      entry.expires = Date.now() + entry.ttl;
    }
  }

  async all(): Promise<SessionData[]> {
    const now = Date.now();
    const result: SessionData[] = [];
    for (const entry of this.sessions.values()) {
      if (!entry.expires || now <= entry.expires) {
        result.push({ ...entry.data });
      }
    }
    return result;
  }

  async length(): Promise<number> {
    const now = Date.now();
    let count = 0;
    for (const entry of this.sessions.values()) {
      if (!entry.expires || now <= entry.expires) count++;
    }
    return count;
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }

  get size(): number {
    return this.sessions.size;
  }
}

export interface FileStoreOptions {
  path: string;
  ttl?: number;
}

export class FileStore implements SessionStore {
  private path: string;
  private ttl: number;

  constructor(options: FileStoreOptions) {
    this.path = options.path;
    this.ttl = options.ttl ?? 86400000; // 24 hours default
  }

  private getFilePath(sid: string): string {
    // Sanitize session ID to prevent directory traversal
    const safeSid = sid.replace(/[^a-zA-Z0-9-]/g, "");
    return `${this.path}/${safeSid}.json`;
  }

  async get(sid: string): Promise<SessionData | null> {
    try {
      const filePath = this.getFilePath(sid);
      const file = Bun.file(filePath);

      if (!(await file.exists())) {
        return null;
      }

      const content = await file.json() as { data: SessionData; expires?: number };

      if (content.expires && Date.now() > content.expires) {
        await this.destroy(sid);
        return null;
      }

      return content.data;
    } catch {
      return null;
    }
  }

  async set(sid: string, session: SessionData, maxAge?: number): Promise<void> {
    const filePath = this.getFilePath(sid);
    const ttl = maxAge ?? this.ttl;
    const expires = Date.now() + ttl;
    await Bun.write(filePath, JSON.stringify({ data: session, expires, ttl }));
  }

  async destroy(sid: string): Promise<void> {
    try {
      const filePath = this.getFilePath(sid);
      const file = Bun.file(filePath);

      if (await file.exists()) {
        const fs = await import("fs/promises");
        await fs.unlink(filePath);
      }
    } catch {
      // Ignore errors during deletion
    }
  }

  async touch(sid: string, session: SessionData): Promise<void> {
    const filePath = this.getFilePath(sid);
    try {
      const file = Bun.file(filePath);
      if (!(await file.exists())) return;
      const content = await file.json() as { data: SessionData; expires?: number; ttl?: number };
      if (content.expires && Date.now() > content.expires) {
        await this.destroy(sid);
        return;
      }
      const originalTtl = content.ttl ?? this.ttl;
      await this.set(sid, session, originalTtl);
    } catch {
      // Ignore — session may have been deleted concurrently
    }
  }

  async clear(): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const files = await fs.readdir(this.path);

      for (const file of files) {
        if (file.endsWith(".json")) {
          await fs.unlink(`${this.path}/${file}`);
        }
      }
    } catch {
      // Ignore errors during clear
    }
  }

  async length(): Promise<number> {
    try {
      const fs = await import("fs/promises");
      const files = await fs.readdir(this.path);
      return files.filter((f) => f.endsWith(".json")).length;
    } catch {
      return 0;
    }
  }
}

export function session(options: SessionOptions): Handler {
  const {
    secret: secretOrSecrets,
    name = "connect.sid",
    cookie = {},
    store = new MemoryStore(),
    resave = true,
    saveUninitialized = true,
    rolling = false,
    genid = (_req: BunRequest) => generateSessionId(),
  } = options;

  if (store instanceof MemoryStore && process.env.NODE_ENV === "production") {
    console.warn(
      "Warning: bunway session() MemoryStore is not designed for production. " +
      "It leaks memory and cannot scale beyond a single process. " +
      "Use a Redis, SQLite, or other persistent store instead."
    );
  }

  const secrets = Array.isArray(secretOrSecrets)
    ? secretOrSecrets
    : [secretOrSecrets];
  const secret = secrets[0]!;

  const cookieMaxAge = cookie.maxAge ?? 86400000;
  const cookieSecure = cookie.secure ?? false;
  const cookieHttpOnly = cookie.httpOnly ?? true;
  const cookiePath = cookie.path ?? "/";
  const cookieSameSite = cookie.sameSite ?? "lax";

  function setCookie(res: any, sessionId: string) {
    const signedValue = signSessionId(sessionId, secret);
    res.cookie(name, signedValue, {
      maxAge: cookieMaxAge,
      secure: cookieSecure,
      httpOnly: cookieHttpOnly,
      path: cookiePath,
      sameSite: cookieSameSite,
    });
  }

  return async (req, res, next) => {
    let sessionId: string | null = null;
    let isNew = false;

    // req.cookies is lazy-parsed and cached by BunRequest — no re-parse needed
    const signedSid = req.cookies[name];
    if (signedSid) {
      const unsigned = unsignSessionId(signedSid, secrets);
      if (unsigned) {
        sessionId = unsigned;
      }
    }

    let sessionData: SessionData | null = null;

    if (sessionId) {
      try {
        sessionData = await store.get(sessionId);
      } catch (err) {
        return next(err);
      }
    }

    if (!sessionData) {
      sessionId = genid(req);
      sessionData = {};
      isNew = true;
    }

    const flashData: Record<string, string[]> = (sessionData._flash as Record<string, string[]>) || {};
    delete sessionData._flash;

    const internalData: SessionData = sessionData;
    const originalHash = hashSession(internalData);
    let destroyed = false;
    let dirty = false;

    // Write queue to ensure session writes happen in order
    let pendingWrite: Promise<void> = Promise.resolve();

    const queueWrite = () => {
      if (destroyed) return;
      dirty = true;

      const data = { ...internalData };
      if (Object.keys(flashData).length > 0) {
        data._flash = flashData;
      }
      // Chain writes to ensure they complete in order
      pendingWrite = pendingWrite.then(() => store.set(sessionId!, data, cookieMaxAge));
    };

    const sess: Session = {
      id: sessionId!,
      cookie: {
        maxAge: cookieMaxAge,
        expires: new Date(Date.now() + cookieMaxAge),
        secure: cookieSecure,
        httpOnly: cookieHttpOnly,
        path: cookiePath,
        sameSite: cookieSameSite,
      },

      regenerate(callback?: (err?: Error) => void) {
        store.destroy(sessionId!).then(() => {
          sessionId = genid(req);
          sess.id = sessionId;
          (req as any).sessionID = sessionId;
          Object.keys(internalData).forEach((k) => delete internalData[k]);
          isNew = true;
          setCookie(res, sessionId);
          return store.set(sessionId, {}, cookieMaxAge).then(() => callback?.());
        })
          .catch((err: Error) => callback?.(err));
      },

      destroy(callback?: (err?: Error) => void): Promise<void> | void {
        destroyed = true;
        const promise = store.destroy(sessionId!).then(() => {
          res.cookie(name, "", { maxAge: 0, path: cookiePath });
          callback?.();
        });
        if (!callback) {
          return promise;
        }
      },

      reload(callback?: (err?: Error) => void) {
        store.get(sessionId!).then((data) => {
          if (data) {
            Object.keys(internalData).forEach((k) => delete internalData[k]);
            Object.assign(internalData, data);
          }
          callback?.();
        });
      },

      save(callback?: (err?: Error) => void) {
        const data = { ...internalData };
        if (Object.keys(flashData).length > 0) {
          data._flash = flashData;
        }
        store.set(sessionId!, data, cookieMaxAge).then(() => callback?.());
      },

      touch() {
        sess.cookie.expires = new Date(Date.now() + cookieMaxAge);
        if (store.touch) {
          store.touch(sessionId!, { ...internalData });
        }
      },

      flash(type: string, message?: string): string | string[] | undefined {
        if (message === undefined) {
          const messages = flashData[type] || [];
          delete flashData[type];
          return messages.length === 1 ? messages[0] : messages.length > 0 ? messages : undefined;
        }

        if (!flashData[type]) {
          flashData[type] = [];
        }
        flashData[type].push(message);

        // Schedule debounced write
        queueWrite();

        return undefined;
      },
    };

    const handler: ProxyHandler<Session> = {
      get(target, prop) {
        if (prop in target) {
          return (target as any)[prop];
        }
        return internalData[prop as string];
      },
      set(target, prop, value) {
        if (prop === "id" || prop === "cookie") {
          (target as any)[prop] = value;
        } else {
          internalData[prop as string] = value;
          queueWrite();
        }
        return true;
      },
      deleteProperty(_target, prop) {
        delete internalData[prop as string];
        queueWrite();
        return true;
      },
      has(_target, prop) {
        return prop in internalData || prop in sess;
      },
      ownKeys() {
        return [...Object.keys(internalData), "id", "cookie", "regenerate", "destroy", "reload", "save", "touch", "flash"];
      },
      getOwnPropertyDescriptor(_target, prop) {
        if (prop in internalData || prop in sess) {
          return { enumerable: true, configurable: true, writable: true };
        }
        return undefined;
      },
    };

    const sessionProxy = new Proxy(sess, handler);

    (req as any).session = sessionProxy;
    (req as any).sessionID = sessionId;
    (req as any).sessionStore = store;

    if (isNew && saveUninitialized) {
      setCookie(res, sessionId!);
      try {
        await store.set(sessionId!, {}, cookieMaxAge);
      } catch (err) {
        return next(err);
      }
    }

    // Patch toResponse/toStreamingResponse — the real lifecycle termination point in Bunway.
    // res.end() only sets a flag; the router calls toResponse() after all middleware resolve.
    const originalToResponse = res.toResponse.bind(res);
    const originalToStreaming = res.toStreamingResponse.bind(res);

    const postResponse = async (): Promise<void> => {
      // saveUninitialized: false + new session + mutation → session WAS saved by queueWrite,
      // but Set-Cookie was skipped at middleware entry. Send it now so the client can retrieve
      // the session on the next request. Without this, the stored session is unreachable.
      if (!destroyed && isNew && dirty && !saveUninitialized) {
        setCookie(res, sessionId!);
      }

      // resave: true → force-save even if nothing changed (only when data actually differs)
      if (!destroyed && !isNew && resave && !dirty) {
        const currentHash = hashSession(internalData);
        if (currentHash !== originalHash) {
          // Data changed but queueWrite was somehow not triggered — save now
          try {
            await store.set(sessionId!, { ...internalData }, cookieMaxAge);
          } catch { /* non-fatal at response time */ }
        } else if (!store.touch) {
          // No touch() available: resave must save to extend the store TTL
          try {
            await store.set(sessionId!, { ...internalData }, cookieMaxAge);
          } catch { /* non-fatal */ }
        }
      }

      // rolling: true → re-send Set-Cookie and extend store TTL on every response
      if (!destroyed && !isNew && rolling) {
        setCookie(res, sessionId!);
        if (store.touch) {
          try {
            await store.touch(sessionId!, { ...internalData });
          } catch { /* non-fatal */ }
        }
        return;
      }

      if (!destroyed && !isNew && !dirty && store.touch) {
        try {
          await store.touch(sessionId!, { ...internalData });
        } catch {
          // Non-fatal — session will expire naturally in store
        }
      }
    };

    res.toResponse = () => {
      // Fire-and-forget; errors are non-fatal
      postResponse();
      return originalToResponse();
    };

    res.toStreamingResponse = async () => {
      await postResponse();
      return originalToStreaming();
    };

    next();
  };
}
