/**
 * Network status hook + offline guard (Phase 1 Addendum T24d).
 *
 * Uses @capacitor/network on Android and the browser's `navigator.onLine`
 * + `online` / `offline` events on web. The Capacitor plugin also works
 * on web but the browser APIs are zero-dep and ship sooner; the plugin
 * is the source of truth on native.
 *
 * Mutations are NOT queued when offline (addendum forbids it). Call
 * `requireOnline()` from any mutationFn that touches the network — it
 * throws a friendly Error that bubbles up to the existing error UI.
 */
import { useEffect, useState } from "react";

import { Capacitor } from "@capacitor/core";

export type ConnectionType = "wifi" | "cellular" | "none" | "unknown";

export interface NetworkStatus {
  connected:      boolean;
  connectionType: ConnectionType;
}

const isWeb = (): boolean => Capacitor.getPlatform() === "web";

function initialStatus(): NetworkStatus {
  if (typeof navigator === "undefined") {
    // SSR / jsdom without navigator.onLine fallback — assume online.
    return { connected: true, connectionType: "unknown" };
  }
  return {
    connected:      navigator.onLine,
    connectionType: navigator.onLine ? "unknown" : "none",
  };
}

/**
 * Live network status. Subscribes to platform events on mount and
 * unsubscribes on unmount. The initial render uses navigator.onLine as
 * a best-guess; the first real plugin event will overwrite within ms.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(initialStatus);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    if (isWeb()) {
      // Native browser events.
      const onOnline = () =>
        !cancelled && setStatus({ connected: true,  connectionType: "unknown" });
      const onOffline = () =>
        !cancelled && setStatus({ connected: false, connectionType: "none" });
      window.addEventListener("online",  onOnline);
      window.addEventListener("offline", onOffline);
      cleanup = () => {
        window.removeEventListener("online",  onOnline);
        window.removeEventListener("offline", onOffline);
      };
    } else {
      // Dynamic import so the web bundle stays slim.
      void (async () => {
        try {
          const { Network } = await import("@capacitor/network");
          if (cancelled) return;
          const current = await Network.getStatus();
          if (!cancelled) {
            setStatus({
              connected:      current.connected,
              connectionType: (current.connectionType as ConnectionType) ?? "unknown",
            });
          }
          const handle = await Network.addListener("networkStatusChange", (s) => {
            if (cancelled) return;
            setStatus({
              connected:      s.connected,
              connectionType: (s.connectionType as ConnectionType) ?? "unknown",
            });
          });
          cleanup = () => void handle.remove();
        } catch {
          /* plugin missing — leave initial status in place */
        }
      })();
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return status;
}

/**
 * Throw if the device is currently offline. Call at the top of any
 * mutationFn that hits the network. Address bar shows a clear error
 * rather than a hung spinner.
 */
export function requireOnline(): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("You're offline. Reconnect to continue.");
  }
}
