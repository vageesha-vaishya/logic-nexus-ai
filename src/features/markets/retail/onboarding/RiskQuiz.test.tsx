import { describe, it, expect } from 'vitest';
import { computeRiskTag } from '../types';
import { computeQuizScore, QUIZ_QUESTIONS } from './RiskQuiz';

describe('quiz scoring', () => {
  it('all safe answers (score 0) → conservative', () => {
    const allSafe: Record<string, string> = {};
    QUIZ_QUESTIONS.forEach((q) => {
      allSafe[q.id] = q.options[0].value; // first option = lowest score
    });
    const score = computeQuizScore(allSafe);
    expect(computeRiskTag(score)).toBe('conservative');
  });

  it('all bold answers (max score) → aggressive', () => {
    const allBold: Record<string, string> = {};
    QUIZ_QUESTIONS.forEach((q) => {
      allBold[q.id] = q.options[q.options.length - 1].value; // last option = highest score
    });
    const score = computeQuizScore(allBold);
    expect(computeRiskTag(score)).toBe('aggressive');
  });

  it('unanswered questions contribute 0 to score', () => {
    expect(computeQuizScore({})).toBe(0);
  });

  it('QUIZ_QUESTIONS has exactly 4 questions', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(4);
  });
});
