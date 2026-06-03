export type AmroModuleId =
  | 'MOD-AMRO-01'
  | 'MOD-AMRO-02'
  | 'MOD-AMRO-03'
  | 'MOD-AMRO-04'
  | 'MOD-AMRO-05'
  | 'MOD-AMRO-06'
  | 'MOD-AMRO-07'
  | 'MOD-AMRO-08'
  | 'MOD-AMRO-09'
  | 'MOD-AMRO-10';

export type AmroModuleCatalogRow = {
  moduleId: AmroModuleId;
  module: string;
  subModules: string[];
  coreOwnershipBoundary: string;
  primaryUsers: string[];
  primaryInputs: string[];
  primaryOutputs: string[];
  coreDependencies: string[];
};

export type AmroDatabaseMappingMatrixRow = {
  moduleId: AmroModuleId;
  primaryTables: string[];
  keyFieldsUsedByModule: string[];
  criticalConstraintsAndRules: string[];
};

export type AmroTableRelationshipCrossReferenceRow = {
  relationshipPath: string;
  purpose: string;
  modulesConsumingPath: AmroModuleId[];
};

export type AmroWorkflowDataFlowMappingRow = {
  moduleId: AmroModuleId;
  workflowDiagramReference: string;
  businessLogicSequence: string;
  userInteractionPattern: string;
  dataFlowReference: string[];
};

export type AmroEndToEndArchitectureFlowchart = {
  userInterfaces: string;
  apiGateway: string;
  domainModules: Array<{
    moduleId: AmroModuleId;
    module: string;
  }>;
  mandatoryAuditLedger: {
    moduleId: AmroModuleId;
    module: string;
    rule: string;
  };
  operationalDatabase: string;
  eventBackbone: string;
  downstreamIntelligence: string;
  uiRefreshAndNotifications: string;
  externalSystemsIntegration: {
    moduleId: AmroModuleId;
    module: string;
    adapters: string;
  };
};

export type AmroImplementationSequenceMappingRow = {
  sequence: string;
  deliverableGroup: string;
  dependsOn: string[];
  blocksOrUnblocks: string;
  deploymentPriority: 'Critical' | 'High' | 'Medium';
};

export type AmroDeploymentWavePriorityMapRow = {
  wave: string;
  environment: string;
  includedSequences: string[];
  entryCriteria: string;
  exitCriteria: string;
};

export type AmroQuickLookupCrossReferenceRow = {
  module: string;
  subModules: string;
  uiUx: string;
  dbTables: string;
  workflow: string;
  apis: string;
  implementationSequence: string;
};

