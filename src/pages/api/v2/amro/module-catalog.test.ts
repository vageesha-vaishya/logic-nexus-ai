import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import handler from './module-catalog';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  buildApiContext: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
}));

vi.mock('../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, any> } {
  const res: any = {
    headers: {},
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return {
        json: (body: unknown) => {
          res.jsonBody = body;
        },
        end: vi.fn(),
      };
    }),
  };
  return res;
}

describe('/api/v2/amro/module-catalog', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-module-catalog',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2-shadow' });
  });

  it('returns module catalog relationship mappings for AMRO sections 15.1, 26.1, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8, and 26.9', async () => {
    process.env.AMRO_MODULE_CATALOG_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('module-catalog');
    expect((res.jsonBody as any)?.data?.moduleCatalog?.summary?.totalModules).toBe(10);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.summary?.totalSubModules).toBe(39);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.summary?.databaseMappingModules).toBe(10);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.summary?.relationshipPaths).toBe(6);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.summary?.workflowMappings).toBe(10);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.summary?.implementationSequences).toBe(10);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.summary?.deploymentWaves).toBe(4);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.summary?.quickLookupRows).toBe(10);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.hierarchyMap?.length).toBe(10);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.databaseMappingMatrix?.length).toBe(10);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.tableRelationshipCrossReference?.length).toBe(6);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.workflowDataFlowMapping?.length).toBe(10);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.implementationSequenceMapping?.length).toBe(10);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.deploymentWavePriorityMap?.length).toBe(4);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.quickLookupCrossReference?.length).toBe(10);
    expect((res.jsonBody as any)?.data?.moduleCatalog?.modules?.[0]?.module).toBe('Overview and KPI Intelligence');
    expect((res.jsonBody as any)?.data?.moduleCatalog?.modules?.[0]).toEqual({
      moduleId: 'MOD-AMRO-01',
      module: 'Overview and KPI Intelligence',
      subModules: ['KPI Aggregation', 'Risk Heatmap', 'Forecast Panel', 'SLA Trends'],
      coreOwnershipBoundary: 'Read-mostly operational intelligence',
      primaryUsers: ['Management', 'planner', 'compliance lead'],
      primaryInputs: ['Work package states', 'telemetry', 'SLA targets', 'compliance events'],
      primaryOutputs: ['KPI cards', 'risk heatmaps', 'trend lines', 'anomalies'],
      coreDependencies: ['Event stream', 'analytics cache', 'forecast engine'],
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.modules?.[8]).toEqual({
      moduleId: 'MOD-AMRO-09',
      module: 'Forecast and Reliability',
      subModules: ['Feature Pipeline', 'Risk Scoring', 'Recommendation Engine', 'Outcome Feedback'],
      coreOwnershipBoundary: 'Predictive maintenance intelligence',
      primaryUsers: ['Planner', 'management'],
      primaryInputs: ['Telemetry features', 'historical defects', 'environmental context'],
      primaryOutputs: ['Risk scores', 'suggested interventions', 'confidence/explainability'],
      coreDependencies: ['ML pipeline', 'feature store'],
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.modules?.[9]).toEqual({
      moduleId: 'MOD-AMRO-10',
      module: 'Audit and Evidence Ledger',
      subModules: ['Event Append Log', 'Hash Chain Verifier', 'Replay Export', 'Security Audit Trail'],
      coreOwnershipBoundary: 'Non-repudiation and evidentiary replay',
      primaryUsers: ['Compliance officer', 'auditor', 'security analyst'],
      primaryInputs: ['State transition events', 'evidence signatures', 'integration callbacks', 'policy checkpoints'],
      primaryOutputs: ['Immutable audit events', 'hash-chain verification status', 'replay exports', 'security trail reports'],
      coreDependencies: ['Audit records schema', 'hash-chain verifier', 'replay service'],
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.hierarchyMap?.[7]).toEqual({
      moduleId: 'MOD-AMRO-08',
      module: 'Integration and Partner Hub',
      subModules: ['Adapter Runtime', 'Canonical Mapping', 'Idempotency/Dedup', 'Replay Queue'],
      coreOwnershipBoundary: 'External interoperability',
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.databaseMappingMatrix?.[1]).toEqual({
      moduleId: 'MOD-AMRO-02',
      primaryTables: ['work_orders', 'work_package_templates', 'tasks'],
      keyFieldsUsedByModule: ['work_package_number', 'maintenance_type', 'priority', 'status'],
      criticalConstraintsAndRules: ['Unique (tenant_id, work_package_number)', 'Transition policy validation required'],
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.databaseMappingMatrix?.[9]).toEqual({
      moduleId: 'MOD-AMRO-10',
      primaryTables: ['maintenance_events', 'mro_audit.records', 'mro_audit.trails'],
      keyFieldsUsedByModule: ['event_hash', 'previous_hash', 'actor_id', 'timestamp'],
      criticalConstraintsAndRules: ['Append-only semantics', 'Hash-chain integrity required'],
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.tableRelationshipCrossReference?.[0]).toEqual({
      relationshipPath: 'aircraft -> work_orders -> tasks -> maintenance_events',
      purpose: 'End-to-end execution trace',
      modulesConsumingPath: ['MOD-AMRO-02', 'MOD-AMRO-03', 'MOD-AMRO-10'],
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.tableRelationshipCrossReference?.[5]).toEqual({
      relationshipPath: 'asset_health_signals -> forecast_outputs -> work_orders',
      purpose: 'Predictive recommendation to planned work creation',
      modulesConsumingPath: ['MOD-AMRO-09', 'MOD-AMRO-02'],
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.workflowDataFlowMapping?.[0]).toEqual({
      moduleId: 'MOD-AMRO-01',
      workflowDiagramReference: '17.1 (steps 1-3, 7)',
      businessLogicSequence: 'Aggregate operational state -> compute KPIs -> publish widgets',
      userInteractionPattern: 'Filter, drill-down, export',
      dataFlowReference: ['18.1'],
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.workflowDataFlowMapping?.[9]).toEqual({
      moduleId: 'MOD-AMRO-10',
      workflowDiagramReference: '17.1 (step 7), 17.3',
      businessLogicSequence: 'Append immutable event -> verify hash chain -> replay export',
      userInteractionPattern: 'Audit timeline and export filters',
      dataFlowReference: ['18.3'],
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.endToEndArchitectureFlowchart).toEqual({
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
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.implementationSequenceMapping?.[0]).toEqual({
      sequence: 'S1',
      deliverableGroup: 'Schema foundation, RLS, scoped auth, audit primitives',
      dependsOn: ['None'],
      blocksOrUnblocks: 'Unblocks all modules',
      deploymentPriority: 'Critical',
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.implementationSequenceMapping?.[9]).toEqual({
      sequence: 'S10',
      deliverableGroup: 'Scale/performance hardening + DR validation',
      dependsOn: ['S1..S9'],
      blocksOrUnblocks: 'Unblocks GA rollout',
      deploymentPriority: 'Critical',
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.deploymentWavePriorityMap?.[0]).toEqual({
      wave: 'W1',
      environment: 'Dev and Integration',
      includedSequences: ['S1-S4'],
      entryCriteria: 'Core tests and RLS tests passing',
      exitCriteria: 'Create-plan-execute basic flow stable',
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.deploymentWavePriorityMap?.[3]).toEqual({
      wave: 'W4',
      environment: 'Production GA',
      includedSequences: ['S10'],
      entryCriteria: 'DR drill success, security sign-off, rollout approvals',
      exitCriteria: 'Controlled GA with SLO monitoring active',
    });
    expect((res.jsonBody as any)?.data?.moduleCatalog?.quickLookupCrossReference?.[0]).toEqual({
      module: 'Overview and KPI Intelligence',
      subModules: 'KPI Aggregation, Risk Heatmap, Forecast Panel',
      uiUx: 'SCR-001, SCR-012',
      dbTables: 'work_orders, maintenance_events, forecast_outputs',
      workflow: '17.1, 18.1',
      apis: 'API-001, API-015',
      implementationSequence: 'S8',
    });
    expect((res.jsonBody as any)?.domainAccess?.subscriptionStatus).toBe('public');
    expect((res.jsonBody as any)?.serviceBoundaries?.scopedAccess?.tenant_id).toBe('public');
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
  });

  it('handles unsupported methods', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect((res.jsonBody as any)?.error).toContain('Method POST Not Allowed');
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });
});
