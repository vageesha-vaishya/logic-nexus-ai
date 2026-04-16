import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

const NODE_KEYS = new Set([
  'overview',
  'item-master',
  'stock-ledger',
  'reservations',
  'issue-consume',
  'restock',
  'locations',
  'analytics',
]);

export type StoredRecord = {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  node_key: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const store = new Map<string, StoredRecord>();

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Tenant-Id,X-Franchise-Id,X-User-Id,X-Correlation-Id');
}

function getHeader(req: IncomingMessage, key: string): string {
  const value = req.headers[key.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function resolveTenant(req: IncomingMessage): { tenantId: string; franchiseId: string | null } {
  const tenantId = String(getHeader(req, 'x-tenant-id') || 'dev-tenant');
  const franchiseId = String(getHeader(req, 'x-franchise-id') || '').trim() || null;
  return { tenantId, franchiseId };
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function match(pathname: string, regex: RegExp): RegExpMatchArray | null {
  return pathname.match(regex);
}

export async function handleUimMockRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'GET' && pathname === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'uim-api',
      mode: 'dev-mock',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/uim/health') {
    sendJson(res, 200, {
      status: 'ok',
      interface: 'uim-api',
      mode: 'dev-mock',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const listMatch = match(pathname, /^\/api\/v2\/uim\/forms\/([^/]+)$/);
  const recordMatch = match(pathname, /^\/api\/v2\/uim\/forms\/([^/]+)\/([^/]+)$/);

  if (listMatch && method === 'GET') {
    const node = listMatch[1];
    if (!NODE_KEYS.has(node)) {
      sendJson(res, 404, { error: 'UIM form node not found', code: 'UIM_FORM_NODE_NOT_FOUND', version: 'v2' });
      return;
    }
    const limit = Math.min(Math.max(Number.parseInt(String(url.searchParams.get('limit') || '25'), 10) || 25, 1), 200);
    const offset = Math.max(Number.parseInt(String(url.searchParams.get('offset') || '0'), 10) || 0, 0);
    const { tenantId, franchiseId } = resolveTenant(req);
    const records = [...store.values()]
      .filter((record) => record.deleted_at === null)
      .filter((record) => record.tenant_id === tenantId)
      .filter((record) => record.node_key === node)
      .filter((record) => !franchiseId || record.franchise_id === franchiseId)
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    const sliced = records.slice(offset, offset + limit);
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-form-records-list',
      correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
      output: {
        node_key: node,
        count: records.length,
        limit,
        offset,
        records: sliced,
      },
    });
    return;
  }

  if (listMatch && method === 'POST') {
    const node = listMatch[1];
    if (!NODE_KEYS.has(node)) {
      sendJson(res, 404, { error: 'UIM form node not found', code: 'UIM_FORM_NODE_NOT_FOUND', version: 'v2' });
      return;
    }
    const { tenantId, franchiseId } = resolveTenant(req);
    const now = new Date().toISOString();
    const id = randomUUID();
    const body = await parseBody(req);
    const record: StoredRecord = {
      id,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: node,
      payload: body,
      metadata: { mode: 'dev-mock' },
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    store.set(id, record);
    sendJson(res, 201, {
      version: 'v2',
      interface: 'uim-form-record-create',
      id,
      output: record,
      message: 'UIM form record created successfully',
    });
    return;
  }

  if (recordMatch && method === 'GET') {
    const node = recordMatch[1];
    const id = recordMatch[2];
    const existing = store.get(id);
    if (!existing || existing.deleted_at !== null || existing.node_key !== node) {
      sendJson(res, 404, { error: 'UIM form record not found', code: 'UIM_FORM_RECORD_NOT_FOUND', version: 'v2' });
      return;
    }
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-form-record-read',
      output: existing,
    });
    return;
  }

  if (recordMatch && method === 'PATCH') {
    const node = recordMatch[1];
    const id = recordMatch[2];
    const existing = store.get(id);
    if (!existing || existing.deleted_at !== null || existing.node_key !== node) {
      sendJson(res, 404, { error: 'UIM form record not found', code: 'UIM_FORM_RECORD_NOT_FOUND', version: 'v2' });
      return;
    }
    const body = await parseBody(req);
    const updated: StoredRecord = {
      ...existing,
      payload: body,
      updated_at: new Date().toISOString(),
    };
    store.set(id, updated);
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-form-record-update',
      id,
      output: updated,
      message: 'UIM form record updated successfully',
    });
    return;
  }

  if (recordMatch && method === 'DELETE') {
    const node = recordMatch[1];
    const id = recordMatch[2];
    const existing = store.get(id);
    if (!existing || existing.deleted_at !== null || existing.node_key !== node) {
      sendJson(res, 404, { error: 'UIM form record not found', code: 'UIM_FORM_RECORD_NOT_FOUND', version: 'v2' });
      return;
    }
    const deleted: StoredRecord = {
      ...existing,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.set(id, deleted);
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-form-record-delete',
      id,
      message: 'UIM form record deleted successfully',
    });
    return;
  }

  // Domain assignments - POST (bulk assign)
  if (pathname === '/api/v1/domain-assignments' && method === 'POST') {
    const body = await parseBody(req);
    const domainId = String(body.domainId || '').trim();
    const tenantIds = Array.isArray(body.tenantIds) ? body.tenantIds : [];
    const batchId = String(body.batchId || randomUUID()).trim();

    if (!domainId || tenantIds.length === 0) {
      sendJson(res, 400, { error: 'domainId and tenantIds are required', code: 'INVALID_PAYLOAD' });
      return;
    }

    // Store assignment records in mock store
    const now = new Date().toISOString();
    const records: any[] = [];
    for (const tenantId of tenantIds) {
      const id = randomUUID();
      const record = {
        id,
        tenant_id: String(tenantId),
        domain_id: domainId,
        is_active: true,
        subscription_status: 'active',
        batch_id: batchId,
        actor_user_id: String(getHeader(req, 'x-user-id') || 'system'),
        created_at: now,
      };
      store.set(`domain-assignment:${id}`, record as any);
      records.push(record);
    }

    sendJson(res, 200, {
      version: 'v1',
      correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
      data: {
        batchId,
        assignedCount: records.length,
        records,
      },
    });
    return;
  }

  // Domain assignments - DELETE (bulk revoke)
  if (pathname === '/api/v1/domain-assignments' && method === 'DELETE') {
    const body = await parseBody(req);
    const domainId = String(body.domainId || '').trim();
    const tenantIds = Array.isArray(body.tenantIds) ? body.tenantIds : [];
    const batchId = String(body.batchId || randomUUID()).trim();

    if (!domainId || tenantIds.length === 0) {
      sendJson(res, 400, { error: 'domainId and tenantIds are required', code: 'INVALID_PAYLOAD' });
      return;
    }

    let revokedCount = 0;
    for (const [key, record] of store.entries()) {
      if (
        key.startsWith('domain-assignment:') &&
        record.domain_id === domainId &&
        tenantIds.includes(record.tenant_id)
      ) {
        store.delete(key);
        revokedCount++;
      }
    }

    sendJson(res, 200, {
      version: 'v1',
      correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
      data: {
        batchId,
        revokedCount,
      },
    });
    return;
  }

  // Domain assignments - GET (audit history)
  if (pathname === '/api/v1/domain-assignments' && method === 'GET') {
    const records: any[] = [];
    for (const [key, record] of store.entries()) {
      if (key.startsWith('domain-assignment:')) {
        records.push(record);
      }
    }
    const sorted = records.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    sendJson(res, 200, {
      version: 'v1',
      correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
      data: sorted,
    });
    return;
  }

  // Platform domains - GET
  if (pathname === '/api/v1/platform-domains' && method === 'GET') {
    const domains = [
      { id: '849b380e-3603-4530-94d3-e028126e2a2c', code: 'LOGISTICS', name: 'Logistics & Supply Chain', description: 'Transportation, warehousing, and freight', is_active: true },
      { id: '123e4567-e89b-12d3-a456-426614174000', code: 'BANKING', name: 'Banking & Finance', description: 'Financial services and lending', is_active: true },
      { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', code: 'ECOMMERCE', name: 'E-Commerce', description: 'Online retail and order management', is_active: true },
      { id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', code: 'TELECOM', name: 'Telecommunications', description: 'Network services and connectivity', is_active: true },
      { id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', code: 'INSURANCE', name: 'Insurance', description: 'Risk management and coverage', is_active: true },
      { id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', code: 'CUSTOMS', name: 'Customs & Compliance', description: 'Regulatory compliance and border clearance', is_active: true },
      { id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', code: 'TRADING', name: 'Trading & Procurement', description: 'Sourcing and trade execution', is_active: true },
      { id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', code: 'REAL_ESTATE', name: 'Real Estate', description: 'Property management and sales', is_active: true },
      { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', code: 'AMRO', name: 'Aircraft Maintenance & Repair Operations', description: 'Aviation maintenance, repair, and overhaul management', is_active: true },
    ];

    sendJson(res, 200, {
      version: 'v1',
      correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
      data: domains,
      tenantDomainCount: domains.length,
    });
    return;
  }

  // Domain config - GET
  if (pathname === '/api/v1/domain-config' && method === 'GET') {
    sendJson(res, 200, {
      version: 'v1',
      correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
      data: [],
    });
    return;
  }

  // Domain config - PUT
  if (pathname === '/api/v1/domain-config' && method === 'PUT') {
    const body = await parseBody(req);
    const now = new Date().toISOString();
    const id = String(body.id || randomUUID());
    const record = {
      id,
      ...body,
      updated_at: now,
    };
    store.set(`domain-config:${id}`, record as any);

    sendJson(res, 200, {
      version: 'v1',
      correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
      data: record,
    });
    return;
  }

  sendJson(res, 404, {
    error: 'Route not found',
    code: 'NOT_FOUND',
    statusCode: 404,
  });
}
