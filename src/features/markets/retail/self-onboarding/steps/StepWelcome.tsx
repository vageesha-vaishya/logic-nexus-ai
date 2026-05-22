/**
 * Step 2 — Welcome + disclosure.
 *
 * Greets the user by first name (falls back to email-local). Presents four
 * acknowledgements derived from the SEBI retail-investor risk-disclosure
 * standard + the platform's paper-mode + broker-deferred posture. All four
 * must be ticked before Continue stamps retail_profile.disclosure_accepted_at.
 *
 * The acknowledgements are intentionally short and plain-language — the
 * audience is layman retail (decision A). The dense SEBI legalese lives in
 * the linked /legal/retail-disclosure page, opened in a new tab.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';

import { StepShell } from './StepShell';
import { useUpsertRetailProfile } from '../useRetailProfile';

interface Props {
  onNext: () => void;
}

interface Ack {
  id:    'market_risk' | 'paper_mode' | 'not_advice' | 'broker_later';
  label: string;
}

const ACKS: readonly Ack[] = [
  {
    id:    'market_risk',
    label: 'I understand investments are subject to market risk and my capital can lose value.',
  },
  {
    id:    'paper_mode',
    label: 'I understand my account starts in paper-trading mode — no real money moves until I connect a broker.',
  },
  {
    id:    'not_advice',
    label: 'I understand Sthira shows signals and education, not personalised investment advice from a SEBI-registered advisor.',
  },
  {
    id:    'broker_later',
    label: 'I can connect a Zerodha or Fyers account later from Settings to start real trades.',
  },
] as const;

function greetingName(profile: ReturnType<typeof useAuth>['profile']): string {
  const first = profile?.first_name?.trim();
  if (first) return first;
  const email = profile?.email ?? '';
  const local = email.split('@')[0] ?? '';
  if (!local) return 'there';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function StepWelcome({ onNext }: Props) {
  const { profile } = useAuth();
  const upsert      = useUpsertRetailProfile();
  const [checked, setChecked] = useState<Record<Ack['id'], boolean>>({
    market_risk:  false,
    paper_mode:   false,
    not_advice:   false,
    broker_later: false,
  });

  const allAcked = ACKS.every((a) => checked[a.id]);

  const handleContinue = async () => {
    try {
      await upsert.mutateAsync({
        disclosure_accepted_at: new Date().toISOString(),
      });
      onNext();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Try again.';
      toast.error(`Could not save: ${detail}`);
    }
  };

  return (
    <StepShell
      title={`Welcome, ${greetingName(profile)}`}
      description="A calm, layman-friendly way to grow your savings. Before we start, four quick acknowledgements — please read each."
      primaryLabel="I agree — continue"
      canAdvance={allAcked}
      saving={upsert.isPending}
      onPrimary={handleContinue}
    >
      <div className="space-y-3">
        {ACKS.map((a) => (
          <label
            key={a.id}
            htmlFor={`ack-${a.id}`}
            className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
          >
            <Checkbox
              id={`ack-${a.id}`}
              checked={checked[a.id]}
              onCheckedChange={(v) =>
                setChecked((prev) => ({ ...prev, [a.id]: v === true }))
              }
              className="mt-0.5"
            />
            <Label
              htmlFor={`ack-${a.id}`}
              className="text-sm leading-snug font-normal cursor-pointer"
            >
              {a.label}
            </Label>
          </label>
        ))}
        <p className="pt-2 text-xs text-muted-foreground">
          The full risk disclosure is available at{' '}
          <a
            href="/legal/retail-disclosure"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            /legal/retail-disclosure
          </a>
          .
        </p>
      </div>
    </StepShell>
  );
}
