export const AMRO_OPENAPI_SPEC_PATH = '/api/v2/amro/contracts/openapi-3.1.yaml' as const;
export const AMRO_GRAPHQL_SUBGRAPH_PATH = '/api/v2/amro/contracts/amro-subgraph.graphql' as const;
export const AMRO_GRPC_PROTO_PATH = '/api/v2/amro/contracts/amro-v1.proto' as const;
export const AMRO_ASYNCAPI_SPEC_PATH = '/api/v2/amro/contracts/asyncapi-2.6.yaml' as const;
export const AMRO_PHASE_PLAN_PATH = '/api/v2/amro/phase-plan' as const;
export const AMRO_PHASE_1_READINESS_PATH = '/api/v2/amro/phase-1-readiness' as const;
export const AMRO_MIGRATION_PLAN_PATH = '/api/v2/amro/migration-plan' as const;
export const AMRO_OVERVIEW_KPI_PATH = '/api/v2/amro/overview-kpi' as const;
export const AMRO_MODULE_CATALOG_PATH = '/api/v2/amro/module-catalog' as const;
export const AMRO_SCREEN_INVENTORY_PATH = '/api/v2/amro/screen-inventory' as const;

export const AMRO_INTEGRATION_CONTRACTS = {
  rest: {
    specification: 'OpenAPI 3.1',
    endpoints: [
      '/api/v2/amro/work-packages',
      '/api/v2/amro/work-packages/{id}',
      '/api/v2/amro/work-packages/{id}/transitions',
      '/api/v2/amro/schedules',
      '/api/v2/amro/schedules/replan',
      '/api/v2/amro/tasks',
      '/api/v2/amro/tasks/{id}/evidence',
      '/api/v2/amro/compliance-gates',
      '/api/v2/amro/certification',
      '/api/v2/amro/integration-hub',
      '/api/v2/amro/forecast-reliability',
      AMRO_OVERVIEW_KPI_PATH,
      AMRO_MODULE_CATALOG_PATH,
      AMRO_SCREEN_INVENTORY_PATH,
      AMRO_PHASE_PLAN_PATH,
      AMRO_PHASE_1_READINESS_PATH,
      AMRO_MIGRATION_PLAN_PATH,
    ],
    contractPath: AMRO_OPENAPI_SPEC_PATH,
  },
  graphql: {
    type: 'subgraph',
    fields: ['amroWorkPackages', 'amroTask(id)', 'amroComplianceStatus'],
    schemaPath: AMRO_GRAPHQL_SUBGRAPH_PATH,
  },
  grpc: {
    services: ['amro.v1.WorkOrderService', 'amro.v1.ComplianceService'],
    protoPath: AMRO_GRPC_PROTO_PATH,
  },
  asyncApi: {
    events: [
      'amro.work_package.created.v1',
      'amro.task.completed.v1',
      'amro.compliance.gate_decided.v1',
      'amro.certification.decision.submitted.v1',
      'amro.integration.payload.ingested.v1',
      'amro.forecast.risk.scored.v1',
      'amro.audit.recorded.v1',
    ],
    contractPath: AMRO_ASYNCAPI_SPEC_PATH,
  },
} as const;

export const AMRO_COEXISTENCE_SAFEGUARDS = {
  dualRead: 'deterministic comparison across legacy and AMRO query surfaces',
  dualWrite: 'approved entities with per-entity idempotency key and reconciliation queue',
  featureFlags: 'tenant/franchise cohort and capability set',
  fallback: 'legacy handler switch with queue drain and snapshot checkpoint restore',
} as const;
