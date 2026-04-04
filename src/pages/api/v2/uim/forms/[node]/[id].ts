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
import { parseNodeKey, parsePayload, resolveUimFormAccess } from '../_shared';

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
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
