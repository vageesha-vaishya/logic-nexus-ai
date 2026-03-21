import { describe, expect, it } from 'vitest';
import type { PluginFormConfig } from '@/services/plugins/IPlugin';
import {
  canFinalizeAcceptance,
  nextAsyncJobProgress,
  validatePluginFormBlocks,
} from './quotationWorkspaceModel';

describe('quotationWorkspaceModel', () => {
  it('enforces required plugin fields through module validation rules', () => {
    const config: PluginFormConfig = {
      sections: [
        {
          id: 's1',
          title: 'Section',
          fields: [
            { id: 'commodity', label: 'Commodity', type: 'text', required: true },
            { id: 'origin', label: 'Origin', type: 'text', required: true },
          ],
        },
      ],
    };
    const result = validatePluginFormBlocks(config, { commodity: 'Electronics', origin: '' });
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toEqual(['origin']);
  });

  it('does not block on hidden required fields and uses default values', () => {
    const config: PluginFormConfig = {
      sections: [
        {
          id: 's2',
          title: 'Section',
          fields: [
            { id: 'origin_city', label: 'Origin City', type: 'text', required: true, defaultValue: 'Dubai' },
            { id: 'internal_code', label: 'Internal Code', type: 'text', required: true, hidden: true },
            { id: 'service_type', label: 'Service Type', type: 'text', required: true },
          ],
        },
      ],
    };
    const result = validatePluginFormBlocks(config, { service_type: 'Express' });
    expect(result.isValid).toBe(true);
    expect(result.missingRequiredFields).toEqual([]);
  });

  it('requires all policy and validation gates before acceptance final commit', () => {
    expect(
      canFinalizeAcceptance({ policyPassed: true, validationPassed: true, complianceReady: false })
    ).toBe(false);
    expect(
      canFinalizeAcceptance({ policyPassed: true, validationPassed: true, complianceReady: true })
    ).toBe(true);
  });

  it('advances async import export jobs with deterministic status progression', () => {
    const queued = { id: 'job1', type: 'import' as const, status: 'queued' as const, progress: 70, retryCount: 0 };
    const running = nextAsyncJobProgress(queued);
    expect(running.progress).toBe(100);
    expect(running.status).toBe('completed');
  });
});
