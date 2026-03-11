import { beforeEach, describe, expect, it, vi } from 'vitest';
import importHandler from '@/pages/api/v2/quotations/import';
import rollbackHandler from '@/pages/api/v2/quotations/import/rollback';
import jobHandler from '@/pages/api/v2/quotations/import/job';
import exportHandler from '@/pages/api/v2/quotations/export';

type Row = Record<string, any>;

const state = {
  quotes: [] as Row[],
  import_history: [] as Row[],
  import_history_details: [] as Row[],
  import_errors: [] as Row[],
};

function resetState() {
  state.quotes = [];
  state.import_history = [];
  state.import_history_details = [];
  state.import_errors = [];
}

function createMockDb() {
  return {
    from(table: keyof typeof state | 'quotes') {
      const filters: Record<string, any> = {};
      let mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
      let pendingPayload: any = null;
      let pendingRange: { from: number; to: number } | null = null;
      let pendingOrder: { key: string; ascending: boolean } | null = null;
      let pendingSearch: string | null = null;

      const query: any = {
        select: (_fields?: string) => {
          if (mode !== 'insert' && mode !== 'upsert') {
            mode = 'select';
          }
          return query;
        },
        insert: (payload: any) => {
          mode = 'insert';
          pendingPayload = payload;
          return query;
        },
        update: (payload: any) => {
          mode = 'update';
          pendingPayload = payload;
          return query;
        },
        upsert: (payload: any) => {
          mode = 'upsert';
          pendingPayload = payload;
          return query;
        },
        delete: () => {
          mode = 'delete';
          return query;
        },
        eq: (key: string, value: any) => {
          filters[key] = value;
          if (mode === 'update') {
            const rows = (state as any)[table] as Row[];
            rows.forEach((r) => {
              if (Object.entries(filters).every(([k, v]) => r[k] === v)) Object.assign(r, pendingPayload);
            });
            return Promise.resolve({ data: null, error: null });
          }
          return query;
        },
        in: (key: string, values: any[]) => {
          filters[key] = values;
          if (mode === 'delete') {
            const rows = (state as any)[table] as Row[];
            (state as any)[table] = rows.filter((r) => !values.includes(r[key]));
            return Promise.resolve({ data: null, error: null });
          }
          return query;
        },
        order: (key: string, options?: { ascending?: boolean }) => {
          pendingOrder = { key, ascending: options?.ascending !== false };
          return query;
        },
        limit: (size: number) => {
          pendingRange = { from: 0, to: Math.max(0, size - 1) };
          return query;
        },
        or: (expr: string) => {
          const parts = String(expr || '').split(',').map((item) => item.trim()).filter(Boolean);
          const parsedTerms = parts
            .map((part) => {
              const match = part.match(/^(quote_number|title)\.ilike\.%(.*)%$/);
              if (!match) return null;
              return String(match[2] || '').toLowerCase();
            })
            .filter((term): term is string => Boolean(term));
          pendingSearch = parsedTerms.length > 0 ? parsedTerms.join(' ') : null;
          return query;
        },
        range: (from: number, to: number) => {
          pendingRange = { from, to };
          return Promise.resolve({
            data: ((state as any)[table] as Row[]).filter((r) =>
              Object.entries(filters).every(([k, v]) => r[k] === v)
            ).slice(from, to + 1),
            error: null,
          });
        },
        single: () => {
          if (mode === 'insert') {
            const rows = Array.isArray(pendingPayload) ? pendingPayload : [pendingPayload];
            const created = rows.map((r) => ({ id: r.id || crypto.randomUUID(), ...r }));
            (state as any)[table].push(...created);
            return Promise.resolve({ data: created[0] || null, error: null });
          }
          if (mode === 'upsert') {
            const rows = Array.isArray(pendingPayload) ? pendingPayload : [pendingPayload];
            const tableRows = (state as any)[table] as Row[];
            for (const row of rows) {
              const idx = tableRows.findIndex((r) => r.id === row.id);
              if (idx >= 0) tableRows[idx] = { ...tableRows[idx], ...row };
              else tableRows.push({ id: row.id || crypto.randomUUID(), ...row });
            }
            return Promise.resolve({ data: tableRows[0] || null, error: null });
          }
          const rows = ((state as any)[table] as Row[]).filter((r) =>
            Object.entries(filters).every(([k, v]) => r[k] === v)
          );
          return Promise.resolve({ data: rows[0] || null, error: rows[0] ? null : new Error('not found') });
        },
        then: (resolve: any) => {
          if (mode === 'select') {
            let rows = ((state as any)[table] as Row[]).filter((r) =>
              Object.entries(filters).every(([k, v]) => {
                if (Array.isArray(v)) return v.includes(r[k]);
                return r[k] === v;
              })
            );
            if (pendingSearch) {
              const needle = pendingSearch.toLowerCase();
              rows = rows.filter((row) =>
                String(row.quote_number || '').toLowerCase().includes(needle) ||
                String(row.title || '').toLowerCase().includes(needle)
              );
            }
            if (pendingOrder) {
              const { key, ascending } = pendingOrder;
              rows = [...rows].sort((a, b) => {
                const av = a[key];
                const bv = b[key];
                if (av === bv) return 0;
                if (av === undefined || av === null) return ascending ? 1 : -1;
                if (bv === undefined || bv === null) return ascending ? -1 : 1;
                return String(av).localeCompare(String(bv), undefined, { numeric: true }) * (ascending ? 1 : -1);
              });
            }
            resolve({ data: pendingRange ? rows.slice(pendingRange.from, pendingRange.to + 1) : rows, error: null });
            return;
          }
          if (mode === 'insert') {
            const rows = Array.isArray(pendingPayload) ? pendingPayload : [pendingPayload];
            const created = rows.map((r) => ({ id: r.id || crypto.randomUUID(), ...r }));
            (state as any)[table].push(...created);
            resolve({ data: created, error: null });
            return;
          }
          if (mode === 'upsert') {
            const rows = Array.isArray(pendingPayload) ? pendingPayload : [pendingPayload];
            const tableRows = (state as any)[table] as Row[];
            const updated: Row[] = [];
            for (const row of rows) {
              const idx = tableRows.findIndex((r) => r.id === row.id);
              if (idx >= 0) tableRows[idx] = { ...tableRows[idx], ...row };
              else tableRows.push({ id: row.id || crypto.randomUUID(), ...row });
              updated.push(tableRows[idx >= 0 ? idx : tableRows.length - 1]);
            }
            resolve({ data: updated, error: null });
            return;
          }
          resolve({ data: null, error: null });
        },
      };

      return query;
    },
  };
}

