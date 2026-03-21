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
    primaryUsers: ['Management', 'Planner', 'Compliance Lead'],
    primaryInputs: ['Work package states', 'Telemetry', 'SLA targets', 'Compliance events'],
    primaryOutputs: ['KPI cards', 'Risk heatmaps', 'Trend lines', 'Anomalies'],
    coreDependencies: ['Event stream', 'Analytics cache', 'Forecast engine'],
  },
  {
    module: 'Work Package Management',
    primaryUsers: ['Planner', 'Engineer', 'Technician'],
    primaryInputs: ['Fleet schedule triggers', 'Task templates', 'Role permissions'],
    primaryOutputs: ['Work packages', 'Status transitions', 'Audit events'],
    coreDependencies: ['Scheduling', 'RBAC', 'Evidence ledger'],
  },
  {
    module: 'Task Execution and Evidence',
    primaryUsers: ['Technician', 'Inspector'],
    primaryInputs: ['Task steps', 'Procedures', 'Qualification rules', 'Offline queue'],
    primaryOutputs: ['Step completion states', 'Evidence objects', 'Signatures'],
    coreDependencies: ['Mobile sync', 'Signature service', 'Storage'],
  },
  {
    module: 'Maintenance Scheduling',
    primaryUsers: ['Planner', 'Operations Control'],
    primaryInputs: ['Capacity calendars', 'Aircraft availability', 'Constraints'],
    primaryOutputs: ['Slot assignments', 'Replan proposals', 'Conflict alerts'],
    coreDependencies: ['Constraint engine', 'Resource registry'],
  },
  {
    module: 'Parts and Materials',
    primaryUsers: ['Store Keeper', 'Planner', 'Engineer'],
    primaryInputs: ['Demand from work packages', 'Stock and supplier feeds'],
    primaryOutputs: ['Reservations', 'Shortage alerts', 'Procurement triggers'],
    coreDependencies: ['Inventory', 'ERP adapter', 'Supplier APIs'],
  },
  {
    module: 'Compliance and Airworthiness',
    primaryUsers: ['Inspector', 'Compliance Officer'],
    primaryInputs: ['AD/SB feeds', 'MEL/CDL records', 'Regulator profile'],
    primaryOutputs: ['Gate decisions', 'Exceptions', 'Dossiers', 'Audit packages'],
    coreDependencies: ['Policy engine', 'Records service'],
  },
  {
    module: 'Certification and Authority',
    primaryUsers: ['Inspector', 'Certifying Engineer'],
    primaryInputs: ['Staff qualifications', 'Authority scope', 'Expiration dates'],
    primaryOutputs: ['Certification decisions', 'Blocked actions', 'Escalation events'],
    coreDependencies: ['IAM', 'Qualification registry'],
  },
  {
    module: 'Integration and Partner Hub',
    primaryUsers: ['Integration Engineer', 'Operations'],
    primaryInputs: ['External ERP/IoT/regulator payloads'],
    primaryOutputs: ['Canonical AMRO events', 'Sync statuses', 'Retries'],
    coreDependencies: ['Adapter runtime', 'Queue', 'Mapping rules'],
  },
  {
    module: 'Forecast and Reliability',
    primaryUsers: ['Planner', 'Management'],
    primaryInputs: ['Telemetry features', 'Historical defects', 'Environmental context'],
    primaryOutputs: ['Risk scores', 'Suggested interventions', 'Confidence/explainability'],
    coreDependencies: ['ML pipeline', 'Feature store'],
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
