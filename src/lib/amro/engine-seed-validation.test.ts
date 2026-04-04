import { describe, expect, it } from 'vitest';

import {
  isEngineParameterName,
  validateAviationIdentifiers,
  validateComponentHierarchy,
  validateEngineParameterRange,
  validateFlightPhase,
  validateMaintenanceChronology,
} from './engine-seed-validation';

describe('engine-seed-validation', () => {
  it('accepts valid engine parameter names and ranges', () => {
    expect(isEngineParameterName('egt_c')).toBe(true);
    expect(validateEngineParameterRange('egt_c', 920)).toBe(true);
    expect(validateEngineParameterRange('thrust_takeoff_lbf', 32000)).toBe(true);
    expect(validateEngineParameterRange('sfc_lbf_per_lbf_hr', 0.46)).toBe(true);
  });

  it('rejects out-of-range engine parameters', () => {
    expect(validateEngineParameterRange('egt_c', 1001)).toBe(false);
    expect(validateEngineParameterRange('thrust_cruise_lbf', 4500)).toBe(false);
    expect(validateEngineParameterRange('oil_pressure_psi', 20)).toBe(false);
    expect(validateEngineParameterRange('efficiency_pct', 101)).toBe(false);
  });

  it('treats unknown parameters as pass-through', () => {
    expect(isEngineParameterName('unknown_metric')).toBe(false);
    expect(validateEngineParameterRange('unknown_metric', 99999)).toBe(true);
  });

  it('validates aviation identifiers', () => {
    expect(validateAviationIdentifiers('AMRO-ENG-TA-0001', 'AUTOENG-L-MOD-001', 'AD-CFM56-4021')).toBe(true);
    expect(validateAviationIdentifiers('AMRO-LUBE-PMP-0201', 'AUTOENG-R-LS-201', 'SB-CFM56-5020')).toBe(true);
  });

  it('rejects invalid aviation identifiers', () => {
    expect(validateAviationIdentifiers('bad part', 'AUTOENG-R-LS-201', 'SB-CFM56-5020')).toBe(false);
    expect(validateAviationIdentifiers('AMRO-LUBE-PMP-0201', 'bad serial', 'SB-CFM56-5020')).toBe(false);
    expect(validateAviationIdentifiers('AMRO-LUBE-PMP-0201', 'AUTOENG-R-LS-201', 'INVALID-REF')).toBe(false);
  });

  it('validates maintenance chronology', () => {
    const valid = [
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T01:00:00.000Z',
      '2026-01-02T01:00:00.000Z',
    ];
    const invalid = [
      '2026-01-01T00:00:00.000Z',
      '2025-12-31T23:00:00.000Z',
    ];

    expect(validateMaintenanceChronology(valid)).toBe(true);
    expect(validateMaintenanceChronology(invalid)).toBe(false);
    expect(validateMaintenanceChronology(['invalid-date'])).toBe(true);
    expect(validateMaintenanceChronology(['2026-01-01T00:00:00.000Z', 'invalid-date'])).toBe(false);
  });

  it('validates supported flight phases', () => {
    expect(validateFlightPhase('takeoff')).toBe(true);
    expect(validateFlightPhase('cruise')).toBe(true);
    expect(validateFlightPhase('landing')).toBe(true);
    expect(validateFlightPhase('holding')).toBe(false);
  });

  it('validates component hierarchy integrity', () => {
    const validNodes = [
      { id: 'ENG-L', parentId: null },
      { id: 'FUEL-PUMP-L', parentId: 'ENG-L' },
      { id: 'LUBE-PUMP-L', parentId: 'ENG-L' },
      { id: 'IGNITION-EXCITER-L', parentId: 'ENG-L' },
    ];
    const missingParent = [
      { id: 'ENG-L', parentId: null },
      { id: 'FUEL-PUMP-L', parentId: 'ENG-NON-EXISTENT' },
    ];
    const cyclic = [
      { id: 'A', parentId: 'C' },
      { id: 'B', parentId: 'A' },
      { id: 'C', parentId: 'B' },
    ];

    expect(validateComponentHierarchy(validNodes)).toBe(true);
    expect(validateComponentHierarchy(missingParent)).toBe(false);
    expect(validateComponentHierarchy(cyclic)).toBe(false);
  });
});
