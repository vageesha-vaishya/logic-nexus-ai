import { afterEach, describe, expect, it } from 'vitest';
import {
  buildReconciliationReport,
  clearReconciliationArtifacts,
  getDualRunShadowMode,
  getReconciliationArtifacts,
  resetDualRunShadowModes,
  setDualRunShadowMode,
} from './dual-run-reconciliation';

describe('dual run reconciliation', () => {
  afterEach(() => {
    clearReconciliationArtifacts();
    resetDualRunShadowModes();
  });

  it('generates deterministic reconciliation report with canonical comparison rules', () => {
    const report = buildReconciliationReport({
      moduleKey: 'module-crm',
      entityKey: 'crm.lead',
      thresholdPercent: 20,
      primaryRecords: [
        { id: 'lead-1', email: 'Ops@Acme.com', stage: 'new', tags: ['a', 'b'] },
        { id: 'lead-2', email: 'sales@acme.com', stage: 'qualified', amount: 5.1234567 },
      ],
      shadowRecords: [
        { id: 'lead-1', email: 'ops@acme.com', stage: 'new', tags: ['b', 'a'] },
        { id: 'lead-2', email: 'sales@acme.com', stage: 'qualified', amount: 5.1234571 },
      ],
    });
    expect(report.mismatchRecords).toBe(0);
    expect(report.withinThreshold).toBe(true);
    expect(report.diffRatePercent).toBe(0);
  });

  it('reports mismatch rate above threshold when shadow diverges', () => {
    const report = buildReconciliationReport({
      moduleKey: 'module-quotation',
      entityKey: 'quotation.version',
      thresholdPercent: 0.5,
      primaryRecords: [
        { id: 'quote-1', total: 1200, currency: 'USD' },
        { id: 'quote-2', total: 1400, currency: 'USD' },
      ],
      shadowRecords: [
        { id: 'quote-1', total: 1200, currency: 'USD' },
        { id: 'quote-2', total: 1500, currency: 'USD' },
      ],
    });
    expect(report.mismatchRecords).toBe(1);
    expect(report.withinThreshold).toBe(false);
    expect(report.mismatches[0].recordKey).toContain('id:quote-2');
    expect(report.mismatches[0].diffs[0].path).toBe('total');
  });

  it('preserves reconciliation artifacts when shadow mode is terminated', () => {
    buildReconciliationReport({
      moduleKey: 'module-logistics',
      entityKey: 'shipment',
      thresholdPercent: 1,
      primaryRecords: [{ id: 's-1', status: 'booked' }],
      shadowRecords: [{ id: 's-1', status: 'in_transit' }],
    });
    const updatedMode = setDualRunShadowMode('module-logistics', {
      shadowReadsEnabled: false,
      shadowWritesEnabled: false,
    });
    const artifacts = getReconciliationArtifacts();
    const mode = getDualRunShadowMode('module-logistics');
    expect(updatedMode.shadowReadsEnabled).toBe(false);
    expect(updatedMode.shadowWritesEnabled).toBe(false);
    expect(mode.shadowReadsEnabled).toBe(false);
    expect(mode.shadowWritesEnabled).toBe(false);
    expect(artifacts.length).toBeGreaterThan(0);
  });
});
