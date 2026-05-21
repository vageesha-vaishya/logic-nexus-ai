/**
 * MobileShell — Sthira mobile app chrome (PR 1).
 *
 * Provides:
 *   - Cream background, safe-area-aware viewport
 *   - Bottom tab bar (Home, Markets, Goals, You) with copper active state
 *   - Floating Trade FAB slot (Markets tab only, gated by props)
 *
 * Does NOT yet wire screens or auth. PR 2 inserts the onboarding flow,
 * PR 3 inserts the Home tab content, PR 4 wires the Trade FAB action.
 *
 * Brand reference:
 *   docs/plans/2026-05-20-sthira-mobile-onboarding-and-markets-ux-design.md
 */
import { Home, LineChart, Target, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export type SthiraTabKey = "home" | "markets" | "goals" | "you";

export interface MobileShellProps {
  /** Page body — fills the area above the tab bar. */
  children: React.ReactNode;
  /** Currently active tab. If omitted, derived from `useLocation()`. */
  activeTab?: SthiraTabKey;
  /** Render the Trade FAB above the bottom bar. Defaults to false. */
  showTradeFab?: boolean;
  /** Called when the Trade FAB is tapped. PR 4 wires this to biometric + sheet. */
  onTradePress?: () => void;
}

interface TabDef {
  key:   SthiraTabKey;
  label: string;
  href:  string;
  icon:  typeof Home;
}

const TABS: readonly TabDef[] = [
  { key: "home",    label: "Home",    href: "/dashboard/markets/retail/home", icon: Home },
  { key: "markets", label: "Markets", href: "/dashboard/markets/signals",     icon: LineChart },
  { key: "goals",   label: "Goals",   href: "/dashboard/markets/retail/home", icon: Target },
  { key: "you",     label: "You",     href: "/dashboard/settings/profile",    icon: User },
] as const;

function deriveActiveTab(pathname: string): SthiraTabKey {
  if (pathname.includes("/markets/signals") || pathname.includes("/markets/settings/brokers")) return "markets";
  if (pathname.includes("/settings/profile") || pathname.includes("/settings/notifications")) return "you";
  if (pathname.includes("/markets/retail")) return "home";
  return "home";
}

export function MobileShell({
  children,
  activeTab,
  showTradeFab = false,
  onTradePress,
}: MobileShellProps) {
  const location = useLocation();
  const active = activeTab ?? deriveActiveTab(location.pathname);

  return (
    <div
      className="
        relative min-h-screen w-full
        bg-sthira-cream text-sthira-ink font-sthiraSans
        flex flex-col
      "
      data-sthira-shell
    >
      {/* Page body. Bottom padding clears the tab bar + FAB. */}
      <main className="flex-1 pb-20 pt-[env(safe-area-inset-top)]">
        {children}
      </main>

      {/* Trade FAB — appears 16dp above tab bar, copper. */}
      {showTradeFab && (
        <button
          type="button"
          onClick={onTradePress}
          aria-label="Place a trade"
          className="
            fixed right-4 z-30
            h-14 w-14 rounded-full
            bg-sthira-copper text-sthira-cream
            shadow-lg shadow-sthira-navy/20
            flex items-center justify-center
            font-sthiraSerif text-2xl leading-none
            active:translate-y-px transition-transform
          "
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.5rem + 1rem)" }}
        >
          ₹
        </button>
      )}

      {/* Bottom tab bar. Cream background, copper active state, no shadow. */}
      <nav
        className="
          fixed bottom-0 inset-x-0 z-20
          bg-sthira-cream border-t border-sthira-navy/10
          pt-1 pb-[env(safe-area-inset-bottom)]
        "
        aria-label="Primary navigation"
      >
        <ul className="grid grid-cols-4">
          {TABS.map(({ key, label, href, icon: Icon }) => {
            const isActive = key === active;
            return (
              <li key={key} className="flex">
                <Link
                  to={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-0.5 py-2",
                    "transition-colors",
                    isActive
                      ? "text-sthira-copper"
                      : "text-sthira-navy/50 hover:text-sthira-navy/80",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[11px] leading-none font-medium">{label}</span>
                  {/* Quiet 3px copper dot below active label — no underline / pill */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-[3px] w-[3px] rounded-full",
                      isActive ? "bg-sthira-copper" : "bg-transparent",
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
