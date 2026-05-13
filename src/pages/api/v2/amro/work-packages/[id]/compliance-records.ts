/**
 * AMRO Compliance Records API
 * 
 * DATABASE SCHEMA ANALYSIS:
 * - Uses existing table: amro_work_order_compliance_records (created 2026-04-12, renamed)
 * - Uses existing table: amro_compliance_directives (created 2026-04-12)
 * - Uses existing table: amro_certificates_release_service (created 2026-04-12)
 * - Uses existing table: work_orders (created 2026-03-22)
 * - Uses existing table: tasks (for task-level compliance)
 * - NO NEW TABLES REQUIRED
 * 
 * ENDPOINTS:
 * - GET    /api/v2/amro/work-orders/[id]/compliance-records (list compliance records)
 * - POST   /api/v2/amro/work-orders/[id]/compliance-records (create compliance record)
 * - POST   /api/v2/amro/work-orders/[id]/certificates (generate CRS)
 * 
 * FEATURES:
 * - AD/SB directive tracking
 * - Task-level compliance records
 * - Digital signature support
 * - Evidence attachment system
 * - Certificate of Release to Service (CRS) generation
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

const VALID_COMPLIANCE_TYPES = ['AD', 'SB', 'inspection', 'certification', 'routine'];
const VALID_COMPLIANCE_STATUSES = ['pending', 'in_progress', 'completed', 'deferred', 'exempted'];

function parseBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const workOrderId = String(req.query.id || '').trim();

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (!workOrderId) {
      res.status(400).json({ error: 'Work Package ID is required', version: 'v2', correlationId: ctx.correlationId });
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

    // Verify work package exists and belongs to tenant
    const { error: wpError } = await supabase
      .from('work_orders')
      .select('id, aircraft_id')
      .eq('id', workOrderId)
      .eq('tenant_id', tenantId)
      .single();

    if (wpError) {
      if (wpError.code === 'PGRST116') {
        res.status(404).json({ error: 'Work package not found', version: 'v2', correlationId: ctx.correlationId });
      } else {
        throw new Error(`Failed to fetch work package: ${wpError.message}`);
      }
      return;
    }

    // ── GET: list compliance records ─────────────────────────────────────────
    if (req.method === 'GET') {
      const complianceType = String(req.query.compliance_type || '').trim() || undefined;
      const status = String(req.query.status || '').trim() || undefined;

      let query = supabase
        .from('amro_work_order_compliance_records')
        .select(`
          *,
          directive:directive_id (
            id,
            directive_type,
            directive_number,
            issuing_authority,
            title
          )
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });

      if (complianceType && VALID_COMPLIANCE_TYPES.includes(complianceType)) {
        query = query.eq('compliance_type', complianceType);
      }

      if (status && VALID_COMPLIANCE_STATUSES.includes(status)) {
        query = query.eq('compliance_status', status);
      }

      let { data: records, error, count } = await query;

      // Transition-safe fallback while environments converge on rename migration.
      if (error && /amro_work_order_compliance_records|work_order_id/i.test(String(error.message || ''))) {
        let legacyQuery = supabase
          .from('amro_work_order_compliance_records')
          .select(`
            *,
            directive:directive_id (
              id,
              directive_type,
              directive_number,
              issuing_authority,
              title
            )
          `, { count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('work_order_id', workOrderId)
          .order('created_at', { ascending: false });

        if (complianceType && VALID_COMPLIANCE_TYPES.includes(complianceType)) {
          legacyQuery = legacyQuery.eq('compliance_type', complianceType);
        }
        if (status && VALID_COMPLIANCE_STATUSES.includes(status)) {
          legacyQuery = legacyQuery.eq('compliance_status', status);
        }

        const legacyResult = await legacyQuery;
        records = legacyResult.data;
        error = legacyResult.error;
        count = legacyResult.count ?? count;
      }

      if (error) {
        throw new Error(`Failed to fetch compliance records: ${error.message}`);
      }

      res.status(200).json({
        version: 'v2',
        interface: 'list-compliance-records',
        correlationId: ctx.correlationId,
        output: {
          work_order_id: workOrderId,
          records: records || [],
          total: count || 0,
        },
      });
      return;
    }

    // ── POST: create compliance record ──────────────────────────────────────
    if (req.method === 'POST') {
      const body = parseBody(req.body);
      const complianceType = assertNonEmpty(body.compliance_type, 'compliance_type');
      const complianceReference = assertNonEmpty(body.compliance_reference, 'compliance_reference');

      if (!VALID_COMPLIANCE_TYPES.includes(complianceType)) {
        throw new Error(`Invalid compliance_type. Must be one of: ${VALID_COMPLIANCE_TYPES.join(', ')}`);
      }

      const taskId = body.task_id ? String(body.task_id).trim() : null;
      const directiveId = body.directive_id ? String(body.directive_id).trim() : null;
      const complianceMethod = body.compliance_method ? String(body.compliance_method).trim() : null;
      const complianceStatus = String(body.compliance_status || 'pending').trim();
      
      if (!VALID_COMPLIANCE_STATUSES.includes(complianceStatus)) {
        throw new Error(`Invalid compliance_status. Must be one of: ${VALID_COMPLIANCE_STATUSES.join(', ')}`);
      }

      const evidenceAttachments = body.evidence_attachments && Array.isArray(body.evidence_attachments)
        ? body.evidence_attachments
        : [];
      const evidenceCaptured = body.evidence_captured === true || evidenceAttachments.length > 0;
      const inspectionResult = body.inspection_result ? String(body.inspection_result).trim() : null;
      const findings = body.findings ? String(body.findings).trim() : null;

      // Certification fields
      const certifiedBy = body.certified_by ? String(body.certified_by).trim() : null;
      const certificateNumber = body.certificate_number ? String(body.certificate_number).trim() : null;
      const licenseNumber = body.license_number ? String(body.license_number).trim() : null;
      const licenseExpiry = body.license_expiry ? String(body.license_expiry).trim() : null;

      let { data: record, error: createError } = await supabase
        .from('amro_work_order_compliance_records')
        .insert({
          tenant_id: tenantId,
          work_order_id: workOrderId,
          task_id: taskId,
          directive_id: directiveId,
          compliance_type: complianceType,
          compliance_reference: complianceReference,
          compliance_method: complianceMethod,
          compliance_status: complianceStatus,
          certified_by: certifiedBy,
          certified_at: certifiedBy ? new Date().toISOString() : null,
          certificate_number: certificateNumber,
          license_number: licenseNumber,
          license_expiry: licenseExpiry,
          evidence_attachments: evidenceAttachments,
          evidence_captured: evidenceCaptured,
          inspection_result: inspectionResult,
          findings: findings,
          created_by: authUser.userId,
          updated_by: authUser.userId,
        })
        .select()
        .single();

      if (createError && /amro_work_order_compliance_records|work_order_id/i.test(String(createError.message || ''))) {
        const legacyResult = await supabase
          .from('amro_work_order_compliance_records')
          .insert({
            tenant_id: tenantId,
            work_order_id: workOrderId,
            task_id: taskId,
            directive_id: directiveId,
            compliance_type: complianceType,
            compliance_reference: complianceReference,
            compliance_method: complianceMethod,
            compliance_status: complianceStatus,
            certified_by: certifiedBy,
            certified_at: certifiedBy ? new Date().toISOString() : null,
            certificate_number: certificateNumber,
            license_number: licenseNumber,
            license_expiry: licenseExpiry,
            evidence_attachments: evidenceAttachments,
            evidence_captured: evidenceCaptured,
            inspection_result: inspectionResult,
            findings: findings,
            created_by: authUser.userId,
            updated_by: authUser.userId,
          })
          .select()
          .single();
        record = legacyResult.data;
        createError = legacyResult.error;
      }

      if (createError) {
        throw new Error(`Failed to create compliance record: ${createError.message}`);
      }

      res.status(201).json({
        version: 'v2',
        interface: 'create-compliance-record',
        correlationId: ctx.correlationId,
        output: record,
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
