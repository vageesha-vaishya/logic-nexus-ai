// Phase 7 UIM Step 4b.9 — forms route scaffold.
//
// First slice of the forms surface carve. The legacy
// src/pages/api/v2/uim/forms/{[node]/index.ts,[node]/[id].ts}
// totals 1,151 LOC because it dispatches by node_key to per-table
// SELECTs (overview / item-master / stock-ledger / reservations /
// issue-consume / restock / locations / analytics) AND falls back
// to uim_form_records for unknown nodes.
//
// This first slice ships the form-storage fallback path only —
// generic CRUD against uim_form_records keyed by node_key. The per-
// node canonical mappers (the bulk of the legacy LOC) ship in
// follow-up slices because each one needs its own SELECT shape
// + PATCH translator.
//
// Routes:
//   GET    /api/v1/uim/forms/:node                       — list
//   POST   /api/v1/uim/forms/:node                       — create
//   GET    /api/v1/uim/forms/:node/:id                   — fetch
//   PATCH  /api/v1/uim/forms/:node/:id                   — update
//   DELETE /api/v1/uim/forms/:node/:id                   — soft-delete

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';
import {
  parseNodeKey,
  parsePayload,
  parsePositiveInt,
  tryHandleUimFormStorageError,
} from '../services/forms-shared.js';
import {
  buildDerivedNodeRecords,
  buildSchemaDrivenColumnCatalog,
  mapItemMasterPayloadToCatalog,
} from '../services/forms-canonical.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function bad(res: Response, message: string, status = 400, code = 'INVALID_REQUEST'): void {
  res.status(status).json({ error: message, code, statusCode: status } as ErrorResponse);
}

