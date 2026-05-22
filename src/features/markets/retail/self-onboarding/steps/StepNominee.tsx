/**
 * Step 7 — Nominee (skippable).
 *
 * Captures who should inherit the investments if anything happens to the
 * user. Mandatory pre-launch for SEBI-aligned KYC but skippable here because
 * (a) the user is still in paper mode and (b) a forced step on a 5-minute
 * onboarding kills conversion. Skip writes the sentinel { skipped: true }
 * so we can prompt later from Settings without re-asking on every login.
 *
 * Share % defaults to 100 (single nominee). When/if we add multi-nominee
 * support, the design picks up at task #45+.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

import { useOnboardingDraft } from '../useOnboardingState';
import { useUpsertRetailProfile } from '../useRetailProfile';
import { StepShell } from './StepShell';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

// SEBI PAN format: 5 letters, 4 digits, 1 letter. Case-insensitive at type
// time; we uppercase before storing.
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const RELATIONSHIPS = [
  'Spouse', 'Parent', 'Child', 'Sibling', 'Other',
] as const;

export function StepNominee({ onNext, onBack }: Props) {
  const { draft, merge, clearKeys } = useOnboardingDraft();
  const upsert = useUpsertRetailProfile();

  const [name,         setName]         = useState(draft.nominee?.name ?? '');
  const [relationship, setRelationship] = useState(draft.nominee?.relationship ?? '');
  const [pan,          setPan]          = useState(draft.nominee?.pan ?? '');
  const [sharePct,     setSharePct]     = useState<number>(100);

  // Drop pan-validation errors as soon as the user starts editing again.
  const [panTouched, setPanTouched] = useState(false);

  useEffect(() => {
    merge({ nominee: { name, relationship, pan } });
    // We don't depend on `merge` to avoid churn — eslint exhaustive-deps off here is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, relationship, pan]);

  const panValid = useMemo(
    () => pan.length === 0 || PAN_RE.test(pan.toUpperCase()),
    [pan],
  );

  const canAdvance =
    name.trim().length >= 2 &&
    relationship.trim().length > 0 &&
    panValid;

  const save = async (skip: boolean) => {
    try {
      await upsert.mutateAsync({
        nominee: skip
          ? { skipped: true }
          : {
              name:         name.trim(),
              relationship,
              pan:          pan ? pan.toUpperCase() : undefined,
              share_pct:    sharePct,
            },
      });
      clearKeys(['nominee']);
      onNext();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Try again.';
      toast.error(`Could not save: ${detail}`);
    }
  };

  return (
    <StepShell
      title="Nominee (optional)"
      description="Who should your investments go to if something happens to you? You can add or change this any time from Settings."
      canAdvance={canAdvance}
      saving={upsert.isPending}
      onPrimary={() => save(false)}
      onBack={onBack}
      secondaryLabel="Skip for now"
      onSecondary={() => save(true)}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nominee-name">Full name</Label>
          <Input
            id="nominee-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya Sharma"
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nominee-rel">Relationship</Label>
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIPS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRelationship(r)}
                className={
                  'rounded-full border px-3 py-1 text-xs transition-colors ' +
                  (relationship === r
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30 hover:bg-muted/40')
                }
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nominee-pan">PAN (optional)</Label>
          <Input
            id="nominee-pan"
            value={pan}
            onChange={(e) => {
              setPan(e.target.value.toUpperCase());
              setPanTouched(true);
            }}
            placeholder="ABCDE1234F"
            maxLength={10}
            autoComplete="off"
            aria-invalid={panTouched && !panValid}
          />
          {panTouched && !panValid && (
            <p className="text-xs text-destructive">
              Looks like an incomplete PAN — format is 5 letters, 4 digits, 1 letter.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Share allocated to this nominee</Label>
            <span className="text-sm font-medium tabular-nums">{sharePct}%</span>
          </div>
          <Slider
            min={10}
            max={100}
            step={5}
            value={[sharePct]}
            onValueChange={([v]) => setSharePct(v)}
          />
          <p className="text-xs text-muted-foreground">
            Multiple nominees aren't supported in beta — leave at 100% for now.
          </p>
        </div>
      </div>
    </StepShell>
  );
}
