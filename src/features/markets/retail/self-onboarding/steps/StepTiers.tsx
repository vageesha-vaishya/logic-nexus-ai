/**
 * Step 5 — Tier sliders. Computes defaults from quiz risk_tag + goal
 * horizons, then lets the user adjust. On Continue writes three rows to
 * markets.portfolio_tiers with target_amount in ₹ derived from the
 * default budget (₹1,00,000 paper capital). The user can re-balance ₹
 * amounts later from the dedicated tier-config screen.
 */
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { useUpsertPortfolioTier, usePortfolioTiers } from '../../hooks/usePortfolioTiers';
import { useRiskProfile } from '../../hooks/useRiskProfile';
import { TIER_DEFAULTS } from '../../types';

import { TierSliders } from '../TierSliders';
import {
  DEFAULT_BUDGET,
  computeDefaultTiers,
  toRupees,
  type TierTriple,
} from '../tiers';
import { useOnboardingDraft } from '../useOnboardingState';
import { StepShell } from './StepShell';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function StepTiers({ onNext, onBack }: Props) {
  const { data: profile } = useRiskProfile();
  const { data: tiersDb } = usePortfolioTiers();
  const upsert            = useUpsertPortfolioTier();
  const { draft, merge, clearKeys } = useOnboardingDraft();

  // Pull existing tier % from DB if present. portfolio_tiers stores target_amount
  // in ₹ — we infer % from each row's share of the total. Falls back to draft,
  // then computed defaults from risk_tag + goals.
  const seed = useMemo<TierTriple>(() => {
    if (draft.tier_targets) {
      const arr = [
        draft.tier_targets[1] ?? 0,
        draft.tier_targets[2] ?? 0,
        draft.tier_targets[3] ?? 0,
      ] as TierTriple;
      const sum = arr[0] + arr[1] + arr[2];
      if (sum > 0) return arr;
    }
    if (tiersDb && tiersDb.length === 3) {
      const amts = [1, 2, 3].map((n) =>
        tiersDb.find((t) => t.tier_number === n)?.target_amount ?? 0,
      );
      const total = amts.reduce((s, n) => s + n, 0);
      if (total > 0) {
        return [
          Math.round((amts[0] / total) * 100),
          Math.round((amts[1] / total) * 100),
          Math.round((amts[2] / total) * 100),
        ] as TierTriple;
      }
    }
    return computeDefaultTiers(profile?.risk_tag, profile?.goals ?? []);
  }, [draft.tier_targets, tiersDb, profile?.risk_tag, profile?.goals]);

  const [tiers, setTiers] = useState<TierTriple>(seed);

  const handleChange = (next: TierTriple) => {
    setTiers(next);
    merge({ tier_targets: { 1: next[0], 2: next[1], 3: next[2] } });
  };

  const handleContinue = async () => {
    const rupees = toRupees(tiers, DEFAULT_BUDGET);
    try {
      for (let i = 0; i < TIER_DEFAULTS.length; i++) {
        const def = TIER_DEFAULTS[i];
        await upsert.mutateAsync({
          tier_number:   def.tier_number,
          name:          def.name,
          portfolio_id:  null,
          target_amount: rupees[i],
        });
      }
      clearKeys(['tier_targets']);
      onNext();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Try again.';
      toast.error(`Could not save: ${detail}`);
    }
  };

  return (
    <StepShell
      title="Your three buckets"
      description="Sthira splits your money into Safety Net, Core, and Experimental. We've picked a starting mix — adjust if you'd like."
      saving={upsert.isPending}
      onPrimary={handleContinue}
      onBack={onBack}
    >
      <TierSliders value={tiers} onChange={handleChange} />
    </StepShell>
  );
}