function nodeNotFound(res: Response): void {
  res.status(404).json({
    error: 'UIM form node not found',
    code: 'UIM_FORM_NODE_NOT_FOUND',
    statusCode: 404,
  } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

// ── GET /v1/uim/forms/:node — list ──────────────────────────────────
// Canonical-first: try buildDerivedNodeRecords for the 6 known
// node_keys with a real backing table (item-master, stock-ledger,
// issue-consume, restock, reservations, locations, analytics,
// overview). On any error from canonical, fall back to the generic
// uim_form_records form-storage path. This mirrors the legacy GET
// handler's behavior exactly.
router.get(
  '/v1/uim/forms/:node',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const nodeKey = parseNodeKey(req.params.node);
    if (!nodeKey) return nodeNotFound(res);

    const limit = Math.min(parsePositiveInt(req.query.limit, 25), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const supabase = getServiceRoleClient();
    const access = {
      tenantId: authReq.tenantId,
      franchiseId: authReq.franchiseId || null,
    };

    // Try canonical first.
    try {
      const canonical = await buildDerivedNodeRecords(supabase, access, nodeKey, limit, offset);
      const schemaDrivenCatalog = buildSchemaDrivenColumnCatalog(
        canonical.columnCatalog,
        canonical.records,
      );
      return res.json({
        node_key: nodeKey,
        source: canonical.source,
        records: canonical.records,
        column_catalog: schemaDrivenCatalog,
        pagination: { limit, offset, total: canonical.total },
      });
    } catch (canonicalErr) {
      logger.warn('uim.forms canonical read failed, falling back to form-storage', {
        node: nodeKey,
        error: String(canonicalErr),
      });
    }

    // Fallback: form-storage.
    try {
      let query = supabase
        .from('uim_form_records')
        .select('id, node_key, payload, metadata, created_at, updated_at', { count: 'exact' })
        .eq('tenant_id', authReq.tenantId)
        .eq('node_key', nodeKey)
        .is('deleted_at', null);
      if (authReq.franchiseId) query = query.eq('franchise_id', authReq.franchiseId);
      const { data, error, count } = await query
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) {
        if (tryHandleUimFormStorageError(res, error)) return;
        throw error;
      }
      return res.json({
        node_key: nodeKey,
        source: 'form-storage',
        records: data ?? [],
        pagination: { limit, offset, total: count ?? 0 },
      });
    } catch (err) {
      logger.error('uim.forms list error', { node: nodeKey, error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to list form records',
        code: 'UIM_FORMS_LIST_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

// ── POST /v1/uim/forms/:node — create ───────────────────────────────
// item-master writes go to uim_catalog_items via
// mapItemMasterPayloadToCatalog (matches legacy POST behavior — the
// item-master form is the only node with a real backing write
// target). All other nodes write to the generic uim_form_records
// table.
router.post(
  '/v1/uim/forms/:node',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const nodeKey = parseNodeKey(req.params.node);
    if (!nodeKey) return nodeNotFound(res);

    const payload = parsePayload(req.body);
    const recordPayload = (payload.payload && typeof payload.payload === 'object')
      ? payload.payload as Record<string, unknown>
      : payload;
    const metadata = (payload.metadata && typeof payload.metadata === 'object')
      ? payload.metadata as Record<string, unknown>
      : { source: 'uim-api.forms' };

    const supabase = getServiceRoleClient();

    if (nodeKey === 'item-master') {
      const catalogInsert = mapItemMasterPayloadToCatalog({
        payload: recordPayload,
        tenantId: authReq.tenantId,
        franchiseId: authReq.franchiseId || null,
        userId: authReq.userId,
      });
      if (!String(catalogInsert.sku || '').trim()) {
        return res.status(400).json({
          error: 'SKU is required for item-master',
          code: 'UIM_ITEM_MASTER_SKU_REQUIRED',
          statusCode: 400,
        } as ErrorResponse);
      }
      try {
        const { data, error } = await supabase
          .from('uim_catalog_items')
          .insert(catalogInsert)
          .select('id, sku, part_number, title, category, unit_of_measure, attributes, updated_at')
          .limit(1)
          .maybeSingle();
        if (error) throw new Error(`Failed to create UIM item-master record: ${error.message}`);
        return res.status(201).json({
          interface: 'uim-item-master-create',
          id: String(data?.id || ''),
          record: data || {},
          message: 'UIM item-master record created successfully',
        });
      } catch (err) {
        logger.error('uim.forms item-master create error', { error: String(err) });
        return res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to create item-master record',
          code: 'UIM_ITEM_MASTER_CREATE_ERROR',
          statusCode: 500,
        } as ErrorResponse);
      }
    }

    try {
      const { data, error } = await supabase
        .from('uim_form_records')
        .insert({
          tenant_id: authReq.tenantId,
          franchise_id: authReq.franchiseId ?? null,
          node_key: nodeKey,
          payload: recordPayload,
          metadata,
          created_by: authReq.userId,
          updated_by: authReq.userId,
        })
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) {
        if (tryHandleUimFormStorageError(res, error)) return;
        throw error;
      }
      return res.status(201).json({ record: data });
    } catch (err) {
      logger.error('uim.forms create error', { node: nodeKey, error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to create form record',
        code: 'UIM_FORMS_CREATE_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

// ── GET /v1/uim/forms/:node/:id — fetch ─────────────────────────────
router.get(
  '/v1/uim/forms/:node/:id',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const nodeKey = parseNodeKey(req.params.node);
    if (!nodeKey) return nodeNotFound(res);
    const id = String(req.params.id || '').trim();
    if (!UUID_RE.test(id)) return bad(res, 'id (uuid) required in path');

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await supabase
        .from('uim_form_records')
        .select('*')
        .eq('tenant_id', authReq.tenantId)
        .eq('node_key', nodeKey)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) {
        if (tryHandleUimFormStorageError(res, error)) return;
        throw error;
      }
      if (!data) {
        return res.status(404).json({
          error: 'Form record not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        } as ErrorResponse);
      }
      return res.json(data);
    } catch (err) {
      logger.error('uim.forms fetch error', { node: nodeKey, id, error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch form record',
        code: 'UIM_FORMS_FETCH_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

// ── PATCH /v1/uim/forms/:node/:id — update ──────────────────────────
router.patch(
  '/v1/uim/forms/:node/:id',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const nodeKey = parseNodeKey(req.params.node);
    if (!nodeKey) return nodeNotFound(res);
    const id = String(req.params.id || '').trim();
    if (!UUID_RE.test(id)) return bad(res, 'id (uuid) required in path');

    const body = parsePayload(req.body);
    const update: Record<string, unknown> = {
      updated_by: authReq.userId,
      updated_at: new Date().toISOString(),
    };
    if (body.payload && typeof body.payload === 'object') {
      update.payload = body.payload as Record<string, unknown>;
    }
    if (body.metadata && typeof body.metadata === 'object') {
      update.metadata = body.metadata as Record<string, unknown>;
    }
    if (Object.keys(update).length <= 2) {
      // Only updated_by + updated_at set — nothing real to PATCH.
      return bad(res, 'payload and/or metadata required for PATCH');
    }

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await supabase
        .from('uim_form_records')
        .update(update)
        .eq('tenant_id', authReq.tenantId)
        .eq('node_key', nodeKey)
        .eq('id', id)
        .is('deleted_at', null)
        .select('*')
        .maybeSingle();
      if (error) {
        if (tryHandleUimFormStorageError(res, error)) return;
        throw error;
      }
      if (!data) {
        return res.status(404).json({
          error: 'Form record not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        } as ErrorResponse);
      }
      return res.json(data);
    } catch (err) {
      logger.error('uim.forms patch error', { node: nodeKey, id, error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to update form record',
        code: 'UIM_FORMS_PATCH_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

// ── DELETE /v1/uim/forms/:node/:id — soft-delete ────────────────────
router.delete(
  '/v1/uim/forms/:node/:id',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const nodeKey = parseNodeKey(req.params.node);
    if (!nodeKey) return nodeNotFound(res);
    const id = String(req.params.id || '').trim();
    if (!UUID_RE.test(id)) return bad(res, 'id (uuid) required in path');

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await supabase
        .from('uim_form_records')
        .update({
          deleted_at: new Date().toISOString(),
          updated_by: authReq.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', authReq.tenantId)
        .eq('node_key', nodeKey)
        .eq('id', id)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();
      if (error) {
        if (tryHandleUimFormStorageError(res, error)) return;
        throw error;
      }
      if (!data) {
        return res.status(404).json({
          error: 'Form record not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        } as ErrorResponse);
      }
      return res.status(204).end();
    } catch (err) {
      logger.error('uim.forms delete error', { node: nodeKey, id, error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to delete form record',
        code: 'UIM_FORMS_DELETE_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
