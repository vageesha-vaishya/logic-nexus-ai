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
const catalog = new Map();
const inventoryItems = new Map();
const reservations = new Map();
const ledger = [];
const commands = new Map();
const projectionSnapshots = new Map();

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

function readNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const commandMatch = pathname.match(/^\/api\/v2\/uim\/commands$/);
  const replayMatch = pathname.match(/^\/api\/v2\/uim\/projections\/replay$/);
  const projectionItemsMatch = pathname.match(/^\/api\/v2\/uim\/projections\/items$/);

  if (commandMatch && method === 'POST') {
    const body = await parseBody(req);
    const commandType = String(body.command_type || '').toUpperCase();
    const payload = body.command_payload && typeof body.command_payload === 'object' ? body.command_payload : {};
    const idempotencyKey = String(body.idempotency_key || '').trim();
    if (!['RECEIVE', 'MOVE', 'RESERVE', 'CONSUME'].includes(commandType)) {
      sendJson(res, 422, { error: 'Unsupported command_type', code: 'INVALID_COMMAND' });
      return;
    }
    if (idempotencyKey && commands.has(idempotencyKey)) {
      sendJson(res, 200, {
        version: 'v2',
        interface: 'uim-command-handler',
        output: {
          replayed: true,
          command: commands.get(idempotencyKey),
        },
      });
      return;
    }

    const commandId = randomUUID();
    const commandRecord = {
      id: commandId,
      command_type: commandType,
      command_payload: payload,
      command_status: 'applied',
      applied_at: new Date().toISOString(),
    };
    if (idempotencyKey) commands.set(idempotencyKey, commandRecord);

    let appliedOutput = {};
    if (commandType === 'RECEIVE') {
      const catalogId = String(payload.catalog_item_id || '').trim() || randomUUID();
      if (!catalog.has(catalogId)) {
        catalog.set(catalogId, {
          id: catalogId,
          sku: String(payload.sku || `SKU-${Date.now().toString(36)}`),
          title: String(payload.title || payload.item_name || 'UIM Item'),
        });
      }
      const itemId = randomUUID();
      const quantity = Math.max(0, readNumber(payload.quantity));
      inventoryItems.set(itemId, {
        id: itemId,
        catalog_item_id: catalogId,
        quantity,
        status: 'available',
      });
      ledger.push({
        id: randomUUID(),
        inventory_item_id: itemId,
        transaction_type: 'RECEIVE',
        quantity_changed: quantity,
        created_at: new Date().toISOString(),
      });
      appliedOutput = { inventory_item_id: itemId, quantity };
    } else if (commandType === 'MOVE') {
      const itemId = String(payload.inventory_item_id || '').trim();
      const existing = inventoryItems.get(itemId);
      if (!existing) {
        sendJson(res, 404, { error: 'Inventory item not found', code: 'INVENTORY_ITEM_NOT_FOUND' });
        return;
      }
      const moved = {
        ...existing,
        location_id: payload.to_location_id || null,
      };
      inventoryItems.set(itemId, moved);
      ledger.push({
        id: randomUUID(),
        inventory_item_id: itemId,
        transaction_type: 'MOVE',
        quantity_changed: 0,
        created_at: new Date().toISOString(),
      });
      appliedOutput = { inventory_item_id: itemId, to_location_id: moved.location_id };
    } else if (commandType === 'RESERVE') {
      const itemId = String(payload.inventory_item_id || '').trim();
      const item = inventoryItems.get(itemId);
      if (!item) {
        sendJson(res, 404, { error: 'Inventory item not found', code: 'INVENTORY_ITEM_NOT_FOUND' });
        return;
      }
      const quantity = Math.max(0, readNumber(payload.quantity));
      if (item.quantity < quantity) {
        sendJson(res, 409, { error: 'Insufficient quantity', code: 'UIM_INSUFFICIENT_AVAILABLE_QUANTITY' });
        return;
      }
      const reservationId = randomUUID();
      reservations.set(reservationId, {
        id: reservationId,
        inventory_item_id: itemId,
        catalog_item_id: payload.catalog_item_id || item.catalog_item_id || null,
        reserved_quantity: quantity,
        reservation_status: 'active',
        reservation_token: String(payload.reservation_token || `uim-resv-${Date.now().toString(36)}`),
      });
      ledger.push({
        id: randomUUID(),
        inventory_item_id: itemId,
        transaction_type: 'RESERVE',
        quantity_changed: quantity,
        reservation_id: reservationId,
        created_at: new Date().toISOString(),
      });
      appliedOutput = { reservation_id: reservationId, reserved_quantity: quantity };
    } else if (commandType === 'CONSUME') {
      const itemId = String(payload.inventory_item_id || '').trim();
      const item = inventoryItems.get(itemId);
      if (!item) {
        sendJson(res, 404, { error: 'Inventory item not found', code: 'INVENTORY_ITEM_NOT_FOUND' });
        return;
      }
      const quantity = Math.max(0, readNumber(payload.quantity));
      if (item.quantity < quantity) {
        sendJson(res, 409, { error: 'Insufficient quantity', code: 'UIM_INSUFFICIENT_AVAILABLE_QUANTITY' });
        return;
      }
      const remaining = Number((item.quantity - quantity).toFixed(4));
      const updated = { ...item, quantity: remaining, status: remaining <= 0 ? 'consumed' : 'available' };
      inventoryItems.set(itemId, updated);
      const reservationId = String(payload.reservation_id || '').trim() || null;
      if (reservationId && reservations.has(reservationId)) {
        reservations.set(reservationId, {
          ...reservations.get(reservationId),
          reservation_status: 'fulfilled',
        });
      }
      ledger.push({
        id: randomUUID(),
        inventory_item_id: itemId,
        transaction_type: 'CONSUME',
        quantity_changed: quantity,
        reservation_id: reservationId,
        created_at: new Date().toISOString(),
      });
      appliedOutput = { inventory_item_id: itemId, remaining_quantity: remaining };
    }

    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-command-handler',
      output: {
        command_id: commandId,
        command_type: commandType,
        command_status: 'applied',
        applied_output: appliedOutput,
      },
    });
    return;
  }

  if (replayMatch && method === 'POST') {
    projectionSnapshots.clear();
    for (const event of ledger) {
      const itemId = String(event.inventory_item_id || '');
      if (!itemId) continue;
      const current = projectionSnapshots.get(itemId) || {
        id: randomUUID(),
        inventory_item_id: itemId,
        projected_available_quantity: 0,
        projected_reserved_quantity: 0,
        projected_consumed_quantity: 0,
        last_ledger_id: null,
        last_ledger_at: null,
        replay_version: Date.now(),
        updated_at: new Date().toISOString(),
      };
      const quantity = readNumber(event.quantity_changed);
      if (event.transaction_type === 'RECEIVE' || event.transaction_type === 'ADJUST' || event.transaction_type === 'RETURN') {
        current.projected_available_quantity += quantity;
      } else if (event.transaction_type === 'RESERVE') {
        current.projected_available_quantity -= quantity;
        current.projected_reserved_quantity += quantity;
      } else if (event.transaction_type === 'RELEASE') {
        current.projected_available_quantity += quantity;
        current.projected_reserved_quantity -= quantity;
      } else if (event.transaction_type === 'CONSUME') {
        current.projected_reserved_quantity = Math.max(0, current.projected_reserved_quantity - quantity);
        current.projected_consumed_quantity += quantity;
      } else if (event.transaction_type === 'SCRAP') {
        current.projected_available_quantity -= quantity;
      }
      current.last_ledger_id = event.id;
      current.last_ledger_at = event.created_at;
      current.updated_at = new Date().toISOString();
      projectionSnapshots.set(itemId, current);
    }
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-projection-replay',
      output: {
        replayed_events: ledger.length,
        updated_snapshots: projectionSnapshots.size,
      },
    });
    return;
  }

  if (projectionItemsMatch && method === 'GET') {
    const limit = Math.min(Math.max(Number.parseInt(String(url.searchParams.get('limit') || '50'), 10) || 50, 1), 500);
    const offset = Math.max(Number.parseInt(String(url.searchParams.get('offset') || '0'), 10) || 0, 0);
    const snapshots = [...projectionSnapshots.values()];
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-projection-items-query',
      output: {
        pagination: {
          limit,
          offset,
          total: snapshots.length,
        },
        snapshots: snapshots.slice(offset, offset + limit),
      },
    });
    return;
  }

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
