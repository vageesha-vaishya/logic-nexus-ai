import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './index';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import {
  applyCompatibilityResponseHeaders,
  resolveGatewayCompatibility,
} from '../../../_utils/compatibility-facade';

vi.mock('../../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, unknown> } {
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

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

describe('/api/v2/amro/schedules', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.AMRO_SCHEDULES_V2_ENABLED = 'true';
    process.env.AMRO_WORK_PACKAGES_V2_ENABLED = 'true';
    process.env.AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED = 'true';
    process.env.AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED = 'true';
    process.env.AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED = 'true';
    process.env.AMRO_SEQ_PREREQ_TEST_PLAN_READY = 'true';
    process.env.AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY = 'true';
    process.env.AMRO_SEQ_M1_STATUS = 'completed';
    process.env.AMRO_SEQ_M2_STATUS = 'completed';
    process.env.AMRO_SEQ_M3_STATUS = 'in-progress';
    process.env.AMRO_SEQ_M4_STATUS = 'not-started';
    process.env.AMRO_SEQ_M5_STATUS = 'not-started';
    process.env.AMRO_SEQ_M6_STATUS = 'not-started';
    process.env.AMRO_SEQ_M7_STATUS = 'not-started';
    process.env.AMRO_SEQ_M8_STATUS = 'not-started';
    process.env.AMRO_SEQ_M9_STATUS = 'not-started';
    process.env.AMRO_SEQ_M10_STATUS = 'not-started';
    process.env.AMRO_SEQ_M1_CORE_SCHEMA_MIGRATED = 'true';
    process.env.AMRO_SEQ_M1_RLS_ENABLED = 'true';
    process.env.AMRO_SEQ_M1_TENANT_LEAKAGE_TESTS_100 = 'true';
    process.env.AMRO_SEQ_M1_JWT_SIGNING_KEY_ONLY = 'true';
    process.env.AMRO_SEQ_M2_API_CONTRACT_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M2_TRANSITION_NEGATIVE_PATH_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M2_E2E_CREATE_TRANSITION_100 = 'true';
    process.env.AMRO_SEQ_M3_CAPACITY_VALIDATION_TESTS_PASS = 'true';
    process.env.AMRO_SEQ_M3_REPLAN_SIMULATION_TESTS_100 = 'true';
    process.env.AMRO_SEQ_M3_SCHEDULING_P95_TARGET_MET = 'true';
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-schedules',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2-shadow' });
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
      permissions: ['dashboards.view', 'reports.manage'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({
      isAuthorized: true,
      subscriptionStatus: 'active',
      graceUntil: null,
      source: 'database',
      validatedAt: '2026-03-21T00:00:00.000Z',
    } as any);
  });

  it('lists scheduling board rows for API-AMRO-004 GET', async () => {
    const req: ApiRequest = { method: 'GET', query: { station: 'station-a', date: '2026-03-22T00:00:00.000Z' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(enforceAnyPermission).toHaveBeenCalledWith(['dashboards.view', 'reports.manage'], ['dashboards.view']);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('list-scheduling-board');
    expect((res.jsonBody as any)?.output?.schedules?.length).toBe(1);
  });

  it('assigns maintenance slot when no-overlap and capacity rules pass', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'assign-maintenance-slot' },
      headers: {},
      body: {
        work_package_id: 'wp-120',
        station_code: 'station-a',
        slot_start: '2026-03-22T03:00:00.000Z',
        slot_end: '2026-03-22T05:00:00.000Z',
        station_capacity: 2,
        existing_slots: [{ slot_start: '2026-03-22T00:00:00.000Z', slot_end: '2026-03-22T02:00:00.000Z' }],
        assigned_team: [
          { member_id: 'tech-1', qualifications: ['station-a'] },
          { member_id: 'tech-2', qualifications: ['station-a', 'station-b'] },
        ],
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('assign-maintenance-slot');
    expect((res.jsonBody as any)?.output?.assignment_status).toBe('assigned');
  });

  it('rejects overlapping slot assignment requests', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'assign-maintenance-slot' },
      headers: {},
      body: {
        work_package_id: 'wp-121',
        station_code: 'station-a',
        slot_start: '2026-03-22T01:30:00.000Z',
        slot_end: '2026-03-22T03:00:00.000Z',
        station_capacity: 2,
        existing_slots: [{ slot_start: '2026-03-22T01:00:00.000Z', slot_end: '2026-03-22T02:00:00.000Z' }],
        assigned_team: [{ member_id: 'tech-1', qualifications: ['station-a'] }],
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-schedules',
      { apiVersion: 'v2' }
    );
  });

  it('rejects assignment requests that exceed station capacity', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: { interface: 'assign-maintenance-slot' },
      headers: {},
      body: {
        work_package_id: 'wp-122',
        station_code: 'station-a',
        slot_start: '2026-03-22T05:00:00.000Z',
        slot_end: '2026-03-22T06:00:00.000Z',
        station_capacity: 1,
        existing_slots: [],
        assigned_team: [
          { member_id: 'tech-1', qualifications: ['station-a'] },
          { member_id: 'tech-2', qualifications: ['station-a'] },
        ],
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-amro-schedules',
      { apiVersion: 'v2' }
    );
  });

  it('keeps scheduling read/write p95 latency within Section 19.3 targets', async () => {
    const readDurations: number[] = [];
    const writeDurations: number[] = [];

    for (let index = 0; index < 25; index += 1) {
      const readReq: ApiRequest = { method: 'GET', query: { date: '2026-03-22T00:00:00.000Z' }, headers: {} };
      const readRes = createResponse();
      const readStart = Date.now();
      await handler(readReq, readRes);
      readDurations.push(Date.now() - readStart);
      expect(readRes.statusCode).toBe(200);

      const writeReq: ApiRequest = {
        method: 'POST',
        query: { interface: 'assign-maintenance-slot' },
        headers: {},
        body: {
          work_package_id: `wp-${index}`,
          station_code: 'station-a',
          slot_start: `2026-03-22T${String((index % 6) + 10).padStart(2, '0')}:00:00.000Z`,
          slot_end: `2026-03-22T${String((index % 6) + 11).padStart(2, '0')}:00:00.000Z`,
          station_capacity: 2,
          existing_slots: [],
          assigned_team: [{ member_id: 'tech-1', qualifications: ['station-a'] }],
        },
      };
      const writeRes = createResponse();
      const writeStart = Date.now();
      await handler(writeReq, writeRes);
      writeDurations.push(Date.now() - writeStart);
      expect(writeRes.statusCode).toBe(200);
    }

    expect(percentile(readDurations, 95)).toBeLessThanOrEqual(300);
    expect(percentile(writeDurations, 95)).toBeLessThanOrEqual(500);
  });
});
