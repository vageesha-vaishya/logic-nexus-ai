import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './status';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  authenticateRequest,
  buildApiContext,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';

vi.mock('../../../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
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
      };
    }),
  };
  return res;
}

describe('/api/v2/uim/reservations/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-uim-status',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
    } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
      permissions: ['dashboards.view'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      tenantId: 'tenant-1',
      franchiseId: '',
      userId: 'user-1',
    } as any);
  });

  it('transitions active reservation to fulfilled and writes CONSUME ledger', async () => {
    const loadMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'resv-1',
        inventory_item_id: 'inv-1',
        reserved_quantity: 2,
        reservation_status: 'active',
        referenced_module: 'work_order',
        referenced_record_id: 'wo-1',
      },
      error: null,
    });
    const loadLimit = vi.fn().mockReturnValue({ maybeSingle: loadMaybeSingle });
    const loadIs = vi.fn().mockReturnValue({ limit: loadLimit });
    const loadEqId = vi.fn().mockReturnValue({ is: loadIs });
    const loadEqTenant = vi.fn().mockReturnValue({ eq: loadEqId });
    const loadSelect = vi.fn().mockReturnValue({ eq: loadEqTenant });

    const updateMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'resv-1',
        reservation_status: 'fulfilled',
        reserved_quantity: 2,
        inventory_item_id: 'inv-1',
      },
      error: null,
    });
    const updateLimit = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateSelect = vi.fn().mockReturnValue({ limit: updateLimit });
    const updateEqId = vi.fn().mockReturnValue({ select: updateSelect });
    const updateEqTenant = vi.fn().mockReturnValue({ eq: updateEqId });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqTenant });

    const ledgerInsert = vi.fn().mockResolvedValue({ error: null });
    const reservationFrom = { select: loadSelect, update: updateFn };
    const fromMock = vi.fn((table: string) => {
      if (table === 'uim_inventory_reservations') return reservationFrom;
      if (table === 'uim_inventory_ledger') return { insert: ledgerInsert };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { id: 'resv-1' },
      headers: {},
      body: { status: 'fulfilled' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ reservation_status: 'fulfilled' }));
    expect(ledgerInsert).toHaveBeenCalledWith(expect.objectContaining({
      transaction_type: 'CONSUME',
      reservation_id: 'resv-1',
      inventory_item_id: 'inv-1',
      quantity_changed: 2,
    }));
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('transitions active reservation to cancelled and writes RELEASE ledger', async () => {
    const loadMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'resv-2',
        inventory_item_id: 'inv-2',
        reserved_quantity: 4,
        reservation_status: 'active',
        referenced_module: null,
        referenced_record_id: null,
      },
      error: null,
    });
    const loadLimit = vi.fn().mockReturnValue({ maybeSingle: loadMaybeSingle });
    const loadIs = vi.fn().mockReturnValue({ limit: loadLimit });
    const loadEqId = vi.fn().mockReturnValue({ is: loadIs });
    const loadEqTenant = vi.fn().mockReturnValue({ eq: loadEqId });
    const loadSelect = vi.fn().mockReturnValue({ eq: loadEqTenant });

    const updateMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'resv-2',
        reservation_status: 'cancelled',
        reserved_quantity: 4,
        inventory_item_id: 'inv-2',
      },
      error: null,
    });
    const updateLimit = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateSelect = vi.fn().mockReturnValue({ limit: updateLimit });
    const updateEqId = vi.fn().mockReturnValue({ select: updateSelect });
    const updateEqTenant = vi.fn().mockReturnValue({ eq: updateEqId });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqTenant });

    const ledgerInsert = vi.fn().mockResolvedValue({ error: null });
    const reservationFrom = { select: loadSelect, update: updateFn };
    const fromMock = vi.fn((table: string) => {
      if (table === 'uim_inventory_reservations') return reservationFrom;
      if (table === 'uim_inventory_ledger') return { insert: ledgerInsert };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { id: 'resv-2' },
      headers: {},
      body: { status: 'cancelled' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ reservation_status: 'cancelled' }));
    expect(ledgerInsert).toHaveBeenCalledWith(expect.objectContaining({
      transaction_type: 'RELEASE',
      reservation_id: 'resv-2',
      inventory_item_id: 'inv-2',
      quantity_changed: 4,
    }));
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns 422 for disallowed transition when reservation is not active and skips ledger write', async () => {
    const loadMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'resv-3',
        inventory_item_id: 'inv-3',
        reserved_quantity: 1,
        reservation_status: 'fulfilled',
        referenced_module: 'work_order',
        referenced_record_id: 'wo-3',
      },
      error: null,
    });
    const loadLimit = vi.fn().mockReturnValue({ maybeSingle: loadMaybeSingle });
    const loadIs = vi.fn().mockReturnValue({ limit: loadLimit });
    const loadEqId = vi.fn().mockReturnValue({ is: loadIs });
    const loadEqTenant = vi.fn().mockReturnValue({ eq: loadEqId });
    const loadSelect = vi.fn().mockReturnValue({ eq: loadEqTenant });

    const updateFn = vi.fn();
    const ledgerInsert = vi.fn();
    const reservationFrom = { select: loadSelect, update: updateFn };
    const fromMock = vi.fn((table: string) => {
      if (table === 'uim_inventory_reservations') return reservationFrom;
      if (table === 'uim_inventory_ledger') return { insert: ledgerInsert };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { id: 'resv-3' },
      headers: {},
      body: { status: 'cancelled' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.jsonBody as any)?.code).toBe('UIM_RESERVATION_INVALID_TRANSITION');
    expect(updateFn).not.toHaveBeenCalled();
    expect(ledgerInsert).not.toHaveBeenCalled();
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns 422 for invalid target status and skips db operations', async () => {
    const fromMock = vi.fn();
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { id: 'resv-4' },
      headers: {},
      body: { status: 'pending' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.jsonBody as any)?.code).toBe('UIM_VALIDATION_INVALID_STATUS');
    expect(fromMock).not.toHaveBeenCalled();
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });
});
