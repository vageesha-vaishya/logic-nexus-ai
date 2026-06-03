// DirectiveApplicabilityCheck — operator UI for the
// llm-directive-applicability edge function. Renders an "AI applicability
// check" button + result card. Designed to drop into existing directive-
// management surfaces with a directive row + aircraft profile context.
//
// Pattern matches the Sthira / AMRO defect-photo wire-ins: useMutation
// from a focused hook, parsed_output rendered with confidence chip +
// matched / unmatched criteria + reasoning + recommended followup.

import { useState } from 'react';
import { Loader2, Sparkles, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  useDirectiveApplicability,
  type DirectiveInput,
  type AircraftInput,
  type DirectiveApplicabilityOutput,
} from '../../hooks/useDirectiveApplicability';

interface DirectiveApplicabilityCheckProps {
  directive: DirectiveInput;
  aircraft: AircraftInput;
  /** Called when the operator commits the verdict back to the directive row. */
  onAccept?: (output: DirectiveApplicabilityOutput) => void;
}

function confidenceLabel(c: number): { label: string; tone: 'destructive' | 'default' | 'secondary' } {
  if (c >= 0.9) return { label: `High confidence (${Math.round(c * 100)}%)`, tone: 'default' };
  if (c >= 0.7) return { label: `Medium confidence (${Math.round(c * 100)}%)`, tone: 'secondary' };
  return { label: `Low confidence (${Math.round(c * 100)}%)`, tone: 'destructive' };
}

export function DirectiveApplicabilityCheck(
  { directive, aircraft, onAccept }: DirectiveApplicabilityCheckProps,
) {
  const { mutateAsync, data, isPending, reset } = useDirectiveApplicability();
  const [committed, setCommitted] = useState(false);

  const handleRun = async () => {
    setCommitted(false);
    await mutateAsync({ directive, aircraft });
  };

  const parsed = data?.parsed_output ?? null;
  const cof = parsed ? confidenceLabel(parsed.confidence) : null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI applicability check
        </CardTitle>
        <CardDescription>
          Evaluate whether <span className="font-medium">{directive.directive_id}</span> applies to{' '}
          <span className="font-medium">
            {aircraft.registration ?? aircraft.serial_number} ({aircraft.model})
          </span>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!parsed && (
          <Button onClick={handleRun} disabled={isPending} size="sm">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Check applicability with AI
              </>
            )}
          </Button>
        )}

        {parsed && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2">
              {parsed.applies ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-600" />
              )}
              <span className="text-base font-semibold">
                {parsed.applies ? 'Applies' : 'Does not apply'}
              </span>
              {cof && <Badge variant={cof.tone}>{cof.label}</Badge>}
            </div>

            <p className="text-muted-foreground">{parsed.reasoning}</p>

            {parsed.matched_criteria.length > 0 && (
              <div>
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Matched criteria</div>
                <ul className="ml-4 list-disc text-xs text-muted-foreground">
                  {parsed.matched_criteria.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.unmatched_criteria.length > 0 && (
              <div>
                <div className="text-xs font-medium text-rose-700 dark:text-rose-400">Unmatched / unclear</div>
                <ul className="ml-4 list-disc text-xs text-muted-foreground">
                  {parsed.unmatched_criteria.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.ata_chapters_touched.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium">ATA chapters:</span>
                {parsed.ata_chapters_touched.map((ch) => (
                  <Badge key={ch} variant="outline">
                    {ch}
                  </Badge>
                ))}
              </div>
            )}

            {parsed.recommended_followup && (
              <div className="flex items-start gap-2 rounded border bg-background p-2 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{parsed.recommended_followup}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {onAccept && !committed && (
                <Button
                  size="sm"
                  onClick={() => {
                    setCommitted(true);
                    onAccept(parsed);
                  }}
                >
                  Accept verdict
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { reset(); setCommitted(false); }}>
                Re-run
              </Button>
            </div>
            {committed && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Verdict applied to directive row.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DirectiveApplicabilityCheck;
