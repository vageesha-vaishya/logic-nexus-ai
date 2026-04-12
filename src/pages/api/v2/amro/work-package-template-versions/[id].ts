/**
 * AMRO Work Package Template Version - Individual Resource API
 * 
 * DATABASE SCHEMA:
 * - Uses: amro_work_package_template_versions (existing)
 * - Workflow: draft → pending_review → approved → active → deprecated
 * - Only draft versions can be updated/deleted
 * - Approval requires platform admin or template_manager role
 * 
 * ENDPOINTS:
 * - GET    /api/v2/amro/work-package-template-versions/[id]
 * - PUT    /api/v2/amro/work-package-template-versions/[id] (only if status=draft)
 * - DELETE /api/v2/amro/work-package-template-versions/[id] (only if status=draft)
 */

import type { ApiRequest, ApiResponse } from '../../../../../_utils/types';
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
} from '../../../../../_utils/http';
import { sendErrorResponse } from '../../../../../_utils/errorHandler';
import { createClient } from '@supabase/supabase-js';

const VALID_STATUSES = ['draft', 'pending_review', 'approved', 'active', 'deprecated', 'archived'];
const EDITABLE_STATUSES = ['draft'];

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const versionId = String(req.query.id || '').trim();

  try {
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

    // ── GET: single version details ─────────────────────────────────────────
    if (req.method === 'GET') {
      const { data: version, error } = await supabase
        .from('amro_work_package_template_versions')
        .select('*')
        .eq('id', versionId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          res.status(404).json({ error: 'Template version not found', version: 'v2', correlationId: ctx.correlationId });
        } else {
          throw new Error(`Failed to fetch template version: ${error.message}`);
        }
        return;
      }

      res.status(200).json({
        version: 'v2',
        interface: 'get-template-version',
        correlationId: ctx.correlationId,
        output: version,
      });
      return;
    }

    // ── PUT: update version (only draft) ────────────────────────────────────
    if (req.method === 'PUT') {
      const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};

      // Fetch current version
      const { data: currentVersion, error: fetchError } = await supabase
        .from('amro_work_package_template_versions')
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

      // Only draft versions can be updated
      if (!EDITABLE_STATUSES.includes(currentVersion.status)) {
        res.status(403).json({
          error: `Cannot update version in '${currentVersion.status}' status. Only draft versions can be modified.`,
          version: 'v2',
          correlationId: ctx.correlationId,
        });
        return;
      }

      const updateData: Record<string, unknown> = {
        updated_by: authUser.userId,
        updated_at: new Date().toISOString(),
      };

      // Allow updating these fields
      const updatableFields = [
        'version_label', 'change_description', 'change_reason',
        'scope_json', 'tasks_json', 'materials_json', 'tooling_json',
        'compliance_requirements_json', 'effective_from', 'effective_until',
        'aircraft_models', 'engine_models',
      ];

      for (const field of updatableFields) {
        if (field in body) {
          updateData[field] = body[field];
        }
      }

      const { data: version, error: updateError } = await supabase
        .from('amro_work_package_template_versions')
        .update(updateData)
        .eq('id', versionId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update template version: ${updateError.message}`);
      }

      res.status(200).json({
        version: 'v2',
        interface: 'update-template-version',
        correlationId: ctx.correlationId,
        output: version,
      });
      return;
    }

    // ── DELETE: remove version (only draft) ─────────────────────────────────
    if (req.method === 'DELETE') {
      // Fetch current version
      const { data: currentVersion, error: fetchError } = await supabase
        .from('amro_work_package_template_versions')
        .select('status')
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

      // Only draft versions can be deleted
      if (!EDITABLE_STATUSES.includes(currentVersion.status)) {
        res.status(403).json({
          error: `Cannot delete version in '${currentVersion.status}' status. Only draft versions can be deleted.`,
          version: 'v2',
          correlationId: ctx.correlationId,
        });
        return;
      }

      const { error: deleteError } = await supabase
        .from('amro_work_package_template_versions')
        .delete()
        .eq('id', versionId)
        .eq('tenant_id', tenantId);

      if (deleteError) {
        throw new Error(`Failed to delete template version: ${deleteError.message}`);
      }

      res.status(204).json({
        version: 'v2',
        interface: 'delete-template-version',
        correlationId: ctx.correlationId,
        output: { deleted: true },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
