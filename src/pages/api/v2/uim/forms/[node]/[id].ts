import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import { parseNodeKey, parsePayload, resolveUimFormAccess, tryHandleUimFormStorageError } from '../_shared';

function toItemMasterPayload(row: Record<string, unknown>): Record<string, unknown> {
  const attributes = (row.attributes || {}) as Record<string, unknown>;
  return {
    item_name: row.title || '',
    sku: row.sku || '',
    part_number: row.part_number || '',
    category: row.category || '',
    uom: row.unit_of_measure || 'EA',
    maintenance_category: attributes.maintenance_category || '',
    ata_chapter_code: attributes.ata_chapter_code || '',
    sku_is_unique: Boolean(attributes.sku_is_unique),
    status: 'active',
  };
}

function isMissingDeletedAtColumnError(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message || error || '').toLowerCase();
  return message.includes('deleted_at') && message.includes('does not exist');
}

function mapItemMasterPatchPayload(payload: Record<string, unknown>, userId: string): Record<string, unknown> {
  const sku = String(payload.sku || '').trim();
  const itemName = String(payload.item_name || '').trim();
  const partNumber = String(payload.part_number || '').trim() || sku;
  const category = String(payload.category || '').trim() || 'UNCLASSIFIED';
  const uom = String(payload.uom || '').trim() || 'EA';
  return {
    sku,
    part_number: partNumber,
    title: itemName || sku,
    category,
    unit_of_measure: uom,
    attributes: {
      maintenance_category: payload.maintenance_category || '',
      ata_chapter_code: payload.ata_chapter_code || '',
      sku_is_unique: Boolean(payload.sku_is_unique),
      source_node: 'item-master-form',
    },
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (!['GET', 'PATCH', 'DELETE'].includes(String(req.method))) {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    const nodeKey = parseNodeKey(req.query.node);
    if (!nodeKey) {
      res.status(404).json({
        error: 'UIM form node not found',
        code: 'UIM_FORM_NODE_NOT_FOUND',
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }
    const recordId = String(req.query.id || '').trim();
    if (!recordId) {
      res.status(400).json({
        error: 'Record id is required',
        code: 'UIM_FORM_RECORD_ID_REQUIRED',
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const access = await resolveUimFormAccess(req, ctx);
    const supabase = getSupabaseAdminClient();

    if (nodeKey === 'item-master') {
      let catalogRecord: Record<string, unknown> | null = null;
      {
        const withDeletedAt = await supabase
          .from('uim_catalog_items')
          .select('id, tenant_id, franchise_id, sku, part_number, title, category, unit_of_measure, attributes, created_at, updated_at')
          .eq('tenant_id', access.tenantId)
          .eq('id', recordId)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();
        if (withDeletedAt.error && isMissingDeletedAtColumnError(withDeletedAt.error)) {
          const withoutDeletedAt = await supabase
            .from('uim_catalog_items')
            .select('id, tenant_id, franchise_id, sku, part_number, title, category, unit_of_measure, attributes, created_at, updated_at')
            .eq('tenant_id', access.tenantId)
            .eq('id', recordId)
            .limit(1)
            .maybeSingle();
          if (withoutDeletedAt.error) throw new Error(`Failed to load UIM item-master record: ${withoutDeletedAt.error.message}`);
          catalogRecord = (withoutDeletedAt.data || null) as Record<string, unknown> | null;
        } else if (withDeletedAt.error) {
          throw new Error(`Failed to load UIM item-master record: ${withDeletedAt.error.message}`);
        } else {
          catalogRecord = (withDeletedAt.data || null) as Record<string, unknown> | null;
        }
      }
      if (!catalogRecord) {
        let inventoryFallback: Record<string, unknown> | null = null;
        {
          const withDeletedAt = await supabase
            .from('uim_inventory_items')
            .select('id, tenant_id, franchise_id, metadata, status, created_at, updated_at')
            .eq('tenant_id', access.tenantId)
            .eq('id', recordId)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();
          if (withDeletedAt.error && isMissingDeletedAtColumnError(withDeletedAt.error)) {
            const withoutDeletedAt = await supabase
              .from('uim_inventory_items')
              .select('id, tenant_id, franchise_id, metadata, status, created_at, updated_at')
              .eq('tenant_id', access.tenantId)
              .eq('id', recordId)
              .limit(1)
              .maybeSingle();
            if (withoutDeletedAt.error) throw new Error(`Failed to load fallback item-master record: ${withoutDeletedAt.error.message}`);
            inventoryFallback = (withoutDeletedAt.data || null) as Record<string, unknown> | null;
          } else if (withDeletedAt.error) {
            throw new Error(`Failed to load fallback item-master record: ${withDeletedAt.error.message}`);
          } else {
            inventoryFallback = (withDeletedAt.data || null) as Record<string, unknown> | null;
          }
        }
        if (!inventoryFallback) {
          res.status(404).json({
            error: 'UIM item-master record not found',
            code: 'UIM_ITEM_MASTER_RECORD_NOT_FOUND',
            version: 'v2',
            correlationId: ctx.correlationId,
          });
          return;
        }
        if (req.method !== 'GET') {
          res.status(409).json({
            error: 'Item-master fallback record is read-only. Create catalog mapping to enable updates.',
            code: 'UIM_ITEM_MASTER_FALLBACK_READ_ONLY',
            version: 'v2',
            correlationId: ctx.correlationId,
          });
          return;
        }
        const metadata = (inventoryFallback.metadata || {}) as Record<string, unknown>;
        res.status(200).json({
          version: 'v2',
          interface: 'uim-item-master-read',
          correlationId: ctx.correlationId,
          output: {
            id: inventoryFallback.id,
            tenant_id: inventoryFallback.tenant_id,
            franchise_id: inventoryFallback.franchise_id,
            node_key: nodeKey,
            payload: {
              item_name: String(metadata.item_name || metadata.title || metadata.part_number || inventoryFallback.id),
              sku: String(metadata.sku || metadata.part_number || inventoryFallback.id),
              part_number: String(metadata.part_number || ''),
              category: String(metadata.category || metadata.item_category || 'UNCLASSIFIED'),
              uom: String(metadata.uom || 'EA'),
              maintenance_category: String(metadata.maintenance_category || ''),
              ata_chapter_code: String(metadata.ata_chapter_code || ''),
              sku_is_unique: Boolean(metadata.sku_is_unique),
              status: String(inventoryFallback.status || 'active'),
            },
            metadata: { mode: 'canonical-fallback', source: 'uim_inventory_items' },
            created_at: inventoryFallback.created_at,
            updated_at: inventoryFallback.updated_at,
          },
        });
        return;
      }

      if (req.method === 'GET') {
        res.status(200).json({
          version: 'v2',
          interface: 'uim-item-master-read',
          correlationId: ctx.correlationId,
          output: {
            id: catalogRecord.id,
            tenant_id: catalogRecord.tenant_id,
            franchise_id: catalogRecord.franchise_id,
            node_key: nodeKey,
            payload: toItemMasterPayload(catalogRecord as Record<string, unknown>),
            metadata: { mode: 'canonical', source: 'uim_catalog_items' },
            created_at: catalogRecord.created_at,
            updated_at: catalogRecord.updated_at,
          },
        });
        return;
      }

      if (req.method === 'PATCH') {
        const payload = parsePayload(req.body);
        const patch = mapItemMasterPatchPayload(payload, access.userId);
        if (!String(patch.sku || '').trim()) {
          res.status(400).json({
            error: 'SKU is required for item-master',
            code: 'UIM_ITEM_MASTER_SKU_REQUIRED',
            version: 'v2',
            correlationId: ctx.correlationId,
          });
          return;
        }
        const { data, error } = await supabase
          .from('uim_catalog_items')
          .update(patch)
          .eq('tenant_id', access.tenantId)
          .eq('id', recordId)
          .select('id, sku, part_number, title, category, unit_of_measure, attributes, updated_at')
          .limit(1)
          .maybeSingle();
        if (error) throw new Error(`Failed to update UIM item-master record: ${error.message}`);
        res.status(200).json({
          version: 'v2',
          interface: 'uim-item-master-update',
          correlationId: ctx.correlationId,
          id: String(data?.id || recordId),
          output: data || {},
          message: 'UIM item-master record updated successfully',
        });
        return;
      }

      const { error: deleteError } = await supabase
        .from('uim_catalog_items')
        .update({
          deleted_at: new Date().toISOString(),
          updated_by: access.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', access.tenantId)
        .eq('id', recordId);
      if (deleteError) throw new Error(`Failed to delete UIM item-master record: ${deleteError.message}`);
      res.status(200).json({
        version: 'v2',
        interface: 'uim-item-master-delete',
        correlationId: ctx.correlationId,
        id: recordId,
        message: 'UIM item-master record deleted successfully',
      });
      return;
    }

    let scopedQuery = supabase
      .from('uim_form_records')
      .select('id, tenant_id, franchise_id, node_key, payload, metadata, created_at, updated_at')
      .eq('tenant_id', access.tenantId)
      .eq('node_key', nodeKey)
      .eq('id', recordId)
      .is('deleted_at', null);
    if (access.franchiseId) scopedQuery = scopedQuery.eq('franchise_id', access.franchiseId);
    const { data: existing, error: existingError } = await scopedQuery.limit(1).maybeSingle();
    if (existingError) throw new Error(`Failed to load UIM form record: ${existingError.message}`);
    if (!existing) {
      res.status(404).json({
        error: 'UIM form record not found',
        code: 'UIM_FORM_RECORD_NOT_FOUND',
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    if (req.method === 'GET') {
      res.status(200).json({
        version: 'v2',
        interface: 'uim-form-record-read',
        correlationId: ctx.correlationId,
        output: existing,
      });
      return;
    }

    if (req.method === 'PATCH') {
      const payload = parsePayload(req.body);
      const { data, error } = await supabase
        .from('uim_form_records')
        .update({
          payload,
          updated_by: access.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', access.tenantId)
        .eq('node_key', nodeKey)
        .eq('id', recordId)
        .select('id, node_key, payload, metadata, created_at, updated_at')
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Failed to update UIM form record: ${error.message}`);
      res.status(200).json({
        version: 'v2',
        interface: 'uim-form-record-update',
        correlationId: ctx.correlationId,
        id: String(data?.id || recordId),
        output: data || {},
        message: 'UIM form record updated successfully',
      });
      return;
    }

    const { error: deleteError } = await supabase
      .from('uim_form_records')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: access.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', access.tenantId)
      .eq('node_key', nodeKey)
      .eq('id', recordId);
    if (deleteError) throw new Error(`Failed to delete UIM form record: ${deleteError.message}`);

    res.status(200).json({
      version: 'v2',
      interface: 'uim-form-record-delete',
      correlationId: ctx.correlationId,
      id: recordId,
      message: 'UIM form record deleted successfully',
    });
  } catch (error) {
    if (tryHandleUimFormStorageError(res, error, ctx.correlationId)) return;
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
