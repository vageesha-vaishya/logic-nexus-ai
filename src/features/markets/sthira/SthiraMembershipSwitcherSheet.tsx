/**
 * SthiraMembershipSwitcherSheet — bottom-sheet that lists every
 * membership the signed-in user holds and switches active membership
 * on tap. Mirrors the topbar `MembershipSwitcher` in DashboardLayout,
 * which is unreachable from inside the Sthira shell because
 * RetailAudienceGuard redirects every /dashboard/* URL back to retail-
 * home when the active membership is the SOS-RETAIL one.
 *
 * Without this sheet, a user who switches into Sthira is trapped —
 * every menu option redirects to Retail Home, and the membership
 * switcher (the platform abstraction for changing roles) sits behind
 * DashboardLayout chrome they can't reach.
 *
 * Reuses useMemberships().switchTo which already does the hard reload
 * to /dashboard so RLS-scoped queries refetch under the new context.
 */
import { useMemo } from "react";
import { Check, Loader2, X, Users } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/design-system";
import { SheetDescription } from "@/components/ui/sheet";

import { useMemberships } from "@/hooks/useMemberships";

export interface SthiraMembershipSwitcherSheetProps {
  open:    boolean;
  onClose: () => void;
}

export function SthiraMembershipSwitcherSheet({
  open, onClose,
}: SthiraMembershipSwitcherSheetProps) {
  const { memberships, activeMembership, isLoading, isSwitching, switchTo } =
    useMemberships();

  // Sort active first, then everything else alphabetically by label.
  const sorted = useMemo(() => {
    const list = [...memberships];
    list.sort((a, b) => {
      if (a.id === activeMembership?.id) return -1;
      if (b.id === activeMembership?.id) return 1;
      return a.display_label.localeCompare(b.display_label);
    });
    return list;
  }, [memberships, activeMembership?.id]);

  async function handleSwitch(membershipId: string) {
    try {
      await switchTo(membershipId);
      // switchTo triggers a window.location.assign('/dashboard') — the
      // page is unmounting; toast is a courtesy in case navigation lags.
      toast.success("Switching account…");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to switch account");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-xl"
      >
        <SheetHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <SheetTitle>Switch account</SheetTitle>
            <SheetDescription className="text-xs">
              You hold more than one membership. Tap one to switch — the
              page will reload under the new context.
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-accent shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {isLoading && (
            <p className="text-xs text-muted-foreground">Loading memberships…</p>
          )}

          {!isLoading && memberships.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No memberships found.
            </p>
          )}

          {sorted.map((m) => {
            const isActive = m.id === activeMembership?.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => !isActive && !isSwitching && handleSwitch(m.id)}
                disabled={isActive || isSwitching}
                className={
                  "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors " +
                  (isActive
                    ? "border-primary/40 bg-primary/5 cursor-default"
                    : "hover:bg-accent")
                }
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
                {isActive ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                ) : isSwitching ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
