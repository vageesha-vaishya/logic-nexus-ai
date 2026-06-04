// ActivitySummarisePanel — operator UI for llm-activity-summarise.
// Drop-in card for lead/opportunity/account/contact detail surfaces.
// Renders headline, narrative, commitments, decisions/blockers,
// stakeholders, sentiment, and a quantified next-step suggestion.

import { useState } from 'react';
import {
  Sparkles,
  Loader2,
  Flame,
  CalendarClock,
  Clock,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  ThumbsUp,
  TrendingDown,
  Snowflake,
  Trophy,
  Minus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import {
  useActivitySummarise,
  type ActivitySummariseInput,
  type ActivitySummariseOutput,
  type CommitmentItem,
  type StakeholderItem,
  type Sentiment,
  type Urgency,
} from '../hooks/useActivitySummarise';

interface ActivitySummarisePanelProps {
  input: ActivitySummariseInput;
}

function confidenceTone(c: number): 'destructive' | 'default' | 'secondary' {
  if (c >= 0.85) return 'default';
  if (c >= 0.65) return 'secondary';
  return 'destructive';
}

const SENTIMENT_META: Record<
  Sentiment,
  { label: string; icon: typeof Trophy; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  champion: { label: 'Champion', icon: Trophy, variant: 'default' },
  interested: { label: 'Interested', icon: ThumbsUp, variant: 'default' },
  neutral: { label: 'Neutral', icon: Minus, variant: 'secondary' },
  cooling: { label: 'Cooling', icon: Snowflake, variant: 'destructive' },
  lost: { label: 'Lost', icon: TrendingDown, variant: 'destructive' },
  unknown: { label: 'Unknown', icon: HelpCircle, variant: 'outline' },
};

const URGENCY_META: Record<
  Urgency,
  { label: string; icon: typeof Flame; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  today: { label: 'Today', icon: Flame, variant: 'destructive' },
  this_week: { label: 'This week', icon: CalendarClock, variant: 'default' },
  this_month: { label: 'This month', icon: Clock, variant: 'secondary' },
  watch: { label: 'Watch', icon: Eye, variant: 'outline' },
};

const COMMITMENT_STATUS_META: Record<
  CommitmentItem['status'],
  { variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof CheckCircle2 }
> = {
  open: { variant: 'secondary', icon: Clock },
  done: { variant: 'default', icon: CheckCircle2 },
  overdue: { variant: 'destructive', icon: AlertTriangle },
  missed: { variant: 'destructive', icon: XCircle },
};

const STAKEHOLDER_VARIANT: Record<StakeholderItem['sentiment'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  champion: 'default',
  neutral: 'secondary',
  skeptical: 'outline',
  blocker: 'destructive',
  unknown: 'outline',
};

export function ActivitySummarisePanel({ input }: ActivitySummarisePanelProps) {
  const { mutateAsync, data, isPending, reset } = useActivitySummarise();
  const [refreshed, setRefreshed] = useState(false);

  const parsed = data?.parsed_output ?? null;

  const handleRun = async () => {
    setRefreshed(true);
    await mutateAsync(input);
  };

  const sentimentMeta = parsed ? SENTIMENT_META[parsed.sentiment_overall] : null;
  const SentimentIcon = sentimentMeta?.icon;
  const urgencyMeta = parsed ? URGENCY_META[parsed.next_step_suggestion.urgency] : null;
  const UrgencyIcon = urgencyMeta?.icon;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI activity summary
        </CardTitle>
        <CardDescription>
          {input.summary_window.audience === 'sdr_handoff' && 'Pre-call prep for SDR handoff'}
          {input.summary_window.audience === 'am_prep' && 'Pre-conversation prep for the AM'}
          {input.summary_window.audience === 'manager_review' && 'Manager review of momentum + risks'}
          {input.summary_window.audience === 'renewal_prep' && 'Renewal context + expansion signals'}
          {' '}— {input.subject.name}
          {input.subject.stage && (
            <>
              {' '}· <span className="font-medium">{input.subject.stage}</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed && (
          <Button onClick={handleRun} disabled={isPending} size="sm">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Summarising {input.activities.length} activities…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Summarise {input.activities.length} activities
              </>
            )}
          </Button>
        )}

        {parsed && (
          <div className="space-y-4">
            {/* Headline + sentiment + confidence chips */}
            <div className="space-y-2">
              <p className="text-base font-medium leading-snug">{parsed.headline}</p>
              <div className="flex flex-wrap items-center gap-2">
                {sentimentMeta && (
                  <Badge variant={sentimentMeta.variant}>
                    {SentimentIcon && <SentimentIcon className="mr-1 h-3.5 w-3.5" />}
                    {sentimentMeta.label}
                  </Badge>
                )}
                <Badge variant={confidenceTone(parsed.confidence)}>
                  {Math.round(parsed.confidence * 100)}% confidence
                </Badge>
                {parsed.topics_covered.slice(0, 4).map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                ))}
                {parsed.topics_covered.length > 4 && (
                  <span className="text-xs text-muted-foreground">
                    +{parsed.topics_covered.length - 4} more topics
                  </span>
                )}
              </div>
            </div>

            {/* Narrative */}
            <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {parsed.narrative}
            </div>

            {/* Sentiment rationale */}
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Sentiment: </span>
              {parsed.sentiment_rationale}
            </p>

            <Separator />

            {/* 3-column: Commitments / Decisions / Blockers */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {/* Commitments */}
              <div className="rounded-md border p-3">
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Commitments ({parsed.commitments.length})
                </div>
                {parsed.commitments.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground/70">None outstanding.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {parsed.commitments.map((c, i) => {
                      const meta = COMMITMENT_STATUS_META[c.status];
                      const Icon = meta.icon;
                      return (
                        <li key={`c-${i}-${c.supporting_activity_id}`}>
                          <div className="flex items-start gap-1.5">
                            <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                            <div>
                              <Badge variant={meta.variant} className="mr-1 text-xs">{c.party}</Badge>
                              {c.what}
                              {c.deadline_iso && (
                                <span className="ml-1 text-muted-foreground">
                                  by {c.deadline_iso}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Decisions */}
              <div className="rounded-md border p-3">
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Decisions ({parsed.decisions_made.length})
                </div>
                {parsed.decisions_made.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground/70">None recorded.</p>
                ) : (
                  <ul className="ml-4 list-disc space-y-1 text-xs">
                    {parsed.decisions_made.map((d, i) => (
                      <li key={`d-${i}-${d}`}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Blockers */}
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Blockers ({parsed.blockers.length})
                </div>
                {parsed.blockers.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground/70">None open.</p>
                ) : (
                  <ul className="ml-4 list-disc space-y-1 text-xs">
                    {parsed.blockers.map((b, i) => (
                      <li key={`b-${i}-${b}`}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Stakeholders */}
            {parsed.key_stakeholders_named.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Key stakeholders ({parsed.key_stakeholders_named.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {parsed.key_stakeholders_named.map((s) => (
                    <div
                      key={`${s.name}-${s.side}`}
                      className="rounded-md border bg-background px-2.5 py-1.5 text-xs"
                    >
                      <div className="font-medium">{s.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-muted-foreground">
                          {s.role_or_title || s.side}
                        </span>
                        <Badge variant={STAKEHOLDER_VARIANT[s.sentiment]} className="text-xs">
                          {s.sentiment}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Next step suggestion */}
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Suggested next step
                {urgencyMeta && (
                  <Badge variant={urgencyMeta.variant}>
                    {UrgencyIcon && <UrgencyIcon className="mr-1 h-3 w-3" />}
                    {urgencyMeta.label}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  owner: {parsed.next_step_suggestion.owner}
                </Badge>
              </div>
              <p className="text-sm">{parsed.next_step_suggestion.action}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {parsed.next_step_suggestion.rationale}
              </p>
            </div>

            {/* Redactions notice */}
            {parsed.redactions_made.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Redactions: </span>
                {parsed.redactions_made.join(', ')}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { reset(); setRefreshed(false); void handleRun(); }}
              >
                Re-summarise
              </Button>
            </div>
            {refreshed && parsed && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Summary generated from {input.activities.length} activities.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActivitySummarisePanel;
