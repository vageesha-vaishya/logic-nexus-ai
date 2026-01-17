export type ConflictMode = 'error' | 'skip' | 'update';

export type ConflictTargetMap = Map<string, string[]>;

export const rewriteInsertsWithOnConflict = (
  stmts: string[],
  mode: ConflictMode,
  conflictTargets: ConflictTargetMap,
  overrides?: Record<string, ConflictMode>
): string[] => {
  const out: string[] = [];
  const insertRegex =
    /INSERT\s+INTO\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]*?)\)\s*;?$/i;

  const rewriteInsert = (input: string): string => {
    const trimmed = input.trim();
    const upper = trimmed.toUpperCase();

    if (!upper.startsWith('INSERT')) return input;

    if (upper.includes('ON CONFLICT')) return input;

    const m = insertRegex.exec(input);
    if (!m) {
      if (mode === 'skip') {
        const hasSemicolon = /;\s*$/.test(input);
        const base = hasSemicolon ? input.replace(/;\s*$/, '') : input;
        return `${base} ON CONFLICT DO NOTHING${hasSemicolon ? ';' : ''}`;
      }
      return input;
    }

    const schema = (m[1] || 'public').toLowerCase();
    const table = (m[2] || '').toLowerCase();
    const colsPart = m[3];
    const key = `${schema}.${table}`;
    const effectiveMode: ConflictMode = overrides?.[key] ?? mode;

    const cols = colsPart
      .split(',')
      .map(c => c.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);

    const hasSemicolon = /;\s*$/.test(input);
    const base = hasSemicolon ? input.replace(/;\s*$/, '') : input;

    if (effectiveMode === 'error') {
      return input;
    }

    if (effectiveMode === 'skip') {
      return `${base} ON CONFLICT DO NOTHING${hasSemicolon ? ';' : ''}`;
    }

    const pk = conflictTargets.get(key);
    if (!pk || pk.length === 0) {
      return input;
    }

    const pkSet = new Set(pk.map(c => c.toLowerCase()));
    const nonKeyCols = cols.filter(c => !pkSet.has(c.toLowerCase()));

    if (nonKeyCols.length === 0) {
      return `${base} ON CONFLICT DO NOTHING${hasSemicolon ? ';' : ''}`;
    }

    const conflictTarget = pk.map(c => `"${c}"`).join(', ');
    const setList = nonKeyCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

    return `${base} ON CONFLICT (${conflictTarget}) DO UPDATE SET ${setList}${hasSemicolon ? ';' : ''}`;
  };

  for (const s of stmts) {
    const trimmed = s.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('DO $$')) {
      const lines = s.split('\n');
      const rewrittenLines = lines.map(line => {
        const lineTrimmed = line.trimStart();
        const lineUpper = lineTrimmed.toUpperCase();
        if (!lineUpper.startsWith('INSERT')) return line;
        return rewriteInsert(line);
      });
      out.push(rewrittenLines.join('\n'));
      continue;
    }

    if (!upper.startsWith('INSERT')) {
      out.push(s);
      continue;
    }

    out.push(rewriteInsert(s));
  }

  return out;
};
