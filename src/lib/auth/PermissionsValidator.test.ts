import { describe, expect, it } from 'vitest';
import { detectConflicts, isSensitiveChange } from './PermissionsValidator';

describe('PermissionsValidator', () => {
  it('flags shipment create+approve and config+audit as blockers', () => {
    const conflicts = detectConflicts([
      'shipments.create',
      'shipments.approvals.manage',
      'shipments.config.manage',
      'shipments.audit.manage',
    ]);

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SOD_CREATE_APPROVE',
          severity: 'blocker',
        }),
        expect.objectContaining({
          code: 'SOD_CONFIG_AUDIT',
          severity: 'blocker',
        }),
      ]),
    );
  });

  it('flags missing view dependencies as warnings', () => {
    const conflicts = detectConflicts(['shipments.edit', 'shipments.delete']);

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EDIT_WITHOUT_VIEW',
          severity: 'warning',
        }),
        expect.objectContaining({
          code: 'DELETE_WITHOUT_VIEW',
          severity: 'warning',
        }),
      ]),
    );
  });

  it('detects sensitive escalation only for newly added sensitive permissions', () => {
    expect(isSensitiveChange(['shipments.config.manage'], ['shipments.config.manage'])).toBe(false);
    expect(isSensitiveChange(['shipments.view'], ['shipments.view', 'shipments.audit.manage'])).toBe(true);
  });
});
