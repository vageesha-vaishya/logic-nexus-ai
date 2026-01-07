import { describe, it, expect } from 'vitest';
import { buildShipmentsMatrix, detectConflicts, isSensitiveChange } from './PermissionsValidator';

describe('Shipments Permissions', () => {
  it('builds matrix correctly', () => {
    const perms = [
      'shipments.view','shipments.create','shipments.edit',
      'shipments.approvals.view',
      'shipments.reports.view',
      'shipments.config.manage',
      'shipments.audit.view',
    ];
    const m = buildShipmentsMatrix(perms);
    expect(m.core.view).toBe(true);
    expect(m.core.delete).toBe(false);
    expect(m.approvals.view).toBe(true);
    expect(m.approvals.manage).toBe(false);
    expect(m.reports.view).toBe(true);
    expect(m.config.manage).toBe(true);
    expect(m.audit.view).toBe(true);
    expect(m.audit.manage).toBe(false);
  });

  it('detects conflicts', () => {
    const perms = ['shipments.delete'];
    const c = detectConflicts(perms);
    expect(c.some(x => x.code === 'DELETE_WITHOUT_VIEW')).toBe(true);
  });

  it('requires justification for sensitive additions', () => {
    const before: string[] = [];
    const after = ['shipments.approvals.manage'];
    expect(isSensitiveChange(before, after)).toBe(true);
  });
});