export const AMRO_MODULE_CATALOG: ReadonlyArray<AmroModuleCatalogRow> = [
  {
    moduleId: 'MOD-AMRO-01',
    module: 'Overview and KPI Intelligence',
    subModules: ['KPI Aggregation', 'Risk Heatmap', 'Forecast Panel', 'SLA Trends'],
    coreOwnershipBoundary: 'Read-mostly operational intelligence',
    primaryUsers: ['Management', 'planner', 'compliance lead'],
    primaryInputs: ['Work package states', 'telemetry', 'SLA targets', 'compliance events'],
    primaryOutputs: ['KPI cards', 'risk heatmaps', 'trend lines', 'anomalies'],
    coreDependencies: ['Event stream', 'analytics cache', 'forecast engine'],
  },
  {
    moduleId: 'MOD-AMRO-02',
    module: 'Work Package Management',
    subModules: ['Package CRUD', 'Status Transition Engine', 'Saved Views', 'Detail Context Panel'],
    coreOwnershipBoundary: 'Work package lifecycle control',
    primaryUsers: ['Planner', 'engineer', 'technician'],
    primaryInputs: ['Fleet schedule triggers', 'task templates', 'role permissions'],
    primaryOutputs: ['Work packages', 'status transitions', 'audit events'],
    coreDependencies: ['Scheduling', 'RBAC', 'Evidence ledger'],
  },
  {
    moduleId: 'MOD-AMRO-03',
    module: 'Task Execution and Evidence',
    subModules: ['Task Step Engine', 'Evidence Capture', 'Signature Capture', 'Offline Queue'],
    coreOwnershipBoundary: 'Technician execution and evidence quality',
    primaryUsers: ['Technician', 'inspector'],
    primaryInputs: ['Task steps', 'procedures', 'qualification rules', 'offline queue'],
    primaryOutputs: ['Step completion states', 'evidence objects', 'signatures'],
    coreDependencies: ['Mobile sync', 'signature service', 'storage'],
  },
  {
    moduleId: 'MOD-AMRO-04',
    module: 'Maintenance Scheduling',
    subModules: ['Slot Planner', 'Constraint Solver', 'Disruption Replan', 'Capacity Calendar'],
    coreOwnershipBoundary: 'Time and resource planning',
    primaryUsers: ['Planner', 'operations control'],
    primaryInputs: ['Capacity calendars', 'aircraft availability', 'constraints'],
    primaryOutputs: ['Slot assignments', 'replan proposals', 'conflict alerts'],
    coreDependencies: ['Constraint engine', 'resource registry'],
  },
  {
    moduleId: 'MOD-AMRO-05',
    module: 'Parts and Materials',
    subModules: ['Inventory Availability', 'Reservation Engine', 'Shortage Alerting', 'Supplier ETA'],
    coreOwnershipBoundary: 'Material readiness and traceability',
    primaryUsers: ['Store keeper', 'planner', 'engineer'],
    primaryInputs: ['Demand from work packages', 'stock and supplier feeds'],
    primaryOutputs: ['Reservations', 'shortage alerts', 'procurement triggers'],
    coreDependencies: ['Inventory', 'ERP adapter', 'Supplier APIs'],
  },
  {
    moduleId: 'MOD-AMRO-06',
    module: 'Compliance and Airworthiness',
    subModules: ['AD/SB Ingestion', 'MEL/CDL Policy Engine', 'Gate Evaluator', 'Dossier Assembly'],
    coreOwnershipBoundary: 'Regulatory gate enforcement',
    primaryUsers: ['Inspector', 'compliance officer'],
    primaryInputs: ['AD/SB feeds', 'MEL/CDL records', 'regulator profile'],
    primaryOutputs: ['Gate decisions', 'exceptions', 'dossiers', 'audit packages'],
    coreDependencies: ['Policy engine', 'records service'],
  },
  {
    moduleId: 'MOD-AMRO-07',
    module: 'Certification and Authority',
    subModules: ['Qualification Registry', 'Certifying Privilege Validation', 'Release Decision Flow'],
    coreOwnershipBoundary: 'Release authorization integrity',
    primaryUsers: ['Inspector', 'certifying engineer'],
    primaryInputs: ['Staff qualifications', 'authority scope', 'expiration dates'],
    primaryOutputs: ['Certification decisions', 'blocked actions', 'escalation events'],
    coreDependencies: ['IAM', 'Qualification registry'],
  },
  {
    moduleId: 'MOD-AMRO-08',
    module: 'Integration and Partner Hub',
    subModules: ['Adapter Runtime', 'Canonical Mapping', 'Idempotency/Dedup', 'Replay Queue'],
    coreOwnershipBoundary: 'External interoperability',
    primaryUsers: ['Integration engineer', 'operations'],
    primaryInputs: ['External ERP/IoT/regulator payloads'],
    primaryOutputs: ['Canonical AMRO events', 'sync statuses', 'retries'],
    coreDependencies: ['Adapter runtime', 'queue', 'mapping rules'],
  },
  {
    moduleId: 'MOD-AMRO-09',
    module: 'Forecast and Reliability',
    subModules: ['Feature Pipeline', 'Risk Scoring', 'Recommendation Engine', 'Outcome Feedback'],
    coreOwnershipBoundary: 'Predictive maintenance intelligence',
    primaryUsers: ['Planner', 'management'],
    primaryInputs: ['Telemetry features', 'historical defects', 'environmental context'],
    primaryOutputs: ['Risk scores', 'suggested interventions', 'confidence/explainability'],
    coreDependencies: ['ML pipeline', 'feature store'],
  },
  {
    moduleId: 'MOD-AMRO-10',
    module: 'Audit and Evidence Ledger',
    subModules: ['Event Append Log', 'Hash Chain Verifier', 'Replay Export', 'Security Audit Trail'],
    coreOwnershipBoundary: 'Non-repudiation and evidentiary replay',
    primaryUsers: ['Compliance officer', 'auditor', 'security analyst'],
    primaryInputs: ['State transition events', 'evidence signatures', 'integration callbacks', 'policy checkpoints'],
    primaryOutputs: ['Immutable audit events', 'hash-chain verification status', 'replay exports', 'security trail reports'],
    coreDependencies: ['Audit records schema', 'hash-chain verifier', 'replay service'],
  },
] as const;

