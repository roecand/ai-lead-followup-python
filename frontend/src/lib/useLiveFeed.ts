import { useEffect, useRef, useState } from "react";
import type { Message } from "../components/ConversationsPage";
import { WS_BASE } from "./client";

/** What /ws sends today. Add event types here as the backend grows. */
export type LiveEvent = { type: "new_message"; lead_id: string; message: Message };

/**
 * One websocket to /ws with reconnect. Returns whether it's connected, which
 * the header shows as Live / Offline.
 *
 * Reconnects with backoff (1s, 2s, 4s ... capped at 15s). Stops if the server
 * closes with 4401, since that means the session is gone and retrying won't help.
 */
export function useLiveFeed(onEvent: (event: LiveEvent) => void): boolean {
  const [live, setLive] = useState(false);
  const handler = useRef(onEvent);

  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(`${WS_BASE}/ws`);
      ws.onopen = () => {
        attempt = 0;
        setLive(true);
      };
      ws.onclose = (e) => {
        setLive(false);
        if (closed || e.code === 4401) return;
        retry = setTimeout(connect, Math.min(15_000, 1000 * 2 ** attempt++));
      };
      ws.onmessage = (e) => {
        try {
          handler.current(JSON.parse(e.data) as LiveEvent);
        } catch {
          /* ignore anything that isn't JSON */
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  return live;
}
