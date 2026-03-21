import { createHash, randomUUID } from 'node:crypto';
import type { VerticalModuleKey } from './vertical-extraction-acl';

export type CanonicalComparisonRule = {
  trimStrings: boolean;
  normalizeEmailCase: boolean;
  sortArrays: boolean;
  numberPrecision: number;
};

export type DeterministicDiff = {
  path: string;
  expected: unknown;
  actual: unknown;
  category: 'missing_in_shadow' | 'missing_in_primary' | 'value_mismatch';
};

export type ReconciliationMismatch = {
  recordKey: string;
  primaryChecksum: string;
  shadowChecksum: string;
  diffs: DeterministicDiff[];
};

export type ReconciliationReport = {
  runId: string;
  moduleKey: VerticalModuleKey;
  entityKey: string;
  thresholdPercent: number;
  totalPrimaryRecords: number;
  totalShadowRecords: number;
  comparedRecords: number;
  mismatchRecords: number;
  diffRatePercent: number;
  withinThreshold: boolean;
  generatedAt: string;
  mismatches: ReconciliationMismatch[];
  canonicalRule: CanonicalComparisonRule;
};

export type ShadowModeState = {
  moduleKey: VerticalModuleKey;
  shadowReadsEnabled: boolean;
  shadowWritesEnabled: boolean;
  updatedAt: string;
};

type ReconciliationInput = {
  moduleKey: VerticalModuleKey;
  entityKey: string;
  primaryRecords: Record<string, unknown>[];
  shadowRecords: Record<string, unknown>[];
  thresholdPercent?: number;
  ruleOverrides?: Partial<CanonicalComparisonRule>;
};

const defaultRule: CanonicalComparisonRule = {
  trimStrings: true,
  normalizeEmailCase: true,
  sortArrays: true,
  numberPrecision: 6,
};

const shadowModeStore = new Map<VerticalModuleKey, ShadowModeState>([
  ['module-crm', { moduleKey: 'module-crm', shadowReadsEnabled: true, shadowWritesEnabled: true, updatedAt: new Date().toISOString() }],
  ['module-logistics', { moduleKey: 'module-logistics', shadowReadsEnabled: true, shadowWritesEnabled: true, updatedAt: new Date().toISOString() }],
  ['module-quotation', { moduleKey: 'module-quotation', shadowReadsEnabled: true, shadowWritesEnabled: true, updatedAt: new Date().toISOString() }],
  ['module-finance', { moduleKey: 'module-finance', shadowReadsEnabled: true, shadowWritesEnabled: true, updatedAt: new Date().toISOString() }],
]);

const reconciliationArtifactStore = new Map<string, ReconciliationReport>();

function toRoundedNumber(value: number, precision: number): number {
  const factor = 10 ** Math.max(0, precision);
  return Math.round(value * factor) / factor;
}

function canonicalizeValue(value: unknown, rule: CanonicalComparisonRule): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const trimmed = rule.trimStrings ? value.trim() : value;
    if (rule.normalizeEmailCase && trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }
    return trimmed;
  }
  if (typeof value === 'number') {
    return toRoundedNumber(value, rule.numberPrecision);
  }
  if (Array.isArray(value)) {
    const mapped = value.map((item) => canonicalizeValue(item, rule));
    if (!rule.sortArrays) return mapped;
    return mapped
      .map((item) => JSON.stringify(item))
      .sort((a, b) => a.localeCompare(b))
      .map((item) => JSON.parse(item));
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalizeValue((value as Record<string, unknown>)[key], rule);
        return acc;
      }, {});
  }
  return value;
}

function stableChecksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function collectDiffs(
  primary: Record<string, unknown>,
  shadow: Record<string, unknown>,
  prefix = ''
): DeterministicDiff[] {
  const primaryKeys = Object.keys(primary);
  const shadowKeys = Object.keys(shadow);
  const allKeys = Array.from(new Set([...primaryKeys, ...shadowKeys])).sort((a, b) => a.localeCompare(b));
  const diffs: DeterministicDiff[] = [];

  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const hasPrimary = Object.prototype.hasOwnProperty.call(primary, key);
    const hasShadow = Object.prototype.hasOwnProperty.call(shadow, key);
    if (!hasPrimary && hasShadow) {
      diffs.push({
        path,
        expected: undefined,
        actual: shadow[key],
        category: 'missing_in_primary',
      });
      continue;
    }
    if (hasPrimary && !hasShadow) {
      diffs.push({
        path,
        expected: primary[key],
        actual: undefined,
        category: 'missing_in_shadow',
      });
      continue;
    }

    const p = primary[key];
    const s = shadow[key];
    const pIsObject = p !== null && typeof p === 'object' && !Array.isArray(p);
    const sIsObject = s !== null && typeof s === 'object' && !Array.isArray(s);
    if (pIsObject && sIsObject) {
      diffs.push(...collectDiffs(p as Record<string, unknown>, s as Record<string, unknown>, path));
      continue;
    }
    const same = JSON.stringify(p) === JSON.stringify(s);
    if (!same) {
      diffs.push({
        path,
        expected: p,
        actual: s,
        category: 'value_mismatch',
      });
    }
  }

  return diffs.sort((a, b) => a.path.localeCompare(b.path));
}

