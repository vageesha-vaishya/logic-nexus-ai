/**
 * Step 8 — Summary + finish.
 *
 * Read-only recap card showing what the user set up in steps 2–7. On
 * "Take me home" we mark risk_profiles.onboarding_complete = true,
 * clear the localStorage draft, and the wizard's caller navigates to
 * the retail home (where the first-Home tour from task #46 fires).
 *
 * Pulls live data from the same hooks the rest of the wizard writes to —
 * no prop-drilled wizard state — so the recap stays accurate even if the
 * user navigated back-and-forth between steps.
 */
import { toast } from 'sonner';

import { GOALS, TIER_DEFAULTS } from '../../types';
import { usePortfolioTiers } from '../../hooks/usePortfolioTiers';
import { useRiskProfile, useUpsertRiskProfile } from '../../hooks/useRiskProfile';
import { useRetailProfile } from '../useRetailProfile';
import { useOnboardingDraft } from '../useOnboardingState';
import { StepShell } from './StepShell';

interface Props {
  onFinish: () => void;
  onBack:   () => void;
}

const goalLabel = (id: string) =>
  GOALS.find((g) => g.id === id)?.label ?? id.replace(/_/g, ' ');

const tierLabel = (n: 1 | 2 | 3) =>
  TIER_DEFAULTS.find((t) => t.tier_number === n)?.name ?? `Tier ${n}`;

const inr = (n: number | null | undefined): string =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-IN', {
        style:                'currency',
        currency:             'INR',
        maximumFractionDigits: 0,
      }).format(n);

export function StepSummary({ onFinish, onBack }: Props) {
  const { data: profile }       = useRiskProfile();
  const { data: tiers }         = usePortfolioTiers();
  const { data: retailProfile } = useRetailProfile();
  const upsert                  = useUpsertRiskProfile();
  const { clearAll }            = useOnboardingDraft();

  const handleFinish = async () => {
    if (!profile) {
      toast.error('Profile not ready yet — try again in a moment.');
      return;
    }
    try {
      await upsert.mutateAsync({
        experience_level:    profile.experience_level,
        risk_tag:            profile.risk_tag,
        goals:               profile.goals,
        quiz_answers:        profile.quiz_answers,
        behavioral_flags:    profile.behavioral_flags,
        onboarding_complete: true,
      });
      clearAll();
      toast.success("You're all set — welcome to Sthira.");
      onFinish();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Try again.';
      toast.error(`Could not finish: ${detail}`);
    }
  };

  const nomineeNode = retailProfile?.nominee;
  const nomineeText =
    !nomineeNode
      ? '—'
      : nomineeNode.skipped
        ? 'Skipped (you can add one later)'
        : `${nomineeNode.name ?? '—'} (${nomineeNode.relationship ?? '—'})`;

  return (
    <StepShell
      title="Ready to start"
      description="Here's what we set up. You can change any of this later from Settings."
      primaryLabel="Take me home"
      saving={upsert.isPending}
      onPrimary={handleFinish}
      onBack={onBack}
    >
      <dl className="divide-y rounded-md border text-sm">
        <Row label="Risk profile">
          <span className="capitalize">{profile?.risk_tag ?? '—'}</span>
        </Row>

        <Row label="Goals">
          {profile?.goals && profile.goals.length > 0 ? (
            <ul className="space-y-1">
              {profile.goals.map((g) => (
                <li key={g.goal}>
                  {goalLabel(g.goal)} — {g.years} yr{g.years === 1 ? '' : 's'}
                  {g.target_amount ? ` · ${inr(g.target_amount)}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Row>

        <Row label="Buckets">
          {tiers && tiers.length > 0 ? (
            <ul className="space-y-1">
              {tiers.map((t) => (
                <li key={t.tier_number}>
                  {tierLabel(t.tier_number)}
                  {t.target_amount ? ` — target ${inr(t.target_amount)}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Row>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(profile as any)?.starter_template_slug && (
          <Row label="Starter template">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <span className="capitalize">{(profile as any).starter_template_slug}</span>
          </Row>
        )}

        <Row label="Nominee">
          <span>{nomineeText}</span>
        </Row>

        <Row label="Starting capital">
          {/* The provision edge function seeds every paper portfolio with
              ₹1,00,000 / 30% NIFTY 50 ETF — surface that here so the user
              knows what they'll see on Home. */}
          <span>{inr(100000)} paper cash · 30% NIFTY 50 ETF</span>
        </Row>
      </dl>
    </StepShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 p-3">
      <dt className="text-xs text-muted-foreground self-start pt-0.5">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
