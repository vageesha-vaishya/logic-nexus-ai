/**
 * AudiencePageShell — picks the right outer layout based on the
 * current user's audience.
 *
 *   • Retail-only users get the 5-tab `RetailBottomNav` (mobile bottom
 *     bar + desktop side rail) so they keep their navigation when
 *     visiting routes outside the `/dashboard/markets/retail/*` subtree
 *     (broker connections, broker drill-down, portfolio detail, etc.).
 *   • Everyone else (admin / advisor / multi-domain operator) gets the
 *     standard `DashboardLayout` with the CRM sidebar.
 *
 * Pages that can be reached from BOTH audiences (anything allow-listed
 * in `RetailAudienceGuard`) must use this instead of wrapping in
 * `DashboardLayout` directly. The canonical bug this prevents:
 * tapping More → Broker accounts on the Sthira APK stranded retail
 * users with no in-app navigation back (fixed 2026-05-26, commit
 * `8e542cee` for the broker pages, then again for portfolio detail).
 */
import type { ReactNode } from "react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useIsRetailOnly } from "@/hooks/useIsRetailOnly";

import { RetailBottomNav } from "../retail/layouts/RetailNavLayout";

export interface AudiencePageShellProps {
  children: ReactNode;
}

export function AudiencePageShell({ children }: AudiencePageShellProps) {
  const isRetail = useIsRetailOnly();
  if (isRetail) {
    return (
      <>
        <main className="min-h-screen pb-20 md:pb-0 md:pl-20">{children}</main>
        <RetailBottomNav />
      </>
    );
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}
