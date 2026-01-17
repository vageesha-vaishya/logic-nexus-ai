import { describe, it, expect } from 'vitest';
import { rewriteInsertsWithOnConflict } from './pgDumpImportConflict';

describe('rewriteInsertsWithOnConflict', () => {
  it('leaves statements unchanged in error mode', () => {
    const stmts = ['INSERT INTO public.test (id, value) VALUES (1, \'a\');'];
    const map = new Map<string, string[]>();
    const result = rewriteInsertsWithOnConflict(stmts, 'error', map);
    expect(result).toEqual(stmts);
  });

  it('adds ON CONFLICT DO NOTHING in skip mode', () => {
    const stmts = ['INSERT INTO public.test (id, value) VALUES (1, \'a\');'];
    const map = new Map<string, string[]>();
    const result = rewriteInsertsWithOnConflict(stmts, 'skip', map);
    expect(result[0]).toContain('ON CONFLICT DO NOTHING');
    expect(result[0].trim().endsWith(';')).toBe(true);
  });

  it('does not rewrite when INSERT already has ON CONFLICT', () => {
    const stmts = ['INSERT INTO public.test (id, value) VALUES (1, \'a\') ON CONFLICT DO NOTHING;'];
    const map = new Map<string, string[]>();
    const result = rewriteInsertsWithOnConflict(stmts, 'skip', map);
    expect(result).toEqual(stmts);
  });

  it('adds ON CONFLICT DO UPDATE when primary key is known', () => {
    const stmts = ['INSERT INTO public.test (id, value) VALUES (1, \'a\');'];
    const map = new Map<string, string[]>();
    map.set('public.test', ['id']);
    const result = rewriteInsertsWithOnConflict(stmts, 'update', map);
    expect(result[0]).toContain('ON CONFLICT ("id") DO UPDATE SET "value" = EXCLUDED."value"');
  });

  it('uses DO NOTHING when all columns are key columns', () => {
    const stmts = ['INSERT INTO public.test (id) VALUES (1);'];
    const map = new Map<string, string[]>();
    map.set('public.test', ['id']);
    const result = rewriteInsertsWithOnConflict(stmts, 'update', map);
    expect(result[0]).toContain('ON CONFLICT DO NOTHING');
  });

  it('handles schema-qualified table names and mixed case', () => {
    const stmts = ['INSERT INTO "Public"."Test" ("Id", "Value") VALUES (1, \'a\');'];
    const map = new Map<string, string[]>();
    map.set('public.test', ['Id']);
    const result = rewriteInsertsWithOnConflict(stmts, 'update', map);
    expect(result[0]).toContain('ON CONFLICT ("Id") DO UPDATE SET "Value" = EXCLUDED."Value"');
  });

  it('respects per-table overrides', () => {
    const stmts = [
      'INSERT INTO public.test (id, value) VALUES (1, \'a\');',
      'INSERT INTO public.audit_log_entries (id, payload) VALUES (1, \'x\');',
    ];
    const map = new Map<string, string[]>();
    map.set('public.test', ['id']);
    map.set('public.audit_log_entries', ['id']);
    const overrides = {
      'public.audit_log_entries': 'error' as const,
    };
    const result = rewriteInsertsWithOnConflict(stmts, 'update', map, overrides);
    expect(result[0]).toContain('ON CONFLICT ("id") DO UPDATE');
    expect(result[1]).toEqual(stmts[1]);
  });
});
