import { describe, expect, it } from 'vitest';
import {
  buildComplianceCoverage,
  buildMaterialsPlanningSummary,
  buildPredictiveMaintenanceSummary,
  canPerformAuthoritySignOff,
  canTransitionWorkPackageLifecycle,
  getNextWorkPackageLifecycleStage,
} from './amroWorkspaceModel';

describe('amroWorkspaceModel', () => {
  it('transitions lifecycle only to same or next stage', () => {
    expect(canTransitionWorkPackageLifecycle('create', 'plan')).toBe(true);
    expect(canTransitionWorkPackageLifecycle('plan', 'execute')).toBe(false);
    expect(canTransitionWorkPackageLifecycle('close', 'close')).toBe(true);
  });

  it('computes next lifecycle stage', () => {
    expect(getNextWorkPackageLifecycleStage('create')).toBe('plan');
    expect(getNextWorkPackageLifecycleStage('schedule')).toBe('execute');
    expect(getNextWorkPackageLifecycleStage('close')).toBe('close');
  });

  it('validates authority sign-off rules', () => {
    expect(
      canPerformAuthoritySignOff(
        {
          id: 'q1',
          staffName: 'A',
          authorityLevel: 'supervisor',
          roleConstraint: 'B1',
          signOffAuthority: true,
          validUntil: '2028-01-01T00:00:00.000Z',
        },
        'supervisor'
      )
    ).toBe(true);
    expect(
      canPerformAuthoritySignOff(
        {
          id: 'q2',
          staffName: 'B',
          authorityLevel: 'technician',
          roleConstraint: 'A&P',
          signOffAuthority: false,
          validUntil: '2028-01-01T00:00:00.000Z',
        },
        'technician'
      )
    ).toBe(false);
    expect(
      canPerformAuthoritySignOff(
        {
          id: 'q3',
          staffName: 'C',
          authorityLevel: 'compliance',
          roleConstraint: 'regulatory',
          signOffAuthority: true,
          validUntil: '2028-01-01T00:00:00.000Z',
        },
        'engineering'
      )
    ).toBe(true);
  });

  it('builds compliance, materials, and predictive summaries', () => {
    expect(
      buildComplianceCoverage([
        { id: 'r1', authority: 'FAA', ruleVersion: '1', active: true },
        { id: 'r2', authority: 'EASA', ruleVersion: '1', active: false },
      ])
    ).toEqual({
      totalPacks: 2,
      activePacks: 1,
      authorityCoverage: ['FAA'],
    });

    expect(
      buildMaterialsPlanningSummary([
        { id: 'm1', partNumber: 'PN-1', reservationStatus: 'shortage', repairAction: 'install', supplierEta: '2026-01-01T00:00:00.000Z' },
        { id: 'm2', partNumber: 'PN-2', reservationStatus: 'pending', repairAction: 'repair', supplierEta: '2026-01-01T00:00:00.000Z' },
        { id: 'm3', partNumber: 'PN-3', reservationStatus: 'reserved', repairAction: 'remove', supplierEta: '2026-01-01T00:00:00.000Z' },
      ])
    ).toEqual({
      totalRecords: 3,
      shortageCount: 1,
      pendingReservations: 1,
    });

    expect(
      buildPredictiveMaintenanceSummary([
        { id: 'p1', digitalTwinReference: 'DT-1', riskScore: 0.9, trigger: 'telemetry', recommendation: 'A' },
        { id: 'p2', digitalTwinReference: 'DT-2', riskScore: 0.5, trigger: 'calendar', recommendation: 'B' },
      ])
    ).toEqual({
      totalRecommendations: 2,
      highRisk: 1,
      telemetryTriggers: 1,
      averageRisk: 0.7,
    });
  });
});
