/**
 * Step 6 — Starter template confirmation.
 *
 * Renders the three seeded templates as full cards (Conservative /
 * Balanced / Growth). Pre-selects the one matching the user's quiz
 * risk_tag and tier mix (suggestedTemplateSlug from ./tiers.ts) and
 * tags it "Recommended". The user can pick any of the three before
 * continuing.
 *
 * On Continue we write risk_profiles.starter_template_slug. The actual
 * portfolio seeding has already happened in the post-signup edge function
 * (30/70 NIFTY ETF / cash) — this step captures intent for later
 * tier-config tooling and signal-feed personalisation.
 */
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { useRiskProfile } from '../../hooks/useRiskProfile';
import { usePortfolioTiers } from '../../hooks/usePortfolioTiers';
import { useStarterTemplates } from '../../hooks/useStarterTemplates';
import { marketsKeys } from '../../../hooks/queryKeys';

import { StarterTemplateCards } from '../StarterTemplateCards';
import { suggestedTemplateSlug, type TierTriple } from '../tiers';
import { useOnboardingDraft } from '../useOnboardingState';
import { StepShell } from './StepShell';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function StepStarter({ onNext, onBack }: Props) {
  const { user }                = useAuth();
  const { data: profile }       = useRiskProfile();
  const { data: tiers }         = usePortfolioTiers();
  const { data: templates = [], isLoading, isError } = useStarterTemplates();
  const qc                      = useQueryClient();
  const { draft }               = useOnboardingDraft();
  const [saving, setSaving]     = useState(false);

  const recommendedSlug = useMemo(() => {
    if (draft.tier_targets) {
      return suggestedTemplateSlug([
        draft.tier_targets[1] ?? 0,
        draft.tier_targets[2] ?? 0,
        draft.tier_targets[3] ?? 0,
      ] as TierTriple);
    }
    if (tiers && tiers.length === 3) {
      const amts = [1, 2, 3].map((n) =>
        tiers.find((t) => t.tier_number === n)?.target_amount ?? 0,
      );
      const total = amts.reduce((s, n) => s + n, 0);
      if (total > 0) {
        return suggestedTemplateSlug([
          Math.round((amts[0] / total) * 100),
          Math.round((amts[1] / total) * 100),
          Math.round((amts[2] / total) * 100),
        ] as TierTriple);
      }
    }
    return templates.find((t) => t.risk_tag === profile?.risk_tag)?.slug ?? null;
  }, [draft.tier_targets, tiers, templates, profile?.risk_tag]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingSlug = (profile as any)?.starter_template_slug as string | null | undefined;
  const [selected, setSelected] = useState<string | null>(
    existingSlug ?? draft.starter_slug ?? recommendedSlug,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || templates.length === 0) {
    return (
      <StepShell
        title="Pick a starting template"
        description="We couldn't load the starter templates. You can continue without one and set this later from Settings."
        onPrimary={onNext}
        onBack={onBack}
      >
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          Template list unavailable.
        </div>
      </StepShell>
    );
  }

  const handleContinue = async () => {
    if (!user?.id || !selected) {
      toast.error('Pick a template to continue.');
      return;
    }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .schema('markets')
        .from('risk_profiles')
        .update({ starter_template_slug: selected })
        .eq('user_id', user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: marketsKeys.retail.profile() });
      onNext();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Try again.';
      toast.error(`Could not save: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepShell
      title="Pick a starting template"
      description="We've matched a template to your risk profile and goals. Pick a different one if you'd rather — you can change this from Settings any time."
      canAdvance={Boolean(selected)}
      saving={saving}
      onPrimary={handleContinue}
      onBack={onBack}
    >
      <StarterTemplateCards
        templates={templates}
        selectedSlug={selected}
        recommendedSlug={recommendedSlug}
        onSelect={setSelected}
      />
    </StepShell>
  );
}
