/**
 * AMRO Work Package Template Version - Submit for Review
 * 
 * DATABASE SCHEMA:
 * - Uses: amro_work_order_template_versions (existing, renamed)
 * - Transition: draft → pending_review
 * - Sets: submitted_by, submitted_at
 * 
 * ENDPOINT:
 * - POST /api/v2/amro/work-package-template-versions/[id]/submit
 */

import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const versionId = String(req.query.id || '').trim();

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (!versionId) {
      res.status(400).json({ error: 'Version ID is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const authUser = await authenticateRequest(req);
    ctx.userId = authUser.userId;
    enforceAnyPermission(authUser.permissions, ['dashboards.view']);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const tenantId = String(scopedAccess.tenantId || '');

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch current version
    const { data: currentVersion, error: fetchError } = await supabase
      .from('amro_work_order_template_versions')
      .select('id, status, version_number, template_id')
      .eq('id', versionId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        res.status(404).json({ error: 'Template version not found', version: 'v2', correlationId: ctx.correlationId });
      } else {
        throw new Error(`Failed to fetch template version: ${fetchError.message}`);
      }
      return;
    }

    // Can only submit draft versions
    if (currentVersion.status !== 'draft') {
      res.status(400).json({
        error: `Cannot submit version in '${currentVersion.status}' status. Only draft versions can be submitted.`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    // Submit for review
    const { data: version, error: updateError } = await supabase
      .from('amro_work_order_template_versions')
      .update({
        status: 'pending_review',
        submitted_by: authUser.userId,
        submitted_at: new Date().toISOString(),
        updated_by: authUser.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to submit template version: ${updateError.message}`);
    }

    res.status(200).json({
      version: 'v2',
      interface: 'submit-template-version',
      correlationId: ctx.correlationId,
      output: {
        ...version,
        message: 'Template version submitted for review',
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
