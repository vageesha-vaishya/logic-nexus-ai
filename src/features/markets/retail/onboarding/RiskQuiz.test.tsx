import { describe, it, expect } from 'vitest';
import { computeRiskTag } from '../types';
import { QUIZ_QUESTIONS, computeQuizScore } from './RiskQuiz';

describe('quiz risk scoring', () => {
  it('panic seller (all safe answers) → conservative', () => {
    expect(computeRiskTag(0)).toBe('conservative');
  });
  it('balanced investor → moderate', () => {
    expect(computeRiskTag(6)).toBe('moderate');
  });
  it('risk taker (all bold answers) → aggressive', () => {
    expect(computeRiskTag(10)).toBe('aggressive');
  });
});

describe('computeQuizScore', () => {
  it('returns 0 when nothing answered', () => {
    expect(computeQuizScore({})).toBe(0);
  });

  it('sums option scores across answered questions', () => {
    const answers = {
      q1: 'buy_more',  // 2
      q2: 'research',  // 1
      q3: 'invest',    // 2
      q4: 'some',      // 1
    };
    expect(computeQuizScore(answers)).toBe(6);
    expect(computeRiskTag(computeQuizScore(answers))).toBe('moderate');
  });

  it('hits the upper bound at 10 when every answer is the bold option', () => {
    const answers = Object.fromEntries(
      QUIZ_QUESTIONS.map((q) => [q.id, q.options[2].value]),
    );
    expect(computeQuizScore(answers)).toBe(8);
    // 4 questions × 2 pts = 8 → still aggressive, because the band starts at 8.
    expect(computeRiskTag(computeQuizScore(answers))).toBe('aggressive');
  });

  it('ignores unknown answer values without throwing', () => {
    expect(computeQuizScore({ q1: 'mystery', q2: 'ignore' })).toBe(0);
  });
});
