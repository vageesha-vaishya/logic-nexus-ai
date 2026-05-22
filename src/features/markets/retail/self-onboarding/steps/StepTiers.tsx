/**
 * Step 5 — Tier sliders. Placeholder: writes a default 3-tier layout so
 * the wizard frame can advance. Task #45 replaces the inputs with the
 * percentage sliders that sum to 100%.
 */
import { toast } from 'sonner';

import { useUpsertPortfolioTier } from '../../hooks/usePortfolioTiers';
import { TIER_DEFAULTS } from '../../types';
import { StepShell } from './StepShell';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function StepTiers({ onNext, onBack }: Props) {
  const upsert = useUpsertPortfolioTier();

  const handleContinue = async () => {
    try {
      for (const t of TIER_DEFAULTS) {
        await upsert.mutateAsync({
          tier_number:   t.tier_number,
          name:          t.name,
          portfolio_id:  null,
          target_amount: null,
        });
      }
      onNext();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Try again.';
      toast.error(`Could not save: ${detail}`);
    }
  };

  return (
    <StepShell
      title="Your three buckets"
      description="Sthira splits your money into Safety Net, Core Portfolio, and Experimental. Percentage sliders land in task #45."
      saving={upsert.isPending}
      onPrimary={handleContinue}
      onBack={onBack}
    >
      <div className="space-y-2">
        {TIER_DEFAULTS.map((t) => (
          <div key={t.tier_number} className="rounded-md border p-3">
            <p className="font-medium text-sm">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </div>
        ))}
      </div>
    </StepShell>
  );
}
