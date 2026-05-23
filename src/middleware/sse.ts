import type { Handler } from "../types";

export interface SseOptions {
  heartbeatInterval?: number;
}

export function sse(options: SseOptions = {}): Handler {
  return (req, res, next) => {
    res.set("Content-Type", "text/event-stream");
    res.set("Cache-Control", "no-cache");
    res.set("Connection", "keep-alive");
    res.set("X-Accel-Buffering", "no");

    const heartbeat = options.heartbeatInterval ?? 15_000;
    let timer: ReturnType<typeof setInterval> | null = null;

    const clearHeartbeat = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    if (heartbeat > 0) {
      timer = setInterval(() => res.write(": ping\n\n"), heartbeat);
      if (typeof (timer as { unref?: () => void }).unref === "function") {
        (timer as { unref: () => void }).unref();
      }
    }

    const originalEnd = res.end.bind(res);
    res.end = (chunk, encoding, callback) => {
      clearHeartbeat();
      return originalEnd(chunk, encoding, callback);
    };

    (res as { sendEvent?: (event: string, data: unknown, id?: string) => void }).sendEvent = (
      event,
      data,
      id
    ) => {
      if (id) res.write(`id: ${id}\n`);
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    req.original.signal.addEventListener("abort", () => {
      clearHeartbeat();
      res.end();
    }, { once: true });

    next();
  };
}
