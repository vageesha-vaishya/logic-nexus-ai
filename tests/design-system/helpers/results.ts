import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, type Mode } from '../pages';

export interface AxeViolationSummary {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  help: string;
  helpUrl: string;
  nodes: number;
  sampleTargets: string[];
}

export interface FocusStop {
  index: number;
  tag: string;
  role: string | null;
  name: string;
  visibleFocus: boolean;
  visible: boolean;
  inAriaHidden: boolean;
}

export interface CellResult {
  page: string;
  route: string;
  engine: string;
  width: number;
  height: number;
  mode: Mode;
  /** Relative to docs/design-system/verification/ */
  screenshot?: string;
  /** 'viewport' when the engine refused a full-page capture (Firefox caps at 32767px). */
  screenshotMode?: 'full' | 'viewport';
  scrollHeight?: number;
  layout?: { passed: boolean; offenders: string[] };
  axe?: { passed: boolean; violations: AxeViolationSummary[]; disabledRules: { id: string; reason: string }[] };
  keyboard?: { passed: boolean; stops: FocusStop[]; failures: string[]; focusableCount?: number };
  aria?: { passed: boolean; failures: string[]; snapshot: string };
  error?: string;
}

export type CellKind = 'matrix' | 'keyboard' | 'aria';

export function writeCellResult(kind: CellKind, r: CellResult): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${kind}-${r.page}-${r.engine}-${r.width}-${r.mode}.json`);
  fs.writeFileSync(file, JSON.stringify(r, null, 2));
}
