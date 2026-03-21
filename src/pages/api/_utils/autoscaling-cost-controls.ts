export type ModuleHpaPolicy = {
  moduleKey: string;
  minReplicas: number;
  maxReplicas: number;
  targetCpuUtilizationPercent: number;
  targetMemoryUtilizationPercent: number;
  stabilizationWindowSeconds: number;
  scaleUpStep: number;
  scaleDownStep: number;
  baselineStaticReplicas: number;
  updatedAt: string;
};

export type BudgetAlertPolicy = {
  moduleKey: string;
  monthlyBudgetUsd: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  updatedAt: string;
};

export type QuotaPolicy = {
  moduleKey: string;
  maxRps: number;
  maxConcurrentWorkers: number;
  updatedAt: string;
};

export type ScalingDecision = {
  moduleKey: string;
  desiredReplicas: number;
  reason:
    | 'scale_up'
    | 'scale_down'
    | 'stabilized_hold'
    | 'floor_capacity'
    | 'quota_enforced'
    | 'baseline_rollback';
  cpuUtilizationPercent: number;
  memoryUtilizationPercent: number;
  currentRps: number;
  at: string;
};

export type ScaleRollbackProfile = {
  enabled: boolean;
  reason: string;
  updatedAt: string;
};

type SpendRecord = {
  moduleKey: string;
  monthKey: string;
  amountUsd: number;
};

const hpaStore = new Map<string, ModuleHpaPolicy>();
const budgetStore = new Map<string, BudgetAlertPolicy>();
const quotaStore = new Map<string, QuotaPolicy>();
const decisionHistory = new Map<string, ScalingDecision[]>();
const spendStore = new Map<string, SpendRecord>();

let rollbackProfile: ScaleRollbackProfile = {
  enabled: false,
  reason: '',
  updatedAt: new Date().toISOString(),
};

