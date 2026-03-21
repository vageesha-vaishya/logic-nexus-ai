import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  AmroAssetRegistryRecord,
  AmroAuthorityLevel,
  AmroComplianceRulePack,
  AmroEvidenceRecord,
  AmroMaterialPlanningRecord,
  AmroPredictiveRecommendation,
  AmroQualification,
  AmroWorkPackage,
} from '../workspace/amroWorkspaceModel';
import {
  buildComplianceCoverage,
  buildMaterialsPlanningSummary,
  buildPredictiveMaintenanceSummary,
  canPerformAuthoritySignOff,
  canTransitionWorkPackageLifecycle,
  getNextWorkPackageLifecycleStage,
} from '../workspace/amroWorkspaceModel';

const initialAssets: AmroAssetRegistryRecord[] = [
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

const initialWorkPackages: AmroWorkPackage[] = [
  {
    id: 'wp-1',
    packageNumber: 'WP-2026-031',
    lifecycleStage: 'create',
    assetId: 'asset-1',
    tasks: [
      { id: 'task-1', workPackageId: 'wp-1', title: 'Incoming defect triage', lifecycleStage: 'create', assignedRole: 'planner', completed: false },
      { id: 'task-2', workPackageId: 'wp-1', title: 'Inspection work card build', lifecycleStage: 'plan', assignedRole: 'planner', completed: false },
    ],
  },
  {
    id: 'wp-2',
    packageNumber: 'WP-2026-032',
    lifecycleStage: 'schedule',
    assetId: 'asset-2',
    tasks: [
      { id: 'task-3', workPackageId: 'wp-2', title: 'Engine borescope check', lifecycleStage: 'schedule', assignedRole: 'technician', completed: false },
      { id: 'task-4', workPackageId: 'wp-2', title: 'QA readiness gate', lifecycleStage: 'execute', assignedRole: 'inspector', completed: false },
    ],
  },
];

const initialQualifications: AmroQualification[] = [
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

const initialRulePacks: AmroComplianceRulePack[] = [
  { id: 'rc-1', authority: 'FAA', ruleVersion: '2026.1', active: true },
  { id: 'rc-2', authority: 'EASA', ruleVersion: '2026.2', active: true },
  { id: 'rc-3', authority: 'SACAA', ruleVersion: '2026.1', active: true },
  { id: 'rc-4', authority: 'ISO_55000', ruleVersion: '2014.9', active: true },
];

const initialEvidenceChain: AmroEvidenceRecord[] = [
  { id: 'ev-1', entityType: 'work_package', entityId: 'wp-1', hash: 'sha256:8df2a39aaad9', immutable: true, createdAt: '2026-03-20T11:40:00.000Z' },
  { id: 'ev-2', entityType: 'task', entityId: 'task-3', hash: 'sha256:9ab12cdaa8be', immutable: true, createdAt: '2026-03-20T12:30:00.000Z' },
  { id: 'ev-3', entityType: 'inspection', entityId: 'task-4', hash: 'sha256:5a72c3ef8a71', immutable: true, createdAt: '2026-03-20T12:55:00.000Z' },
];

const initialMaterials: AmroMaterialPlanningRecord[] = [
  { id: 'mat-1', partNumber: 'PN-ATA72-889', reservationStatus: 'reserved', repairAction: 'install', supplierEta: '2026-03-24T09:00:00.000Z' },
  { id: 'mat-2', partNumber: 'PN-ATA27-190', reservationStatus: 'pending', repairAction: 'repair', supplierEta: '2026-03-26T09:00:00.000Z' },
  { id: 'mat-3', partNumber: 'PN-ATA32-672', reservationStatus: 'shortage', repairAction: 'remove', supplierEta: '2026-03-29T09:00:00.000Z' },
];

const initialPredictiveRecommendations: AmroPredictiveRecommendation[] = [
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

export function useAmroWorkspaceState() {
  const { hasPermission, hasRole, isPlatformAdmin } = useAuth();
  const [assets] = useState<AmroAssetRegistryRecord[]>(initialAssets);
  const [workPackages, setWorkPackages] = useState<AmroWorkPackage[]>(initialWorkPackages);
  const [selectedWorkPackageId, setSelectedWorkPackageId] = useState<string>(initialWorkPackages[0]?.id ?? '');
  const [requiredAuthority, setRequiredAuthority] = useState<AmroAuthorityLevel>('supervisor');
  const [selectedQualificationId, setSelectedQualificationId] = useState<string>(initialQualifications[0]?.id ?? '');
  const [qualifications] = useState<AmroQualification[]>(initialQualifications);
  const [rulePacks] = useState<AmroComplianceRulePack[]>(initialRulePacks);
  const [evidenceChain] = useState<AmroEvidenceRecord[]>(initialEvidenceChain);
  const [materials] = useState<AmroMaterialPlanningRecord[]>(initialMaterials);
  const [predictiveRecommendations] = useState<AmroPredictiveRecommendation[]>(initialPredictiveRecommendations);

  const selectedWorkPackage = useMemo(
    () => workPackages.find((item) => item.id === selectedWorkPackageId) ?? workPackages[0] ?? null,
    [selectedWorkPackageId, workPackages]
  );

  const selectedQualification = useMemo(
    () => qualifications.find((item) => item.id === selectedQualificationId) ?? qualifications[0] ?? null,
    [qualifications, selectedQualificationId]
  );

  const isAmroAuthorized = useMemo(() => {
    if (isPlatformAdmin()) return true;
    return hasPermission('*') || hasRole('tenant_admin') || hasRole('franchise_admin');
  }, [hasPermission, hasRole, isPlatformAdmin]);

  const canAdvanceLifecycle = useMemo(() => {
    if (!isAmroAuthorized || !selectedWorkPackage) return false;
    return selectedWorkPackage.lifecycleStage !== 'close';
  }, [isAmroAuthorized, selectedWorkPackage]);

  const canSignOff = useMemo(() => {
    if (!selectedQualification) return false;
    return canPerformAuthoritySignOff(selectedQualification, requiredAuthority);
  }, [requiredAuthority, selectedQualification]);

  const complianceCoverage = useMemo(() => buildComplianceCoverage(rulePacks), [rulePacks]);
  const materialsSummary = useMemo(() => buildMaterialsPlanningSummary(materials), [materials]);
  const predictiveSummary = useMemo(
    () => buildPredictiveMaintenanceSummary(predictiveRecommendations),
    [predictiveRecommendations]
  );

  const advanceWorkPackageLifecycle = () => {
    if (!selectedWorkPackage || !canAdvanceLifecycle) return false;
    const nextStage = getNextWorkPackageLifecycleStage(selectedWorkPackage.lifecycleStage);
    if (!canTransitionWorkPackageLifecycle(selectedWorkPackage.lifecycleStage, nextStage)) return false;
    setWorkPackages((previous) =>
      previous.map((item) =>
        item.id === selectedWorkPackage.id
          ? { ...item, lifecycleStage: nextStage, tasks: item.tasks.map((task) => ({ ...task, lifecycleStage: nextStage })) }
          : item
      )
    );
    return nextStage;
  };

  return {
    assets,
    workPackages,
    selectedWorkPackage,
    selectedWorkPackageId,
    setSelectedWorkPackageId,
    requiredAuthority,
    setRequiredAuthority,
    qualifications,
    selectedQualificationId,
    setSelectedQualificationId,
    selectedQualification,
    rulePacks,
    evidenceChain,
    materials,
    predictiveRecommendations,
    isAmroAuthorized,
    canAdvanceLifecycle,
    canSignOff,
    complianceCoverage,
    materialsSummary,
    predictiveSummary,
    advanceWorkPackageLifecycle,
  };
}
