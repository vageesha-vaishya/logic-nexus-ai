// src/features/markets/retail/community/hooks/useCommunity.test.ts
import { describe, it, expect } from 'vitest';
import { formatWeight } from '../types';

describe('formatWeight', () => {
  it('formats 33.33 as "33.3%"', () => {
    expect(formatWeight(33.33)).toBe('33.3%');
  });
  it('formats 100 as "100.0%"', () => {
    expect(formatWeight(100)).toBe('100.0%');
  });
});
