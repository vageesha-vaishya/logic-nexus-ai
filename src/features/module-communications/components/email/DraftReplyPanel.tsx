// DraftReplyPanel — operator-in-the-loop AI reply drafting surface.
// Sits between the classification badge and the Reply button in
// EmailDetailDialog. Operator clicks "Draft", picks a tone, reviews
// the generated subject + body, then "Use this draft" pre-fills the
// existing EmailComposeDialog. Never auto-sends.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, MessageSquare, AlertTriangle, Clock, ListChecks } from 'lucide-react';
import {
  useDraftReply,
  type DraftReplyInput,
  type DraftReplyTone,
  type DraftReplyOutput,
} from '@/features/module-communications/hooks/useDraftReply';

interface DraftReplyPanelProps {
  input: DraftReplyInput;
  onUseDraft: (draft: { subject: string; body: string }) => void;
}

const TONE_LABEL: Record<DraftReplyTone, string> = {
  friendly: 'Friendly',
  formal: 'Formal',
  firm: 'Firm',
};

export function DraftReplyPanel({ input, onUseDraft }: DraftReplyPanelProps) {
  const [tone, setTone] = useState<DraftReplyTone>('friendly');
  const draft = useDraftReply();
  const parsed: DraftReplyOutput | null = draft.data?.parsed_output ?? null;

  const handleDraft = () => {
    draft.mutate({ ...input, tone });
  };

  return (
    <>
      <Separator />
      <div className="space-y-3 rounded-md border bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold">AI reply draft</h4>
          <span className="ml-auto text-xs text-muted-foreground">
            Operator reviews before sending
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={tone} onValueChange={(v) => setTone(v as DraftReplyTone)}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TONE_LABEL) as DraftReplyTone[]).map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{TONE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleDraft}
            disabled={draft.isPending}
          >
            {draft.isPending ? (
              <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Drafting…</>
            ) : (
              <><MessageSquare className="w-3 h-3 mr-2" /> {parsed ? 'Re-draft' : 'Draft reply'}</>
            )}
          </Button>
          {parsed && (
            <span className="ml-auto text-xs text-muted-foreground">
              confidence {(parsed.confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>

        {parsed && parsed.confidence === 0 && (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
            <AlertTriangle className="w-3 h-3 mt-0.5" />
            <div>This looks like spam. No reply drafted. Skip to archive or delete.</div>
          </div>
        )}

        {parsed && parsed.body_plaintext && (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Subject</div>
              <div className="rounded-md border bg-background p-2 text-sm">{parsed.subject}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-xs font-medium text-muted-foreground">Body</div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {parsed.tone_used}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {parsed.language}
                </Badge>
              </div>
              <div className="whitespace-pre-wrap rounded-md border bg-background p-2 text-sm">
                {parsed.body_plaintext}
              </div>
            </div>

            {parsed.internal_note && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                <span className="font-medium">Internal note: </span>{parsed.internal_note}
              </div>
            )}

            {parsed.warnings.length > 0 && (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {parsed.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}

            {parsed.follow_up_actions.length > 0 &&
              parsed.follow_up_actions.some(a => a.action_type !== 'none') && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <ListChecks className="w-3 h-3" /> Suggested follow-ups
                </div>
                <ul className="space-y-1">
                  {parsed.follow_up_actions
                    .filter(a => a.action_type !== 'none')
                    .map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {a.action_type.replace(/_/g, ' ')}
                        </Badge>
                        <span className="flex-1">{a.description}</span>
                        {a.deadline_hint_hours != null && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {a.deadline_hint_hours}h
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={() => onUseDraft({
                  subject: parsed.subject,
                  body: parsed.body_plaintext,
                })}
              >
                Use this draft
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
