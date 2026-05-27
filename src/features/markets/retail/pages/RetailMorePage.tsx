import { useState } from "react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import {
  Bug,
  BookOpen,
  ChevronRight,
  LogOut,
  Palette,
  Plug,
  TrendingDown,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useMemberships } from "@/hooks/useMemberships";
import { SthiraMembershipSwitcherSheet } from "@/features/markets/sthira/SthiraMembershipSwitcherSheet";
import { ThemePickerSheet } from "@/features/markets/sthira/ThemePickerSheet";
import { getSthiraThemeMeta } from "@/features/markets/sthira/themes";
import { useSthiraTheme } from "@/features/markets/sthira/useSthiraTheme";

import { GLOSSARY, lookupTerm, Term } from "../glossary";

// Configurable destination for closed-beta bug reports. Falls back to
// the operator's personal address so the feature works in dev even when
// the env isn't wired.
const BUG_REPORT_EMAIL =
  import.meta.env.VITE_BUG_REPORT_EMAIL || "bahuguna.vimal@gmail.com";

function openBugReport(user: { id?: string; email?: string | null } | null) {
  const platform = Capacitor.getPlatform();
  const native   = Capacitor.isNativePlatform();
  const ts       = new Date().toISOString();
  const ua       = typeof navigator !== "undefined" ? navigator.userAgent : "n/a";
  const subject  = "Sthira bug report";
  const body = [
    "What happened (please describe):",
    "",
    "",
    "",
    "—— diagnostic info (auto-filled, please leave intact) ——",
    `When:      ${ts}`,
    `Platform:  ${platform}${native ? " (native)" : " (web)"}`,
    `User:      ${user?.email ?? "unknown"} (${user?.id ?? "no-id"})`,
    `User-Agent: ${ua}`,
  ].join("\n");
  const href =
    `mailto:${encodeURIComponent(BUG_REPORT_EMAIL)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
  if (typeof window !== "undefined") {
    window.location.href = href;
  }
}

interface RowProps {
  Icon: LucideIcon;
  label: string;
  hint: string;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
}

function Row({ Icon, label, hint, to, onClick, disabled }: RowProps) {
  const content = (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </div>
  );

  const className =
    "block rounded-md border bg-card p-3 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:hover:bg-card disabled:cursor-not-allowed";

  if (to && !disabled) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left ${className}`}
    >
      {content}
    </button>
  );
}

/**
 * More tab — settings, withdraw, stress test entry, glossary, logout. Most
 * items are stubs flagged "coming soon" until the corresponding Addendum task
 * lands; the glossary preview is live today since T13 shipped.
 */
export default function RetailMorePage() {
  const { signOut, user } = useAuth();
  const [showGlossary, setShowGlossary] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { theme } = useSthiraTheme();
  const themeMeta = getSthiraThemeMeta(theme);
  const { memberships } = useMemberships();
  // Only surface the switcher when the user actually holds ≥2 memberships.
  // Retail-only users with a single membership get no extra noise.
  const hasMultipleMemberships = memberships.length >= 2;

  const entries = Object.values(GLOSSARY);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <header>
        <h2 className="text-lg font-semibold">More</h2>
        <p className="text-xs text-muted-foreground">
          Settings, withdraw, stress test, and references.
        </p>
      </header>

      <div className="space-y-2">
        {/* Settings row removed in v1: it linked to /dashboard/settings
            which renders the CRM DashboardLayout sidebar — brand bleed for
            retail users. A retail-specific settings page can replace this
            row when account-management UI is needed (profile edit, password
            change, etc.). Broker connections + theme are reachable directly
            from this More tab; sign-out is the LogOut row below. */}
        <Row
          Icon={Plug}
          label="Broker accounts"
          hint="Connect or manage your trading accounts"
          to="/dashboard/markets/settings/brokers"
        />
        <Row
          Icon={Wallet}
          label="Withdraw"
          hint="Settlement timeline, exit loads, tax impact"
          to="/dashboard/markets/retail/withdraw"
        />
        <Row
          Icon={TrendingDown}
          label="Stress test"
          hint="Coming soon — how your portfolio held in 2008 / 2020 / 2022"
          disabled
        />
        <Row
          Icon={Palette}
          label="Appearance"
          hint={`Theme — ${themeMeta.name}`}
          onClick={() => setThemePickerOpen(true)}
        />
        <Row
          Icon={BookOpen}
          label={showGlossary ? "Hide glossary" : "Glossary"}
          hint={`${entries.length} terms — tap a word in the app to see its definition`}
          onClick={() => setShowGlossary((v) => !v)}
        />
        <Row
          Icon={Bug}
          label="Report an issue"
          hint="Open your email app with diagnostic info pre-filled"
          onClick={() => openBugReport(user ? { id: user.id, email: user.email } : null)}
        />
        {hasMultipleMemberships && (
          <Row
            Icon={Users}
            label="Switch account"
            hint={`You hold ${memberships.length} memberships — tap to switch`}
            onClick={() => setSwitcherOpen(true)}
          />
        )}
        <Row
          Icon={LogOut}
          label="Log out"
          hint="End this session"
          onClick={() => {
            void signOut();
          }}
        />
      </div>

      <SthiraMembershipSwitcherSheet
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
      />

      <ThemePickerSheet open={themePickerOpen} onOpenChange={setThemePickerOpen} />

      {showGlossary && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Tap any underlined word in signal cards, portfolio cards, and alerts
            to see its definition inline.
          </p>
          <ul className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
            {Array.from(
              new Set(entries.map((e) => e.title)),
            ).map((title) => {
              // Reverse-lookup a key whose entry matches this title so <Term>
              // can render with a popover. Keys are case-insensitive aliases
              // (e.g. "pe" and "p/e ratio" both map to the same title) so we
              // pick the first key that resolves.
              const matchKey = Object.keys(GLOSSARY).find(
                (k) => lookupTerm(k)?.title === title,
              );
              return (
                <li key={title}>
                  <Term word={matchKey ?? title}>{title}</Term>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
