/**
 * Step 2 — Welcome + disclosure.
 *
 * Greets the user by first name (falls back to email-local). Presents four
 * acknowledgements derived from the SEBI retail-investor risk-disclosure
 * standard + the platform's paper-mode + broker-deferred posture. All four
 * must be ticked before Continue stamps retail_profile.disclosure_accepted_at.
 *
 * The acknowledgements are intentionally short and plain-language — the
 * audience is layman retail (decision A). Tapping "Read full disclosure"
 * opens an in-flow Sheet with the expanded plain-English version (avoids
 * target="_blank" which silently no-ops inside the Capacitor WebView).
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="underline underline-offset-2 text-foreground hover:text-primary"
              >
                Read the full risk disclosure →
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader className="text-left">
                <SheetTitle>Sthira retail risk disclosure</SheetTitle>
                <SheetDescription>
                  Plain-English summary of each acknowledgement on the previous
                  screen. Final SEBI-reviewed version will replace this draft
                  before public launch.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm leading-relaxed">
                <section>
                  <h3 className="font-medium">1. Market risk</h3>
                  <p className="mt-1 text-muted-foreground">
                    All investments traded through Sthira — equity, ETFs, mutual
                    funds, derivatives — carry the risk of loss. Past performance
                    of any instrument or strategy does not guarantee future
                    returns. You may receive less than what you put in. SEBI
                    requires every retail platform to surface this fact before
                    you transact.
                  </p>
                </section>
                <section>
                  <h3 className="font-medium">2. Paper-trading mode by default</h3>
                  <p className="mt-1 text-muted-foreground">
                    Your account starts in paper-trading mode. No real money
                    moves to or from any broker until you explicitly connect a
                    real brokerage account and enable live orders. Paper trades
                    are recorded for learning and signal-calibration only and
                    do not represent actual fills.
                  </p>
                </section>
                <section>
                  <h3 className="font-medium">3. Signals, education — not personal advice</h3>
                  <p className="mt-1 text-muted-foreground">
                    Sthira shows market signals, educational content, and
                    LLM-generated explanations. None of this is personalised
                    investment advice from a SEBI-registered Investment Adviser
                    (RIA) or Research Analyst (RA). For tailored advice based on
                    your specific financial situation, please consult a
                    SEBI-registered professional separately. Sthira does not
                    place trades on your behalf without a per-trade approval
                    from you.
                  </p>
                </section>
                <section>
                  <h3 className="font-medium">4. Connecting a broker is optional and later</h3>
                  <p className="mt-1 text-muted-foreground">
                    When you are ready, you can connect a supported broker
                    (currently Zerodha or Fyers, with Groww in evaluation) from
                    Settings → Brokers. Sthira never holds custody of your
                    money — it orchestrates orders through your broker and
                    reads positions you authorise. You can disconnect at any
                    time.
                  </p>
                </section>
                <section>
                  <h3 className="font-medium">Data and grievances</h3>
                  <p className="mt-1 text-muted-foreground">
                    Sthira is operated by SOS Markets in India. Your account
                    data is stored in the ap-south-1 region. For data-access,
                    correction, or grievance requests, contact{' '}
                    <a
                      href="mailto:support@sosservices.online"
                      className="underline underline-offset-2"
                    >
                      support@sosservices.online
                    </a>{' '}
                    or write to the address on{' '}
                    sthira.sosservices.online/legal/privacy.
                  </p>
                </section>
              </div>
            </SheetContent>
          </Sheet>
        </p>
      </div>
    </StepShell>
  );
}
