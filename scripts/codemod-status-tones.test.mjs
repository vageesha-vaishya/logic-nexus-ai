import { describe, expect, it } from 'vitest';
import { rewriteClassString } from './codemod-status-tones.mjs';

describe('rewriteClassString', () => {
  it('rewrites a same-hue surface/text pair and drops its dark: siblings', () => {
    const r = rewriteClassString('rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2');
    expect(r.output).toBe('rounded bg-status-success text-status-success-foreground px-2');
    expect(r.manual).toEqual([]);
  });

  it('maps every hue family', () => {
    expect(rewriteClassString('bg-amber-100 text-amber-700').output).toBe('bg-status-warning text-status-warning-foreground');
    expect(rewriteClassString('bg-rose-50 text-rose-600').output).toBe('bg-status-danger text-status-danger-foreground');
    expect(rewriteClassString('bg-indigo-100 text-indigo-800').output).toBe('bg-status-info text-status-info-foreground');
    expect(rewriteClassString('bg-slate-100 text-slate-700').output).toBe('bg-status-neutral text-status-neutral-foreground');
    expect(rewriteClassString('bg-violet-100 text-violet-800').output).toBe('bg-status-special text-status-special-foreground');
  });

  it('rewrites hover: surface siblings to the tone surface', () => {
    expect(rewriteClassString('bg-red-100 text-red-800 hover:bg-red-200').output).toBe('bg-status-danger text-status-danger-foreground hover:bg-status-danger/80');
  });

  it('scopes dark: sibling stripping to the hue actually rewritten, not the whole tone family', () => {
    const r = rewriteClassString('bg-green-100 text-green-800 dark:bg-emerald-900 dark:text-emerald-200');
    expect(r.output).toBe('bg-status-success text-status-success-foreground dark:bg-emerald-900 dark:text-emerald-200');
  });

  it('scopes hover: sibling rewriting to the hue actually rewritten, not the whole tone family', () => {
    const r = rewriteClassString('bg-green-100 text-green-800 hover:bg-teal-200');
    expect(r.output).toBe('bg-status-success text-status-success-foreground hover:bg-teal-200');
  });

  it('leaves mixed-hue pairs and lone colours alone but reports them', () => {
    const r = rewriteClassString('bg-blue-100 text-gray-800');
    expect(r.output).toBe('bg-blue-100 text-gray-800');
    expect(r.manual).toEqual(['bg-blue-100 text-gray-800']);
    expect(rewriteClassString('text-emerald-600').output).toBe('text-emerald-600');
  });

  it('consumes an opacity suffix on a hover: sibling instead of producing an invalid /80/NN class', () => {
    expect(rewriteClassString('bg-green-500/10 text-green-600 hover:bg-green-500/20').output)
      .toBe('bg-status-success text-status-success-foreground hover:bg-status-success/80');
  });

  it('drops dark:hover: siblings of the rewritten hue', () => {
    expect(rewriteClassString('bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-900/50').output)
      .toBe('bg-status-success text-status-success-foreground hover:bg-status-success/80');
  });

  it('rewrites a same-hue border sibling to the tone border token, but not a variant-prefixed one', () => {
    expect(rewriteClassString('bg-amber-50 text-amber-700 border-amber-200').output)
      .toBe('bg-status-warning text-status-warning-foreground border-status-warning-border');
    expect(rewriteClassString('bg-amber-50 text-amber-700 border-amber-500/20 hover:border-amber-400').output)
      .toBe('bg-status-warning text-status-warning-foreground border-status-warning-border hover:border-amber-400');
  });

  it('does not treat a dark:-prefixed surface as the start of a pair', () => {
    const r = rewriteClassString('bg-red-100 dark:bg-red-900/20 text-red-900 dark:text-red-100');
    expect(r.output).toBe('bg-red-100 dark:bg-red-900/20 text-red-900 dark:text-red-100');
    expect(r.manual).toEqual([]);
  });

  it('is idempotent', () => {
    const once = rewriteClassString('bg-green-100 text-green-800').output;
    expect(rewriteClassString(once).output).toBe(once);
  });
});