vi.mock('@/pages/api/_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(() => createMockDb()),
}));

vi.mock('@/pages/api/v2/quotations/import/queue', () => ({
  enqueueQuotationImportJob: vi.fn(async () => true),
  cancelQueuedQuotationImportJob: vi.fn(async () => true),
}));

function mockReqRes(input: { method?: string; query?: Record<string, unknown>; headers?: Record<string, string>; body?: any }) {
  const headers = input.headers || {};
  const req = {
    method: input.method,
    query: input.query || {},
    headers,
    body: input.body,
  } as any;
  let statusCode = 200;
  let payload: any;
  const res = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      statusCode = code;
      return {
        json: (data: unknown) => {
          payload = data;
        },
        end: () => undefined,
      };
    }),
    _getStatusCode: () => statusCode,
    _getData: () => payload,
  } as any;
  return { req, res };
}

const authHeaders = (overrides: Record<string, string> = {}) => ({
  'x-tenant-id': 'tenant-1',
  'x-user-id': 'user-1',
  'x-user-permissions': 'import_quotation,export_quotation',
  'x-csrf-token': 'csrf-test-token',
  cookie: 'csrf_token=csrf-test-token',
  ...overrides,
});

describe('Quotation import v2 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    state.quotes.push({
      id: 'quote-existing-1',
      tenant_id: 'tenant-1',
      quote_number: 'QUO-EXIST',
      title: 'Existing',
      sell_price: 1000,
      buy_price: 500,
      currency: 'USD',
      status: 'draft',
      account_id: 'account-1',
      contact_id: 'contact-1',
      opportunity_id: 'opportunity-1',
    });
  });

  it('imports valid rows and records failures', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      headers: authHeaders(),
      body: {
        format: 'json',
        mode: 'full',
        duplicateMode: 'update',
        rows: [
          { quote_number: 'QUO-NEW', title: 'New', status: 'draft', buy_price: 10, sell_price: 20, currency: 'USD' },
          { quote_number: 'QUO-BLOCK', title: 'Blocked', status: 'draft', buy_price: 10, sell_price: 30, currency: 'USD', custom_fields: { credit_status: 'blocked' } },
          { quote_number: 'QUO-EXIST', title: 'Existing Updated', status: 'sent', buy_price: 20, sell_price: 40, currency: 'USD' },
        ],
      },
    });

    await importHandler(req, res);
    const data = res._getData();
    expect(res._getStatusCode()).toBe(200);
    expect(data.version).toBe('v2');
    expect(data.summary.success).toBe(2);
    expect(data.summary.failed).toBe(1);
    expect(state.import_history.length).toBe(1);
    expect(state.import_history_details.length).toBeGreaterThan(0);
    expect(state.import_errors.length).toBe(1);
  });

  it('rolls back inserts and updates by import id', async () => {
    state.import_history.push({
      id: '11111111-1111-4111-8111-111111111111',
      tenant_id: 'tenant-1',
      status: 'success',
    });
    state.import_history_details.push(
      {
        import_id: '11111111-1111-4111-8111-111111111111',
        operation_type: 'insert',
        record_id: 'quote-inserted-1',
      },
      {
        import_id: '11111111-1111-4111-8111-111111111111',
        operation_type: 'update',
        record_id: 'quote-existing-1',
        previous_data: {
          id: 'quote-existing-1',
          tenant_id: 'tenant-1',
          quote_number: 'QUO-EXIST',
          title: 'Existing Restored',
          sell_price: 1000,
          buy_price: 500,
          currency: 'USD',
          status: 'draft',
        },
      }
    );
    state.quotes.push({
      id: 'quote-inserted-1',
      tenant_id: 'tenant-1',
      quote_number: 'QUO-ROLLBACK',
      title: 'Inserted',
      sell_price: 30,
      buy_price: 20,
      currency: 'USD',
      status: 'draft',
    });
    state.quotes = state.quotes.map((q) => (q.id === 'quote-existing-1' ? { ...q, title: 'Changed' } : q));

    const { req, res } = mockReqRes({
      method: 'POST',
      headers: authHeaders(),
      body: { importId: '11111111-1111-4111-8111-111111111111' },
    });

    await rollbackHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getData().revertedInserts).toBe(1);
    expect(res._getData().revertedUpdates).toBe(1);
    expect(state.quotes.find((q) => q.id === 'quote-inserted-1')).toBeUndefined();
    expect(state.quotes.find((q) => q.id === 'quote-existing-1')?.title).toBe('Existing Restored');
  });

  it('rejects import when CSRF token is missing', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      headers: {
        'x-tenant-id': 'tenant-1',
        'x-user-id': 'user-1',
        'x-user-permissions': 'import_quotation',
      },
      body: {
        format: 'json',
        mode: 'full',
        duplicateMode: 'update',
        rows: [{ quote_number: 'QUO-NEW-2', title: 'New 2', status: 'draft', buy_price: 10, sell_price: 20, currency: 'USD' }],
      },
    });

    await importHandler(req, res);
    expect(res._getStatusCode()).toBe(403);
    expect(res._getData().error).toMatch(/CSRF/i);
  });

  it('rejects rollback when permission is missing', async () => {
    state.import_history.push({
      id: '21111111-1111-4111-8111-111111111111',
      tenant_id: 'tenant-1',
      status: 'success',
    });

    const { req, res } = mockReqRes({
      method: 'POST',
      headers: authHeaders({ 'x-user-permissions': 'export_quotation' }),
      body: { importId: '21111111-1111-4111-8111-111111111111' },
    });

    await rollbackHandler(req, res);
    expect(res._getStatusCode()).toBe(403);
    expect(res._getData().error).toBe('Forbidden');
  });

  it('returns queued async job contract and supports job status and cancellation', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      headers: authHeaders(),
      body: {
        format: 'json',
        mode: 'full',
        duplicateMode: 'update',
        async: true,
        rows: [{ quote_number: 'QUO-ASYNC', title: 'Async', status: 'draft', buy_price: 11, sell_price: 22, currency: 'USD' }],
      },
    });

    await importHandler(req, res);
    expect(res._getStatusCode()).toBe(202);
    const importId = res._getData().importId;
    expect(res._getData().job.status).toBe('queued');

    const statusCall = mockReqRes({
      method: 'GET',
      query: { importId },
      headers: authHeaders(),
    });
    await jobHandler(statusCall.req, statusCall.res);
    expect(statusCall.res._getStatusCode()).toBe(200);
    expect(statusCall.res._getData().job.id).toBe(importId);
    expect(statusCall.res._getData().job.status).toBe('queued');

    const cancelCall = mockReqRes({
      method: 'DELETE',
      query: { importId },
      headers: authHeaders(),
    });
    await jobHandler(cancelCall.req, cancelCall.res);
    expect(cancelCall.res._getStatusCode()).toBe(200);
    expect(cancelCall.res._getData().job.status).toBe('cancelled');
  });

  it('exports selected quotations with signed report metadata', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      headers: authHeaders(),
      body: {
        format: 'json',
        scope: 'selected',
        ids: ['quote-existing-1'],
      },
    });

    await exportHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = res._getData();
    expect(data.version).toBe('v2');
    expect(data.report.rowCount).toBe(1);
    expect(data.report.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(data.report.digitalSignature.value).toMatch(/^[a-f0-9]{64}$/);

    const decoded = JSON.parse(Buffer.from(String(data.export.data), 'base64').toString('utf8'));
    expect(decoded.rowCount).toBe(1);
    expect(decoded.rows[0].quote_number).toBe('QUO-EXIST');
    expect(decoded.rows[0].buy_price).toBeUndefined();
  });

  it('rejects sensitive export without sensitive permission', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      headers: authHeaders({ 'x-user-permissions': 'export_quotation' }),
      body: {
        format: 'json',
        scope: 'selected',
        ids: ['quote-existing-1'],
        includeSensitive: true,
      },
    });

    await exportHandler(req, res);
    expect(res._getStatusCode()).toBe(403);
    expect(String(res._getData().error || '')).toMatch(/Forbidden/i);
  });

  it('allows sensitive export with sensitive permission', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      headers: authHeaders({ 'x-user-permissions': 'export_quotation,export_quotation_sensitive' }),
      body: {
        format: 'json',
        scope: 'selected',
        ids: ['quote-existing-1'],
        includeSensitive: true,
        fields: ['quote_number', 'buy_price', 'account_id'],
      },
    });

    await exportHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = res._getData();
    const decoded = JSON.parse(Buffer.from(String(data.export.data), 'base64').toString('utf8'));
    expect(decoded.rows[0].buy_price).toBe(500);
    expect(decoded.rows[0].account_id).toBe('account-1');
  });
});
