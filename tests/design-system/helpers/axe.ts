import path from 'node:path';
import type { Page } from '@playwright/test';
import { REPO_ROOT } from '../pages';
import type { AxeViolationSummary, CellResult } from './results';

const AXE_PATH = path.join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js');
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const GATED: AxeViolationSummary['impact'][] = ['serious', 'critical'];

interface RawViolation {
  id: string;
  impact: AxeViolationSummary['impact'] | null;
  help: string;
  helpUrl: string;
  nodes: { target: string[] }[];
}

export async function runAxe(
  page: Page,
  disabledRules: { id: string; reason: string }[],
): Promise<NonNullable<CellResult['axe']>> {
  await page.addScriptTag({ path: AXE_PATH });
  const raw = await page.evaluate(
    async ([tags, disabled]) => {
      const rules: Record<string, { enabled: boolean }> = {};
      for (const id of disabled) rules[id] = { enabled: false };
      // @ts-expect-error axe is injected globally by addScriptTag
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, rules });
      return res.violations as RawViolation[];
    },
    [AXE_TAGS, disabledRules.map(r => r.id)] as const,
  );

  const violations: AxeViolationSummary[] = raw.map(v => ({
    id: v.id,
    impact: v.impact ?? 'minor',
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
    sampleTargets: v.nodes.slice(0, 3).map(n => n.target.join(' ')),
  }));

  return {
    passed: !violations.some(v => GATED.includes(v.impact)),
    violations,
    disabledRules,
  };
}
