---
title: WebSockets
description: Real-time communication with WebSockets in bunWay, built on Bun's native WebSocket support.
---

# WebSockets

bunWay provides native WebSocket support built directly on Bun's WebSocket primitives. Define WebSocket routes alongside HTTP routes with the same familiar API.

## Quick Start

```ts
import { bunway } from 'bunway';

const app = bunway();

app.ws('/chat', {
  open(ws) {
    console.log('Client connected');
    ws.send('Welcome to the chat!');
  },
  message(ws, message) {
    console.log('Received:', message);
    ws.send(`Echo: ${message}`);
  },
  close(ws, code, reason) {
    console.log('Client disconnected:', code, reason);
  }
});

app.listen(3000);
```

## WebSocket Handlers

Define handlers for WebSocket lifecycle events:

```ts
interface WebSocketHandlers {
  open?: (ws: BunWebSocket) => void;
  message?: (ws: BunWebSocket, message: string | Buffer) => void;
  close?: (ws: BunWebSocket, code: number, reason: string) => void;
  drain?: (ws: BunWebSocket) => void;
}
```

| Handler | Description |
|---------|-------------|
| `open` | Called when a client connects |
| `message` | Called when a message is received |
| `close` | Called when the connection closes |
| `drain` | Called when the socket is ready for more data after backpressure |

## Route Parameters

WebSocket routes support the same parameter syntax as HTTP routes:

```ts
app.ws('/room/:roomId', {
  open(ws) {
    const roomId = ws.data.params.roomId;
    console.log(`Client joined room: ${roomId}`);
  },
  message(ws, message) {
    const roomId = ws.data.params.roomId;
    // Broadcast to room...
  }
});
```

## Middleware Support

Apply middleware before the WebSocket upgrade:

```ts
import { bunway, session, rateLimit } from 'bunway';

const app = bunway();

app.use(session({ secret: 'my-secret' }));

// Middleware runs before upgrade
const authMiddleware = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.ws('/protected', authMiddleware, {
  open(ws) {
    // User is authenticated
    console.log('Authenticated user connected');
  },
  message(ws, message) {
    // Handle message
  }
});

app.listen(3000);
```

## WebSocket Data

Each WebSocket connection has associated data accessible via `ws.data`:

```ts
interface WebSocketData {
  routePath: string;              // The matched route path
  params: Record<string, string>; // Route parameters
  handlers: WebSocketHandlers;    // The handlers for this route
  req: BunRequest;                // The original upgrade request
}
```

Access the original request to get session data, headers, etc.:

```ts
app.ws('/user', {
  open(ws) {
    // Access the original request
    const userId = ws.data.req.session?.userId;
    const userAgent = ws.data.req.get('user-agent');
  }
});
```

## BunWebSocket API

`BunWebSocket` wraps Bun's `ServerWebSocket` with your route data:

```ts
// Send a message
ws.send('Hello');
ws.send(Buffer.from([0x01, 0x02]));

// Send JSON
ws.send(JSON.stringify({ type: 'message', text: 'Hello' }));

// Close the connection
ws.close(1000, 'Normal closure');

// Check if ready for more data
if (ws.readyState === 1) {
  ws.send('Ready!');
}

// Get buffered amount
console.log(ws.bufferedAmount);
```

## Examples

### Chat Room

```ts
const rooms = new Map<string, Set<BunWebSocket>>();

app.ws('/chat/:room', {
  open(ws) {
    const room = ws.data.params.room;

    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    rooms.get(room)!.add(ws);

    // Notify others
    broadcast(room, `User joined`, ws);
  },

  message(ws, message) {
    const room = ws.data.params.room;
    broadcast(room, message.toString(), ws);
  },

  close(ws) {
    const room = ws.data.params.room;
    rooms.get(room)?.delete(ws);
    broadcast(room, `User left`);
  }
});

function broadcast(room: string, message: string, exclude?: BunWebSocket) {
  for (const client of rooms.get(room) || []) {
    if (client !== exclude) {
      client.send(message);
    }
  }
}
```

### Real-time Notifications

```ts
const userConnections = new Map<string, BunWebSocket>();

app.ws('/notifications', authMiddleware, {
  open(ws) {
    const userId = ws.data.req.session.userId;
    userConnections.set(userId, ws);
  },

  close(ws) {
    const userId = ws.data.req.session.userId;
    userConnections.delete(userId);
  }
});

// Send notification from anywhere
function notifyUser(userId: string, notification: object) {
  const ws = userConnections.get(userId);
  if (ws) {
    ws.send(JSON.stringify(notification));
  }
}

// Use in HTTP routes
app.post('/api/order', async (req, res) => {
  const order = await createOrder(req.body);
  notifyUser(req.session.userId, {
    type: 'order_created',
    orderId: order.id
  });
  res.json(order);
});
```

### Heartbeat / Keep-alive

```ts
app.ws('/stream', {
  open(ws) {
    // Send ping every 30 seconds
    const interval = setInterval(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(interval);
      }
    }, 30000);

    // Store interval for cleanup
    (ws as any).pingInterval = interval;
  },

  message(ws, message) {
    const data = JSON.parse(message.toString());
    if (data.type === 'pong') {
      // Client is alive
      return;
    }
    // Handle other messages
  },

  close(ws) {
    clearInterval((ws as any).pingInterval);
  }
});
```

## Type Exports

Import WebSocket types for TypeScript:

```ts
import type {
  WebSocketData,
  WebSocketHandlers,
  WebSocketRouteDefinition,
  BunWebSocket
} from 'bunway';
```

## Debugging

Use `printRoutes()` to see all registered routes including WebSocket routes:

```ts
app.get('/', (req, res) => res.text('Hello'));
app.ws('/chat', { message(ws, m) { ws.send(m); } });

app.printRoutes();
// Output:
// GET     /
// WS      /chat
```

## Client-side Connection

Connect from the browser:

```js
const ws = new WebSocket('ws://localhost:3000/chat/general');

ws.onopen = () => {
  console.log('Connected');
  ws.send('Hello!');
};

ws.onmessage = (event) => {
  console.log('Received:', event.data);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code, event.reason);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```
