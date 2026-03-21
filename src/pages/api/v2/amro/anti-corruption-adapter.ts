export type WorkPackageStatus = 'planned' | 'in_progress' | 'completed';
export type TaskStatus = 'planned' | 'in_progress' | 'completed';
export type ComplianceDecision = 'approved' | 'rejected' | 'pending';

export type LegacyWorkPackageRow = {
  legacy_id: string;
  legacy_code: string;
  legacy_title: string;
  legacy_status: WorkPackageStatus;
  tenant_id: string;
  franchise_id: string | null;
};

export type LegacyTaskRow = {
  legacy_id: string;
  work_package_id: string;
  task_code: string;
  legacy_title: string;
  legacy_status: TaskStatus;
  certifier_authority_level: 'A' | 'B' | 'C';
  tenant_id: string;
  franchise_id: string | null;
};

export type LegacyComplianceGateRow = {
  legacy_gate_id: string;
  work_package_id: string;
  task_code: string;
  decision: ComplianceDecision;
  decided_by: string | null;
  decided_at: string | null;
  tenant_id: string;
  franchise_id: string | null;
};

export type WorkPackageItem = {
  id: string;
  code: string;
  title: string;
  status: WorkPackageStatus;
  tenantId: string;
  franchiseId: string | null;
};

export type TaskItem = {
  id: string;
  workPackageId: string;
  taskCode: string;
  title: string;
  status: TaskStatus;
  certifierAuthorityLevel: 'A' | 'B' | 'C';
  tenantId: string;
  franchiseId: string | null;
};

export type ComplianceGateItem = {
  gateId: string;
  workPackageId: string;
  taskCode: string;
  decision: ComplianceDecision;
  decidedBy: string | null;
  decidedAt: string | null;
  tenantId: string;
  franchiseId: string | null;
};

function toModuleId(legacyId: string): string {
  return legacyId.startsWith('legacy-') ? legacyId.replace('legacy-', 'amro-') : `amro-${legacyId}`;
}

function toModuleTitle(legacyTitle: string): string {
  return legacyTitle.startsWith('Legacy ') ? `AMRO ${legacyTitle.slice(7)}` : legacyTitle;
}

export function adaptLegacyWorkPackages(rows: LegacyWorkPackageRow[]): WorkPackageItem[] {
  return rows.map((row) => ({
    id: row.legacy_id,
    code: row.legacy_code,
    title: row.legacy_title,
    status: row.legacy_status,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
  }));
}

export function adaptModuleWorkPackagesFromLegacy(rows: LegacyWorkPackageRow[]): WorkPackageItem[] {
  return rows.map((row) => ({
    id: toModuleId(row.legacy_id),
    code: row.legacy_code,
    title: toModuleTitle(row.legacy_title),
    status: row.legacy_status,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
  }));
}

export function adaptLegacyTasks(rows: LegacyTaskRow[]): TaskItem[] {
  return rows.map((row) => ({
    id: row.legacy_id,
    workPackageId: row.work_package_id,
    taskCode: row.task_code,
    title: row.legacy_title,
    status: row.legacy_status,
    certifierAuthorityLevel: row.certifier_authority_level,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
  }));
}

export function adaptModuleTasksFromLegacy(rows: LegacyTaskRow[]): TaskItem[] {
  return rows.map((row) => ({
    id: toModuleId(row.legacy_id),
    workPackageId: row.work_package_id,
    taskCode: row.task_code,
    title: toModuleTitle(row.legacy_title),
    status: row.legacy_status,
    certifierAuthorityLevel: row.certifier_authority_level,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
  }));
}

export function adaptLegacyComplianceGates(rows: LegacyComplianceGateRow[]): ComplianceGateItem[] {
  return rows.map((row) => ({
    gateId: row.legacy_gate_id,
    workPackageId: row.work_package_id,
    taskCode: row.task_code,
    decision: row.decision,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
  }));
}

export function adaptModuleComplianceGatesFromLegacy(rows: LegacyComplianceGateRow[]): ComplianceGateItem[] {
  return rows.map((row) => ({
    gateId: toModuleId(row.legacy_gate_id),
    workPackageId: row.work_package_id,
    taskCode: row.task_code,
    decision: row.decision,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
  }));
}
