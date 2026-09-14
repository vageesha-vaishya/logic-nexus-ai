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

  it('leaves mixed-hue pairs and lone colours alone but reports them', () => {
    const r = rewriteClassString('bg-blue-100 text-gray-800');
    expect(r.output).toBe('bg-blue-100 text-gray-800');
    expect(r.manual).toEqual(['bg-blue-100 text-gray-800']);
    expect(rewriteClassString('text-emerald-600').output).toBe('text-emerald-600');
  });

  it('is idempotent', () => {
    const once = rewriteClassString('bg-green-100 text-green-800').output;
    expect(rewriteClassString(once).output).toBe(once);
  });
});
