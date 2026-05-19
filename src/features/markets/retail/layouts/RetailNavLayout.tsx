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
}

export const RETAIL_TABS: ReadonlyArray<RetailTab> = [
  { to: "/dashboard/markets/retail/home",      label: "Home",      Icon: Home },
  { to: "/dashboard/markets/retail/portfolio", label: "Portfolio", Icon: Wallet },
  { to: "/dashboard/markets/retail/signals",   label: "Signals",   Icon: Zap },
  { to: "/dashboard/markets/retail/goals",     label: "Goals",     Icon: Target },
  { to: "/dashboard/markets/retail/more",      label: "More",      Icon: MoreHorizontal },
];

function TabLink({ tab, vertical }: { tab: RetailTab; vertical: boolean }) {
  const { to, label, Icon } = tab;
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
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
}

export function RetailNavLayout() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] md:flex-row flex-col">
      {/* Desktop: vertical sidebar to the left, fixed-width. */}
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