export const AMRO_DATABASE_MAPPING_MATRIX: ReadonlyArray<AmroDatabaseMappingMatrixRow> = [
  {
    moduleId: 'MOD-AMRO-01',
    primaryTables: ['work_orders', 'maintenance_events', 'forecast_outputs'],
    keyFieldsUsedByModule: ['status', 'planned_start', 'risk_score', 'created_at'],
    criticalConstraintsAndRules: ['Tenant/franchise scope enforced', 'KPI queries use indexed status/time fields'],
  },
  {
    moduleId: 'MOD-AMRO-02',
    primaryTables: ['work_orders', 'work_order_templates', 'tasks'],
    keyFieldsUsedByModule: ['work_order_number', 'maintenance_type', 'priority', 'status'],
    criticalConstraintsAndRules: ['Unique (tenant_id, work_order_number)', 'Transition policy validation required'],
  },
  {
    moduleId: 'MOD-AMRO-03',
    primaryTables: ['tasks', 'task_evidence', 'maintenance_events', 'sync_conflicts'],
    keyFieldsUsedByModule: ['sequence', 'steps_json', 'checksum', 'signature metadata'],
    criticalConstraintsAndRules: ['Unique (work_order_id, sequence)', 'Evidence checksum mandatory'],
  },
  {
    moduleId: 'MOD-AMRO-04',
    primaryTables: ['schedules', 'schedule_constraints', 'shift_calendars'],
    keyFieldsUsedByModule: ['slot_start', 'slot_end', 'station_code', 'qualification requirements'],
    criticalConstraintsAndRules: ['Constraint solver enforces capacity', 'Constraint solver enforces certification availability'],
  },
  {
    moduleId: 'MOD-AMRO-05',
    primaryTables: ['parts_inventory', 'reservations', 'stock_movements', 'suppliers'],
    keyFieldsUsedByModule: ['part_number', 'serial_number', 'quantity_available', 'eta'],
    criticalConstraintsAndRules: ['Quantity consistency checks', 'Serialized uniqueness per tenant'],
  },
  {
    moduleId: 'MOD-AMRO-06',
    primaryTables: ['compliance_obligations', 'compliance_records', 'regulator_profiles', 'policy_snapshots'],
    keyFieldsUsedByModule: ['obligation_type', 'due_date', 'decision_status', 'policy_version'],
    criticalConstraintsAndRules: ['Mandatory obligations must pass before release', 'Policy snapshot immutability'],
  },
  {
    moduleId: 'MOD-AMRO-07',
    primaryTables: ['staff_qualifications', 'certification_actions', 'regulator_dossiers'],
    keyFieldsUsedByModule: ['expiration_date', 'can_certify_release', 'action_status'],
    criticalConstraintsAndRules: ['Expired authority blocks release', 'Issuer/regulator alignment required'],
  },
  {
    moduleId: 'MOD-AMRO-08',
    primaryTables: ['integration_jobs', 'integration_mappings', 'webhook_outbox'],
    keyFieldsUsedByModule: ['source_system', 'idempotency_key', 'replay_status'],
    criticalConstraintsAndRules: ['Idempotency and dedup required', 'Replay queue state must be durable'],
  },
  {
    moduleId: 'MOD-AMRO-09',
    primaryTables: ['asset_health_signals', 'forecast_features', 'forecast_outputs', 'forecast_decisions'],
    keyFieldsUsedByModule: ['feature_vector', 'confidence', 'recommendation_id', 'accepted'],
    criticalConstraintsAndRules: ['Model outputs traceable to feature snapshot', 'Model outputs traceable to policy context'],
  },
  {
    moduleId: 'MOD-AMRO-10',
    // Phase 8b: mro_audit.* dropped; audit lives in core.audit_log.
    primaryTables: ['maintenance_events', 'core.audit_log'],
    keyFieldsUsedByModule: ['event_hash', 'previous_hash', 'actor_id', 'timestamp'],
    criticalConstraintsAndRules: ['Append-only semantics', 'Hash-chain integrity required'],
  },
] as const;

