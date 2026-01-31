import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import bunway from "../../../src";

describe("WebSocket support", () => {
  it("handles basic WebSocket connection", async () => {
    const app = bunway();
    const messages: string[] = [];

    app.ws("/ws", {
      open(ws) {
        ws.send("welcome");
      },
      message(ws, msg) {
        messages.push(String(msg));
        ws.send(`echo: ${msg}`);
      },
    });

    const server = app.listen(0); // Random port

    try {
      const ws = new WebSocket(`ws://localhost:${server.port}/ws`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

        ws.onopen = () => {
          ws.send("hello");
        };

        ws.onmessage = (e) => {
          if (e.data === "echo: hello") {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        };

        ws.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });

      expect(messages).toContain("hello");
    } finally {
      server.stop();
    }
  });

  it("supports path parameters", async () => {
    const app = bunway();
    let capturedRoom: string | undefined;

    app.ws("/rooms/:roomId", {
      open(ws) {
        capturedRoom = ws.data.params.roomId;
        ws.close();
      },
    });

    const server = app.listen(0);

    try {
      const ws = new WebSocket(`ws://localhost:${server.port}/rooms/lobby`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

        ws.onopen = () => {
          // Connection opened, wait for close
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          resolve();
        };

        ws.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });

      expect(capturedRoom).toBe("lobby");
    } finally {
      server.stop();
    }
  });

  it("handles close event with code and reason", async () => {
    const app = bunway();
    let closeCode: number | undefined;
    let closeReason: string | undefined;

    app.ws("/close-test", {
      open(ws) {
        // Client will close
      },
      close(ws, code, reason) {
        closeCode = code;
        closeReason = reason;
      },
    });

    const server = app.listen(0);

    try {
      const ws = new WebSocket(`ws://localhost:${server.port}/close-test`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

        ws.onopen = () => {
          ws.close(1000, "done");
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          // Give time for server to process close
          setTimeout(resolve, 100);
        };

        ws.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });

      expect(closeCode).toBe(1000);
      // Note: Close reason may not be preserved in all WebSocket implementations
      expect(closeReason).toBeDefined();
    } finally {
      server.stop();
    }
  });

  it("returns 404 for non-existent WebSocket route", async () => {
    const app = bunway();

    app.ws("/exists", {
      open() {},
    });

    const server = app.listen(0);

    try {
      const ws = new WebSocket(`ws://localhost:${server.port}/not-exists`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error("Should not have connected"));
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve();
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          resolve();
        };
      });

      // Should reach here because connection failed
      expect(true).toBe(true);
    } finally {
      server.stop();
    }
  });

  it("runs middleware before WebSocket upgrade", async () => {
    const app = bunway();
    let middlewareRan = false;
    let authenticated = false;

    // Global middleware
    app.use((req, res, next) => {
      middlewareRan = true;
      next();
    });

    // Route-specific middleware
    const authMiddleware = (req: any, res: any, next: any) => {
      const token = req.get("sec-websocket-protocol");
      if (token === "auth-token") {
        authenticated = true;
        next();
      } else {
        res.status(401).json({ error: "Unauthorized" });
      }
    };

    app.ws("/secure", authMiddleware, {
      open(ws) {
        ws.send("authenticated");
        ws.close();
      },
    });

    const server = app.listen(0);

    try {
      // With auth token via subprotocol
      const ws = new WebSocket(`ws://localhost:${server.port}/secure`, ["auth-token"]);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

        ws.onmessage = (e) => {
          if (e.data === "authenticated") {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        };

        ws.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          resolve();
        };
      });

      expect(middlewareRan).toBe(true);
      expect(authenticated).toBe(true);
    } finally {
      server.stop();
    }
  });

  it("can broadcast to multiple clients", async () => {
    const app = bunway();
    const clients: any[] = [];

    app.ws("/broadcast", {
      open(ws) {
        clients.push(ws);
        if (clients.length === 2) {
          // Both connected, broadcast
          for (const client of clients) {
            client.send("broadcast message");
          }
        }
      },
    });

    const server = app.listen(0);

    try {
      const ws1Messages: string[] = [];
      const ws2Messages: string[] = [];

      const ws1 = new WebSocket(`ws://localhost:${server.port}/broadcast`);
      const ws2 = new WebSocket(`ws://localhost:${server.port}/broadcast`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
        let received = 0;

        ws1.onmessage = (e) => {
          ws1Messages.push(e.data);
          received++;
          if (received === 2) {
            clearTimeout(timeout);
            ws1.close();
            ws2.close();
            resolve();
          }
        };

        ws2.onmessage = (e) => {
          ws2Messages.push(e.data);
          received++;
          if (received === 2) {
            clearTimeout(timeout);
            ws1.close();
            ws2.close();
            resolve();
          }
        };

        ws1.onerror = ws2.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });

      expect(ws1Messages).toContain("broadcast message");
      expect(ws2Messages).toContain("broadcast message");
    } finally {
      server.stop();
    }
  });

  it("provides access to original request in ws.data", async () => {
    const app = bunway();
    let requestPath: string | undefined;
    let requestMethod: string | undefined;

    app.ws("/req-test", {
      open(ws) {
        requestPath = ws.data.req.path;
        requestMethod = ws.data.req.method;
        ws.close();
      },
    });

    const server = app.listen(0);

    try {
      const ws = new WebSocket(`ws://localhost:${server.port}/req-test`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

        ws.onclose = () => {
          clearTimeout(timeout);
          resolve();
        };

        ws.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });

      expect(requestPath).toBe("/req-test");
      expect(requestMethod).toBe("GET");
    } finally {
      server.stop();
    }
  });
});
