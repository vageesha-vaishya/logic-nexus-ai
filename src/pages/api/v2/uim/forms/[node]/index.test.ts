import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './index';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  buildApiContext,
  handlePreflight,
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import { resolveUimFormAccess } from '../_shared';

vi.mock('../../../../_utils/http', () => ({
  applyCors: vi.fn(),
  buildApiContext: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
}));

vi.mock('../../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../_shared', async () => {
  const actual = await vi.importActual<object>('../_shared');
  return {
    ...actual,
    resolveUimFormAccess: vi.fn(),
  };
});

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

describe('/api/v2/uim/forms/[node]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-uim-forms-node',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
    } as any);
    vi.mocked(resolveUimFormAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
  });

  it('creates a form record on POST', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'rec-1', node_key: 'overview', payload: { module_name: 'UIM' }, created_at: 'now', updated_at: 'now' },
      error: null,
    });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ limit });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { node: 'overview' },
      headers: {},
      body: { module_name: 'UIM' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('lists form records on GET', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [{ id: 'rec-1', node_key: 'overview' }],
      error: null,
      count: 1,
    });
    const order = vi.fn().mockReturnValue({ range });
    const isDeleted = vi.fn().mockReturnValue({ order });
    const eqNode = vi.fn().mockReturnValue({ is: isDeleted });
    const eqTenant = vi.fn().mockReturnValue({ eq: eqNode });
    const select = vi.fn().mockReturnValue({ eq: eqTenant });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { node: 'overview', limit: '11', offset: '0' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.records?.length).toBe(1);
    expect((res.jsonBody as any)?.output?.source).toBe('form-storage');
    expect(Array.isArray((res.jsonBody as any)?.output?.column_catalog)).toBe(true);
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown node', async () => {
    const req: ApiRequest = {
      method: 'GET',
      query: { node: 'unknown' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect((res.jsonBody as any)?.code).toBe('UIM_FORM_NODE_NOT_FOUND');
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('returns storage-not-ready code when table does not exist', async () => {
    const range = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'relation "uim_form_records" does not exist' },
      count: 0,
    });
    const order = vi.fn().mockReturnValue({ range });
    const isDeleted = vi.fn().mockReturnValue({ order });
    const eqNode = vi.fn().mockReturnValue({ is: isDeleted });
    const eqTenant = vi.fn().mockReturnValue({ eq: eqNode });
    const select = vi.fn().mockReturnValue({ eq: eqTenant });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { node: 'overview' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect((res.jsonBody as any)?.code).toBe('UIM_FORM_STORAGE_NOT_READY');
  });

  it('creates item-master records in uim_catalog_items canonical table', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'cat-1', sku: 'UIM-MRO-000001' },
      error: null,
    });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ limit });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn((table: string) => {
      if (table === 'uim_catalog_items') return { insert };
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'POST',
      query: { node: 'item-master' },
      headers: {},
      body: { item_name: 'Hydraulic Pump', sku: 'UIM-MRO-000001', category: 'rotable', uom: 'EA' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any)?.interface).toBe('uim-item-master-create');
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('derives overview records from canonical tables when form records are empty', async () => {
    const formRange = vi.fn().mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });
    const formOrder = vi.fn().mockReturnValue({ range: formRange });
    const formIs = vi.fn().mockReturnValue({ order: formOrder });
    const formEqNode = vi.fn().mockReturnValue({ is: formIs });
    const formEqTenant = vi.fn().mockReturnValue({ eq: formEqNode });
    const formSelect = vi.fn().mockReturnValue({ eq: formEqTenant });

    const headCount = (count: number) => ({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ count, error: null }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'uim_form_records') return { select: formSelect };
      if (table === 'uim_catalog_items') return { select: vi.fn().mockReturnValue(headCount(800)) };
      if (table === 'uim_inventory_items') return { select: vi.fn().mockReturnValue(headCount(800)) };
      if (table === 'uim_inventory_projection_snapshots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 800, error: null }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { node: 'overview', limit: '10', offset: '0' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.count).toBe(1);
    expect((res.jsonBody as any)?.output?.source).toBe('canonical');
    expect((res.jsonBody as any)?.output?.records?.[0]?.metadata?.mode).toBe('derived-canonical');
    expect((res.jsonBody as any)?.output?.records?.[0]?.payload?.notes).toContain('catalog=800');
  });

  it('returns module-specific canonical datasets with distinct field mapping per module', async () => {
    const catalogRange = vi.fn().mockResolvedValue({
      data: [{
        id: 'cat-1',
        sku: 'UIM-MRO-000001',
        part_number: 'MRO-PN-70000001',
        title: 'Rotable Unit',
        category: 'rotable',
        unit_of_measure: 'EA',
        attributes: { maintenance_category: 'rotable', ata_chapter_code: '71' },
        updated_at: '2026-04-07T00:00:00.000Z',
      }],
      error: null,
    });
    const catalogOrder = vi.fn().mockReturnValue({ range: catalogRange });
    const catalogIs = vi.fn().mockReturnValue({ order: catalogOrder });
    const catalogEqTenant = vi.fn().mockReturnValue({ is: catalogIs });
    const catalogSelect = vi.fn().mockReturnValue({ eq: catalogEqTenant });

    const catalogCountIs = vi.fn().mockResolvedValue({ count: 1, error: null });
    const catalogCountEq = vi.fn().mockReturnValue({ is: catalogCountIs });
    const catalogCountSelect = vi.fn().mockReturnValue({ eq: catalogCountEq });

    const reservationRange = vi.fn().mockResolvedValue({
      data: [{
        id: 'res-1',
        inventory_item_id: 'inv-1',
        reserved_quantity: 4,
        reservation_status: 'active',
        reservation_token: 'token-1',
        expected_use_at: '2026-04-08',
        metadata: { consumer_reference: 'WO-1' },
        updated_at: '2026-04-07T01:00:00.000Z',
      }],
      error: null,
    });
    const reservationOrder = vi.fn().mockReturnValue({ range: reservationRange });
    const reservationEqTenant = vi.fn().mockReturnValue({ order: reservationOrder });
    const reservationSelect = vi.fn().mockReturnValue({ eq: reservationEqTenant });

    const reservationCountEq = vi.fn().mockResolvedValue({ count: 1, error: null });
    const reservationCountSelect = vi.fn().mockReturnValue({ eq: reservationCountEq });

    const from = vi.fn((table: string) => {
      if (table === 'uim_catalog_items') {
        return {
          select: vi.fn((_: string, options?: any) => (options?.head ? catalogCountSelect() : catalogSelect())),
        };
      }
      if (table === 'uim_inventory_reservations') {
        return {
          select: vi.fn((_: string, options?: any) => (options?.head ? reservationCountSelect() : reservationSelect())),
        };
      }
      if (table === 'uim_form_records') {
        const range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
        const order = vi.fn().mockReturnValue({ range });
        const is = vi.fn().mockReturnValue({ order });
        const eqNode = vi.fn().mockReturnValue({ is });
        const eqTenant = vi.fn().mockReturnValue({ eq: eqNode });
        const select = vi.fn().mockReturnValue({ eq: eqTenant });
        return { select };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const itemReq: ApiRequest = {
      method: 'GET',
      query: { node: 'item-master', limit: '10', offset: '0' },
      headers: {},
      body: {},
    };
    const itemRes = createResponse();
    await handler(itemReq, itemRes);
    expect(itemRes.statusCode).toBe(200);
    expect((itemRes.jsonBody as any)?.output?.source).toBe('canonical');
    expect((itemRes.jsonBody as any)?.output?.column_catalog?.some((col: any) => col.key === 'part_number')).toBe(true);
    expect((itemRes.jsonBody as any)?.output?.records?.[0]?.payload?.part_number).toBe('MRO-PN-70000001');
    expect((itemRes.jsonBody as any)?.output?.records?.[0]?.payload?.reservation_token).toBeUndefined();

    const reservationReq: ApiRequest = {
      method: 'GET',
      query: { node: 'reservations', limit: '10', offset: '0' },
      headers: {},
      body: {},
    };
    const reservationRes = createResponse();
    await handler(reservationReq, reservationRes);
    expect(reservationRes.statusCode).toBe(200);
    expect((reservationRes.jsonBody as any)?.output?.source).toBe('canonical');
    expect((reservationRes.jsonBody as any)?.output?.column_catalog?.some((col: any) => col.key === 'reservation_token')).toBe(true);
    expect((reservationRes.jsonBody as any)?.output?.records?.[0]?.payload?.reservation_token).toBe('token-1');
    expect((reservationRes.jsonBody as any)?.output?.records?.[0]?.payload?.part_number).toBeUndefined();
  });

  it('falls back item-master listing to uim_inventory_items when catalog is empty', async () => {
    const emptyCatalogRange = vi.fn().mockResolvedValue({ data: [], error: null });
    const emptyCatalogOrder = vi.fn().mockReturnValue({ range: emptyCatalogRange });
    const emptyCatalogIs = vi.fn().mockReturnValue({ order: emptyCatalogOrder });
    const emptyCatalogEq = vi.fn().mockReturnValue({ is: emptyCatalogIs });
    const emptyCatalogSelect = vi.fn().mockReturnValue({ eq: emptyCatalogEq });

    const zeroCountIs = vi.fn().mockResolvedValue({ count: 0, error: null });
    const zeroCountEq = vi.fn().mockReturnValue({ is: zeroCountIs });
    const zeroCountSelect = vi.fn().mockReturnValue({ eq: zeroCountEq });

    const inventoryRange = vi.fn().mockResolvedValue({
      data: [{
        id: 'inv-1',
        metadata: { part_number: 'MRO-PN-90000001', sku: 'INV-SKU-1', item_name: 'Fallback Item' },
        status: 'available',
        updated_at: '2026-04-07T00:00:00.000Z',
      }],
      error: null,
    });
    const inventoryOrder = vi.fn().mockReturnValue({ range: inventoryRange });
    const inventoryIs = vi.fn().mockReturnValue({ order: inventoryOrder });
    const inventoryEq = vi.fn().mockReturnValue({ is: inventoryIs });
    const inventorySelect = vi.fn().mockReturnValue({ eq: inventoryEq });

    const inventoryCountIs = vi.fn().mockResolvedValue({ count: 1, error: null });
    const inventoryCountEq = vi.fn().mockReturnValue({ is: inventoryCountIs });
    const inventoryCountSelect = vi.fn().mockReturnValue({ eq: inventoryCountEq });

    const from = vi.fn((table: string) => {
      if (table === 'uim_catalog_items') {
        return {
          select: vi.fn((_: string, options?: any) => (options?.head ? zeroCountSelect() : emptyCatalogSelect())),
        };
      }
      if (table === 'uim_inventory_items') {
        return {
          select: vi.fn((_: string, options?: any) => (options?.head ? inventoryCountSelect() : inventorySelect())),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { node: 'item-master', limit: '12', offset: '0' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.records?.[0]?.payload?.item_name).toBe('Fallback Item');
    expect((res.jsonBody as any)?.output?.records?.[0]?.metadata?.source).toBe('uim_inventory_items-fallback');
  });
});
