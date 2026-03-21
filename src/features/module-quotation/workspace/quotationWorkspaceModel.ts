import type { PluginFormConfig } from '@/services/plugins/IPlugin';

export type QuotationPricingIntent = 'cost_plus' | 'market_competitive' | 'margin_protect';

export type QuotationVersionSnapshot = {
  id: string;
  versionLabel: string;
  snapshotType: 'draft' | 'immutable_snapshot';
  createdAt: string;
  author: string;
};

export type QuotationAsyncJob = {
  id: string;
  type: 'import' | 'export';
  status: 'queued' | 'running' | 'failed' | 'completed';
  progress: number;
  retryCount: number;
};

export type QuotationPolicyGateState = {
  policyPassed: boolean;
  validationPassed: boolean;
  complianceReady: boolean;
};

export type PluginFieldValue = Record<string, unknown>;

export type PluginValidationResult = {
  isValid: boolean;
  missingRequiredFields: string[];
};

export function validatePluginFormBlocks(config: PluginFormConfig | null, values: PluginFieldValue): PluginValidationResult {
  if (!config) {
    return { isValid: true, missingRequiredFields: [] };
  }
  const missingRequiredFields: string[] = [];
  for (const section of config.sections) {
    for (const field of section.fields) {
      if (!field.required) continue;
      if (field.hidden) continue;
      const value = values[field.id] ?? field.defaultValue;
      if (value === null || value === undefined || String(value).trim().length === 0) {
        missingRequiredFields.push(field.id);
      }
    }
  }
  return {
    isValid: missingRequiredFields.length === 0,
    missingRequiredFields,
  };
}

export function canFinalizeAcceptance(gates: QuotationPolicyGateState): boolean {
  return gates.policyPassed && gates.validationPassed && gates.complianceReady;
}

export function nextAsyncJobProgress(job: QuotationAsyncJob): QuotationAsyncJob {
  if (job.status === 'completed') return job;
  const nextProgress = Math.min(100, job.progress + 35);
  return {
    ...job,
    status: nextProgress === 100 ? 'completed' : 'running',
    progress: nextProgress,
  };
}
