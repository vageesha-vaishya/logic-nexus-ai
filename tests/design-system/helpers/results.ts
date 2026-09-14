import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, type Mode, type PageDef } from '../pages';
import { routeFor } from './route';

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
  /** Rendered text length of the content root when the readiness gate passed (see helpers/ready.ts). */
  mainTextLength?: number;
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

/** The identifying half of a CellResult; `page` may differ from `def.key` (the onboarding row). */
export type CellMeta = Pick<CellResult, 'page' | 'engine' | 'width' | 'height' | 'mode'>;

export function writeCellResult(kind: CellKind, r: CellResult): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${kind}-${r.page}-${r.engine}-${r.width}-${r.mode}.json`);
  fs.writeFileSync(file, JSON.stringify(r, null, 2));
}

/**
 * One cell's lifecycle: seeds the result (route pre-filled so an early failure
 * still identifies the page), runs `fn`, records any error on the cell and
 * rethrows it, and always writes the JSON — a cell that dies must leave a file.
 */
export async function runCell(
  kind: CellKind,
  def: PageDef,
  meta: CellMeta,
  fn: (result: CellResult, route: string) => Promise<void>,
): Promise<CellResult> {
  const result: CellResult = { ...meta, route: typeof def.route === 'string' ? def.route : def.key };
  try {
    const route = routeFor(def);
    result.route = route;
    await fn(result, route);
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    writeCellResult(kind, result);
  }
  return result;
}
