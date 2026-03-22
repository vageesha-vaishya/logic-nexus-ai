export type AmroModuleCatalogRow = {
  module: string;
  primaryUsers: string[];
  primaryInputs: string[];
  primaryOutputs: string[];
  coreDependencies: string[];
};

export const AMRO_MODULE_CATALOG: ReadonlyArray<AmroModuleCatalogRow> = [
  {
    module: 'Overview and KPI Intelligence',
    primaryUsers: ['Management', 'planner', 'compliance lead'],
    primaryInputs: ['Work package states', 'telemetry', 'SLA targets', 'compliance events'],
    primaryOutputs: ['KPI cards', 'risk heatmaps', 'trend lines', 'anomalies'],
    coreDependencies: ['Event stream', 'analytics cache', 'forecast engine'],
  },
  {
    module: 'Work Package Management',
    primaryUsers: ['Planner', 'engineer', 'technician'],
    primaryInputs: ['Fleet schedule triggers', 'task templates', 'role permissions'],
    primaryOutputs: ['Work packages', 'status transitions', 'audit events'],
    coreDependencies: ['Scheduling', 'RBAC', 'Evidence ledger'],
  },
  {
    module: 'Task Execution and Evidence',
    primaryUsers: ['Technician', 'inspector'],
    primaryInputs: ['Task steps', 'procedures', 'qualification rules', 'offline queue'],
    primaryOutputs: ['Step completion states', 'evidence objects', 'signatures'],
    coreDependencies: ['Mobile sync', 'signature service', 'storage'],
  },
  {
    module: 'Maintenance Scheduling',
    primaryUsers: ['Planner', 'operations control'],
    primaryInputs: ['Capacity calendars', 'aircraft availability', 'constraints'],
    primaryOutputs: ['Slot assignments', 'replan proposals', 'conflict alerts'],
    coreDependencies: ['Constraint engine', 'resource registry'],
  },
  {
    module: 'Parts and Materials',
    primaryUsers: ['Store keeper', 'planner', 'engineer'],
    primaryInputs: ['Demand from work packages', 'stock and supplier feeds'],
    primaryOutputs: ['Reservations', 'shortage alerts', 'procurement triggers'],
    coreDependencies: ['Inventory', 'ERP adapter', 'Supplier APIs'],
  },
  {
    module: 'Compliance and Airworthiness',
    primaryUsers: ['Inspector', 'compliance officer'],
    primaryInputs: ['AD/SB feeds', 'MEL/CDL records', 'regulator profile'],
    primaryOutputs: ['Gate decisions', 'exceptions', 'dossiers', 'audit packages'],
    coreDependencies: ['Policy engine', 'records service'],
  },
  {
    module: 'Certification and Authority',
    primaryUsers: ['Inspector', 'certifying engineer'],
    primaryInputs: ['Staff qualifications', 'authority scope', 'expiration dates'],
    primaryOutputs: ['Certification decisions', 'blocked actions', 'escalation events'],
    coreDependencies: ['IAM', 'Qualification registry'],
  },
  {
    module: 'Integration and Partner Hub',
    primaryUsers: ['Integration engineer', 'operations'],
    primaryInputs: ['External ERP/IoT/regulator payloads'],
    primaryOutputs: ['Canonical AMRO events', 'sync statuses', 'retries'],
    coreDependencies: ['Adapter runtime', 'queue', 'mapping rules'],
  },
  {
    module: 'Forecast and Reliability',
    primaryUsers: ['Planner', 'management'],
    primaryInputs: ['Telemetry features', 'historical defects', 'environmental context'],
    primaryOutputs: ['Risk scores', 'suggested interventions', 'confidence/explainability'],
    coreDependencies: ['ML pipeline', 'feature store'],
  },
] as const;

export function buildAmroModuleCatalogEnvelope() {
  const modules = [...AMRO_MODULE_CATALOG];
  return {
    modules,
    summary: {
      totalModules: modules.length,
      totalPrimaryUsers: modules.reduce((total, row) => total + row.primaryUsers.length, 0),
      totalDependencies: modules.reduce((total, row) => total + row.coreDependencies.length, 0),
    },
  };
}
