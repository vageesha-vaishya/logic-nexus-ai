import { describe, expect, it } from 'vitest';
import { buildRoundMarkdown } from './export.mjs';

const ROWS = [
  { task_id: 'find-open-lead', route: '/dashboard/leads', completed: 'yes', ease: 4, comment: 'Easy once I saw the search box' },
  { task_id: 'find-open-lead', route: '/dashboard/leads', completed: 'no', ease: 2, comment: null },
  { task_id: 'move-opportunity-stage', route: '/dashboard/leads/pipeline', completed: 'partial', ease: 3, comment: 'Drag felt fragile' },
];

describe('buildRoundMarkdown', () => {
  const md = buildRoundMarkdown(ROWS, 1);

  it('reports completion % per task', () => {
    // find-open-lead: 1 of 2 fully completed = 50%
    expect(md).toMatch(/find-open-lead[\s\S]*?50%/);
  });

  it('reports mean and median ease per task', () => {
    // find-open-lead ease values [4, 2] -> mean 3, median 3
    expect(md).toMatch(/find-open-lead[\s\S]*?mean 3(\.0)?[\s\S]*?median 3/);
  });

  it('groups comments by route, omitting null comments', () => {
    expect(md).toContain('/dashboard/leads');
    expect(md).toContain('Easy once I saw the search box');
    expect(md).not.toMatch(/\/dashboard\/leads[\s\S]*?null/);
  });

  it('handles zero rows for a round without throwing', () => {
    expect(() => buildRoundMarkdown([], 2)).not.toThrow();
    expect(buildRoundMarkdown([], 2)).toContain('No feedback rows for round 2');
  });
});
