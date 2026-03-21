import { describe, expect, it } from 'vitest';
import {
  adaptLegacyComplianceGates,
  adaptLegacyTasks,
  adaptLegacyWorkPackages,
  adaptModuleComplianceGatesFromLegacy,
  adaptModuleTasksFromLegacy,
  adaptModuleWorkPackagesFromLegacy,
} from './anti-corruption-adapter';

describe('AMRO anti-corruption adapter', () => {
  it('maps legacy work package rows to module surface fields', () => {
    const rows = [
      {
        legacy_id: 'legacy-wp-001',
        legacy_code: 'WP-001',
        legacy_title: 'Legacy Structural Inspection',
        legacy_status: 'planned' as const,
        tenant_id: 'tenant-1',
        franchise_id: 'fr-1',
      },
    ];

    const legacyItems = adaptLegacyWorkPackages(rows);
    const moduleItems = adaptModuleWorkPackagesFromLegacy(rows);

    expect(legacyItems[0].id).toBe('legacy-wp-001');
    expect(moduleItems[0].id).toBe('amro-wp-001');
    expect(moduleItems[0].title).toBe('AMRO Structural Inspection');
  });

  it('maps legacy task rows to module and legacy task surfaces', () => {
    const rows = [
      {
        legacy_id: 'legacy-task-002',
        work_package_id: 'WP-001',
        task_code: 'T-002',
        legacy_title: 'Legacy Avionics Wiring Continuity Test',
        legacy_status: 'in_progress' as const,
        certifier_authority_level: 'A' as const,
        tenant_id: 'tenant-1',
        franchise_id: null,
      },
    ];

    const legacyItems = adaptLegacyTasks(rows);
    const moduleItems = adaptModuleTasksFromLegacy(rows);

    expect(legacyItems[0].id).toBe('legacy-task-002');
    expect(moduleItems[0].id).toBe('amro-task-002');
    expect(moduleItems[0].title).toBe('AMRO Avionics Wiring Continuity Test');
  });

  it('maps legacy compliance rows to module and legacy compliance surfaces', () => {
    const rows = [
      {
        legacy_gate_id: 'legacy-gate-003',
        work_package_id: 'WP-002',
        task_code: 'T-003',
        decision: 'rejected' as const,
        decided_by: 'certifier-b',
        decided_at: '2026-03-20T09:00:00.000Z',
        tenant_id: 'tenant-1',
        franchise_id: 'fr-1',
      },
    ];

    const legacyItems = adaptLegacyComplianceGates(rows);
    const moduleItems = adaptModuleComplianceGatesFromLegacy(rows);

    expect(legacyItems[0].gateId).toBe('legacy-gate-003');
    expect(moduleItems[0].gateId).toBe('amro-gate-003');
    expect(moduleItems[0].decision).toBe('rejected');
  });
});
