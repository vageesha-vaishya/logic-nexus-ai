import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    text: 'Your ₹1 lakh investment drops to ₹75,000 in 3 months. You…',
    options: [
      { value: 'sell',     label: 'Sell immediately',        score: 0 },
      { value: 'hold',     label: 'Hold and wait',           score: 1 },
      { value: 'buy_more', label: 'Buy more at lower price', score: 2 },
    ],
  },
  {
    id: 'q2',
    text: 'You see a trending stock tip on social media. You…',
    options: [
      { value: 'ignore',    label: 'Ignore it',          score: 0 },
      { value: 'research',  label: 'Investigate first',  score: 1 },
      { value: 'buy_small', label: 'Buy a small amount', score: 2 },
    ],
  },
  {
    id: 'q3',
    text: 'Markets have fallen 20%. Your advisor says to wait. You…',
    options: [
      { value: 'sell',   label: 'Sell anyway',     score: 0 },
      { value: 'wait',   label: 'Wait as advised', score: 1 },
      { value: 'invest', label: 'Invest more',     score: 2 },
    ],
  },
  {
    id: 'q4',
    text: 'You need this money in 2 years. Would you invest in stocks?',
    options: [
      { value: 'no',   label: 'No',         score: 0 },
      { value: 'some', label: 'Some of it', score: 1 },
      { value: 'yes',  label: 'Yes',        score: 2 },
    ],
  },
] as const;

interface RiskQuizProps {
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
}

export function RiskQuiz({ answers, onChange }: RiskQuizProps) {
  return (
    <div className="space-y-6">
      {QUIZ_QUESTIONS.map((q) => (
        <div key={q.id} className="space-y-3">
          <p className="text-sm font-medium leading-tight">{q.text}</p>
          <RadioGroup
            value={answers[q.id] ?? ''}
            onValueChange={(v) => onChange({ ...answers, [q.id]: v })}
            className="space-y-2"
          >
            {q.options.map((opt) => (
              <div key={opt.value} className="flex items-center gap-3 rounded-md border p-2.5 hover:bg-muted/40">
                <RadioGroupItem value={opt.value} id={`${q.id}-${opt.value}`} />
                <Label htmlFor={`${q.id}-${opt.value}`} className="text-sm cursor-pointer flex-1">
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ))}
    </div>
  );
}

export function computeQuizScore(answers: Record<string, string>): number {
  return QUIZ_QUESTIONS.reduce((total, q) => {
    const opt = q.options.find((o) => o.value === answers[q.id]);
    return total + (opt?.score ?? 0);
  }, 0);
}

/** True if every question has an answer — used by the wizard to gate Next. */
export function isQuizComplete(answers: Record<string, string>): boolean {
  return QUIZ_QUESTIONS.every((q) => Boolean(answers[q.id]));
}
