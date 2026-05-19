import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  LogOut,
  Settings,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";

import { GLOSSARY, lookupTerm, Term } from "../glossary";

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
  const { signOut } = useAuth();
  const [showGlossary, setShowGlossary] = useState(false);

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
        <Row
          Icon={Settings}
          label="Settings"
          hint="Profile, notifications, broker connections"
          to="/dashboard/settings"
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
          Icon={BookOpen}
          label={showGlossary ? "Hide glossary" : "Glossary"}
          hint={`${entries.length} terms — tap a word in the app to see its definition`}
          onClick={() => setShowGlossary((v) => !v)}
        />
        <Row
          Icon={LogOut}
          label="Log out"
          hint="End this session"
          onClick={() => {
            void signOut();
          }}
        />
      </div>

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
