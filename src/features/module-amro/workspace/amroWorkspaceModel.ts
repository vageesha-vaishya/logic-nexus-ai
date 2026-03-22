export type AmroAssetType = 'aircraft' | 'engine' | 'serialized_component' | 'heavy_asset';

export type AmroWorkPackageLifecycleStage = 'create' | 'plan' | 'schedule' | 'execute' | 'blocked' | 'close';

export type AmroAuthorityLevel = 'technician' | 'supervisor' | 'engineering' | 'qa' | 'compliance';

export type AmroRegulatoryAuthority = 'FAA' | 'EASA' | 'CAAC' | 'SACAA' | 'ISO_55000';

export type AmroAssetRegistryRecord = {
  id: string;
  assetTag: string;
  assetType: AmroAssetType;
  serialNumber: string;
  configurationState: string;
  tenantId: string;
  franchiseId: string;
};

export type AmroTask = {
  id: string;
  workPackageId: string;
  title: string;
  lifecycleStage: AmroWorkPackageLifecycleStage;
  assignedRole: 'planner' | 'technician' | 'inspector';
  completed: boolean;
};

export type AmroWorkPackage = {
  id: string;
  packageNumber: string;
  lifecycleStage: AmroWorkPackageLifecycleStage;
  assetId: string;
  tasks: AmroTask[];
};

export type AmroQualification = {
  id: string;
  staffName: string;
  authorityLevel: AmroAuthorityLevel;
  roleConstraint: string;
  signOffAuthority: boolean;
  validUntil: string;
};

export type AmroComplianceRulePack = {
  id: string;
  authority: AmroRegulatoryAuthority;
  ruleVersion: string;
  active: boolean;
};

export type AmroEvidenceRecord = {
  id: string;
  entityType: 'work_package' | 'task' | 'inspection' | 'release';
  entityId: string;
  hash: string;
  immutable: boolean;
  createdAt: string;
};

export type AmroMaterialPlanningRecord = {
  id: string;
  partNumber: string;
  reservationStatus: 'reserved' | 'pending' | 'shortage';
  repairAction: 'install' | 'remove' | 'repair';
  supplierEta: string;
  shortageSeverity: 'none' | 'watch' | 'critical';
  etaStatus: 'on_time' | 'at_risk' | 'late';
  rotableStatus: 'serviceable' | 'unserviceable' | 'quarantined';
  llpRemainingCycles: number;
  traceabilityStatus: 'verified' | 'quarantined' | 'released';
};

export type AmroPredictiveRecommendation = {
  id: string;
  digitalTwinReference: string;
  riskScore: number;
  trigger: 'telemetry' | 'calendar' | 'reliability';
  recommendation: string;
};

const lifecycleOrder: AmroWorkPackageLifecycleStage[] = ['create', 'plan', 'schedule', 'execute', 'close'];

export function canTransitionWorkPackageLifecycle(
  current: AmroWorkPackageLifecycleStage,
  next: AmroWorkPackageLifecycleStage
): boolean {
  if (next === 'blocked') {
    return current !== 'close';
  }
  if (current === 'blocked') {
    return next === 'blocked' || next === 'execute' || next === 'close';
  }
  const currentIndex = lifecycleOrder.indexOf(current);
  const nextIndex = lifecycleOrder.indexOf(next);
  if (currentIndex < 0 || nextIndex < 0) return false;
  return nextIndex === currentIndex || nextIndex === currentIndex + 1;
}

export function getNextWorkPackageLifecycleStage(
  current: AmroWorkPackageLifecycleStage
): AmroWorkPackageLifecycleStage {
  if (current === 'blocked') return 'execute';
  const currentIndex = lifecycleOrder.indexOf(current);
  if (currentIndex < 0 || currentIndex === lifecycleOrder.length - 1) return 'close';
  return lifecycleOrder[currentIndex + 1];
}

export function canPerformAuthoritySignOff(
  qualification: AmroQualification,
  requiredAuthority: AmroAuthorityLevel
): boolean {
  if (!qualification.signOffAuthority) return false;
  if (qualification.authorityLevel === requiredAuthority) return true;
  if (qualification.authorityLevel === 'compliance') return true;
  return false;
}

export function buildComplianceCoverage(rulePacks: AmroComplianceRulePack[]) {
  const activeAuthorities = rulePacks.filter((pack) => pack.active).map((pack) => pack.authority);
  return {
    totalPacks: rulePacks.length,
    activePacks: rulePacks.filter((pack) => pack.active).length,
    authorityCoverage: Array.from(new Set(activeAuthorities)),
  };
}

export function buildMaterialsPlanningSummary(materials: AmroMaterialPlanningRecord[]) {
  const shortageCount = materials.filter((material) => material.reservationStatus === 'shortage').length;
  const pendingReservations = materials.filter((material) => material.reservationStatus === 'pending').length;
  const atRiskEtaCount = materials.filter((material) => material.etaStatus === 'at_risk' || material.etaStatus === 'late').length;
  const llpAlertCount = materials.filter((material) => material.llpRemainingCycles <= 500).length;
  return {
    totalRecords: materials.length,
    shortageCount,
    pendingReservations,
    atRiskEtaCount,
    llpAlertCount,
  };
}

export function buildPredictiveMaintenanceSummary(recommendations: AmroPredictiveRecommendation[]) {
  const highRisk = recommendations.filter((item) => item.riskScore >= 0.8).length;
  const averageRisk = recommendations.length
    ? Number((recommendations.reduce((sum, item) => sum + item.riskScore, 0) / recommendations.length).toFixed(2))
    : 0;
  const telemetryTriggers = recommendations.filter((item) => item.trigger === 'telemetry').length;
  return {
    totalRecommendations: recommendations.length,
    highRisk,
    telemetryTriggers,
    averageRisk,
  };
}
