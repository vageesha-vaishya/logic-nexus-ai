import { WifiOff } from "lucide-react";

import { useNetworkStatus } from "@/lib/network";

/**
 * Thin banner shown at the top of the retail layout when the device is
 * offline. We deliberately keep it tiny — it sits between the bottom nav
 * and the content so it doesn't push the layout. Mutations are blocked
 * elsewhere (see `requireOnline()`), this is just the cue.
 */
export function OfflineBanner() {
  const { connected } = useNetworkStatus();
  if (connected) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-1.5 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      Offline — viewing your last saved snapshot. Trades disabled until you reconnect.
    </div>
  );
}
