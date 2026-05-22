/**
 * Step 6 — Starter template confirmation. Placeholder picks a template
 * derived from risk_tag; task #45 builds the full picker.
 */
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

import { useRiskProfile } from '../../hooks/useRiskProfile';
import { marketsKeys } from '../../../hooks/queryKeys';
import { StepShell } from './StepShell';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

function defaultTemplateForRiskTag(tag?: string): string {
  if (tag === 'conservative') return 'conservative';
  if (tag === 'aggressive')   return 'growth';
  return 'balanced';
}

export function StepStarter({ onNext, onBack }: Props) {
  const { data: profile } = useRiskProfile();
  const { user } = useAuth();
  const qc = useQueryClient();
  const slug = defaultTemplateForRiskTag(profile?.risk_tag);

  const handleContinue = async () => {
    if (!user?.id) {
      toast.error('Not authenticated.');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .schema('markets')
        .from('risk_profiles')
        .update({ starter_template_slug: slug })
        .eq('user_id', user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: marketsKeys.retail.profile() });
      onNext();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Try again.';
      toast.error(`Could not save: ${detail}`);
    }
  };

  return (
    <StepShell
      title="Pick a starting template"
      description="Based on your risk profile we'll suggest a default mix. Full picker UI lands in task #45."
      onPrimary={handleContinue}
      onBack={onBack}
    >
      <div className="rounded-md border p-3">
        <p className="font-medium text-sm capitalize">{slug}</p>
        <p className="text-xs text-muted-foreground">
          Matched to your risk tag ({profile?.risk_tag ?? 'unknown'}).
        </p>
      </div>
    </StepShell>
  );
}
