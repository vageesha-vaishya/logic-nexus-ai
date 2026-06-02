// Type aliases extracted from useAmroWorkspaceState.ts (Slice D / AMRO
// god-component split). No runtime code — pure shape definitions for
// the AMRO API responses + internal compliance/certification state.

export type ApiWorkOrder = {
  id: string;
  aircraft_id: string;
  work_order_number?: string;
  status: string;
  title: string;
  maintenance_type?: string;
};

export type WorkOrderStatus =
  | 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

export type ApiTask = {
  id: string;
  work_order_id: string;
  title: string;
  status: string;
};

export type ApiAsset = {
  id: string;
  tenant_id: string;
  franchise_id?: string | null;
  registration: string;
  aircraft_type: string;
  serial_number: string;
  status: string;
};

export type ApiQualification = {
  id: string;
  qualification_name: string;
  rating: string;
  can_certify_release: boolean;
  expiration_date?: string | null;
};

export type ApiComplianceSummary = {
  authorityCoverage?: string[];
  activeRulePacks?: number;
};

export type ApiEvidence = {
  id: string;
  entity_type: 'work_order' | 'task' | 'inspection' | 'release';
  entity_id: string;
  hash: string;
  immutable: boolean;
  created_at: string;
};

export type ApiMaterial = {
  id: string;
  part_number: string;
  status: 'pending' | 'ordered' | 'received' | 'installed' | 'cancelled' | 'returned';
  action: 'install' | 'remove' | 'inspect' | 'repair';
  received_date?: string | null;
};

export type ApiRecommendation = {
  id: string;
  digital_twin_reference: string;
  risk_score: number;
  trigger: 'telemetry' | 'calendar' | 'reliability';
  recommendation: string;
};

export type ComplianceRegulatorProfile = 'FAA' | 'EASA' | 'CAAC';

export type ApiScheduleRow = {
  schedule_id: string;
  work_order_id: string;
  station_code: string;
  slot_start: string;
  slot_end: string;
  assigned_team_size: number;
  capacity: number;
  status: string;
};

export type ApiScheduleOptimizationRecommendation = {
  recommendation_id: string;
  title: string;
  station_code: string;
  schedule_date: string;
  expected_delay_reduction_pct: number;
  confidence: number;
  rationale: string;
};

export type ApiWorkOrderReplanOption = {
  option_id: string;
  title: string;
  impact_score: number;
};

export type ApiEnvelope<T> = {
  data: T;
};

export type V2WorkOrderItem = {
  id: string;
  code?: string;
  status: string;
};

export type V2TaskItem = {
  id: string;
  workOrderId: string;
  title: string;
  status: string;
};

export type V2SavedWorkOrderView = {
  id: string;
  name: string;
  filters: {
    status: string;
    search: string;
  };
};

export const DEFAULT_WORK_PACKAGE_SAVED_VIEW: V2SavedWorkOrderView = {
  id: 'default-all',
  name: 'All Work Packages',
  filters: {
    status: 'all',
    search: '',
  },
};

export type V2SchedulesResponse = {
  output?: {
    schedules?: ApiScheduleRow[];
  };
  error?: string;
};

export type V2WorkOrdersResponse = {
  data?: {
    workOrders?: V2WorkOrderItem[];
  };
  savedViews?: V2SavedWorkOrderView[];
  error?: string;
};

export type V2ScheduleOptimizationResponse = {
  output?: {
    recommendations?: ApiScheduleOptimizationRecommendation[];
  };
  error?: string;
};

export type ComplianceExplainabilityState = {
  decision: 'pass' | 'fail';
  blockerCount: number;
  blockers: string[];
  policyVersion: string;
};

export type ComplianceAuditReplayState = {
  capability: 'work-orders' | 'tasks' | 'compliance-gates';
  format: 'csv' | 'json';
  eventCount: number;
  events: Array<{ sequence: number; recordId: string; action: string; createdAt: string }>;
};

export type ComplianceAnomalyAlert = {
  severity: string;
  code: string;
  metric: number;
};

export type ComplianceRegulatorProfilePackState = {
  regulatorProfile: ComplianceRegulatorProfile;
  obligations: string[];
  gateRules: string[];
};

export type CertificationAuthorityProfile = 'FAA' | 'EASA' | 'CAAC';

export type CertificationDecisionOption = 'approve' | 'reject' | 'defer';

export type CertificationQualificationStatusState = {
  lifecycle: 'active' | 'warning' | 'suspended';
  daysUntilExpiry: number;
  reason: string;
};

export type CertificationDecisionState = {
  actionStatus: string;
  nextAction: string;
  blockers: string[];
};

export type CertificationExpiryAutomationState = {
  warningCount: number;
  suspensionCount: number;
  evaluatedCount: number;
};

export type CertificationCompetencyAnalyticsState = {
  totalQualifiedStaff: number;
  activeCertifiers: number;
  warningWindowStaff: number;
  suspendedCertifiers: number;
  authorityDistribution: Record<string, number>;
};

export type CertificationTemplateState = {
  templateId: string;
  authorityProfile: CertificationAuthorityProfile;
  requiredSignatures: string[];
  mandatoryChecks: string[];
  deferMaxDays: number;
};

export type CreateWorkOrderOptions = {
  aircraftId?: string;
  maintenanceType?: 'line' | 'base' | 'hangar' | 'shop';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  plannedStartIso?: string;
  plannedEndIso?: string;
  station?: string;
  scopeItems?: string[];
  taskPlan?: string[];
  revision?: string;
  assignedRole?: string;
  workflowStatus?: 'planning' | 'scheduled' | 'in_progress' | 'blocked';
  taskSnapshot?: Array<{
    id: string;
    taskNumber: string;
    title: string;
    dueBasis: string;
    estimatedManHours: string;
    category: string;
  }>;
  clientMetadata?: Record<string, unknown>;
};
