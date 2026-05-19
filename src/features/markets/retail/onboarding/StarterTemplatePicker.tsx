import { useState } from "react";
import { Sparkles, Check, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  applyTemplateToBudget,
  useStarterTemplates,
  type PortfolioTemplate,
} from "../hooks/useStarterTemplates";

export interface StarterTemplatePickerProps {
  /**
   * Called with the per-tier target amounts derived from the chosen template
   * and budget. The host wires this into its `onChange(tierNumber, 'target_amount', value)`
   * pattern to populate the 3 tier inputs in one shot.
   */
  onApply: (
    allocations: Array<{ tier_number: 1 | 2 | 3; target_amount: number }>,
    template: PortfolioTemplate,
  ) => void;
}

const formatINR = (n: number): string =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * Onboarding helper: "Not sure where to start? Pick a template."
 *
 * Renders the three seeded templates as side-by-side cards. The user enters
 * a total budget once; clicking a template card splits that budget across
 * tiers per the template's weights and bubbles the result to the host
 * (TierSetup) via `onApply`. The host pre-fills the per-tier target_amount
 * inputs and the user can still tweak any of them after.
 *
 * Collapsed by default — the CTA "Not sure? Use a starter template" expands
 * the picker to keep the onboarding wizard's primary path uncluttered.
 */
export function StarterTemplatePicker({ onApply }: StarterTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [budgetRaw, setBudgetRaw] = useState("");
  const [appliedSlug, setAppliedSlug] = useState<string | null>(null);

  const { data: templates = [], isLoading, isError } = useStarterTemplates();
  const budget = Number(budgetRaw);
  const budgetValid = Number.isFinite(budget) && budget > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 p-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Not sure where to start? Use a starter template
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            Starter templates
          </p>
          <p className="text-xs text-muted-foreground">
            Enter a total budget, then pick a template. We&apos;ll split the
            amount across the three tiers — you can still tweak any number after.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label="Hide starter templates"
        >
          Hide
        </button>
      </div>

      <div className="space-y-1">
        <Label htmlFor="starter-budget" className="text-xs">
          Total to invest (₹)
        </Label>
        <Input
          id="starter-budget"
          type="number"
          inputMode="numeric"
          min={0}
          className="h-8 text-xs"
          placeholder="e.g. 500000"
          value={budgetRaw}
          onChange={(e) => {
            setBudgetRaw(e.target.value.trim());
            setAppliedSlug(null);
          }}
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading templates…
        </div>
      )}
      {isError && (
        <p className="text-xs text-destructive">
          Couldn&apos;t load starter templates. You can still set targets manually below.
        </p>
      )}

      {templates.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {templates.map((t) => {
            const active = appliedSlug === t.slug;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!budgetValid}
                onClick={() => {
                  const allocations = applyTemplateToBudget(t, budget);
                  setAppliedSlug(t.slug);
                  onApply(allocations, t);
                }}
                className={cn(
                  "flex flex-col gap-1.5 rounded-md border bg-card p-3 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary ring-1 ring-primary"
                    : "hover:border-foreground/30",
                  !budgetValid && "cursor-not-allowed opacity-60",
                )}
                aria-pressed={active}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold">{t.display_name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div className="flex gap-1">
                  {t.tier_allocations.map((a) => (
                    <Badge
                      key={a.tier_number}
                      variant="outline"
                      className="px-1.5 py-0 text-[10px] tabular-nums"
                    >
                      {a.weight_pct}%
                    </Badge>
                  ))}
                </div>
                {budgetValid && (
                  <ul className="space-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                    {applyTemplateToBudget(t, budget).map((alloc) => (
                      <li key={alloc.tier_number} className="flex justify-between">
                        <span>T{alloc.tier_number}</span>
                        <span>{formatINR(alloc.target_amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {t.description.split(".").slice(0, 1).join(".")}.
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
