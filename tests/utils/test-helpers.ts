/**
 * Test Utilities for bunWay
 *
 * Shared utilities for unit, integration, and acceptance tests.
 * Inspired by Express, NestJS, and Elysia testing patterns.
 */

// ============================================
// Constants
// ============================================

export const TEST_BASE_URL = "http://localhost:3000";
export const TEST_ORIGIN = "http://localhost:8080";

// ============================================
// Request Factories
// ============================================

/**
 * Create a Request object for testing
 */
export function createRequest(
  path: string,
  options: RequestInit = {},
  baseUrl: string = TEST_BASE_URL
): Request {
  const url = new URL(path, baseUrl).toString();
  return new Request(url, options);
}

/**
 * Shorthand for GET request
 */
export const req = (path: string, options?: RequestInit) =>
  createRequest(path, { method: "GET", ...options });

/**
 * Shorthand for POST request with JSON body
 */
export const post = (
  path: string,
  body?: Record<string, unknown> | string,
  options?: RequestInit
) =>
  createRequest(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...options,
  });

/**
 * Shorthand for PUT request with JSON body
 */
export const put = (
  path: string,
  body?: Record<string, unknown> | string,
  options?: RequestInit
) =>
  createRequest(path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...options,
  });

/**
 * Shorthand for PATCH request with JSON body
 */
export const patch = (
  path: string,
  body?: Record<string, unknown> | string,
  options?: RequestInit
) =>
  createRequest(path, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...options,
  });

/**
 * Shorthand for DELETE request
 */
export const del = (path: string, options?: RequestInit) =>
  createRequest(path, { method: "DELETE", ...options });

/**
 * Create form-urlencoded request
 */
export const form = (
  path: string,
  data: Record<string, string>,
  method: string = "POST"
) =>
  createRequest(path, {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data).toString(),
  });

// ============================================
// Response Helpers
// ============================================

/**
 * Extract JSON from response
 */
export async function json<T = unknown>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/**
 * Extract text from response
 */
export async function text(response: Response): Promise<string> {
  return response.text();
}

/**
 * Extract cookie from response
 */
export function getCookie(response: Response, name?: string): string | null {
  const setCookie = response.headers.get("Set-Cookie");
  if (!setCookie) return null;

  if (!name) {
    // Return first cookie value
    return setCookie.split(";")[0];
  }

  // Find specific cookie
  const cookies = setCookie.split(",").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie.split(";")[0];
    }
  }
  return null;
}

/**
 * Parse all cookies from response
 */
export function parseCookies(
  response: Response
): Record<string, string> {
  const setCookie = response.headers.get("Set-Cookie");
  if (!setCookie) return {};

  const cookies: Record<string, string> = {};
  const parts = setCookie.split(",").map((c) => c.trim());

  for (const part of parts) {
    const [nameValue] = part.split(";");
    const [name, value] = nameValue.split("=");
    if (name && value) {
      cookies[name.trim()] = value.trim();
    }
  }

  return cookies;
}

// ============================================
// Async Utilities
// ============================================

/**
 * Delay execution
 */
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 50
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await delay(interval);
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

// ============================================
// WebSocket Utilities (from Elysia pattern)
// ============================================

/**
 * Wait for WebSocket to open
 */
export const wsOpen = (ws: WebSocket): Promise<Event> =>
  new Promise((resolve) => {
    ws.onopen = resolve;
  });

/**
 * Wait for WebSocket message
 */
export const wsMessage = (ws: WebSocket): Promise<MessageEvent> =>
  new Promise((resolve) => {
    ws.onmessage = resolve;
  });

/**
 * Wait for WebSocket to close
 */
export const wsClose = (ws: WebSocket): Promise<CloseEvent> =>
  new Promise((resolve) => {
    ws.onclose = resolve;
  });

/**
 * Close WebSocket and wait for it to complete
 */
export const wsClosed = async (ws: WebSocket): Promise<CloseEvent> => {
  const closed = wsClose(ws);
  ws.close();
  return closed;
};

/**
 * Create WebSocket connection to test server
 */
export const newWebSocket = (
  server: { hostname: string; port: number },
  path: string = "/ws"
): WebSocket => {
  return new WebSocket(`ws://${server.hostname}:${server.port}${path}`);
};

// ============================================
// Test Order Tracking (from Elysia pattern)
// ============================================

/**
 * Create an order tracker for verifying execution order
 */
export function createOrderTracker(): {
  track: (label: string) => void;
  order: string[];
  reset: () => void;
} {
  const order: string[] = [];
  return {
    track: (label: string) => order.push(label),
    order,
    reset: () => {
      order.length = 0;
    },
  };
}

// ============================================
// Mock Factories (for unit tests)
// ============================================

/**
 * Create a minimal mock request object for unit testing
 */
export function createMockRequest(
  method: string = "GET",
  url: string = "http://localhost/",
  headers: Record<string, string> = {}
): {
  method: string;
  url: URL;
  headers: Headers;
} {
  return {
    method,
    url: new URL(url),
    headers: new Headers(headers),
  };
}

/**
 * Create a minimal mock response object for unit testing
 */
export function createMockResponse(): {
  statusCode: number;
  headers: Headers;
  body: unknown;
  ended: boolean;
  status: (code: number) => void;
  set: (name: string, value: string) => void;
  json: (data: unknown) => void;
  send: (data: unknown) => void;
  end: () => void;
} {
  const res = {
    statusCode: 200,
    headers: new Headers(),
    body: null as unknown,
    ended: false,
    status(code: number) {
      res.statusCode = code;
    },
    set(name: string, value: string) {
      res.headers.set(name, value);
    },
    json(data: unknown) {
      res.body = data;
      res.ended = true;
    },
    send(data: unknown) {
      res.body = data;
      res.ended = true;
    },
    end() {
      res.ended = true;
    },
  };
  return res;
}

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert response status code
 */
export function expectStatus(response: Response, status: number): void {
  if (response.status !== status) {
    throw new Error(
      `Expected status ${status}, got ${response.status}`
    );
  }
}

/**
 * Assert response header
 */
export function expectHeader(
  response: Response,
  name: string,
  value: string | RegExp
): void {
  const actual = response.headers.get(name);
  if (typeof value === "string") {
    if (actual !== value) {
      throw new Error(
        `Expected header ${name}="${value}", got "${actual}"`
      );
    }
  } else {
    if (!actual || !value.test(actual)) {
      throw new Error(
        `Expected header ${name} to match ${value}, got "${actual}"`
      );
    }
  }
}

/**
 * Assert response does not have header
 */
export function expectNoHeader(response: Response, name: string): void {
  const actual = response.headers.get(name);
  if (actual !== null) {
    throw new Error(
      `Expected no header ${name}, but found "${actual}"`
    );
  }
}

// ============================================
// Server Lifecycle Helpers
// ============================================

import type { Server } from "bun";

/**
 * Track servers for cleanup after tests
 */
const activeServers: Server[] = [];

/**
 * Register a server for cleanup
 */
export function registerServer(server: Server): Server {
  activeServers.push(server);
  return server;
}

/**
 * Stop all registered servers
 */
export function stopAllServers(): void {
  for (const server of activeServers) {
    try {
      server.stop();
    } catch {
      // Ignore errors during cleanup
    }
  }
  activeServers.length = 0;
}
