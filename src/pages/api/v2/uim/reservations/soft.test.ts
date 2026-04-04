import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './soft';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  authenticateRequest,
  buildApiContext,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';

vi.mock('../../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../../_utils/supabaseAdmin', () => ({
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

describe('/api/v2/uim/reservations/soft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-uim-reserve',
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

  it('creates a persisted soft reservation when inventory is sufficient', async () => {
    const catalogMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'catalog-1', sku: 'SKU-1', title: 'Item 1' },
      error: null,
    });
    const catalogLimit = vi.fn().mockReturnValue({ maybeSingle: catalogMaybeSingle });
    const catalogIs = vi.fn().mockReturnValue({ limit: catalogLimit });
    const catalogEqId = vi.fn().mockReturnValue({ is: catalogIs });
    const catalogEqTenant = vi.fn().mockReturnValue({ eq: catalogEqId });
    const catalogSelect = vi.fn().mockReturnValue({ eq: catalogEqTenant });

    const availableLimit = vi.fn().mockResolvedValue({
      data: [{ id: 'inv-1', quantity: 5 }],
      error: null,
    });
    const availableIs = vi.fn().mockReturnValue({ limit: availableLimit });
    const availableEqStatus = vi.fn().mockReturnValue({ is: availableIs });
    const availableEqCatalog = vi.fn().mockReturnValue({ eq: availableEqStatus });
    const availableEqTenant = vi.fn().mockReturnValue({ eq: availableEqCatalog });
    const availableSelect = vi.fn().mockReturnValue({ eq: availableEqTenant });

    const reservationMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'resv-1',
        reservation_token: 'uim-resv-token',
        reservation_status: 'active',
        reserved_quantity: 2,
        expected_use_date: '2026-04-20T00:00:00Z',
      },
      error: null,
    });
    const reservationLimit = vi.fn().mockReturnValue({ maybeSingle: reservationMaybeSingle });
    const reservationSelect = vi.fn().mockReturnValue({ limit: reservationLimit });
    const reservationInsert = vi.fn().mockReturnValue({ select: reservationSelect });
    const ledgerInsert = vi.fn().mockResolvedValue({ error: null });

    const fromMock = vi.fn((table: string) => {
      if (table === 'uim_catalog_items') return { select: catalogSelect };
      if (table === 'uim_inventory_items') return { select: availableSelect };
      if (table === 'uim_inventory_reservations') return { insert: reservationInsert };
      if (table === 'uim_inventory_ledger') return { insert: ledgerInsert };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        catalog_item_id: 'catalog-1',
        quantity: 2,
        expected_use_date: '2026-04-20T00:00:00Z',
      },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.reservation_id).toBe('resv-1');
    expect(reservationInsert).toHaveBeenCalledTimes(1);
    expect(ledgerInsert).toHaveBeenCalledTimes(1);
    expect(ledgerInsert).toHaveBeenCalledWith(expect.objectContaining({
      transaction_type: 'RESERVE',
      inventory_item_id: 'inv-1',
      reservation_id: 'resv-1',
      quantity_changed: 2,
    }));
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns conflict when available inventory is insufficient', async () => {
    const catalogMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'catalog-1', sku: 'SKU-1', title: 'Item 1' },
      error: null,
    });
    const catalogLimit = vi.fn().mockReturnValue({ maybeSingle: catalogMaybeSingle });
    const catalogIs = vi.fn().mockReturnValue({ limit: catalogLimit });
    const catalogEqId = vi.fn().mockReturnValue({ is: catalogIs });
    const catalogEqTenant = vi.fn().mockReturnValue({ eq: catalogEqId });
    const catalogSelect = vi.fn().mockReturnValue({ eq: catalogEqTenant });

    const availableLimit = vi.fn().mockResolvedValue({
      data: [{ id: 'inv-1', quantity: 1 }],
      error: null,
    });
    const availableIs = vi.fn().mockReturnValue({ limit: availableLimit });
    const availableEqStatus = vi.fn().mockReturnValue({ is: availableIs });
    const availableEqCatalog = vi.fn().mockReturnValue({ eq: availableEqStatus });
    const availableEqTenant = vi.fn().mockReturnValue({ eq: availableEqCatalog });
    const availableSelect = vi.fn().mockReturnValue({ eq: availableEqTenant });

    const reservationInsert = vi.fn();
    const ledgerInsert = vi.fn();
    const fromMock = vi.fn((table: string) => {
      if (table === 'uim_catalog_items') return { select: catalogSelect };
      if (table === 'uim_inventory_items') return { select: availableSelect };
      if (table === 'uim_inventory_reservations') return { insert: reservationInsert };
      if (table === 'uim_inventory_ledger') return { insert: ledgerInsert };
      return {};
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        catalog_item_id: 'catalog-1',
        quantity: 3,
        expected_use_date: '2026-04-20T00:00:00Z',
      },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect((res.jsonBody as any)?.code).toBe('UIM_INSUFFICIENT_AVAILABLE_QUANTITY');
    expect(reservationInsert).not.toHaveBeenCalled();
    expect(ledgerInsert).not.toHaveBeenCalled();
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns 422 for invalid payload and skips persistence', async () => {
    const fromMock = vi.fn();
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        catalog_item_id: 'catalog-1',
        quantity: 0,
        expected_use_date: 'bad-date',
      },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.jsonBody as any)?.code).toBe('UIM_VALIDATION_INVALID_QUANTITY');
    expect(fromMock).not.toHaveBeenCalled();
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });
});
