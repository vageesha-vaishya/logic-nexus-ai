// Seed/demo fixtures extracted from useAmroWorkspaceState.ts (Slice D).
// These arrays seed the workspace's local state on first mount; they're
// progressively overwritten by API responses once the AMRO service
// returns data. Kept here rather than inline so the hook file isn't
// dominated by mock content.

import type {
  AmroAssetRegistryRecord,
  AmroComplianceRulePack,
  AmroEvidenceRecord,
  AmroMaterialPlanningRecord,
  AmroPredictiveRecommendation,
  AmroQualification,
} from '../workspace/amroWorkspaceModel';

export const initialAssets: AmroAssetRegistryRecord[] = [
  {
    id: 'asset-1',
    assetTag: 'A320-9M-ANX',
    assetType: 'aircraft',
    serialNumber: 'MSN-20411',
    configurationState: 'Line maintenance configuration baseline v12',
    tenantId: 'tenant-ops-01',
    franchiseId: 'franchise-gulf-01',
  },
  {
    id: 'asset-2',
    assetTag: 'CFM56-7B-ENG-442',
    assetType: 'engine',
    serialNumber: 'ENG-SN-884214',
    configurationState: 'Engine LLP tracking profile v7',
    tenantId: 'tenant-ops-01',
    franchiseId: 'franchise-gulf-01',
  },
  {
    id: 'asset-3',
    assetTag: 'SER-COMP-ATA27-991',
    assetType: 'serialized_component',
    serialNumber: 'CMP-SN-112390',
    configurationState: 'Flight control component revision C',
    tenantId: 'tenant-ops-01',
    franchiseId: 'franchise-gulf-01',
  },
  {
    id: 'asset-4',
    assetTag: 'HEAVY-RIG-DOCK-10',
    assetType: 'heavy_asset',
    serialNumber: 'HA-SN-44291',
    configurationState: 'Hangar dock tooling calibration active',
    tenantId: 'tenant-ops-01',
    franchiseId: 'franchise-gulf-01',
  },
];

export const initialQualifications: AmroQualification[] = [
  {
    id: 'qual-1',
    staffName: 'Alex Santos',
    authorityLevel: 'supervisor',
    roleConstraint: 'B1 mechanical certifier',
    signOffAuthority: true,
    validUntil: '2027-05-01T00:00:00.000Z',
  },
  {
    id: 'qual-2',
    staffName: 'Meera Patel',
    authorityLevel: 'compliance',
    roleConstraint: 'Regulatory release verifier',
    signOffAuthority: true,
    validUntil: '2028-02-15T00:00:00.000Z',
  },
  {
    id: 'qual-3',
    staffName: 'Jonah Wright',
    authorityLevel: 'technician',
    roleConstraint: 'Powerplant technician',
    signOffAuthority: false,
    validUntil: '2026-09-01T00:00:00.000Z',
  },
];

export const initialRulePacks: AmroComplianceRulePack[] = [
  { id: 'rc-1', authority: 'FAA', ruleVersion: '2026.1', active: true },
  { id: 'rc-2', authority: 'EASA', ruleVersion: '2026.2', active: true },
  { id: 'rc-3', authority: 'CAAC', ruleVersion: '2026.1', active: true },
  { id: 'rc-4', authority: 'SACAA', ruleVersion: '2026.1', active: true },
  { id: 'rc-5', authority: 'ISO_55000', ruleVersion: '2014.9', active: true },
];

export const initialEvidenceChain: AmroEvidenceRecord[] = [
  { id: 'ev-1', entityType: 'work_order', entityId: 'wp-1', hash: 'sha256:8df2a39aaad9', immutable: true, createdAt: '2026-03-20T11:40:00.000Z' },
  { id: 'ev-2', entityType: 'task', entityId: 'task-3', hash: 'sha256:9ab12cdaa8be', immutable: true, createdAt: '2026-03-20T12:30:00.000Z' },
  { id: 'ev-3', entityType: 'inspection', entityId: 'task-4', hash: 'sha256:5a72c3ef8a71', immutable: true, createdAt: '2026-03-20T12:55:00.000Z' },
];

export const initialMaterials: AmroMaterialPlanningRecord[] = [
  {
    id: 'mat-1',
    partNumber: 'PN-ATA72-889',
    reservationStatus: 'reserved',
    repairAction: 'install',
    supplierEta: '2026-03-24T09:00:00.000Z',
    shortageSeverity: 'none',
    etaStatus: 'on_time',
    rotableStatus: 'serviceable',
    llpRemainingCycles: 1240,
    traceabilityStatus: 'verified',
  },
  {
    id: 'mat-2',
    partNumber: 'PN-ATA27-190',
    reservationStatus: 'pending',
    repairAction: 'repair',
    supplierEta: '2026-03-26T09:00:00.000Z',
    shortageSeverity: 'watch',
    etaStatus: 'at_risk',
    rotableStatus: 'serviceable',
    llpRemainingCycles: 620,
    traceabilityStatus: 'verified',
  },
  {
    id: 'mat-3',
    partNumber: 'PN-ATA32-672',
    reservationStatus: 'shortage',
    repairAction: 'remove',
    supplierEta: '2026-03-29T09:00:00.000Z',
    shortageSeverity: 'critical',
    etaStatus: 'late',
    rotableStatus: 'quarantined',
    llpRemainingCycles: 420,
    traceabilityStatus: 'quarantined',
  },
];

export const initialPredictiveRecommendations: AmroPredictiveRecommendation[] = [
  {
    id: 'pr-1',
    digitalTwinReference: 'DT-A320-9M-ANX',
    riskScore: 0.87,
    trigger: 'telemetry',
    recommendation: 'Advance hydraulic line inspection before next 50-cycle check',
  },
  {
    id: 'pr-2',
    digitalTwinReference: 'DT-CFM56-7B-442',
    riskScore: 0.72,
    trigger: 'reliability',
    recommendation: 'Schedule compressor wash at next available night stop',
  },
  {
    id: 'pr-3',
    digitalTwinReference: 'DT-COMP-ATA27-991',
    riskScore: 0.65,
    trigger: 'calendar',
    recommendation: 'Run calibration verification in upcoming maintenance window',
  },
];
