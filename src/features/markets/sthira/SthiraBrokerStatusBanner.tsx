/**
 * SthiraBrokerStatusBanner — shown on Home when ≥1 broker connection needs
 * attention (status = 'error' | 'expired').
 *
 * Productizes the daily-refresh approach (option A). Groww's session ends
 * each day; if the user forgot to tap Approve on groww.in/trade-api/api-keys,
 * the 06:30 IST refresh fails and the connection flips to 'error'. Without
 * a visible signal, the user just sees "Trade FAB missing" and doesn't know
 * why. This banner makes the cause + remedy obvious in one tap.
 *
 * Behaviour:
 *   - Hidden when all brokers are 'active'.
 *   - Per-broker call-to-action:
 *       - Groww → opens https://groww.in/trade-api/api-keys in the device's
 *         external browser (Capacitor Browser plugin on native, window.open
 *         fallback on web preview).
 *       - Others → in-app deep link to /dashboard/markets/settings/brokers.
 *   - Plain copper accent (no destructive red — error is recoverable in
 *     30 seconds, not a crisis).
 *
 * See docs/plans/2026-05-20-sthira-mobile-onboarding-and-markets-ux-design.md
 * §"Connect Wealth → Daily approval reminder".
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";

import { useBrokerConnections } from "@/features/markets/hooks/useBrokerConnections";

const GROWW_APPROVE_URL = "https://groww.in/trade-api/api-keys";

async function openExternal(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    } catch {
      // Plugin not available — fall back to window.open
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function SthiraBrokerStatusBanner() {
  const { data } = useBrokerConnections();

  const needsAttention = useMemo(
    () =>
      (data ?? []).filter(
        (c) => c.status === "error" || c.status === "expired",
      ),
    [data],
  );

  if (needsAttention.length === 0) return null;

  // Highlight Groww specifically because its daily-approval cycle is the
  // most common cause and the remedy is a Groww-side action.
  const grownConn = needsAttention.find((c) => c.broker === "groww");
  const otherConn = needsAttention.find((c) => c.broker !== "groww");

  return (
    <div
      role="alert"
      className="rounded-lg border border-sthira-copper/40 bg-sthira-copper/10 px-4 py-3 flex items-start gap-3"
    >
      <AlertTriangle
        className="h-4 w-4 mt-0.5 shrink-0 text-sthira-copper"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        {grownConn && (
          <>
            <p className="text-sm font-medium text-sthira-ink">
              Groww needs your approval
            </p>
            <p className="text-xs text-sthira-fog mt-0.5">
              Tap Approve on Groww for today's session, then come back to
              place orders.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openExternal(GROWW_APPROVE_URL)}
              className="mt-2 border-sthira-copper text-sthira-copper hover:bg-sthira-copper/10 gap-1.5"
            >
              Re-approve on Groww
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </>
        )}
        {!grownConn && otherConn && (
          <>
            <p className="text-sm font-medium text-sthira-ink">
              {otherConn.display_name} needs reconnecting
            </p>
            <p className="text-xs text-sthira-fog mt-0.5">
              The connection expired — reconnect from Broker Accounts.
            </p>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="mt-2 border-sthira-copper text-sthira-copper hover:bg-sthira-copper/10"
            >
              <Link to="/dashboard/markets/settings/brokers">
                Reconnect
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
