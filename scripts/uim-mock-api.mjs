import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 3000);

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

const store = new Map();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Tenant-Id,X-Franchise-Id,X-User-Id,X-Correlation-Id');
}

function getHeader(req, key) {
  const value = req.headers[key.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function resolveTenant(req) {
  const tenantId = String(getHeader(req, 'x-tenant-id') || 'dev-tenant');
  const franchiseId = String(getHeader(req, 'x-franchise-id') || '').trim() || null;
  return { tenantId, franchiseId };
}

function sendJson(res, status, payload) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  const chunks = [];
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

const server = createServer(async (req, res) => {
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
    sendJson(res, 200, { status: 'ok', service: 'uim-api', mode: 'dev-mock', timestamp: new Date().toISOString() });
    return;
  }
  if (method === 'GET' && pathname === '/api/v2/uim/health') {
    sendJson(res, 200, { status: 'ok', interface: 'uim-api', mode: 'dev-mock', timestamp: new Date().toISOString() });
    return;
  }

  const listMatch = pathname.match(/^\/api\/v2\/uim\/forms\/([^/]+)$/);
  const recordMatch = pathname.match(/^\/api\/v2\/uim\/forms\/([^/]+)\/([^/]+)$/);

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
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-form-records-list',
      correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
      output: { node_key: node, count: records.length, limit, offset, records: records.slice(offset, offset + limit) },
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
    const body = await parseBody(req);
    const now = new Date().toISOString();
    const id = randomUUID();
    const record = {
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
    sendJson(res, 201, { version: 'v2', interface: 'uim-form-record-create', id, output: record, message: 'UIM form record created successfully' });
    return;
  }

  if (recordMatch && method === 'GET') {
    const [_, node, id] = recordMatch;
    const existing = store.get(id);
    if (!existing || existing.deleted_at !== null || existing.node_key !== node) {
      sendJson(res, 404, { error: 'UIM form record not found', code: 'UIM_FORM_RECORD_NOT_FOUND', version: 'v2' });
      return;
    }
    sendJson(res, 200, { version: 'v2', interface: 'uim-form-record-read', output: existing });
    return;
  }

  if (recordMatch && method === 'PATCH') {
    const [_, node, id] = recordMatch;
    const existing = store.get(id);
    if (!existing || existing.deleted_at !== null || existing.node_key !== node) {
      sendJson(res, 404, { error: 'UIM form record not found', code: 'UIM_FORM_RECORD_NOT_FOUND', version: 'v2' });
      return;
    }
    const body = await parseBody(req);
    const updated = { ...existing, payload: body, updated_at: new Date().toISOString() };
    store.set(id, updated);
    sendJson(res, 200, { version: 'v2', interface: 'uim-form-record-update', id, output: updated, message: 'UIM form record updated successfully' });
    return;
  }

  if (recordMatch && method === 'DELETE') {
    const [_, node, id] = recordMatch;
    const existing = store.get(id);
    if (!existing || existing.deleted_at !== null || existing.node_key !== node) {
      sendJson(res, 404, { error: 'UIM form record not found', code: 'UIM_FORM_RECORD_NOT_FOUND', version: 'v2' });
      return;
    }
    const deleted = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    store.set(id, deleted);
    sendJson(res, 200, { version: 'v2', interface: 'uim-form-record-delete', id, message: 'UIM form record deleted successfully' });
    return;
  }

  sendJson(res, 404, { error: 'Route not found', code: 'NOT_FOUND', statusCode: 404 });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[uim-mock-api] listening on port ${PORT}`);
});
