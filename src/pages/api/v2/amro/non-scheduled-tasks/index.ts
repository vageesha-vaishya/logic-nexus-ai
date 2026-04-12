/**
 * AMRO Non-Scheduled Task Registry API
 * 
 * DATABASE SCHEMA ANALYSIS:
 * - Uses existing table: amro_non_scheduled_tasks (created 2026-04-12)
 * - Uses existing table: aircraft (for validation)
 * - Uses existing table: work_packages (for conversion)
 * - NO NEW TABLES REQUIRED
 * 
 * ENDPOINTS:
 * - GET    /api/v2/amro/non-scheduled-tasks (list tasks)
 * - POST   /api/v2/amro/non-scheduled-tasks (create task)
 * - GET    /api/v2/amro/non-scheduled-tasks/[id] (get details)
 * - PUT    /api/v2/amro/non-scheduled-tasks/[id] (update task)
 * - POST   /api/v2/amro/non-scheduled-tasks/[id]/convert-to-wp (convert to emergency WP)
 * 
 * FEATURES:
 * - Non-scheduled task registry (pilot reports, mechanic reports, inspection findings)
 * - Priority assignment
 * - Conversion to emergency work packages
 * - Status tracking
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

const VALID_TASK_SOURCES = ['pilot_report', 'mechanic_report', 'inspection_finding', 'reliability_program', 'manufacturer_advisory', 'incident_investigation', 'quality_audit'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical', 'aog'];
const VALID_STATUSES = ['reported', 'under_review', 'approved', 'converted_to_wp', 'deferred', 'cancelled'];

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
    enforceAnyPermission(authUser.permissions, ['dashboards.view']);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── GET: list non-scheduled tasks ────────────────────────────────────────
    if (req.method === 'GET') {
      const page = Number(req.query.page || 1);
      const pageSize = Math.min(Number(req.query.page_size || 20), 100);
      const aircraftId = String(req.query.aircraft_id || '').trim() || undefined;
      const status = String(req.query.status || '').trim() || undefined;
      const priority = String(req.query.priority || '').trim() || undefined;
      const taskSource = String(req.query.task_source || '').trim() || undefined;

      let query = supabase
        .from('amro_non_scheduled_tasks')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('reported_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (franchiseId) {
        // Would need to join with aircraft table for franchise filtering
        // For now, filter at application level or add aircraft_id to query
      }

      if (aircraftId) {
        query = query.eq('aircraft_id', aircraftId);
      }

      if (status && VALID_STATUSES.includes(status)) {
        query = query.eq('status', status);
      }

      if (priority && VALID_PRIORITIES.includes(priority)) {
        query = query.eq('priority', priority);
      }

      if (taskSource && VALID_TASK_SOURCES.includes(taskSource)) {
        query = query.eq('task_source', taskSource);
      }

      const { data: tasks, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch non-scheduled tasks: ${error.message}`);
      }

      res.status(200).json({
        version: 'v2',
        interface: 'list-non-scheduled-tasks',
        correlationId: ctx.correlationId,
        output: {
          records: tasks || [],
          total: count || 0,
          page,
          page_size: pageSize,
        },
      });
      return;
    }

    // ── POST: create non-scheduled task ─────────────────────────────────────
    if (req.method === 'POST') {
      const body = parseBody(req.body);
      const aircraftId = assertNonEmpty(body.aircraft_id, 'aircraft_id');
      const taskSource = assertNonEmpty(body.task_source, 'task_source');
      const taskDescription = assertNonEmpty(body.task_description, 'task_description');

      if (!VALID_TASK_SOURCES.includes(taskSource)) {
        throw new Error(`Invalid task_source. Must be one of: ${VALID_TASK_SOURCES.join(', ')}`);
      }

      const priority = String(body.priority || 'medium').trim();
      if (!VALID_PRIORITIES.includes(priority)) {
        throw new Error(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }

      const defectDescription = body.defect_description ? String(body.defect_description).trim() : null;
      const faultCode = body.fault_code ? String(body.fault_code).trim() : null;
      const initialAssessment = body.initial_assessment ? String(body.initial_assessment).trim() : null;
      const estimatedDurationHours = body.estimated_duration_hours ? Number(body.estimated_duration_hours) : null;
      const requiredQualifications = body.required_qualifications && Array.isArray(body.required_qualifications)
        ? body.required_qualifications
        : [];
      const requiredMaterials = body.required_materials && Array.isArray(body.required_materials)
        ? body.required_materials
        : [];

      const { data: task, error: createError } = await supabase
        .from('amro_non_scheduled_tasks')
        .insert({
          tenant_id: tenantId,
          aircraft_id: aircraftId,
          task_source: taskSource,
          task_description: taskDescription,
          defect_description: defectDescription,
          fault_code: faultCode,
          reported_by: authUser.userId,
          reported_at: new Date().toISOString(),
          priority: priority,
          initial_assessment: initialAssessment,
          estimated_duration_hours: estimatedDurationHours,
          required_qualifications: requiredQualifications,
          required_materials: requiredMaterials,
          status: 'reported',
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create non-scheduled task: ${createError.message}`);
      }

      res.status(201).json({
        version: 'v2',
        interface: 'create-non-scheduled-task',
        correlationId: ctx.correlationId,
        output: task,
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
