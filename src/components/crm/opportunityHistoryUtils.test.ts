import { describe, it, expect } from 'vitest';
import { filterHistory, buildCsvRows, HistoryFilters, ExportField } from './opportunityHistoryUtils';
import type { OpportunityHistory } from '@/pages/dashboard/opportunities-data';

const baseUser = { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' };
const sample: OpportunityHistory[] = [
  {
    id: '1',
    opportunity_id: 'opp1',
    old_probability: 10,
    new_probability: 20,
    old_stage: 'prospecting',
    new_stage: 'qualification',
    changed_by: 'user1',
    changed_at: new Date('2025-12-30T10:00:00Z').toISOString(),
    changer: baseUser,
  },
  {
    id: '2',
    opportunity_id: 'opp1',
    old_probability: 20,
    new_probability: 20,
    old_stage: 'qualification',
    new_stage: 'qualification',
    changed_by: 'user2',
    changed_at: new Date('2025-12-31T10:00:00Z').toISOString(),
    changer: { first_name: 'John', last_name: 'Smith', email: 'john@example.com' },
  },
  {
    id: '3',
    opportunity_id: 'opp1',
    old_probability: 30,
    new_probability: 40,
    old_stage: 'needs_analysis',
    new_stage: 'needs_analysis',
    changed_by: 'user3',
    changed_at: new Date('2026-01-01T10:00:00Z').toISOString(),
    changer: baseUser,
  },
];

describe('opportunityHistoryUtils', () => {
  it('filters by date range', () => {
    const filters: HistoryFilters = { startDate: '2025-12-31', endDate: '2026-01-01' };
    const res = filterHistory(sample, filters);
    expect(res.map((h) => h.id)).toEqual(['2', '3']);
  });

  it('filters by type stage', () => {
    const filters: HistoryFilters = { type: 'stage' };
    const res = filterHistory(sample, filters);
    expect(res.map((h) => h.id)).toEqual(['1']);
  });

  it('filters by type probability', () => {
    const filters: HistoryFilters = { type: 'probability' };
    const res = filterHistory(sample, filters);
    expect(res.map((h) => h.id)).toEqual(['1', '3']);
  });

  it('filters by both', () => {
    const filters: HistoryFilters = { type: 'both' };
    const res = filterHistory(sample, filters);
    expect(res.map((h) => h.id)).toEqual(['1']);
  });

  it('filters by query on user name', () => {
    const filters: HistoryFilters = { query: 'john' };
    const res = filterHistory(sample, filters);
    expect(res.map((h) => h.id)).toEqual(['2']);
  });

  it('builds csv rows with selected fields', () => {
    const fields: ExportField[] = ['changed_at', 'old_stage', 'new_stage', 'changed_by_name', 'changed_by_email'];
    const rows = buildCsvRows(sample.slice(0, 1), fields);
    expect(rows[0]['changed_at']).toBe(sample[0].changed_at);
    expect(rows[0]['old_stage']).toBe('prospecting');
    expect(rows[0]['new_stage']).toBe('qualification');
    expect(rows[0]['changed_by_name']).toBe('Jane Doe');
    expect(rows[0]['changed_by_email']).toBe('jane@example.com');
  });
});