export const AMRO_TABLE_RELATIONSHIP_CROSS_REFERENCE: ReadonlyArray<AmroTableRelationshipCrossReferenceRow> = [
  {
    relationshipPath: 'aircraft -> work_orders -> tasks -> maintenance_events',
    purpose: 'End-to-end execution trace',
    modulesConsumingPath: ['MOD-AMRO-02', 'MOD-AMRO-03', 'MOD-AMRO-10'],
  },
  {
    relationshipPath: 'work_orders -> reservations -> parts_inventory',
    purpose: 'Material readiness and shortage control',
    modulesConsumingPath: ['MOD-AMRO-05'],
  },
  {
    relationshipPath: 'work_orders -> compliance_records -> compliance_obligations',
    purpose: 'Gate pass/fail rationale',
    modulesConsumingPath: ['MOD-AMRO-06'],
  },
  {
    relationshipPath: 'tasks -> staff_qualifications -> certification_actions',
    purpose: 'Qualification and release validity',
    modulesConsumingPath: ['MOD-AMRO-07'],
  },
  {
    relationshipPath: 'integration_jobs -> webhook_outbox -> maintenance_events',
    purpose: 'External sync and internal state propagation',
    modulesConsumingPath: ['MOD-AMRO-08', 'MOD-AMRO-10'],
  },
  {
    relationshipPath: 'asset_health_signals -> forecast_outputs -> work_orders',
    purpose: 'Predictive recommendation to planned work creation',
    modulesConsumingPath: ['MOD-AMRO-09', 'MOD-AMRO-02'],
  },
] as const;

export const AMRO_WORKFLOW_DATA_FLOW_MAPPING: ReadonlyArray<AmroWorkflowDataFlowMappingRow> = [
  {
    moduleId: 'MOD-AMRO-01',
    workflowDiagramReference: '17.1 (steps 1-3, 7)',
    businessLogicSequence: 'Aggregate operational state -> compute KPIs -> publish widgets',
    userInteractionPattern: 'Filter, drill-down, export',
    dataFlowReference: ['18.1'],
  },
  {
    moduleId: 'MOD-AMRO-02',
    workflowDiagramReference: '17.1 (steps 1-3)',
    businessLogicSequence: 'Create -> enrich -> transition -> audit append',
    userInteractionPattern: 'List, drawer create, detail tab edit',
    dataFlowReference: ['18.1'],
  },
  {
    moduleId: 'MOD-AMRO-03',
    workflowDiagramReference: '17.2',
    businessLogicSequence: 'Step execute -> evidence attach -> sign -> sync/merge',
    userInteractionPattern: 'Mobile task card with offline mode',
    dataFlowReference: ['18.1', '18.3'],
  },
  {
    moduleId: 'MOD-AMRO-04',
    workflowDiagramReference: '17.1 (step 3)',
    businessLogicSequence: 'Constraint validation -> slot allocation -> replan on conflict',
    userInteractionPattern: 'Drag/drop schedule and replan prompts',
    dataFlowReference: ['18.1'],
  },
  {
    moduleId: 'MOD-AMRO-05',
    workflowDiagramReference: '17.1 (step 2-4)',
    businessLogicSequence: 'Demand detect -> reserve -> shortage escalate -> ETA update',
    userInteractionPattern: 'Inline reservation and bulk reserve actions',
    dataFlowReference: ['18.1', '18.2'],
  },
  {
    moduleId: 'MOD-AMRO-06',
    workflowDiagramReference: '17.3',
    businessLogicSequence: 'Evaluate obligations -> compute gate result -> block/allow release',
    userInteractionPattern: 'Gate modal with blockers and rationale',
    dataFlowReference: ['18.3'],
  },
  {
    moduleId: 'MOD-AMRO-07',
    workflowDiagramReference: '17.1 (step 6), 17.3',
    businessLogicSequence: 'Validate authority -> capture release decision -> dossier build',
    userInteractionPattern: 'Certification panel approve/reject/defer',
    dataFlowReference: ['18.3'],
  },
  {
    moduleId: 'MOD-AMRO-08',
    workflowDiagramReference: '17.2, 23.1',
    businessLogicSequence: 'Ingest -> map -> dedup -> apply -> replay failed jobs',
    userInteractionPattern: 'Console monitoring, retry, quarantine review',
    dataFlowReference: ['18.2'],
  },
  {
    moduleId: 'MOD-AMRO-09',
    workflowDiagramReference: '17.1 planning decision',
    businessLogicSequence: 'Score risk -> generate recommendations -> capture outcomes',
    userInteractionPattern: 'Recommendation accept/reject with reasons',
    dataFlowReference: ['18.1'],
  },
  {
    moduleId: 'MOD-AMRO-10',
    workflowDiagramReference: '17.1 (step 7), 17.3',
    businessLogicSequence: 'Append immutable event -> verify hash chain -> replay export',
    userInteractionPattern: 'Audit timeline and export filters',
    dataFlowReference: ['18.3'],
  },
] as const;

