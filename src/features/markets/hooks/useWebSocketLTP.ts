/**
 * Real-time LTP via WebSocket, with automatic polling fallback.
 *
 * Connects to ws://<host>/v1/ws/ltp, subscribes to the given symbols,
 * and streams tick updates every ~2 s.  If the WebSocket is unavailable
 * (or fails / disconnects), the hook transparently falls back to the
 * existing useLTP polling hook so the UI always has data.
 */

import { useEffect, useRef, useState } from "react";
import { useLTP, type LTPQuote } from "./useLTP";

const WS_URL = (import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001")
  .replace(/^http/, "ws") + "/v1/ws/ltp";

export interface UseWebSocketLTPResult {
  data: Record<string, LTPQuote>;
  connected: boolean;
  isWebSocket: boolean;
}

export function useWebSocketLTP(
  symbols: string[],
  exchange = "NSE",
): UseWebSocketLTPResult {
  const [quotes, setQuotes] = useState<Record<string, LTPQuote>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  // Stable key for dependency arrays
  const symbolsKey = [...symbols].sort().join(",");

  // Fallback polling — enabled only when WS is not connected
  const pollFallback = useLTP(connected ? [] : symbols, exchange);

  useEffect(() => {
    if (symbols.length === 0) return;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ action: "subscribe", symbols, exchange }));
      };

      ws.onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data as string) as {
            type: string;
            data?: Record<string, LTPQuote>;
          };
          if (msg.type === "tick" && msg.data) {
            setQuotes((prev) => ({ ...prev, ...msg.data }));
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 3 s
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, exchange]);

  // Re-subscribe when symbols change while already connected
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && symbols.length > 0) {
      wsRef.current.send(
        JSON.stringify({ action: "subscribe", symbols, exchange }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, exchange]);

  // Merge WS data with polling fallback
  const data = connected ? quotes : (pollFallback.data ?? {});
  return { data, connected, isWebSocket: connected };
}
