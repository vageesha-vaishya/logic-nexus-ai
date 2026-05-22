/**
 * StarterTemplateCards — full-page card stack for step 6.
 *
 * Different from the legacy collapsed helper in
 * src/features/markets/retail/onboarding/StarterTemplatePicker.tsx — that
 * one was a "not sure?" affordance tucked inside TierSetup. Here the
 * template choice is its own dedicated screen, so the picker is the
 * primary content: large cards, recommended badge, tier-mix preview.
 */
import { Check, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PortfolioTemplate } from '../hooks/useStarterTemplates';

import { TIER_LABELS } from './tiers';

interface Props {
  templates:        readonly PortfolioTemplate[];
  selectedSlug:     string | null;
  recommendedSlug:  string | null;
  onSelect:         (slug: string) => void;
}

export function StarterTemplateCards({
  templates,
  selectedSlug,
  recommendedSlug,
  onSelect,
}: Props) {
  return (
    <div className="space-y-3">
      {templates.map((t) => {
        const isSelected    = selectedSlug    === t.slug;
        const isRecommended = recommendedSlug === t.slug;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.slug)}
            aria-pressed={isSelected}
            className={cn(
              'w-full rounded-lg border bg-card p-4 text-left transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected
                ? 'border-primary ring-1 ring-primary'
                : 'hover:border-foreground/30',
            )}
          >
            <header className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold">{t.display_name}</p>
                  {isRecommended && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Sparkles className="h-3 w-3" />
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {t.description}
                </p>
              </div>
              {isSelected && <Check className="h-5 w-5 text-primary shrink-0" />}
            </header>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              {t.tier_allocations
                .slice()
                .sort((a, b) => a.tier_number - b.tier_number)
                .map((a) => (
                  <div
                    key={a.tier_number}
                    className="rounded-md bg-muted/40 p-2 space-y-0.5"
                  >
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {TIER_LABELS[(a.tier_number - 1) as 0 | 1 | 2]}
                    </dt>
                    <dd className="text-sm font-medium tabular-nums">{a.weight_pct}%</dd>
                    <dd className="text-[11px] text-muted-foreground leading-tight">
                      {a.focus}
                    </dd>
                  </div>
                ))}
            </dl>
          </button>
        );
      })}
    </div>
  );
}