export const AMRO_END_TO_END_ARCHITECTURE_FLOWCHART: AmroEndToEndArchitectureFlowchart = {
  userInterfaces: 'SCR-AMRO-001..012',
  apiGateway: '/api/v2/amro/*, scoped auth',
  domainModules: [
    { moduleId: 'MOD-AMRO-02', module: 'Work Package' },
    { moduleId: 'MOD-AMRO-04', module: 'Scheduling' },
    { moduleId: 'MOD-AMRO-05', module: 'Materials' },
    { moduleId: 'MOD-AMRO-06', module: 'Compliance' },
    { moduleId: 'MOD-AMRO-07', module: 'Certification' },
    { moduleId: 'MOD-AMRO-03', module: 'Task Execution' },
  ],
  mandatoryAuditLedger: {
    moduleId: 'MOD-AMRO-10',
    module: 'Audit Ledger',
    rule: 'Mandatory append on state change',
  },
  operationalDatabase: 'tenant_id + franchise_id + RLS',
  eventBackbone: 'Event Outbox and Kafka',
  downstreamIntelligence: 'MOD-AMRO-01 KPI Intelligence + MOD-AMRO-09 Forecast',
  uiRefreshAndNotifications: 'UI Refresh and Notifications',
  externalSystemsIntegration: {
    moduleId: 'MOD-AMRO-08',
    module: 'Integration Hub',
    adapters: 'ERP/IoT/Regulator adapters, replay queues',
  },
} as const;

export const AMRO_IMPLEMENTATION_SEQUENCE_MAPPING: ReadonlyArray<AmroImplementationSequenceMappingRow> = [
  {
    sequence: 'S1',
    deliverableGroup: 'Schema foundation, RLS, scoped auth, audit primitives',
    dependsOn: ['None'],
    blocksOrUnblocks: 'Unblocks all modules',
    deploymentPriority: 'Critical',
  },
  {
    sequence: 'S2',
    deliverableGroup: 'Work package core (list/create/detail/transitions)',
    dependsOn: ['S1'],
    blocksOrUnblocks: 'Unblocks scheduling, materials, compliance',
    deploymentPriority: 'Critical',
  },
  {
    sequence: 'S3',
    deliverableGroup: 'Scheduling board + constraint engine',
    dependsOn: ['S1', 'S2'],
    blocksOrUnblocks: 'Unblocks execution slotting and capacity governance',
    deploymentPriority: 'High',
  },
  {
    sequence: 'S4',
    deliverableGroup: 'Task execution mobile + evidence + sync',
    dependsOn: ['S1', 'S2'],
    blocksOrUnblocks: 'Unblocks field operations and paperless flow',
    deploymentPriority: 'Critical',
  },
  {
    sequence: 'S5',
    deliverableGroup: 'Materials reservations and shortage intelligence',
    dependsOn: ['S1', 'S2', 'S3'],
    blocksOrUnblocks: 'Unblocks accurate execution and closure quality',
    deploymentPriority: 'High',
  },
  {
    sequence: 'S6',
    deliverableGroup: 'Compliance gates + certification release controls',
    dependsOn: ['S1', 'S2', 'S4'],
    blocksOrUnblocks: 'Unblocks regulator-ready release',
    deploymentPriority: 'Critical',
  },
  {
    sequence: 'S7',
    deliverableGroup: 'Integration hub adapters + monitor console',
    dependsOn: ['S1', 'S2'],
    blocksOrUnblocks: 'Unblocks ERP/IoT/regulator interoperability',
    deploymentPriority: 'High',
  },
  {
    sequence: 'S8',
    deliverableGroup: 'KPI intelligence and forecast recommendation embedding',
    dependsOn: ['S2', 'S3', 'S5', 'S7'],
    blocksOrUnblocks: 'Unblocks optimization and predictive planning',
    deploymentPriority: 'Medium',
  },
  {
    sequence: 'S9',
    deliverableGroup: 'Audit replay hardening and export controls',
    dependsOn: ['S1..S8'],
    blocksOrUnblocks: 'Unblocks full audit readiness and enterprise acceptance',
    deploymentPriority: 'Critical',
  },
  {
    sequence: 'S10',
    deliverableGroup: 'Scale/performance hardening + DR validation',
    dependsOn: ['S1..S9'],
    blocksOrUnblocks: 'Unblocks GA rollout',
    deploymentPriority: 'Critical',
  },
] as const;

