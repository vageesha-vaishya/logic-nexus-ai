import { describe, expect, it } from 'vitest';

import {
  MAX_SCORE,
  QUIZ_V2,
  TOTAL_QUESTIONS,
  computeQuizV2RiskTag,
  computeQuizV2Score,
  deriveBehavioralFlags,
  deriveExperienceLevel,
  isQuizV2Complete,
  type QuizAnswers,
} from './quiz';

const allMinAnswers = (): QuizAnswers => {
  const a: QuizAnswers = {};
  for (const q of QUIZ_V2) {
    const min = q.options.reduce((acc, o) => (o.score < acc.score ? o : acc), q.options[0]);
    a[q.id] = min.value;
  }
  return a;
};

const allMaxAnswers = (): QuizAnswers => {
  const a: QuizAnswers = {};
  for (const q of QUIZ_V2) {
    const max = q.options.reduce((acc, o) => (o.score > acc.score ? o : acc), q.options[0]);
    a[q.id] = max.value;
  }
  return a;
};

describe('Wealthfront-grade quiz', () => {
  it('has 10 questions covering the designed dimensions', () => {
    expect(TOTAL_QUESTIONS).toBe(10);
    const ids = QUIZ_V2.map((q) => q.id);
    expect(ids).toEqual([
      'horizon', 'drawdown', 'income', 'reaction', 'experience',
      'dependents', 'objective', 'trauma', 'liquidity', 'sophistication',
    ]);
  });

  it('computes score 0 for all-min answers and MAX_SCORE for all-max', () => {
    expect(computeQuizV2Score(allMinAnswers())).toBe(0);
    expect(computeQuizV2Score(allMaxAnswers())).toBe(MAX_SCORE);
  });

  it('isQuizV2Complete is false until every question is answered', () => {
    expect(isQuizV2Complete({})).toBe(false);
    const partial = { ...allMinAnswers() };
    delete partial.horizon;
    expect(isQuizV2Complete(partial)).toBe(false);
    expect(isQuizV2Complete(allMinAnswers())).toBe(true);
  });

  it('maps all-min to conservative and all-max to aggressive', () => {
    expect(computeQuizV2RiskTag(computeQuizV2Score(allMinAnswers()))).toBe('conservative');
    expect(computeQuizV2RiskTag(computeQuizV2Score(allMaxAnswers()))).toBe('aggressive');
  });

  it('uses a 40% / 70% band split (slightly conservative bias)', () => {
    // Just below 40% → still conservative
    expect(computeQuizV2RiskTag(Math.floor(MAX_SCORE * 0.39))).toBe('conservative');
    // 40% → moderate
    expect(computeQuizV2RiskTag(Math.ceil(MAX_SCORE * 0.40))).toBe('moderate');
    // Just below 70% → still moderate
    expect(computeQuizV2RiskTag(Math.floor(MAX_SCORE * 0.69))).toBe('moderate');
    // 70% → aggressive
    expect(computeQuizV2RiskTag(Math.ceil(MAX_SCORE * 0.70))).toBe('aggressive');
  });

  it('derives experience_level from the experience question', () => {
    expect(deriveExperienceLevel({ experience: 'none' })).toBe('beginner');
    expect(deriveExperienceLevel({ experience: 'lt_1y' })).toBe('beginner');
    expect(deriveExperienceLevel({ experience: '1_3y' })).toBe('casual');
    expect(deriveExperienceLevel({ experience: '3_10y' })).toBe('casual');
    expect(deriveExperienceLevel({ experience: 'gt_10y' })).toBe('self_directed');
    expect(deriveExperienceLevel({})).toBe('beginner');
  });

  it('flags tends_panic_sell when drawdown=sell OR reaction=panic', () => {
    expect(deriveBehavioralFlags({ drawdown: 'sell' })).toEqual({ tends_panic_sell: true });
    expect(deriveBehavioralFlags({ reaction: 'panic' })).toEqual({ tends_panic_sell: true });
    expect(deriveBehavioralFlags({ drawdown: 'hold', reaction: 'unbothered' })).toEqual({});
    expect(deriveBehavioralFlags({})).toEqual({});
  });
});
