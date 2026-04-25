/**
 * AMRO Work Package Template Version Management API
 * 
 * DATABASE SCHEMA ANALYSIS:
 * - Uses existing table: amro_work_package_template_versions (created 2026-04-12)
 * - Uses existing table: work_order_templates (created 2026-03-22, enhanced 2026-04-05, renamed 2026-04-25)
 * - NO NEW TABLES REQUIRED - schema is comprehensive
 * 
 * ENDPOINTS:
 * - GET  /api/v2/amro/work-package-template-versions?template_id=uuid (list versions)
 * - POST /api/v2/amro/work-package-template-versions (create new version - starts as draft)
 * 
 * FEATURES:
 * - Template versioning with approval workflow (draft → pending_review → approved → active)
 * - Automatic version number incrementing
 * - Tenant and franchise scoping
 * - Pagination support
 * - Status filtering
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

function parseBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

function parsePositiveInt(value: unknown, fallback = 1): number {
  const num = Number(value || fallback);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
}

const VALID_STATUSES = ['draft', 'pending_review', 'approved', 'active', 'deprecated', 'archived'];

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const authUser = await authenticateRequest(req);
    ctx.userId = authUser.userId;
    ctx.role = authUser.role;
    enforceAnyPermission(authUser.permissions, ['dashboards.view']);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── GET: list template versions ─────────────────────────────────────────
    if (req.method === 'GET') {
      const templateId = assertNonEmpty(req.query.template_id, 'template_id');
      const page = parsePositiveInt(req.query.page, 1);
      const pageSize = Math.min(parsePositiveInt(req.query.page_size, 20), 100);
      const status = String(req.query.status || '').trim() || undefined;

      let query = supabase
        .from('amro_work_package_template_versions')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (franchiseId) {
        query = query.eq('franchise_id', franchiseId);
      }

      if (status && VALID_STATUSES.includes(status)) {
        query = query.eq('status', status);
      }

      const { data: versions, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch template versions: ${error.message}`);
      }

      res.status(200).json({
        version: 'v2',
        interface: 'list-template-versions',
        correlationId: ctx.correlationId,
        output: {
          records: versions || [],
          total: count || 0,
          page,
          page_size: pageSize,
        },
      });
      return;
    }

    // ── POST: create template version ───────────────────────────────────────
    if (req.method === 'POST') {
      const body = parseBody(req.body);
      const templateId = assertNonEmpty(body.template_id, 'template_id');
      const changeDescription = assertNonEmpty(body.change_description, 'change_description');
      const changeReason = body.change_reason ? String(body.change_reason).trim() : null;
      const versionLabel = body.version_label ? String(body.version_label).trim() : null;
      const scopeJson = body.scope_json || {};
      const tasksJson = body.tasks_json || [];
      const materialsJson = body.materials_json || [];
      const toolingJson = body.tooling_json || [];
      const complianceRequirementsJson = body.compliance_requirements_json || [];
      const effectiveFrom = body.effective_from ? String(body.effective_from).trim() : null;
      const effectiveUntil = body.effective_until ? String(body.effective_until).trim() : null;
      const aircraftModels = body.aircraft_models ? (Array.isArray(body.aircraft_models) ? body.aircraft_models : [String(body.aircraft_models)]) : null;
      const engineModels = body.engine_models ? (Array.isArray(body.engine_models) ? body.engine_models : [String(body.engine_models)]) : null;

      // Get the latest version number to increment
      const { data: latestVersion, error: versionError } = await supabase
        .from('amro_work_package_template_versions')
        .select('version_number')
        .eq('tenant_id', tenantId)
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (versionError) {
        throw new Error(`Failed to fetch latest version: ${versionError.message}`);
      }

      const newVersionNumber = (latestVersion?.version_number || 0) + 1;

      const { data: version, error: createError } = await supabase
        .from('amro_work_package_template_versions')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          template_id: templateId,
          version_number: newVersionNumber,
          version_label: versionLabel,
          change_description: changeDescription,
          change_reason: changeReason,
          status: 'draft',
          scope_json: scopeJson,
          tasks_json: tasksJson,
          materials_json: materialsJson,
          tooling_json: toolingJson,
          compliance_requirements_json: complianceRequirementsJson,
          effective_from: effectiveFrom,
          effective_until: effectiveUntil,
          aircraft_models: aircraftModels,
          engine_models: engineModels,
          created_by: authUser.userId,
          updated_by: authUser.userId,
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create template version: ${createError.message}`);
      }

      res.status(201).json({
        version: 'v2',
        interface: 'create-template-version',
        correlationId: ctx.correlationId,
        output: version,
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
