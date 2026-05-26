import * as React from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Home,
  Target,
  Wallet,
  Zap,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { AppStatusBanner } from "./AppStatusBanner";
import { OfflineBanner } from "./OfflineBanner";

/**
 * 5-tab IA for retail mode (Phase 1 Addendum, §7b).
 *
 * On viewports <768px the nav is fixed to the bottom (thumb-reach + Capacitor-
 * friendly). At md+ it sits as a thin vertical rail on the left so desktop
 * users don't lose vertical real estate. NavLink handles active state from
 * the URL — each tab keeps its own scroll position via React Router's per-
 * route state, with `<Outlet />` rendering the active page.
 *
 * The tab registry is exported so route definitions and tests share one
 * source of truth.
 */

export interface RetailTab {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** Tour anchor id — referenced by tour/HomeTour.tsx. */
  tourId?: string;
}

export const RETAIL_TABS: ReadonlyArray<RetailTab> = [
  { to: "/dashboard/markets/retail/home",      label: "Home",      Icon: Home },
  { to: "/dashboard/markets/retail/portfolio", label: "Portfolio", Icon: Wallet },
  { to: "/dashboard/markets/retail/signals",   label: "Signals",   Icon: Zap,             tourId: "tab-signals" },
  { to: "/dashboard/markets/retail/goals",     label: "Goals",     Icon: Target },
  { to: "/dashboard/markets/retail/more",      label: "More",      Icon: MoreHorizontal,  tourId: "tab-more" },
];

function TabLink({ tab, vertical }: { tab: RetailTab; vertical: boolean }) {
  const { to, label, Icon, tourId } = tab;
  return (
    <NavLink
      to={to}
      end={false}
      className={({ isActive }) =>
        cn(
          "flex items-center justify-center gap-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          vertical
            ? "h-12 w-full flex-col gap-0.5"
            : "h-14 flex-1 flex-col gap-0.5",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
        )
      }
      aria-label={label}
      data-tour-id={tourId}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
}

/**
 * Standalone bottom-nav (mobile) + side-rail (desktop) renderer.
 *
 * Pulled out of RetailNavLayout so retail-eligible pages OUTSIDE the
 * /dashboard/markets/retail/* subtree (broker connections, broker
 * portfolio detail, etc.) can still show the 5-tab nav. Without this,
 * a retail user navigating to /dashboard/markets/settings/brokers
 * lost the bottom nav entirely (DashboardLayout doesn't render one).
 *
 * Pages that use this should also add `pb-20 md:pb-0` to their main
 * content wrapper so the fixed bottom nav doesn't overlap.
 */
export function RetailBottomNav() {
  return (
    <>
      {/* Desktop side-rail */}
      <nav
        aria-label="Retail sections"
        className="hidden md:fixed md:left-0 md:top-16 md:bottom-0 md:flex md:w-20 md:flex-col md:gap-1 md:border-r md:bg-background md:py-3 md:z-30"
      >
        {RETAIL_TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} vertical />
        ))}
      </nav>

      {/* Mobile bottom-nav */}
      <nav
        aria-label="Retail sections"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background shadow-[0_-1px_3px_0_rgba(0,0,0,0.05)] md:hidden"
      >
        {RETAIL_TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} vertical={false} />
        ))}
      </nav>
    </>
  );
}

export function RetailNavLayout() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] md:flex-row flex-col">
      {/* Desktop: vertical sidebar to the left, fixed-width.
          (Inline rather than via RetailBottomNav so its width takes
          part in the flex layout; RetailBottomNav's side-rail is
          position:fixed and used by detached pages.) */}
      <nav
        aria-label="Retail sections"
        className="hidden md:flex md:w-20 md:flex-col md:gap-1 md:border-r md:bg-background md:py-3"
      >
        {RETAIL_TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} vertical />
        ))}
      </nav>

      {/* Page content — leaves bottom space for the mobile nav. */}
      <main className="flex-1 pb-20 md:pb-0">
        {/* Operator status banner first (urgent), then offline (passive). */}
        <AppStatusBanner />
        <OfflineBanner />
        <Outlet />
      </main>

      {/* Mobile: fixed bottom nav. */}
      <nav
        aria-label="Retail sections"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background shadow-[0_-1px_3px_0_rgba(0,0,0,0.05)] md:hidden"
      >
        {RETAIL_TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} vertical={false} />
        ))}
      </nav>
    </div>
  );
}
