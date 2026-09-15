import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FEATURE_FLAGS, useAppFeatureFlag } from '@/lib/feature-flags';
import { useCRM } from '@/hooks/useCRM';
import { activeRoundTasks, UX_ROUNDS } from '@/config/uxRounds';

const OTHER_TASK_ID = '__other__';
type Completed = 'yes' | 'partial' | 'no';

// Row shape for public.ux_feedback (Plan 3). The Database type for this
// table does not exist yet -- the migration in
// supabase/migrations/20260915000000_create_ux_feedback.sql has not been
// applied to any database this codebase's generated types are drawn from.
// Cast at the call site (below) rather than pretending the relation is
// typed; re-run `npm run supabase:types:gen` once the migration lands and
// remove this interface + the cast.
interface UxFeedbackRow {
  tenant_id: string;
  user_id: string;
  round: number;
  task_id: string;
  route: string;
  completed: Completed;
  ease: number;
  comment: string | null;
  viewport_w: number;
  viewport_h: number;
  theme_mode: 'light' | 'dark';
  user_agent: string;
}

export function UxFeedbackWidget() {
  const { enabled } = useAppFeatureFlag(FEATURE_FLAGS.UX_FEEDBACK_WIDGET, false);
  const { supabase, user, context } = useCRM();
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [completed, setCompleted] = useState<Completed | ''>('');
  const [ease, setEase] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!enabled) return null;

  const reset = () => {
    setTaskId('');
    setCompleted('');
    setEase('');
    setComment('');
  };

  const handleSubmit = async () => {
    if (!taskId || !completed || !ease || !user?.id || !context?.tenantId) return;
    setSubmitting(true);
    const isDark = document.documentElement.classList.contains('dark');
    const row: UxFeedbackRow = {
      tenant_id: context.tenantId,
      user_id: user.id,
      round: UX_ROUNDS.activeRound,
      task_id: taskId,
      route: window.location.pathname,
      completed,
      ease: Number(ease),
      comment: comment.trim() ? comment.trim().slice(0, 500) : null,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      theme_mode: isDark ? 'dark' : 'light',
      user_agent: navigator.userAgent,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see UxFeedbackRow comment above
    const { error } = await (supabase as any).from('ux_feedback').insert(row);
    setSubmitting(false);
    if (error) {
      toast.error('Could not save your feedback — please try again.');
      return;
    }
    toast.success('Thanks for the feedback!');
    reset();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          aria-label="Give feedback"
          className="fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full shadow-lg"
        >
          <FeedbackIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ux-feedback-task">What were you trying to do?</Label>
          <Select value={taskId} onValueChange={setTaskId}>
            <SelectTrigger id="ux-feedback-task" aria-label="What were you trying to do?">
              <SelectValue placeholder="Choose a task" />
            </SelectTrigger>
            <SelectContent>
              {activeRoundTasks().map((task) => (
                <SelectItem key={task.id} value={task.id}>{task.label}</SelectItem>
              ))}
              <SelectItem value={OTHER_TASK_ID}>Something else</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Did you complete it?</Label>
          <RadioGroup value={completed} onValueChange={(v) => setCompleted(v as Completed)} className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="yes" id="ux-feedback-completed-yes" />
              <Label htmlFor="ux-feedback-completed-yes" className="font-normal">Yes</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="partial" id="ux-feedback-completed-partial" />
              <Label htmlFor="ux-feedback-completed-partial" className="font-normal">Partially</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="no" id="ux-feedback-completed-no" />
              <Label htmlFor="ux-feedback-completed-no" className="font-normal">No</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label>How easy was it?</Label>
          <RadioGroup value={ease} onValueChange={setEase} className="flex justify-between">
            {(['1', '2', '3', '4', '5'] as const).map((n) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <RadioGroupItem value={n} id={`ux-feedback-ease-${n}`} aria-label={n} />
                <Label htmlFor={`ux-feedback-ease-${n}`} className="text-xs font-normal">
                  {n === '1' ? 'Very hard' : n === '5' ? 'Very easy' : n}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ux-feedback-comment">Anything else?</Label>
          <Textarea
            id="ux-feedback-comment"
            aria-label="Anything else?"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            maxLength={500}
            rows={3}
          />
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={!taskId || !completed || !ease || submitting}
          onClick={handleSubmit}
        >
          Submit
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function FeedbackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
