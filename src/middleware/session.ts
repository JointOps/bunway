import type { Handler } from "../types";
import { generateSessionId, signSessionId, unsignSessionId } from "../utils/crypto";

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
}

export interface SessionOptions {
  secret: string;
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
  genid?: () => string;
}

export class MemoryStore implements SessionStore {
  private sessions = new Map<string, { data: SessionData; expires?: number }>();

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
    this.sessions.set(sid, { data: { ...session }, expires });
  }

  async destroy(sid: string): Promise<void> {
    this.sessions.delete(sid);
  }

  async touch(sid: string, _session: SessionData): Promise<void> {
    const entry = this.sessions.get(sid);
    if (entry && entry.expires) {
      const ttl = entry.expires - Date.now();
      if (ttl > 0) {
        entry.expires = Date.now() + ttl;
      }
    }
  }

  clear(): void {
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
    const expires = maxAge ? Date.now() + maxAge : Date.now() + this.ttl;

    await Bun.write(filePath, JSON.stringify({ data: session, expires }));
  }

  async destroy(sid: string): Promise<void> {
    try {
      const filePath = this.getFilePath(sid);
      const file = Bun.file(filePath);

      if (await file.exists()) {
        await Bun.write(filePath, ""); // Clear file
        const fs = await import("fs/promises");
        await fs.unlink(filePath);
      }
    } catch {
      // Ignore errors during deletion
    }
  }

  async touch(sid: string, session: SessionData): Promise<void> {
    const existing = await this.get(sid);
    if (existing) {
      await this.set(sid, session, this.ttl);
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
    secret,
    name = "connect.sid",
    cookie = {},
    store = new MemoryStore(),
    saveUninitialized = true,
    genid = generateSessionId,
  } = options;

  const cookieMaxAge = cookie.maxAge ?? 86400000;
  const cookieSecure = cookie.secure ?? false;
  const cookieHttpOnly = cookie.httpOnly ?? true;
  const cookiePath = cookie.path ?? "/";
  const cookieSameSite = cookie.sameSite ?? "lax";

  function setCookie(res: any, sessionId: string) {
    const signedValue = signSessionId(sessionId, secret);
    res.cookie(name, signedValue, {
      maxAge: Math.floor(cookieMaxAge / 1000),
      secure: cookieSecure,
      httpOnly: cookieHttpOnly,
      path: cookiePath,
      sameSite: cookieSameSite,
    });
  }

  return async (req, res, next) => {
    const cookieHeader = req.get("cookie") || "";
    const cookies: Record<string, string> = {};

    for (const pair of cookieHeader.split(";")) {
      const idx = pair.indexOf("=");
      if (idx !== -1) {
        const key = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        cookies[key] = value;
      }
    }

    let sessionId: string | null = null;
    let isNew = false;

    const signedSid = cookies[name];
    if (signedSid) {
      try {
        const decoded = decodeURIComponent(signedSid);
        const unsigned = unsignSessionId(decoded, secret);
        if (unsigned) {
          sessionId = unsigned;
        }
      } catch {
        sessionId = null;
      }
    }

    let sessionData: SessionData | null = null;

    if (sessionId) {
      sessionData = await store.get(sessionId);
    }

    if (!sessionData) {
      sessionId = genid();
      sessionData = {};
      isNew = true;
    }

    const flashData: Record<string, string[]> = (sessionData._flash as Record<string, string[]>) || {};
    delete sessionData._flash;

    const internalData: SessionData = { ...sessionData };
    let destroyed = false;

    // Write queue to ensure session writes happen in order
    let pendingWrite: Promise<void> = Promise.resolve();

    const queueWrite = () => {
      if (destroyed) return;

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
          sessionId = genid();
          sess.id = sessionId;
          Object.keys(internalData).forEach((k) => delete internalData[k]);
          isNew = true;
          setCookie(res, sessionId);
          store.set(sessionId, {}, cookieMaxAge).then(() => callback?.());
        });
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
          store.touch(sessionId!, {});
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

    if (isNew && saveUninitialized) {
      setCookie(res, sessionId!);
      await store.set(sessionId!, {}, cookieMaxAge);
    } else if (!isNew) {
      setCookie(res, sessionId!);
    }

    next();
  };
}
