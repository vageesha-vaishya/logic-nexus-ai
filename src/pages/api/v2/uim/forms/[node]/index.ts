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
import { parseNodeKey, parsePayload, parsePositiveInt, resolveUimFormAccess } from '../_shared';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (!['GET', 'POST'].includes(String(req.method))) {
      res.setHeader('Allow', ['GET', 'POST']);
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

    enforceHttps(req);
    enforceRateLimit(req);
    const access = await resolveUimFormAccess(req, ctx);
    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      const limit = parsePositiveInt(req.query.limit, 25);
      const offset = parsePositiveInt(req.query.offset, 0);
      const end = offset + Math.min(limit, 100) - 1;
      let query = supabase
        .from('uim_form_records')
        .select('id, tenant_id, franchise_id, node_key, payload, metadata, created_at, updated_at', { count: 'exact' })
        .eq('tenant_id', access.tenantId)
        .eq('node_key', nodeKey)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(offset, end);
      if (access.franchiseId) query = query.eq('franchise_id', access.franchiseId);
      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to load UIM form records: ${error.message}`);
      res.status(200).json({
        version: 'v2',
        interface: 'uim-form-records-list',
        correlationId: ctx.correlationId,
        output: {
          node_key: nodeKey,
          count: count || 0,
          limit: Math.min(limit, 100),
          offset,
          records: data || [],
        },
      });
      return;
    }

    const payload = parsePayload(req.body);
    const insertRow = {
      tenant_id: access.tenantId,
      franchise_id: access.franchiseId || null,
      node_key: nodeKey,
      payload,
      metadata: {
        mode: 'form-crud',
        source: 'api_v2_uim_forms_node_index',
      },
      created_by: access.userId,
      updated_by: access.userId,
    };
    const { data, error } = await supabase
      .from('uim_form_records')
      .insert(insertRow)
      .select('id, node_key, payload, created_at, updated_at')
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to create UIM form record: ${error.message}`);

    res.status(201).json({
      version: 'v2',
      interface: 'uim-form-record-create',
      correlationId: ctx.correlationId,
      id: String(data?.id || ''),
      output: data || {},
      message: 'UIM form record created successfully',
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
