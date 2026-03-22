import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import {
  AMRO_ASYNCAPI_SPEC_PATH,
  AMRO_GRAPHQL_SUBGRAPH_PATH,
  AMRO_GRPC_PROTO_PATH,
  AMRO_INTEGRATION_CONTRACTS,
  AMRO_HEALTH_PATH,
  AMRO_MODULE_CATALOG_PATH,
  AMRO_MIGRATION_PLAN_PATH,
  AMRO_OPENAPI_SPEC_PATH,
  AMRO_OVERVIEW_KPI_PATH,
  AMRO_PHASE_1_READINESS_PATH,
  AMRO_PHASE_PLAN_PATH,
  AMRO_SCREEN_INVENTORY_PATH,
} from './integration-contracts';
import { buildAmroIntegrationContractEnvelope } from './anti-corruption-adapter';

function readContractFile(relativePath: string): string {
  const absolutePath = path.resolve(process.cwd(), 'src/pages', relativePath.replace('/api/v2/', 'api/v2/'));
  return readFileSync(absolutePath, 'utf8');
}

describe('AMRO 13.3 integration contracts', () => {
  it('maps all required contract surfaces', () => {
    expect(AMRO_INTEGRATION_CONTRACTS.rest.endpoints).toEqual([
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
      AMRO_HEALTH_PATH,
    ]);
    expect(AMRO_INTEGRATION_CONTRACTS.graphql.fields).toEqual([
      'amroWorkPackages',
      'amroTask(id)',
      'amroComplianceStatus',
    ]);
    expect(AMRO_INTEGRATION_CONTRACTS.grpc.services).toEqual([
      'amro.v1.WorkOrderService',
      'amro.v1.ComplianceService',
    ]);
    expect(AMRO_INTEGRATION_CONTRACTS.asyncApi.events).toEqual([
      'amro.work_package.created.v1',
      'amro.task.completed.v1',
      'amro.compliance.gate_decided.v1',
      'amro.certification.decision.submitted.v1',
      'amro.integration.payload.ingested.v1',
      'amro.forecast.risk.scored.v1',
      'amro.audit.recorded.v1',
    ]);
  });

  it('publishes contract artifact paths via integration envelope', () => {
    const envelope = buildAmroIntegrationContractEnvelope({
      capability: 'work-packages',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      endpointRollout: { enabled: true },
      auditLedgerCutover: { enabled: true },
    });

    expect(envelope.contracts.rest.contractPath).toBe(AMRO_OPENAPI_SPEC_PATH);
    expect(envelope.contracts.graphql.schemaPath).toBe(AMRO_GRAPHQL_SUBGRAPH_PATH);
    expect(envelope.contracts.grpc.protoPath).toBe(AMRO_GRPC_PROTO_PATH);
    expect(envelope.contracts.asyncApi.contractPath).toBe(AMRO_ASYNCAPI_SPEC_PATH);
  });

  it('keeps OpenAPI, GraphQL, gRPC, and AsyncAPI artifacts aligned to 13.3 names', () => {
    const openApi = readContractFile(AMRO_OPENAPI_SPEC_PATH);
    expect(openApi).toContain('/api/v2/amro/work-packages');
    expect(openApi).toContain('/api/v2/amro/work-packages/{id}');
    expect(openApi).toContain('/api/v2/amro/work-packages/{id}/transitions');
    expect(openApi).toContain('/api/v2/amro/schedules');
    expect(openApi).toContain('/api/v2/amro/schedules/replan');
    expect(openApi).toContain('/api/v2/amro/tasks');
    expect(openApi).toContain('/api/v2/amro/tasks/{id}/evidence');
    expect(openApi).toContain('/api/v2/amro/compliance-gates');
    expect(openApi).toContain('/api/v2/amro/certification');
    expect(openApi).toContain('/api/v2/amro/integration-hub');
    expect(openApi).toContain('/api/v2/amro/forecast-reliability');
    expect(openApi).toContain(AMRO_OVERVIEW_KPI_PATH);
    expect(openApi).toContain(AMRO_MODULE_CATALOG_PATH);
    expect(openApi).toContain(AMRO_SCREEN_INVENTORY_PATH);
    expect(openApi).toContain(AMRO_PHASE_PLAN_PATH);
    expect(openApi).toContain(AMRO_PHASE_1_READINESS_PATH);
    expect(openApi).toContain('/api/v2/amro/migration-plan');
    expect(openApi).toContain(AMRO_HEALTH_PATH);

    const graphQl = readContractFile(AMRO_GRAPHQL_SUBGRAPH_PATH);
    expect(graphQl).toContain('amroWorkPackages');
    expect(graphQl).toContain('amroTask(id: ID!)');
    expect(graphQl).toContain('amroComplianceStatus');

    const proto = readContractFile(AMRO_GRPC_PROTO_PATH);
    expect(proto).toContain('service WorkOrderService');
    expect(proto).toContain('service ComplianceService');
    expect(proto).toContain('package amro.v1;');

    const asyncApi = readContractFile(AMRO_ASYNCAPI_SPEC_PATH);
    expect(asyncApi).toContain('amro.work_package.created.v1');
    expect(asyncApi).toContain('amro.task.completed.v1');
    expect(asyncApi).toContain('amro.compliance.gate_decided.v1');
    expect(asyncApi).toContain('amro.certification.decision.submitted.v1');
    expect(asyncApi).toContain('amro.integration.payload.ingested.v1');
    expect(asyncApi).toContain('amro.forecast.risk.scored.v1');
    expect(asyncApi).toContain('amro.audit.recorded.v1');
  });

  it('keeps API-AMRO-001/002/003 OpenAPI contract operations aligned', () => {
    const openApi = readContractFile(AMRO_OPENAPI_SPEC_PATH);
    expect(openApi).toContain('/api/v2/amro/work-packages:');
    expect(openApi).toContain('operationId: listAmroWorkPackages');
    expect(openApi).toContain('operationId: mutateAmroWorkPackages');
    expect(openApi).toContain('/api/v2/amro/work-packages/{id}:');
    expect(openApi).toContain('operationId: getAmroWorkPackageDetail');
    expect(openApi).toContain('operationId: patchAmroWorkPackage');
    expect(openApi).toContain('/api/v2/amro/work-packages/{id}/transitions:');
    expect(openApi).toContain('operationId: transitionAmroWorkPackage');
  });

  it('keeps API-AMRO-004/005 OpenAPI contract operations aligned', () => {
    const openApi = readContractFile(AMRO_OPENAPI_SPEC_PATH);
    expect(openApi).toContain('/api/v2/amro/schedules:');
    expect(openApi).toContain('operationId: listAmroSchedules');
    expect(openApi).toContain('operationId: mutateAmroSchedules');
    expect(openApi).toContain('/api/v2/amro/schedules/replan:');
    expect(openApi).toContain('operationId: replanAmroSchedules');
  });
});
