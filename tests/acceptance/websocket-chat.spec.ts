/**
 * WebSocket Chat Acceptance Tests
 *
 * End-to-end tests for WebSocket chat room scenarios.
 * Tests multi-user chat, broadcasting, room isolation.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import bunway from "../../src";
import type { BunRequest, BunResponse } from "../../src";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../../src";

interface ChatMessage {
  type: "join" | "leave" | "message" | "broadcast" | "error" | "users";
  from?: string;
  content?: string;
  users?: string[];
  timestamp: number;
}

interface ChatUser {
  username: string;
  roomId: string;
}

// Store for room state - reset between tests
let rooms: Map<string, Map<ServerWebSocket<WebSocketData>, ChatUser>>;

function createChatApp() {
  const app = bunway();

  // HTTP endpoint to list rooms and users
  app.get("/rooms", (req: BunRequest, res: BunResponse) => {
    const roomData: Record<string, string[]> = {};
    for (const [roomId, users] of rooms) {
      roomData[roomId] = Array.from(users.values()).map((u) => u.username);
    }
    res.json({ rooms: roomData });
  });

  app.get("/rooms/:roomId/users", (req: BunRequest, res: BunResponse) => {
    const roomId = req.params.roomId;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const users = Array.from(room.values()).map((u) => u.username);
    res.json({ roomId, users, count: users.length });
  });

  // WebSocket chat endpoint
  app.ws("/chat/:roomId", {
    open(ws) {
      const roomId = ws.data.params.roomId;
      const username = ws.data.req.query.get("username") || "anonymous";

      // Get or create room
      let room = rooms.get(roomId);
      if (!room) {
        room = new Map();
        rooms.set(roomId, room);
      }

      // Store user data on the ws
      const user: ChatUser = { username, roomId };
      room.set(ws, user);

      // Notify user of successful join
      ws.send(
        JSON.stringify({
          type: "join",
          content: `Welcome to room ${roomId}!`,
          users: Array.from(room.values()).map((u) => u.username),
          timestamp: Date.now(),
        })
      );

      // Broadcast join to others in room
      for (const [client, clientUser] of room) {
        if (client !== ws) {
          client.send(
            JSON.stringify({
              type: "join",
              from: username,
              content: `${username} joined the room`,
              timestamp: Date.now(),
            })
          );
        }
      }
    },

    message(ws, message) {
      const roomId = ws.data.params.roomId;
      const room = rooms.get(roomId);
      if (!room) return;

      const user = room.get(ws);
      if (!user) return;

      const username = user.username;

      try {
        const data = JSON.parse(message.toString());

        switch (data.type) {
          case "message":
            // Broadcast message to all in room
            for (const [client] of room) {
              client.send(
                JSON.stringify({
                  type: "message",
                  from: username,
                  content: data.content,
                  timestamp: Date.now(),
                })
              );
            }
            break;

          case "users":
            // Send current user list
            ws.send(
              JSON.stringify({
                type: "users",
                users: Array.from(room.values()).map((u) => u.username),
                timestamp: Date.now(),
              })
            );
            break;

          case "broadcast":
            // Broadcast to ALL rooms (admin feature)
            for (const [, r] of rooms) {
              for (const [client] of r) {
                client.send(
                  JSON.stringify({
                    type: "broadcast",
                    from: username,
                    content: data.content,
                    timestamp: Date.now(),
                  })
                );
              }
            }
            break;

          default:
            ws.send(
              JSON.stringify({
                type: "error",
                content: `Unknown message type: ${data.type}`,
                timestamp: Date.now(),
              })
            );
        }
      } catch {
        ws.send(
          JSON.stringify({
            type: "error",
            content: "Invalid message format",
            timestamp: Date.now(),
          })
        );
      }
    },

    close(ws) {
      const roomId = ws.data.params.roomId;
      const room = rooms.get(roomId);

      if (room) {
        const user = room.get(ws);
        const username = user?.username || "unknown";

        room.delete(ws);

        // Notify others
        for (const [client] of room) {
          client.send(
            JSON.stringify({
              type: "leave",
              from: username,
              content: `${username} left the room`,
              timestamp: Date.now(),
            })
          );
        }

        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
    },
  });

  return app;
}

// Helper to collect messages from a WebSocket
function createMessageCollector() {
  const messages: ChatMessage[] = [];
  return {
    messages,
    handler: (event: MessageEvent) => {
      messages.push(JSON.parse(event.data));
    },
    waitFor: (predicate: (msg: ChatMessage) => boolean, timeout = 2000) => {
      return new Promise<ChatMessage>((resolve, reject) => {
        const start = Date.now();
        const check = () => {
          const found = messages.find(predicate);
          if (found) {
            resolve(found);
          } else if (Date.now() - start > timeout) {
            reject(new Error(`Timeout waiting for message. Received: ${JSON.stringify(messages)}`));
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      });
    },
    clear: () => {
      messages.length = 0;
    },
  };
}

// Helper to wait for WebSocket open
function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket open timeout")), 5000);
    ws.onopen = () => {
      clearTimeout(timeout);
      resolve();
    };
    ws.onerror = (e) => {
      clearTimeout(timeout);
      reject(e);
    };
  });
}

describe("WebSocket Chat (Acceptance)", () => {
  let server: ReturnType<typeof Bun.serve> | null = null;
  let port: number;

  beforeEach(() => {
    // Reset rooms
    rooms = new Map();
  });

  afterEach(() => {
    if (server) {
      server.stop(true);
      server = null;
    }
  });

  describe("Connection", () => {
    it("should connect to chat room and receive welcome message", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      const ws = new WebSocket(`ws://localhost:${port}/chat/room1?username=alice`);
      const collector = createMessageCollector();
      ws.onmessage = collector.handler;

      await waitForOpen(ws);

      const joinMsg = await collector.waitFor((m) => m.type === "join");
      expect(joinMsg.content).toContain("Welcome");
      expect(joinMsg.users).toContain("alice");

      ws.close();
    });

    it("should notify existing users when new user joins", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      // First user connects
      const ws1 = new WebSocket(`ws://localhost:${port}/chat/room1?username=alice`);
      const collector1 = createMessageCollector();
      ws1.onmessage = collector1.handler;
      await waitForOpen(ws1);
      await collector1.waitFor((m) => m.type === "join");
      collector1.clear();

      // Second user connects
      const ws2 = new WebSocket(`ws://localhost:${port}/chat/room1?username=bob`);
      const collector2 = createMessageCollector();
      ws2.onmessage = collector2.handler;
      await waitForOpen(ws2);

      // Alice should receive notification about Bob
      const notification = await collector1.waitFor((m) => m.type === "join" && m.from === "bob");
      expect(notification.content).toContain("bob joined");

      // Bob should receive welcome
      const welcome = await collector2.waitFor((m) => m.type === "join" && !m.from);
      expect(welcome.users).toContain("alice");
      expect(welcome.users).toContain("bob");

      ws1.close();
      ws2.close();
    });
  });

  describe("Messaging", () => {
    it("should broadcast message to all users in room", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      // Two users join
      const ws1 = new WebSocket(`ws://localhost:${port}/chat/room1?username=alice`);
      const ws2 = new WebSocket(`ws://localhost:${port}/chat/room1?username=bob`);

      const collector1 = createMessageCollector();
      const collector2 = createMessageCollector();
      ws1.onmessage = collector1.handler;
      ws2.onmessage = collector2.handler;

      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      // Wait for initial join messages
      await collector1.waitFor((m) => m.type === "join");
      await collector2.waitFor((m) => m.type === "join");
      collector1.clear();
      collector2.clear();

      // Alice sends a message
      ws1.send(JSON.stringify({ type: "message", content: "Hello everyone!" }));

      // Both should receive it
      const aliceMsg = await collector1.waitFor((m) => m.type === "message");
      const bobMsg = await collector2.waitFor((m) => m.type === "message");

      expect(aliceMsg.from).toBe("alice");
      expect(aliceMsg.content).toBe("Hello everyone!");
      expect(bobMsg.from).toBe("alice");
      expect(bobMsg.content).toBe("Hello everyone!");

      ws1.close();
      ws2.close();
    });

    it("should handle rapid message exchange", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      const ws1 = new WebSocket(`ws://localhost:${port}/chat/room1?username=alice`);
      const ws2 = new WebSocket(`ws://localhost:${port}/chat/room1?username=bob`);

      const collector1 = createMessageCollector();
      const collector2 = createMessageCollector();
      ws1.onmessage = collector1.handler;
      ws2.onmessage = collector2.handler;

      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      // Clear join messages
      await new Promise((r) => setTimeout(r, 100));
      collector1.clear();
      collector2.clear();

      // Send 10 messages rapidly
      for (let i = 0; i < 10; i++) {
        ws1.send(JSON.stringify({ type: "message", content: `Message ${i}` }));
      }

      // Wait a bit for messages to be processed
      await new Promise((r) => setTimeout(r, 200));

      // Both should have received all messages
      const aliceMessages = collector1.messages.filter((m) => m.type === "message");
      const bobMessages = collector2.messages.filter((m) => m.type === "message");

      expect(aliceMessages.length).toBe(10);
      expect(bobMessages.length).toBe(10);

      ws1.close();
      ws2.close();
    });
  });

  describe("Room Isolation", () => {
    it("should isolate messages between different rooms", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      // Users in different rooms
      const ws1 = new WebSocket(`ws://localhost:${port}/chat/room1?username=alice`);
      const ws2 = new WebSocket(`ws://localhost:${port}/chat/room2?username=bob`);

      const collector1 = createMessageCollector();
      const collector2 = createMessageCollector();
      ws1.onmessage = collector1.handler;
      ws2.onmessage = collector2.handler;

      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      await collector1.waitFor((m) => m.type === "join");
      await collector2.waitFor((m) => m.type === "join");
      collector1.clear();
      collector2.clear();

      // Alice sends message in room1
      ws1.send(JSON.stringify({ type: "message", content: "Hello room1!" }));

      // Wait a bit
      await new Promise((r) => setTimeout(r, 100));

      // Alice should get the message
      const aliceMessages = collector1.messages.filter((m) => m.type === "message");
      expect(aliceMessages.length).toBe(1);

      // Bob should NOT get the message (different room)
      const bobMessages = collector2.messages.filter((m) => m.type === "message");
      expect(bobMessages.length).toBe(0);

      ws1.close();
      ws2.close();
    });

    it("should show correct users per room via HTTP API", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      // Two users in room1, one in room2
      const ws1 = new WebSocket(`ws://localhost:${port}/chat/room1?username=alice`);
      const ws2 = new WebSocket(`ws://localhost:${port}/chat/room1?username=bob`);
      const ws3 = new WebSocket(`ws://localhost:${port}/chat/room2?username=charlie`);

      await Promise.all([waitForOpen(ws1), waitForOpen(ws2), waitForOpen(ws3)]);

      // Wait for connections to be registered
      await new Promise((r) => setTimeout(r, 100));

      // Check room1
      const room1Res = await app.handle(
        new Request(`http://localhost:${port}/rooms/room1/users`)
      );
      const room1 = await room1Res.json();
      expect(room1.count).toBe(2);
      expect(room1.users).toContain("alice");
      expect(room1.users).toContain("bob");

      // Check room2
      const room2Res = await app.handle(
        new Request(`http://localhost:${port}/rooms/room2/users`)
      );
      const room2 = await room2Res.json();
      expect(room2.count).toBe(1);
      expect(room2.users).toContain("charlie");

      ws1.close();
      ws2.close();
      ws3.close();
    });
  });

  describe("Disconnection", () => {
    it("should notify room when user disconnects", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      // Connect alice first
      const ws1 = new WebSocket(`ws://localhost:${port}/chat/room1?username=alice`);
      const collector1 = createMessageCollector();
      ws1.onmessage = collector1.handler;
      await waitForOpen(ws1);
      await collector1.waitFor((m) => m.type === "join");
      collector1.clear();

      // Now connect bob
      const ws2 = new WebSocket(`ws://localhost:${port}/chat/room1?username=bob`);
      await waitForOpen(ws2);

      // Wait for alice to receive bob's join notification
      await collector1.waitFor((m) => m.type === "join" && m.from === "bob");
      collector1.clear();

      // Bob disconnects
      ws2.close();

      // Alice should receive leave notification
      const leaveMsg = await collector1.waitFor((m) => m.type === "leave");
      expect(leaveMsg.from).toBe("bob");
      expect(leaveMsg.content).toContain("bob left");

      ws1.close();
    });

    it("should clean up empty rooms", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      const ws = new WebSocket(`ws://localhost:${port}/chat/temproom?username=alice`);
      await waitForOpen(ws);
      await new Promise((r) => setTimeout(r, 50));

      // Room should exist
      const beforeRes = await app.handle(new Request(`http://localhost:${port}/rooms`));
      const before = await beforeRes.json();
      expect(before.rooms.temproom).toBeDefined();

      // Disconnect
      ws.close();
      await new Promise((r) => setTimeout(r, 100));

      // Room should be cleaned up
      const afterRes = await app.handle(new Request(`http://localhost:${port}/rooms`));
      const after = await afterRes.json();
      expect(after.rooms.temproom).toBeUndefined();
    });
  });

  describe("User List", () => {
    it("should return current user list on request", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      const ws1 = new WebSocket(`ws://localhost:${port}/chat/room1?username=alice`);
      const ws2 = new WebSocket(`ws://localhost:${port}/chat/room1?username=bob`);
      const ws3 = new WebSocket(`ws://localhost:${port}/chat/room1?username=charlie`);

      const collector1 = createMessageCollector();
      ws1.onmessage = collector1.handler;

      await Promise.all([waitForOpen(ws1), waitForOpen(ws2), waitForOpen(ws3)]);

      await new Promise((r) => setTimeout(r, 100));
      collector1.clear();

      // Request user list
      ws1.send(JSON.stringify({ type: "users" }));

      const usersMsg = await collector1.waitFor((m) => m.type === "users");
      expect(usersMsg.users).toContain("alice");
      expect(usersMsg.users).toContain("bob");
      expect(usersMsg.users).toContain("charlie");
      expect(usersMsg.users!.length).toBe(3);

      ws1.close();
      ws2.close();
      ws3.close();
    });
  });

  describe("Broadcast", () => {
    it("should broadcast to all rooms", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      // Users in different rooms
      const ws1 = new WebSocket(`ws://localhost:${port}/chat/room1?username=admin`);
      const ws2 = new WebSocket(`ws://localhost:${port}/chat/room2?username=user1`);
      const ws3 = new WebSocket(`ws://localhost:${port}/chat/room3?username=user2`);

      const collector2 = createMessageCollector();
      const collector3 = createMessageCollector();
      ws2.onmessage = collector2.handler;
      ws3.onmessage = collector3.handler;

      await Promise.all([waitForOpen(ws1), waitForOpen(ws2), waitForOpen(ws3)]);

      await collector2.waitFor((m) => m.type === "join");
      await collector3.waitFor((m) => m.type === "join");
      collector2.clear();
      collector3.clear();

      // Admin broadcasts to all
      ws1.send(JSON.stringify({ type: "broadcast", content: "System announcement!" }));

      // Both users in different rooms should receive
      const user1Broadcast = await collector2.waitFor((m) => m.type === "broadcast");
      const user2Broadcast = await collector3.waitFor((m) => m.type === "broadcast");

      expect(user1Broadcast.content).toBe("System announcement!");
      expect(user2Broadcast.content).toBe("System announcement!");

      ws1.close();
      ws2.close();
      ws3.close();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid message format", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      const ws = new WebSocket(`ws://localhost:${port}/chat/room1?username=alice`);
      const collector = createMessageCollector();
      ws.onmessage = collector.handler;

      await waitForOpen(ws);
      await collector.waitFor((m) => m.type === "join");
      collector.clear();

      // Send invalid JSON
      ws.send("not valid json");

      const errorMsg = await collector.waitFor((m) => m.type === "error");
      expect(errorMsg.content).toContain("Invalid message format");

      ws.close();
    });

    it("should handle unknown message type", async () => {
      const app = createChatApp();
      server = app.listen(0);
      port = server.port;

      const ws = new WebSocket(`ws://localhost:${port}/chat/room1?username=alice`);
      const collector = createMessageCollector();
      ws.onmessage = collector.handler;

      await waitForOpen(ws);
      await collector.waitFor((m) => m.type === "join");
      collector.clear();

      // Send unknown type
      ws.send(JSON.stringify({ type: "unknown_type", content: "test" }));

      const errorMsg = await collector.waitFor((m) => m.type === "error");
      expect(errorMsg.content).toContain("Unknown message type");

      ws.close();
    });
  });
});
