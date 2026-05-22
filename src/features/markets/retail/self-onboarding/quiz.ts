/**
 * Wealthfront-grade risk quiz — 10 questions covering the dimensions listed
 * in the design doc step 3:
 *
 *   horizon, drawdown comfort, income volatility, loss reaction,
 *   experience, dependents, primary objective, prior trauma, liquidity,
 *   sophistication.
 *
 * Each question is scored 0–3. Total range is 0–30. The mapping to a
 * three-band risk_tag biases slightly conservative for the layman retail
 * audience (decision A): conservative ≤ 39%, moderate 40–69%, aggressive
 * ≥ 70%.
 *
 * The quiz also produces an experience_level (beginner / casual /
 * self_directed) so we no longer have to default the legacy field. And a
 * `tends_panic_sell` behavioural flag is derived from the drawdown-comfort
 * + loss-reaction answers — used downstream by the Home drawdown-alert
 * sensitivity and signal-feed filters.
 */
import type { ExperienceLevel, RiskTag } from '../types';

export type QuestionId =
  | 'horizon'
  | 'drawdown'
  | 'income'
  | 'reaction'
  | 'experience'
  | 'dependents'
  | 'objective'
  | 'trauma'
  | 'liquidity'
  | 'sophistication';

export interface QuizOption {
  value: string;
  label: string;
  score: number;
}

export interface QuizQuestion {
  id:       QuestionId;
  text:     string;
  helper?:  string;
  options:  readonly QuizOption[];
}

export const QUIZ_V2: readonly QuizQuestion[] = [
  {
    id: 'horizon',
    text: 'When do you need most of this money?',
    helper: 'A longer horizon lets you ride out short-term dips.',
    options: [
      { value: 'lt_2y',  label: 'Within 2 years',  score: 0 },
      { value: '3_5y',   label: '3 – 5 years',     score: 1 },
      { value: '5_10y',  label: '5 – 10 years',    score: 2 },
      { value: 'gt_10y', label: 'Over 10 years',   score: 3 },
    ],
  },
  {
    id: 'drawdown',
    text: 'Your ₹1,00,000 drops to ₹70,000 in three months. You…',
    options: [
      { value: 'sell',     label: 'Sell immediately to stop the bleeding', score: 0 },
      { value: 'reduce',   label: 'Sell some to feel safer',                score: 1 },
      { value: 'hold',     label: 'Hold and wait it out',                   score: 2 },
      { value: 'buy_more', label: 'Buy more at the lower price',            score: 3 },
    ],
  },
  {
    id: 'income',
    text: 'How stable is your monthly income?',
    options: [
      { value: 'very_var',    label: 'Very variable (gigs / commission)',     score: 0 },
      { value: 'variable',    label: 'Varies month to month',                  score: 1 },
      { value: 'mostly',      label: 'Mostly stable with some variance',       score: 2 },
      { value: 'very_stable', label: 'Very stable salary',                     score: 3 },
    ],
  },
  {
    id: 'reaction',
    text: 'Indian markets fell 30% in a single year. How would you feel?',
    options: [
      { value: 'panic',       label: 'I\'d panic and want to exit',         score: 0 },
      { value: 'anxious',     label: 'Anxious but I\'d stay put',           score: 1 },
      { value: 'unbothered',  label: 'Unbothered — it happens',              score: 2 },
      { value: 'opportunity', label: 'I\'d see a buying opportunity',        score: 3 },
    ],
  },
  {
    id: 'experience',
    text: 'How long have you been investing in markets (any kind)?',
    options: [
      { value: 'none',  label: 'I haven\'t — this is my first time', score: 0 },
      { value: 'lt_1y', label: 'Under a year',                       score: 1 },
      { value: '1_3y',  label: '1 – 3 years',                        score: 2 },
      { value: '3_10y', label: '3 – 10 years',                       score: 3 },
      { value: 'gt_10y', label: 'Over 10 years',                     score: 3 },
    ],
  },
  {
    id: 'dependents',
    text: 'How many people rely on your income?',
    helper: 'More dependents usually means less risk capacity.',
    options: [
      { value: '4_plus', label: '4 or more', score: 0 },
      { value: '2_3',    label: '2 – 3',     score: 1 },
      { value: '1',      label: '1',         score: 2 },
      { value: 'none',   label: 'Just me',   score: 3 },
    ],
  },
  {
    id: 'objective',
    text: 'What\'s your primary reason for investing?',
    options: [
      { value: 'preserve',   label: 'Protect what I\'ve saved',                score: 0 },
      { value: 'steady',     label: 'Beat inflation, grow steadily',           score: 1 },
      { value: 'growth',     label: 'Build wealth aggressively',               score: 2 },
      { value: 'speculate',  label: 'Take big swings for big returns',         score: 3 },
    ],
  },
  {
    id: 'trauma',
    text: 'Have you ever lost a significant amount of money in markets before?',
    options: [
      { value: 'big_loss',  label: 'Yes — 30% or more, it shook me',           score: 0 },
      { value: 'mid_loss',  label: 'Yes — 10% to 30%',                          score: 1 },
      { value: 'small',     label: 'Small losses but nothing major',            score: 2 },
      { value: 'never',     label: 'No, I\'ve never lost significant money',    score: 3 },
    ],
  },
  {
    id: 'liquidity',
    text: 'What share of your total savings will be in this investment?',
    options: [
      { value: 'gt_75', label: 'More than 75%',  score: 0 },
      { value: '50_75', label: '50% – 75%',      score: 1 },
      { value: '25_50', label: '25% – 50%',      score: 2 },
      { value: 'lt_25', label: 'Less than 25%',  score: 3 },
    ],
  },
  {
    id: 'sophistication',
    text: 'Which best describes how you follow markets?',
    options: [
      { value: 'none',         label: 'I don\'t follow them at all',                  score: 0 },
      { value: 'casual',       label: 'Casual — headlines now and then',              score: 1 },
      { value: 'regular',      label: 'Regular — I read daily / weekly',              score: 2 },
      { value: 'professional', label: 'Professional — I work in or trade markets',    score: 3 },
    ],
  },
] as const;

