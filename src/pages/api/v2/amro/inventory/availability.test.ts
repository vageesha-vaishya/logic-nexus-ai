import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import handler from './availability';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { sendErrorResponse } from '../../../_utils/errorHandler';

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

vi.mock('../../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown } {
  const res: any = {
    setHeader: vi.fn(),
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

describe('/api/v2/amro/inventory/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-avail-test' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
    process.env.AMRO_INVENTORY_V2_ENABLED = 'true';
  });

  it('returns 404 when v2 is disabled', async () => {
    process.env.AMRO_INVENTORY_V2_ENABLED = 'false';
    const req = { method: 'GET', query: {}, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 405 for non-GET methods', async () => {
    const req = { method: 'POST', query: {}, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns real inventory data when part_numbers are provided', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'inv-1',
            part_number: 'PN-001',
            serial_number: 'SN-001',
            description: 'Test Part Alpha',
            quantity_on_hand: 50,
            quantity_available: 40,
            quantity_reserved: 10,
            warehouse_location: 'WH-A',
            status: 'available',
            criticality: 'critical',
            reorder_level: 20,
            item_type: 'consumable',
            ata_chapter: 'ATA-21',
            supplier_name: 'Supplier X',
          },
          {
            id: 'inv-2',
            part_number: 'PN-002',
            serial_number: null,
            description: 'Test Part Beta',
            quantity_on_hand: 5,
            quantity_available: 0,
            quantity_reserved: 5,
            warehouse_location: 'WH-B',
            status: 'low_stock',
            criticality: 'high',
            reorder_level: 10,
            item_type: 'rotable',
            ata_chapter: null,
            supplier_name: 'Supplier Y',
          },
        ],
        error: null,
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any);

    const req = {
      method: 'GET',
      query: { part_numbers: 'PN-001,PN-002' },
      headers: {},
    } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as any;
    expect(body.version).toBe('v2');
    expect(body.interface).toBe('inventory-availability');
    expect(body.output.tenant_id).toBe('tenant-1');
    expect(body.output.items).toHaveLength(2);
    expect(body.output.items[0].part_number).toBe('PN-001');
    expect(body.output.items[0].available_qty).toBe(40);
    expect(body.output.items[0].reserved_qty).toBe(10);
    expect(body.output.items[0].status).toBe('available');
    expect(body.output.items[1].part_number).toBe('PN-002');
    expect(body.output.items[1].available_qty).toBe(0);
    expect(body.output.items[1].status).toBe('out_of_stock');
    expect(body.output.summary.total_items).toBe(2);
    expect(body.output.summary.available_items).toBe(1);
    expect(body.output.summary.out_of_stock_items).toBe(1);
  });

  it('filters by station_code when provided', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any);

    const req = {
      method: 'GET',
      query: { station_code: 'WH-A' },
      headers: {},
    } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockSupabase.ilike).toHaveBeenCalledWith('warehouse_location', '%WH-A%');
  });

  it('returns all inventory when no part_numbers specified', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'inv-3',
            part_number: 'PN-003',
            serial_number: null,
            description: 'General Part',
            quantity_on_hand: 100,
            quantity_available: null,
            quantity_reserved: 0,
            warehouse_location: 'WH-C',
            status: 'available',
            criticality: null,
            reorder_level: 10,
            item_type: null,
            ata_chapter: null,
            supplier_name: null,
          },
        ],
        error: null,
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any);

    const req = { method: 'GET', query: {}, headers: {} } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as any;
    expect(body.output.part_numbers_requested).toBeNull();
    expect(body.output.items).toHaveLength(1);
    expect(body.output.items[0].available_qty).toBe(100);
  });

  it('computes availability correctly when quantity_available is null', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'inv-4',
            part_number: 'PN-004',
            serial_number: null,
            description: 'Computed Part',
            quantity_on_hand: 30,
            quantity_available: null,
            quantity_reserved: 15,
            warehouse_location: 'WH-D',
            status: 'available',
            criticality: null,
            reorder_level: 10,
            item_type: null,
            ata_chapter: null,
            supplier_name: null,
          },
        ],
        error: null,
      }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any);

    const req = {
      method: 'GET',
      query: { part_numbers: 'PN-004' },
      headers: {},
    } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as any;
    expect(body.output.items[0].available_qty).toBe(15);
    expect(body.output.items[0].status).toBe('available');
  });

  it('sends error response when database query fails', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Connection timeout' } }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any);

    const req = {
      method: 'GET',
      query: { part_numbers: 'PN-001' },
      headers: {},
    } as unknown as ApiRequest;
    const res = createResponse();
    await handler(req, res);

    expect(vi.mocked(sendErrorResponse)).toHaveBeenCalled();
  });
});
