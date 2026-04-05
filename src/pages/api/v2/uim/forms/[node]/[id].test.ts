import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './[id]';
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

describe('/api/v2/uim/forms/[node]/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-uim-forms-node-id',
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

  it('updates a form record on PATCH', async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'rec-1', node_key: 'overview', payload: { module_name: 'Old' } },
      error: null,
    });
    const existingLimit = vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingle });
    const existingIs = vi.fn().mockReturnValue({ limit: existingLimit });
    const existingEqId = vi.fn().mockReturnValue({ is: existingIs });
    const existingEqNode = vi.fn().mockReturnValue({ eq: existingEqId });
    const existingEqTenant = vi.fn().mockReturnValue({ eq: existingEqNode });
    const existingSelect = vi.fn().mockReturnValue({ eq: existingEqTenant });

    const updateMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'rec-1', node_key: 'overview', payload: { module_name: 'New' } },
      error: null,
    });
    const updateLimit = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateSelect = vi.fn().mockReturnValue({ limit: updateLimit });
    const updateEqId = vi.fn().mockReturnValue({ select: updateSelect });
    const updateEqNode = vi.fn().mockReturnValue({ eq: updateEqId });
    const updateEqTenant = vi.fn().mockReturnValue({ eq: updateEqNode });
    const update = vi.fn().mockReturnValue({ eq: updateEqTenant });

    const from = vi.fn().mockReturnValue({ select: existingSelect, update });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { node: 'overview', id: 'rec-1' },
      headers: {},
      body: { module_name: 'New' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('soft deletes a form record on DELETE', async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'rec-1', node_key: 'overview', payload: { module_name: 'Old' } },
      error: null,
    });
    const existingLimit = vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingle });
    const existingIs = vi.fn().mockReturnValue({ limit: existingLimit });
    const existingEqId = vi.fn().mockReturnValue({ is: existingIs });
    const existingEqNode = vi.fn().mockReturnValue({ eq: existingEqId });
    const existingEqTenant = vi.fn().mockReturnValue({ eq: existingEqNode });
    const existingSelect = vi.fn().mockReturnValue({ eq: existingEqTenant });

    const deleteEqId = vi.fn().mockResolvedValue({ error: null });
    const deleteEqNode = vi.fn().mockReturnValue({ eq: deleteEqId });
    const deleteEqTenant = vi.fn().mockReturnValue({ eq: deleteEqNode });
    const update = vi.fn().mockReturnValue({ eq: deleteEqTenant });

    const from = vi.fn().mockReturnValue({ select: existingSelect, update });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'DELETE',
      query: { node: 'overview', id: 'rec-1' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('reads item-master records from uim_catalog_items canonical table', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'cat-1',
        tenant_id: 'tenant-1',
        franchise_id: null,
        sku: 'UIM-MRO-000001',
        part_number: 'MRO-PN-70000001',
        title: 'Hydraulic Pump',
        category: 'rotable',
        unit_of_measure: 'EA',
        attributes: { maintenance_category: 'rotable', ata_chapter_code: '71' },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      error: null,
    });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const is = vi.fn().mockReturnValue({ limit });
    const eqId = vi.fn().mockReturnValue({ is });
    const eqTenant = vi.fn().mockReturnValue({ eq: eqId });
    const select = vi.fn().mockReturnValue({ eq: eqTenant });
    const from = vi.fn((table: string) => {
      if (table === 'uim_catalog_items') return { select };
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { node: 'item-master', id: 'cat-1' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('uim-item-master-read');
    expect((res.jsonBody as any)?.output?.payload?.item_name).toBe('Hydraulic Pump');
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('updates item-master records on uim_catalog_items canonical table', async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'cat-1',
        tenant_id: 'tenant-1',
      },
      error: null,
    });
    const existingLimit = vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingle });
    const existingIs = vi.fn().mockReturnValue({ limit: existingLimit });
    const existingEqId = vi.fn().mockReturnValue({ is: existingIs });
    const existingEqTenant = vi.fn().mockReturnValue({ eq: existingEqId });
    const existingSelect = vi.fn().mockReturnValue({ eq: existingEqTenant });

    const updateMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'cat-1', sku: 'UIM-MRO-000001' },
      error: null,
    });
    const updateLimit = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateSelect = vi.fn().mockReturnValue({ limit: updateLimit });
    const updateEqId = vi.fn().mockReturnValue({ select: updateSelect });
    const updateEqTenant = vi.fn().mockReturnValue({ eq: updateEqId });
    const update = vi.fn().mockReturnValue({ eq: updateEqTenant });

    const from = vi.fn((table: string) => {
      if (table === 'uim_catalog_items') return { select: existingSelect, update };
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'PATCH',
      query: { node: 'item-master', id: 'cat-1' },
      headers: {},
      body: { item_name: 'Hydraulic Pump X', sku: 'UIM-MRO-000001' },
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect((res.jsonBody as any)?.interface).toBe('uim-item-master-update');
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });

  it('reads item-master fallback records from uim_inventory_items when catalog row is missing', async () => {
    const catalogMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const catalogLimit = vi.fn().mockReturnValue({ maybeSingle: catalogMaybeSingle });
    const catalogIs = vi.fn().mockReturnValue({ limit: catalogLimit });
    const catalogEqId = vi.fn().mockReturnValue({ is: catalogIs });
    const catalogEqTenant = vi.fn().mockReturnValue({ eq: catalogEqId });
    const catalogSelect = vi.fn().mockReturnValue({ eq: catalogEqTenant });

    const inventoryMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'inv-1',
        tenant_id: 'tenant-1',
        franchise_id: null,
        metadata: { part_number: 'MRO-PN-90000001', sku: 'INV-SKU-1', item_name: 'Fallback Item' },
        status: 'available',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      error: null,
    });
    const inventoryLimit = vi.fn().mockReturnValue({ maybeSingle: inventoryMaybeSingle });
    const inventoryIs = vi.fn().mockReturnValue({ limit: inventoryLimit });
    const inventoryEqId = vi.fn().mockReturnValue({ is: inventoryIs });
    const inventoryEqTenant = vi.fn().mockReturnValue({ eq: inventoryEqId });
    const inventorySelect = vi.fn().mockReturnValue({ eq: inventoryEqTenant });

    const from = vi.fn((table: string) => {
      if (table === 'uim_catalog_items') return { select: catalogSelect };
      if (table === 'uim_inventory_items') return { select: inventorySelect };
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as any);

    const req: ApiRequest = {
      method: 'GET',
      query: { node: 'item-master', id: 'inv-1' },
      headers: {},
      body: {},
    };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.payload?.item_name).toBe('Fallback Item');
    expect((res.jsonBody as any)?.output?.metadata?.source).toBe('uim_inventory_items');
  });
});