const defaults: Array<{
  moduleKey: string;
  hpa: Omit<ModuleHpaPolicy, 'moduleKey' | 'updatedAt'>;
  budget: Omit<BudgetAlertPolicy, 'moduleKey' | 'updatedAt'>;
  quota: Omit<QuotaPolicy, 'moduleKey' | 'updatedAt'>;
}> = [
  {
    moduleKey: 'module-crm',
    hpa: {
      minReplicas: 2,
      maxReplicas: 12,
      targetCpuUtilizationPercent: 65,
      targetMemoryUtilizationPercent: 70,
      stabilizationWindowSeconds: 180,
      scaleUpStep: 2,
      scaleDownStep: 1,
      baselineStaticReplicas: 3,
    },
    budget: {
      monthlyBudgetUsd: 2200,
      warningThresholdPercent: 80,
      criticalThresholdPercent: 95,
    },
    quota: {
      maxRps: 500,
      maxConcurrentWorkers: 80,
    },
  },
  {
    moduleKey: 'module-logistics',
    hpa: {
      minReplicas: 2,
      maxReplicas: 14,
      targetCpuUtilizationPercent: 70,
      targetMemoryUtilizationPercent: 75,
      stabilizationWindowSeconds: 240,
      scaleUpStep: 2,
      scaleDownStep: 1,
      baselineStaticReplicas: 4,
    },
    budget: {
      monthlyBudgetUsd: 3100,
      warningThresholdPercent: 80,
      criticalThresholdPercent: 95,
    },
    quota: {
      maxRps: 650,
      maxConcurrentWorkers: 120,
    },
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return Math.floor(value);
}

function appendHistory(decision: ScalingDecision): void {
  const history = decisionHistory.get(decision.moduleKey) || [];
  history.push(decision);
  while (history.length > 500) history.shift();
  decisionHistory.set(decision.moduleKey, history);
}

function recentOscillationCount(moduleKey: string, lookback = 10): number {
  const history = (decisionHistory.get(moduleKey) || []).slice(-lookback);
  if (history.length < 3) return 0;
  let oscillation = 0;
  for (let i = 2; i < history.length; i += 1) {
    const a = history[i - 2];
    const b = history[i - 1];
    const c = history[i];
    if (a.reason === 'scale_up' && b.reason === 'scale_down' && c.reason === 'scale_up') oscillation += 1;
    if (a.reason === 'scale_down' && b.reason === 'scale_up' && c.reason === 'scale_down') oscillation += 1;
  }
  return oscillation;
}

export function upsertModuleHpaPolicy(input: {
  moduleKey: string;
  minReplicas?: number;
  maxReplicas?: number;
  targetCpuUtilizationPercent?: number;
  targetMemoryUtilizationPercent?: number;
  stabilizationWindowSeconds?: number;
  scaleUpStep?: number;
  scaleDownStep?: number;
  baselineStaticReplicas?: number;
}): ModuleHpaPolicy {
  const moduleKey = String(input.moduleKey || '').trim();
  if (!moduleKey) throw new Error('Missing moduleKey');
  const existing = hpaStore.get(moduleKey);
  const minReplicas = clamp(Number(input.minReplicas ?? existing?.minReplicas ?? 1), 1, 100);
  const maxReplicas = clamp(Number(input.maxReplicas ?? existing?.maxReplicas ?? 10), minReplicas, 200);
  const next: ModuleHpaPolicy = {
    moduleKey,
    minReplicas,
    maxReplicas,
    targetCpuUtilizationPercent: clamp(Number(input.targetCpuUtilizationPercent ?? existing?.targetCpuUtilizationPercent ?? 70), 30, 95),
    targetMemoryUtilizationPercent: clamp(Number(input.targetMemoryUtilizationPercent ?? existing?.targetMemoryUtilizationPercent ?? 75), 30, 95),
    stabilizationWindowSeconds: clamp(Number(input.stabilizationWindowSeconds ?? existing?.stabilizationWindowSeconds ?? 180), 30, 1800),
    scaleUpStep: clamp(Number(input.scaleUpStep ?? existing?.scaleUpStep ?? 1), 1, 20),
    scaleDownStep: clamp(Number(input.scaleDownStep ?? existing?.scaleDownStep ?? 1), 1, 20),
    baselineStaticReplicas: clamp(Number(input.baselineStaticReplicas ?? existing?.baselineStaticReplicas ?? minReplicas), minReplicas, maxReplicas),
    updatedAt: nowIso(),
  };
  hpaStore.set(moduleKey, next);
  return { ...next };
}

export function upsertBudgetAlertPolicy(input: {
  moduleKey: string;
  monthlyBudgetUsd?: number;
  warningThresholdPercent?: number;
  criticalThresholdPercent?: number;
}): BudgetAlertPolicy {
  const moduleKey = String(input.moduleKey || '').trim();
  if (!moduleKey) throw new Error('Missing moduleKey');
  const existing = budgetStore.get(moduleKey);
  const warningThresholdPercent = clamp(Number(input.warningThresholdPercent ?? existing?.warningThresholdPercent ?? 80), 10, 100);
  const criticalThresholdPercent = clamp(Number(input.criticalThresholdPercent ?? existing?.criticalThresholdPercent ?? 95), warningThresholdPercent, 120);
  const next: BudgetAlertPolicy = {
    moduleKey,
    monthlyBudgetUsd: Math.max(100, Number(input.monthlyBudgetUsd ?? existing?.monthlyBudgetUsd ?? 1000)),
    warningThresholdPercent,
    criticalThresholdPercent,
    updatedAt: nowIso(),
  };
  budgetStore.set(moduleKey, next);
  return { ...next };
}

export function upsertQuotaPolicy(input: {
  moduleKey: string;
  maxRps?: number;
  maxConcurrentWorkers?: number;
}): QuotaPolicy {
  const moduleKey = String(input.moduleKey || '').trim();
  if (!moduleKey) throw new Error('Missing moduleKey');
  const existing = quotaStore.get(moduleKey);
  const next: QuotaPolicy = {
    moduleKey,
    maxRps: Math.max(10, Math.floor(Number(input.maxRps ?? existing?.maxRps ?? 200))),
    maxConcurrentWorkers: Math.max(1, Math.floor(Number(input.maxConcurrentWorkers ?? existing?.maxConcurrentWorkers ?? 20))),
    updatedAt: nowIso(),
  };
  quotaStore.set(moduleKey, next);
  return { ...next };
}

export function setAutoscalingRollbackProfile(patch: Partial<Omit<ScaleRollbackProfile, 'updatedAt'>>): ScaleRollbackProfile {
  rollbackProfile = {
    enabled: patch.enabled ?? rollbackProfile.enabled,
    reason: patch.reason !== undefined ? String(patch.reason || '') : rollbackProfile.reason,
    updatedAt: nowIso(),
  };
  return { ...rollbackProfile };
}

export function getAutoscalingRollbackProfile(): ScaleRollbackProfile {
  return { ...rollbackProfile };
}

export function recordModuleSpend(input: {
  moduleKey: string;
  amountUsd: number;
  month?: string;
}): SpendRecord {
  const moduleKey = String(input.moduleKey || '').trim();
  if (!moduleKey) throw new Error('Missing moduleKey');
  const key = `${moduleKey}|${String(input.month || monthKey())}`;
  const existing = spendStore.get(key);
  const next: SpendRecord = {
    moduleKey,
    monthKey: String(input.month || monthKey()),
    amountUsd: Math.max(0, Number(input.amountUsd || 0)) + (existing?.amountUsd || 0),
  };
  spendStore.set(key, next);
  return { ...next };
}

export function evaluateAutoscalingDecision(input: {
  moduleKey: string;
  currentReplicas: number;
  currentRps: number;
  cpuUtilizationPercent: number;
  memoryUtilizationPercent: number;
}): ScalingDecision {
  const moduleKey = String(input.moduleKey || '').trim();
  const hpa = hpaStore.get(moduleKey);
  const quota = quotaStore.get(moduleKey);
  if (!hpa || !quota) throw new Error('Autoscaling governance is incomplete for module');
  const currentReplicas = clamp(Number(input.currentReplicas), 1, 500);
  const cpu = clamp(Number(input.cpuUtilizationPercent), 0, 100);
  const memory = clamp(Number(input.memoryUtilizationPercent), 0, 100);
  const currentRps = Math.max(0, Number(input.currentRps || 0));
  let desiredReplicas = currentReplicas;
  let reason: ScalingDecision['reason'] = 'stabilized_hold';
  if (rollbackProfile.enabled) {
    desiredReplicas = hpa.baselineStaticReplicas;
    reason = 'baseline_rollback';
  } else if (currentRps > quota.maxRps) {
    desiredReplicas = Math.max(hpa.minReplicas, Math.floor((quota.maxRps / currentRps) * currentReplicas));
    reason = 'quota_enforced';
  } else if (cpu >= hpa.targetCpuUtilizationPercent || memory >= hpa.targetMemoryUtilizationPercent) {
    desiredReplicas = Math.min(hpa.maxReplicas, currentReplicas + hpa.scaleUpStep);
    reason = 'scale_up';
  } else if (cpu <= hpa.targetCpuUtilizationPercent - 15 && memory <= hpa.targetMemoryUtilizationPercent - 15) {
    desiredReplicas = Math.max(hpa.minReplicas, currentReplicas - hpa.scaleDownStep);
    reason = desiredReplicas === hpa.minReplicas ? 'floor_capacity' : 'scale_down';
  }
  if (recentOscillationCount(moduleKey) > 2 && reason !== 'baseline_rollback') {
    desiredReplicas = Math.max(desiredReplicas, hpa.minReplicas);
    reason = 'stabilized_hold';
  }
  const decision: ScalingDecision = {
    moduleKey,
    desiredReplicas,
    reason,
    cpuUtilizationPercent: cpu,
    memoryUtilizationPercent: memory,
    currentRps,
    at: nowIso(),
  };
  appendHistory(decision);
  return decision;
}

export function evaluateBudgetAlert(input: {
  moduleKey: string;
  month?: string;
}): {
  moduleKey: string;
  monthKey: string;
  spendUsd: number;
  budgetUsd: number;
  ratioPercent: number;
  alertLevel: 'none' | 'warning' | 'critical';
} {
  const moduleKey = String(input.moduleKey || '').trim();
  const budget = budgetStore.get(moduleKey);
  if (!budget) throw new Error('Budget policy missing for module');
  const mk = String(input.month || monthKey());
  const spend = spendStore.get(`${moduleKey}|${mk}`)?.amountUsd || 0;
  const ratioPercent = budget.monthlyBudgetUsd > 0 ? Math.round((spend / budget.monthlyBudgetUsd) * 100) : 0;
  const alertLevel = ratioPercent >= budget.criticalThresholdPercent
    ? 'critical'
    : ratioPercent >= budget.warningThresholdPercent
      ? 'warning'
      : 'none';
  return {
    moduleKey,
    monthKey: mk,
    spendUsd: spend,
    budgetUsd: budget.monthlyBudgetUsd,
    ratioPercent,
    alertLevel,
  };
}

export function listModuleHpaPolicies(): ModuleHpaPolicy[] {
  return Array.from(hpaStore.values())
    .sort((a, b) => a.moduleKey.localeCompare(b.moduleKey))
    .map((entry) => ({ ...entry }));
}

export function listBudgetAlertPolicies(): BudgetAlertPolicy[] {
  return Array.from(budgetStore.values())
    .sort((a, b) => a.moduleKey.localeCompare(b.moduleKey))
    .map((entry) => ({ ...entry }));
}

export function listQuotaPolicies(): QuotaPolicy[] {
  return Array.from(quotaStore.values())
    .sort((a, b) => a.moduleKey.localeCompare(b.moduleKey))
    .map((entry) => ({ ...entry }));
}

export function getAutoscalingCostControlStatus() {
  const hpas = listModuleHpaPolicies();
  const budgets = listBudgetAlertPolicies();
  const stableModules = hpas.filter((policy) => recentOscillationCount(policy.moduleKey, 12) <= 1).length;
  const boundedSpendModules = budgets.filter((policy) => evaluateBudgetAlert({ moduleKey: policy.moduleKey }).ratioPercent <= 110).length;
  return {
    moduleCount: hpas.length,
    stableScalingModules: stableModules,
    boundedSpendModules,
    stableScalingUnderLoad: hpas.length > 0 && stableModules === hpas.length,
    boundedCloudSpendVariance: budgets.length > 0 && boundedSpendModules === budgets.length,
    rollbackProfile: getAutoscalingRollbackProfile(),
  };
}

export function resetAutoscalingCostControlsState(): void {
  hpaStore.clear();
  budgetStore.clear();
  quotaStore.clear();
  decisionHistory.clear();
  spendStore.clear();
  rollbackProfile = {
    enabled: false,
    reason: '',
    updatedAt: nowIso(),
  };
  for (const preset of defaults) {
    upsertModuleHpaPolicy({
      moduleKey: preset.moduleKey,
      ...preset.hpa,
    });
    upsertBudgetAlertPolicy({
      moduleKey: preset.moduleKey,
      ...preset.budget,
    });
    upsertQuotaPolicy({
      moduleKey: preset.moduleKey,
      ...preset.quota,
    });
  }
}

resetAutoscalingCostControlsState();