export const AMRO_DEPLOYMENT_WAVE_PRIORITY_MAP: ReadonlyArray<AmroDeploymentWavePriorityMapRow> = [
  {
    wave: 'W1',
    environment: 'Dev and Integration',
    includedSequences: ['S1-S4'],
    entryCriteria: 'Core tests and RLS tests passing',
    exitCriteria: 'Create-plan-execute basic flow stable',
  },
  {
    wave: 'W2',
    environment: 'Staging Compliance',
    includedSequences: ['S5-S7'],
    entryCriteria: 'Integration contract tests passing',
    exitCriteria: 'Gate outcomes and sync replay validated',
  },
  {
    wave: 'W3',
    environment: 'Pre-Prod Performance',
    includedSequences: ['S8-S9'],
    entryCriteria: 'p95/p99 thresholds and audit replay tests passing',
    exitCriteria: 'Compliance replay and forecast UX accepted',
  },
  {
    wave: 'W4',
    environment: 'Production GA',
    includedSequences: ['S10'],
    entryCriteria: 'DR drill success, security sign-off, rollout approvals',
    exitCriteria: 'Controlled GA with SLO monitoring active',
  },
] as const;

export const AMRO_QUICK_LOOKUP_CROSS_REFERENCE: ReadonlyArray<AmroQuickLookupCrossReferenceRow> = [
  {
    module: 'Overview and KPI Intelligence',
    subModules: 'KPI Aggregation, Risk Heatmap, Forecast Panel',
    uiUx: 'SCR-001, SCR-012',
    dbTables: 'work_orders, maintenance_events, forecast_outputs',
    workflow: '17.1, 18.1',
    apis: 'API-001, API-015',
    implementationSequence: 'S8',
  },
  {
    module: 'Work Package Management',
    subModules: 'CRUD, Transitions, Detail Context',
    uiUx: 'SCR-002, SCR-003, SCR-004',
    dbTables: 'work_orders, work_order_templates, tasks',
    workflow: '17.1',
    apis: 'API-001, API-002, API-003',
    implementationSequence: 'S2',
  },
  {
    module: 'Task Execution and Evidence',
    subModules: 'Step Engine, Evidence, Offline Queue',
    uiUx: 'SCR-005',
    dbTables: 'tasks, task_evidence, maintenance_events, sync_conflicts',
    workflow: '17.2, 18.3',
    apis: 'API-006, API-007',
    implementationSequence: 'S4',
  },
  {
    module: 'Maintenance Scheduling',
    subModules: 'Planner, Solver, Replan',
    uiUx: 'SCR-006',
    dbTables: 'schedules, schedule_constraints, shift_calendars',
    workflow: '17.1',
    apis: 'API-004, API-005',
    implementationSequence: 'S3',
  },
  {
    module: 'Parts and Materials',
    subModules: 'Availability, Reservation, Shortage',
    uiUx: 'SCR-007',
    dbTables: 'parts_inventory, reservations, stock_movements, suppliers',
    workflow: '17.1, 18.2',
    apis: 'API-008, API-009',
    implementationSequence: 'S5',
  },
  {
    module: 'Compliance and Airworthiness',
    subModules: 'AD/SB, MEL/CDL, Gate Evaluator',
    uiUx: 'SCR-008',
    dbTables: 'compliance_obligations, compliance_records, policy_snapshots',
    workflow: '17.3',
    apis: 'API-010, API-011',
    implementationSequence: 'S6',
  },
  {
    module: 'Certification and Authority',
    subModules: 'Qualification, Privilege Validation, Release',
    uiUx: 'SCR-009',
    dbTables: 'staff_qualifications, certification_actions, regulator_dossiers',
    workflow: '17.1, 17.3',
    apis: 'API-012, API-013',
    implementationSequence: 'S6',
  },
  {
    module: 'Integration and Partner Hub',
    subModules: 'Adapter Runtime, Mapping, Replay Queue',
    uiUx: 'SCR-011',
    dbTables: 'integration_jobs, integration_mappings, webhook_outbox',
    workflow: '18.2',
    apis: 'API ingestion and webhook contracts',
    implementationSequence: 'S7',
  },
  {
    module: 'Forecast and Reliability',
    subModules: 'Feature Pipeline, Risk Engine, Feedback',
    uiUx: 'SCR-012',
    dbTables: 'asset_health_signals, forecast_features, forecast_outputs, forecast_decisions',
    workflow: '18.1',
    apis: 'API-015',
    implementationSequence: 'S8',
  },
  {
    module: 'Audit and Evidence Ledger',
    subModules: 'Event Append, Hash Verify, Replay Export',
    uiUx: 'SCR-010',
    dbTables: 'maintenance_events, core.audit_log',
    workflow: '18.3',
    apis: 'API-014',
    implementationSequence: 'S9',
  },
] as const;

