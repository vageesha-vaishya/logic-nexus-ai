export type ConflictMode = 'error' | 'skip' | 'update';

export type ConflictTargetMap = Map<string, string[]>;

export const rewriteInsertsWithOnConflict = (
  stmts: string[],
  mode: ConflictMode,
  conflictTargets: ConflictTargetMap
): string[] => {
  if (mode === 'error') return stmts;

  const out: string[] = [];

  for (const s of stmts) {
    const trimmed = s.trim();
    const upper = trimmed.toUpperCase();

    if (!upper.startsWith('INSERT')) {
      out.push(s);
      continue;
    }

    if (upper.includes('ON CONFLICT')) {
      out.push(s);
      continue;
    }

    const insertRegex =
      /INSERT\s+INTO\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]*?)\)\s*;?$/i;
    const m = insertRegex.exec(s);
    if (!m) {
      if (mode === 'skip') {
        const hasSemicolon = /;\s*$/.test(s);
        const base = hasSemicolon ? s.replace(/;\s*$/, '') : s;
        out.push(`${base} ON CONFLICT DO NOTHING${hasSemicolon ? ';' : ''}`);
        continue;
      }
      out.push(s);
      continue;
    }

    const schema = (m[1] || 'public').toLowerCase();
    const table = (m[2] || '').toLowerCase();
    const colsPart = m[3];
    const key = `${schema}.${table}`;

    const cols = colsPart
      .split(',')
      .map(c => c.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);

    const hasSemicolon = /;\s*$/.test(s);
    const base = hasSemicolon ? s.replace(/;\s*$/, '') : s;

    if (mode === 'skip') {
      out.push(`${base} ON CONFLICT DO NOTHING${hasSemicolon ? ';' : ''}`);
      continue;
    }

    const pk = conflictTargets.get(key);
    if (!pk || pk.length === 0) {
      out.push(s);
      continue;
    }

    const pkSet = new Set(pk.map(c => c.toLowerCase()));
    const nonKeyCols = cols.filter(c => !pkSet.has(c.toLowerCase()));

    if (nonKeyCols.length === 0) {
      out.push(`${base} ON CONFLICT DO NOTHING${hasSemicolon ? ';' : ''}`);
      continue;
    }

    const conflictTarget = pk.map(c => `"${c}"`).join(', ');
    const setList = nonKeyCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

    const rewritten = `${base} ON CONFLICT (${conflictTarget}) DO UPDATE SET ${setList}${hasSemicolon ? ';' : ''}`;
    out.push(rewritten);
  }

  return out;
};
