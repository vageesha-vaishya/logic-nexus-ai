/**
 * MembershipSwitcher — topbar dropdown that swaps the user's active
 * tenant/franchise/domain context.
 *
 * Slot in the DashboardLayout topbar between the existing scope/admin
 * switchers and the avatar. Hidden when the user only has a single
 * membership (no choice to make).
 *
 * Companion of useMemberships(); see
 * docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Loader2, Plus, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMemberships, type Membership } from "@/hooks/useMemberships";
import { accentForDomain } from "@/components/branding";

function membershipIcon(m: Membership) {
  if (m.is_retail) return TrendingUp;
  return Building2;
}

/**
 * Small 8px accent dot whose color matches the membership's domain — see
 * docs/plans/2026-05-22-platform-brand-architecture-design.md. Retail
 * memberships intentionally have no dot (Sthira is its own visual system).
 */
function DomainDot({ m, size = 8 }: { m: Membership; size?: number }) {
  if (m.is_retail) return null;
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{
        width:      size,
        height:     size,
        background: accentForDomain(m.domain_code),
      }}
    />
  );
}

function roleLabel(role: string): string {
  if (role === "tenant_admin")   return "Owner";
  if (role === "franchise_admin") return "Franchise admin";
  if (role === "platform_admin") return "Platform admin";
  if (role === "user")           return "Member";
  if (role === "viewer")         return "Viewer";
  return role.replace(/_/g, " ");
}

export function MembershipSwitcher() {
  const { memberships, activeMembership, isLoading, isSwitching, switchTo } = useMemberships();
  const [open, setOpen] = useState(false);

  // Don't render anything until we know what we're working with.
  if (isLoading || !activeMembership) return null;

  // Single-membership users have nothing to switch to — show a static
  // label so they still see what context they're in.
  if (memberships.length <= 1) {
    const Icon = membershipIcon(activeMembership);
    return (
      <span className="hidden md:inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground">
        <DomainDot m={activeMembership} />
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="max-w-[18ch] truncate">{activeMembership.display_label}</span>
      </span>
    );
  }

  const ActiveIcon = membershipIcon(activeMembership);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-2 text-sm"
          aria-label="Switch workspace"
          disabled={isSwitching}
        >
          {isSwitching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <DomainDot m={activeMembership} />
              <ActiveIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            </>
          )}
          <span className="hidden lg:inline-block max-w-[20ch] truncate">
            {activeMembership.display_label}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Switch workspace
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {memberships.map((m) => {
          const Icon = membershipIcon(m);
          const isActive = m.id === activeMembership.id;
          return (
            <DropdownMenuItem
              key={m.id}
              onSelect={(e) => {
                e.preventDefault();
                if (!isActive) void switchTo(m.id);
              }}
              className={cn(
                "flex items-start gap-2",
                isActive && "bg-accent/40",
              )}
            >
              <div className="mt-1 flex flex-col items-center gap-1">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <DomainDot m={m} size={6} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.display_label}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {roleLabel(m.role)}
                  {m.domain_name && !m.is_retail ? ` · ${m.domain_name}` : ""}
                </p>
              </div>
              {isActive && <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/signup" className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Register another organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