function resolveRecordKey(record: Record<string, unknown>, index: number): string {
  const candidates = ['id', 'leadId', 'quoteId', 'shipmentId', 'invoiceId', 'key'];
  for (const candidate of candidates) {
    const value = record[candidate];
    if (value !== undefined && value !== null && String(value).trim()) {
      return `${candidate}:${String(value).trim()}`;
    }
  }
  return `index:${index}`;
}

export function setDualRunShadowMode(moduleKey: VerticalModuleKey, patch: Partial<Omit<ShadowModeState, 'moduleKey' | 'updatedAt'>>): ShadowModeState {
  const existing = shadowModeStore.get(moduleKey);
  if (!existing) throw new Error(`Unknown module for shadow mode: ${moduleKey}`);
  const next: ShadowModeState = {
    moduleKey,
    shadowReadsEnabled: patch.shadowReadsEnabled ?? existing.shadowReadsEnabled,
    shadowWritesEnabled: patch.shadowWritesEnabled ?? existing.shadowWritesEnabled,
    updatedAt: new Date().toISOString(),
  };
  shadowModeStore.set(moduleKey, next);
  return { ...next };
}

export function getDualRunShadowMode(moduleKey: VerticalModuleKey): ShadowModeState {
  const state = shadowModeStore.get(moduleKey);
  if (!state) throw new Error(`Unknown module for shadow mode: ${moduleKey}`);
  return { ...state };
}

export function resetDualRunShadowModes(): void {
  shadowModeStore.set('module-crm', { moduleKey: 'module-crm', shadowReadsEnabled: true, shadowWritesEnabled: true, updatedAt: new Date().toISOString() });
  shadowModeStore.set('module-logistics', { moduleKey: 'module-logistics', shadowReadsEnabled: true, shadowWritesEnabled: true, updatedAt: new Date().toISOString() });
  shadowModeStore.set('module-quotation', { moduleKey: 'module-quotation', shadowReadsEnabled: true, shadowWritesEnabled: true, updatedAt: new Date().toISOString() });
  shadowModeStore.set('module-finance', { moduleKey: 'module-finance', shadowReadsEnabled: true, shadowWritesEnabled: true, updatedAt: new Date().toISOString() });
}

export function getReconciliationArtifacts(limit = 50): ReconciliationReport[] {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 50)));
  return Array.from(reconciliationArtifactStore.values())
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, safeLimit);
}

export function clearReconciliationArtifacts(): void {
  reconciliationArtifactStore.clear();
}

export function buildReconciliationReport(input: ReconciliationInput): ReconciliationReport {
  const rule: CanonicalComparisonRule = {
    ...defaultRule,
    ...(input.ruleOverrides || {}),
  };
  const thresholdPercent = Number.isFinite(Number(input.thresholdPercent))
    ? Math.max(0, Math.min(100, Number(input.thresholdPercent)))
    : 0.5;

  const primaryMap = new Map<string, Record<string, unknown>>();
  input.primaryRecords.forEach((record, index) => {
    const canonical = canonicalizeValue(record, rule) as Record<string, unknown>;
    const key = resolveRecordKey(canonical, index);
    primaryMap.set(key, canonical);
  });

  const shadowMap = new Map<string, Record<string, unknown>>();
  input.shadowRecords.forEach((record, index) => {
    const canonical = canonicalizeValue(record, rule) as Record<string, unknown>;
    const key = resolveRecordKey(canonical, index);
    shadowMap.set(key, canonical);
  });

  const allKeys = Array.from(new Set([...primaryMap.keys(), ...shadowMap.keys()])).sort((a, b) => a.localeCompare(b));
  const mismatches: ReconciliationMismatch[] = [];
  for (const key of allKeys) {
    const primary = primaryMap.get(key);
    const shadow = shadowMap.get(key);
    if (!primary && shadow) {
      mismatches.push({
        recordKey: key,
        primaryChecksum: 'missing',
        shadowChecksum: stableChecksum(shadow),
        diffs: [{ path: key, expected: undefined, actual: shadow, category: 'missing_in_primary' }],
      });
      continue;
    }
    if (primary && !shadow) {
      mismatches.push({
        recordKey: key,
        primaryChecksum: stableChecksum(primary),
        shadowChecksum: 'missing',
        diffs: [{ path: key, expected: primary, actual: undefined, category: 'missing_in_shadow' }],
      });
      continue;
    }
    if (primary && shadow) {
      const diffs = collectDiffs(primary, shadow);
      if (diffs.length) {
        mismatches.push({
          recordKey: key,
          primaryChecksum: stableChecksum(primary),
          shadowChecksum: stableChecksum(shadow),
          diffs,
        });
      }
    }
  }

  const comparedRecords = allKeys.length;
  const mismatchRecords = mismatches.length;
  const diffRatePercent = comparedRecords > 0 ? toRoundedNumber((mismatchRecords / comparedRecords) * 100, 4) : 0;
  const report: ReconciliationReport = {
    runId: randomUUID(),
    moduleKey: input.moduleKey,
    entityKey: input.entityKey,
    thresholdPercent,
    totalPrimaryRecords: input.primaryRecords.length,
    totalShadowRecords: input.shadowRecords.length,
    comparedRecords,
    mismatchRecords,
    diffRatePercent,
    withinThreshold: diffRatePercent <= thresholdPercent,
    generatedAt: new Date().toISOString(),
    mismatches,
    canonicalRule: rule,
  };
  reconciliationArtifactStore.set(report.runId, report);
  return report;
}
