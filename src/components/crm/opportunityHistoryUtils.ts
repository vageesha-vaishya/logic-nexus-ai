import { OpportunityHistory } from '@/pages/dashboard/opportunities-data';

export type HistoryTypeFilter = 'any' | 'stage' | 'probability' | 'both';

export type HistoryFilters = {
  startDate?: string;
  endDate?: string;
  type?: HistoryTypeFilter;
  query?: string;
};

export type HistoryFilterPreset = {
  id: string;
  name: string;
  filters: HistoryFilters;
};

export function filterHistory(items: OpportunityHistory[], filters: HistoryFilters): OpportunityHistory[] {
  const { startDate, endDate, type = 'any', query = '' } = filters;
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const endInclusive = end ? new Date(end.getTime() + 24 * 60 * 60 * 1000) : null;
  const q = query.trim().toLowerCase();

  return items.filter((h) => {
    const changed = new Date(h.changed_at);
    if (start && changed < start) return false;
    if (endInclusive && changed >= endInclusive) return false;

    const stageChanged = h.old_stage !== h.new_stage;
    const probChanged = h.old_probability !== h.new_probability;
    if (type === 'stage' && !stageChanged) return false;
    if (type === 'probability' && !probChanged) return false;
    if (type === 'both' && !(stageChanged && probChanged)) return false;

    if (q) {
      const by = h.changer
        ? `${h.changer.first_name} ${h.changer.last_name} ${h.changer.email}`.toLowerCase()
        : (h.changed_by || '').toLowerCase();
      const oldStage = h.old_stage || '';
      const newStage = h.new_stage || '';
      const text = `${by} ${oldStage} ${newStage} ${String(h.old_probability ?? '')} ${String(h.new_probability ?? '')}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}

export type ExportField =
  | 'changed_at'
  | 'old_stage'
  | 'new_stage'
  | 'old_probability'
  | 'new_probability'
  | 'changed_by_name'
  | 'changed_by_email';

export function buildCsvRows(items: OpportunityHistory[], fields: ExportField[]): Array<Record<string, string | number | null>> {
  return items.map((h) => {
    const row: Record<string, string | number | null> = {};
    for (const f of fields) {
      if (f === 'changed_at') row[f] = new Date(h.changed_at).toISOString();
      else if (f === 'old_stage') row[f] = h.old_stage ?? null;
      else if (f === 'new_stage') row[f] = h.new_stage ?? null;
      else if (f === 'old_probability') row[f] = h.old_probability ?? null;
      else if (f === 'new_probability') row[f] = h.new_probability ?? null;
      else if (f === 'changed_by_name') row[f] = h.changer ? `${h.changer.first_name} ${h.changer.last_name}` : null;
      else if (f === 'changed_by_email') row[f] = h.changer?.email ?? null;
    }
    return row;
  });
}