export const TOTAL_QUESTIONS = QUIZ_V2.length;
export const MAX_SCORE       = QUIZ_V2.reduce(
  (sum, q) => sum + Math.max(...q.options.map((o) => o.score)),
  0,
);

export type QuizAnswers = Partial<Record<QuestionId, string>>;

/** True if every question has been answered. */
export function isQuizV2Complete(answers: QuizAnswers): boolean {
  return QUIZ_V2.every((q) => Boolean(answers[q.id]));
}

/** Sum the option scores for an answer set. Missing / unknown answers are 0. */
export function computeQuizV2Score(answers: QuizAnswers): number {
  return QUIZ_V2.reduce((total, q) => {
    const opt = q.options.find((o) => o.value === answers[q.id]);
    return total + (opt?.score ?? 0);
  }, 0);
}

/**
 * Map a raw quiz score to a risk_tag. Biased slightly conservative for the
 * layman retail audience: a 50% score is "moderate", not the halfway point
 * between moderate and aggressive.
 */
export function computeQuizV2RiskTag(score: number): RiskTag {
  const pct = MAX_SCORE === 0 ? 0 : score / MAX_SCORE;
  if (pct < 0.40) return 'conservative';
  if (pct < 0.70) return 'moderate';
  return 'aggressive';
}

/** Derive the legacy experience_level from the experience-question answer. */
export function deriveExperienceLevel(answers: QuizAnswers): ExperienceLevel {
  const v = answers.experience;
  if (v === 'gt_10y')                       return 'self_directed';
  if (v === '1_3y' || v === '3_10y')        return 'casual';
  return 'beginner';
}

/**
 * Behavioural flags surfaced from quiz answers. Currently:
 *   tends_panic_sell — set when the user picks 'sell' on drawdown OR
 *                      'panic' on loss-reaction. Used by Home to soften
 *                      drawdown alerts + by signal feed to hide
 *                      experimental-tier signals.
 */
export function deriveBehavioralFlags(answers: QuizAnswers): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  if (answers.drawdown === 'sell' || answers.reaction === 'panic') {
    flags.tends_panic_sell = true;
  }
  return flags;
}
