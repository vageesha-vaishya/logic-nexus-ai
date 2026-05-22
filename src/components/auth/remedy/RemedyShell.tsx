/**
 * RemedyShell — shared layout for the five MV-4 remedy pages.
 *
 * Each remedy page (SwitchTenant / AddDomain / RequestAccess /
 * Upgrade / NotFound) follows the same pattern: a centered card with
 * an icon, headline, body copy, and one or two CTA buttons. The shell
 * factors the layout out so each remedy stays small and focused.
 *
 * See docs/plans/2026-05-22-module-visibility-and-domain-login-design.md.
 */
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface RemedyShellProps {
  icon:    LucideIcon;
  title:   string;
  body:    string;
  actions?: React.ReactNode;
  /** Override the icon tint. Defaults to a neutral muted-foreground. */
  iconTone?: "primary" | "muted" | "destructive";
  className?: string;
}

export function RemedyShell({
  icon: Icon,
  title,
  body,
  actions,
  iconTone   = "muted",
  className,
}: RemedyShellProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div
          className={cn(
            "mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full",
            iconTone === "primary"     && "bg-primary/10 text-primary",
            iconTone === "destructive" && "bg-destructive/10 text-destructive",
            iconTone === "muted"       && "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-snug">{body}</p>
        {actions && <div className="mt-6 flex flex-col gap-2">{actions}</div>}
      </div>
    </div>
  );
}
