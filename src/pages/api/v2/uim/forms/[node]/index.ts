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
import { parseNodeKey, parsePayload, parsePositiveInt, resolveUimFormAccess, tryHandleUimFormStorageError } from '../_shared';

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
      const tenantScopedBase = supabase
        .from('uim_form_records')
        .select('id, tenant_id, franchise_id, node_key, payload, metadata, created_at, updated_at', { count: 'exact' })
        .eq('tenant_id', access.tenantId)
        .eq('node_key', nodeKey)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(offset, end);

      let data: Array<Record<string, unknown>> | null = null;
      let count: number | null = null;

      if (access.franchiseId) {
        const franchiseScoped = await supabase
          .from('uim_form_records')
          .select('id, tenant_id, franchise_id, node_key, payload, metadata, created_at, updated_at', { count: 'exact' })
          .eq('tenant_id', access.tenantId)
          .eq('franchise_id', access.franchiseId)
          .eq('node_key', nodeKey)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .range(offset, end);
        if (franchiseScoped.error) throw new Error(`Failed to load franchise-scoped UIM form records: ${franchiseScoped.error.message}`);
        data = franchiseScoped.data as Array<Record<string, unknown>> | null;
        count = Number(franchiseScoped.count || 0);
      }

      // Fallback: if franchise scope is empty, return tenant-level records.
      if (!access.franchiseId || (count || 0) === 0) {
        const tenantScoped = await tenantScopedBase;
        if (tenantScoped.error) throw new Error(`Failed to load tenant-scoped UIM form records: ${tenantScoped.error.message}`);
        data = tenantScoped.data as Array<Record<string, unknown>> | null;
        count = Number(tenantScoped.count || 0);
      }

      res.status(200).json({
        version: 'v2',
        interface: 'uim-form-records-list',
        correlationId: ctx.correlationId,
        output: {
          node_key: nodeKey,
          count: Number(count || 0),
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
    if (tryHandleUimFormStorageError(res, error, ctx.correlationId)) return;
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
