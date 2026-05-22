/**
 * RiskQuizV2 — 10-question Wealthfront-grade risk-tolerance quiz.
 *
 * Renders one card per question with a vertical option list. Each option
 * is a clickable row (radio under the hood) so the whole row, not just
 * the dot, is a tap target — critical on the Sthira mobile shell.
 *
 * Stateless: holds no internal state. Parent owns the answers map and
 * gets a new copy on every change. This keeps the wizard's hybrid
 * persistence layer (localStorage in-flight cache → DB on Continue)
 * straightforward.
 */
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

import { QUIZ_V2, type QuizAnswers } from './quiz';

interface Props {
  answers:  QuizAnswers;
  onChange: (next: QuizAnswers) => void;
}

export function RiskQuizV2({ answers, onChange }: Props) {
  return (
    <div className="space-y-5">
      {QUIZ_V2.map((q, idx) => (
        <fieldset key={q.id} className="space-y-3">
          <legend className="text-sm font-medium leading-snug">
            <span className="text-muted-foreground mr-2">{idx + 1}.</span>
            {q.text}
          </legend>
          {q.helper && (
            <p className="text-xs text-muted-foreground -mt-1.5 ml-5">{q.helper}</p>
          )}
          <RadioGroup
            value={answers[q.id] ?? ''}
            onValueChange={(v) => onChange({ ...answers, [q.id]: v })}
            className="space-y-1.5"
          >
            {q.options.map((opt) => {
              const inputId = `${q.id}-${opt.value}`;
              return (
                <div
                  key={opt.value}
                  className="flex items-center gap-3 rounded-md border p-2.5 hover:bg-muted/40"
                >
                  <RadioGroupItem value={opt.value} id={inputId} />
                  <Label
                    htmlFor={inputId}
                    className="text-sm leading-snug cursor-pointer flex-1 font-normal"
                  >
                    {opt.label}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </fieldset>
      ))}
    </div>
  );
}
