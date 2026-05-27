/**
 * AuthChooseAccount — login-time membership chooser at /auth/choose-account.
 *
 * Reached automatically via RootRedirect when a signed-in user has
 * ≥2 memberships AND no explicit row in public.user_active_membership
 * (i.e. they've never told us which org to land in). After they pick,
 * switchTo writes the row and triggers a hard reload to "/" so RLS-
 * scoped queries refetch under the new context — RootRedirect then
 * proceeds to /dashboard (or wherever the active membership routes).
 *
 * The in-app SthiraMembershipSwitcherSheet (More tab) handles the
 * AFTER-login switch case; this page handles the FIRST-login decision.
 *
 * Design: docs/plans/2026-05-27-google-microsoft-auth-design.md §4
 */
import { useMemo } from "react";
import { Loader2, Users } from "lucide-react";

import { useMemberships } from "@/hooks/useMemberships";

export default function AuthChooseAccount() {
  const { memberships, hasExplicitActive, isLoading, isSwitching, switchTo } =
    useMemberships();

  // Defensive: if the user lands here directly somehow and they already
  // have an explicit active or only one membership, the page is a no-op —
  // RootRedirect should have handled this, but a stale tab could land
  // here. We just render a "redirecting…" state; on next render
  // RootRedirect picks them up.
  const shouldBeHere = !isLoading && memberships.length >= 2 && !hasExplicitActive;

  const sortedMemberships = useMemo(() => {
    // Show roles in a stable order: platform_admin first, then tenant
    // admins, franchise admins, regular users. Inside each band,
    // alphabetical by display label.
    const roleRank: Record<string, number> = {
      platform_admin: 0,
      tenant_admin:   1,
      franchise_admin:2,
      user:           3,
    };
    return [...memberships].sort((a, b) => {
      const ra = roleRank[a.role] ?? 99;
      const rb = roleRank[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.display_label.localeCompare(b.display_label);
    });
  }, [memberships]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center space-y-2">
          <Users className="h-10 w-10 mx-auto text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold">Choose your account</h1>
          <p className="text-sm text-muted-foreground">
            You hold {memberships.length} memberships. Pick one to continue.
            You can switch any time from your account menu.
          </p>
        </header>

        {!shouldBeHere && (
          <p className="text-xs text-center text-muted-foreground">
            Redirecting…
          </p>
        )}

        {shouldBeHere && (
          <ul className="space-y-2" aria-label="Memberships">
            {sortedMemberships.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => switchTo(m.id)}
                  disabled={isSwitching}
                  className="flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-wait"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">
                      {m.display_label}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {m.role.replace(/_/g, " ")}
                      {m.franchise_code && <> · {m.franchise_code}</>}
                    </span>
                  </span>
                  {isSwitching && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