export function buildAmroModuleCatalogEnvelope() {
  const modules = [...AMRO_MODULE_CATALOG];
  const databaseMappingMatrix = [...AMRO_DATABASE_MAPPING_MATRIX];
  const tableRelationshipCrossReference = [...AMRO_TABLE_RELATIONSHIP_CROSS_REFERENCE];
  const workflowDataFlowMapping = [...AMRO_WORKFLOW_DATA_FLOW_MAPPING];
  const endToEndArchitectureFlowchart = { ...AMRO_END_TO_END_ARCHITECTURE_FLOWCHART };
  const implementationSequenceMapping = [...AMRO_IMPLEMENTATION_SEQUENCE_MAPPING];
  const deploymentWavePriorityMap = [...AMRO_DEPLOYMENT_WAVE_PRIORITY_MAP];
  const quickLookupCrossReference = [...AMRO_QUICK_LOOKUP_CROSS_REFERENCE];
  const hierarchyMap = modules.map((row) => ({
    moduleId: row.moduleId,
    module: row.module,
    subModules: row.subModules,
    coreOwnershipBoundary: row.coreOwnershipBoundary,
  }));
  return {
    modules,
    hierarchyMap,
    databaseMappingMatrix,
    tableRelationshipCrossReference,
    workflowDataFlowMapping,
    endToEndArchitectureFlowchart,
    implementationSequenceMapping,
    deploymentWavePriorityMap,
    quickLookupCrossReference,
    summary: {
      totalModules: modules.length,
      databaseMappingModules: databaseMappingMatrix.length,
      relationshipPaths: tableRelationshipCrossReference.length,
      workflowMappings: workflowDataFlowMapping.length,
      implementationSequences: implementationSequenceMapping.length,
      deploymentWaves: deploymentWavePriorityMap.length,
      quickLookupRows: quickLookupCrossReference.length,
      totalSubModules: hierarchyMap.reduce((total, row) => total + row.subModules.length, 0),
      totalPrimaryUsers: modules.reduce((total, row) => total + row.primaryUsers.length, 0),
      totalDependencies: modules.reduce((total, row) => total + row.coreDependencies.length, 0),
    },
  };
}
