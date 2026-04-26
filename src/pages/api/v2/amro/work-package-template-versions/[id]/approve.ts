/**
 * AMRO Work Package Template Version - Approve/Reject
 * 
 * DATABASE SCHEMA:
 * - Uses: amro_work_order_template_versions (existing, renamed)
 * - Transition: pending_review → approved (or active if first approved version)
 * - Transition: pending_review → draft (rejected)
 * - Sets: approved_by, approved_at OR rejection_reason
 * - Requires: Platform admin or template_manager role
 * 
 * ENDPOINT:
 * - POST /api/v2/amro/work-package-template-versions/[id]/approve
 * 
 * BODY:
 * - action: 'approve' | 'reject'
 * - rejection_reason?: string (required if action='reject')
 * - set_active?: boolean (optional, if true sets status to 'active')
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

    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const action = String(body.action || 'approve').trim();

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({
        error: "Invalid action. Must be 'approve' or 'reject'",
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const authUser = await authenticateRequest(req);
    ctx.userId = authUser.userId;
    
    // Require elevated permissions for approval
    enforceAnyPermission(authUser.permissions, ['templates.approve', 'admin.access']);
    
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

    // Can only approve/reject pending_review versions
    if (currentVersion.status !== 'pending_review') {
      res.status(400).json({
        error: `Cannot ${action} version in '${currentVersion.status}' status. Only pending_review versions can be reviewed.`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    if (action === 'reject') {
      const rejectionReason = body.rejection_reason ? String(body.rejection_reason).trim() : null;
      
      if (!rejectionReason) {
        res.status(400).json({
          error: 'Rejection reason is required',
          version: 'v2',
          correlationId: ctx.correlationId,
        });
        return;
      }

      // Reject - return to draft
      const { data: version, error: updateError } = await supabase
        .from('amro_work_order_template_versions')
        .update({
          status: 'draft',
          rejection_reason: rejectionReason,
          reviewed_by: authUser.userId,
          reviewed_at: new Date().toISOString(),
          updated_by: authUser.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', versionId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to reject template version: ${updateError.message}`);
      }

      res.status(200).json({
        version: 'v2',
        interface: 'reject-template-version',
        correlationId: ctx.correlationId,
        output: {
          ...version,
          message: 'Template version rejected and returned to draft',
        },
      });
      return;
    }

    // Approve - check if this is the first approved version
    const { data: approvedCount, error: countError } = await supabase
      .from('amro_work_order_template_versions')
      .select('id', { count: 'exact' })
      .eq('template_id', currentVersion.template_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'approved');

    if (countError) {
      throw new Error(`Failed to check approved versions: ${countError.message}`);
    }

    const isFirstApproval = (approvedCount?.length || 0) === 0;
    const setActive = body.set_active === true || isFirstApproval;
    const newStatus = setActive ? 'active' : 'approved';

    const { data: version, error: updateError } = await supabase
      .from('amro_work_order_template_versions')
      .update({
        status: newStatus,
        approved_by: authUser.userId,
        approved_at: new Date().toISOString(),
        reviewed_by: authUser.userId,
        reviewed_at: new Date().toISOString(),
        updated_by: authUser.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to approve template version: ${updateError.message}`);
    }

    res.status(200).json({
      version: 'v2',
      interface: 'approve-template-version',
      correlationId: ctx.correlationId,
      output: {
        ...version,
        message: `Template version ${newStatus === 'active' ? 'approved and activated' : 'approved'}`,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
