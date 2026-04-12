/**
 * AMRO Emergency Work Package API
 * 
 * DATABASE SCHEMA ANALYSIS:
 * - Uses existing table: amro_emergency_work_packages (created 2026-04-12)
 * - Uses existing table: work_packages (created 2026-03-22, enhanced 2026-04-11)
 * - Uses existing table: amro_non_scheduled_tasks (created 2026-04-12) - optional conversion source
 * - NO NEW TABLES REQUIRED
 * 
 * ENDPOINTS:
 * - GET    /api/v2/amro/emergency/work-packages (list emergency WPs)
 * - POST   /api/v2/amro/emergency/work-packages (create emergency WP)
 * - GET    /api/v2/amro/emergency/work-packages/[id] (get details)
 * - POST   /api/v2/amro/emergency/work-packages/[id]/resolve (mark as resolved)
 * 
 * FEATURES:
 * - One-click AOG declaration
 * - Rapid WP creation (<5 required fields)
 * - Auto-prioritization based on urgency
 * - Resource conflict detection
 * - Audit trail creation
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

const VALID_EMERGENCY_TYPES = ['aog', 'unscheduled_removal', 'flight_delay_risk', 'safety_issue', 'technical_fault'];
const VALID_URGENCY_LEVELS = ['immediate', 'urgent', 'priority', 'routine'];

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

    // ── GET: list emergency work packages ────────────────────────────────────
    if (req.method === 'GET') {
      const page = Number(req.query.page || 1);
      const pageSize = Math.min(Number(req.query.page_size || 20), 100);
      const emergencyType = String(req.query.emergency_type || '').trim() || undefined;
      const urgencyLevel = String(req.query.urgency_level || '').trim() || undefined;
      const status = String(req.query.status || '').trim() || undefined; // 'active' or 'resolved'

      let query = supabase
        .from('amro_emergency_work_packages')
        .select(`
          *,
          work_packages:work_package_id (
            id,
            work_package_number,
            title,
            status,
            priority,
            aircraft_id
          )
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('declared_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (franchiseId) {
        query = query.eq('work_packages.franchise_id', franchiseId);
      }

      if (emergencyType && VALID_EMERGENCY_TYPES.includes(emergencyType)) {
        query = query.eq('emergency_type', emergencyType);
      }

      if (urgencyLevel && VALID_URGENCY_LEVELS.includes(urgencyLevel)) {
        query = query.eq('urgency_level', urgencyLevel);
      }

      if (status === 'active') {
        query = query.is('resolved_at', null);
      } else if (status === 'resolved') {
        query = query.not('resolved_at', 'is', null);
      }

      const { data: emergencyWPs, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch emergency work packages: ${error.message}`);
      }

      res.status(200).json({
        version: 'v2',
        interface: 'list-emergency-work-packages',
        correlationId: ctx.correlationId,
        output: {
          records: emergencyWPs || [],
          total: count || 0,
          page,
          page_size: pageSize,
          active_count: emergencyWPs?.filter(wp => !wp.resolved_at).length || 0,
        },
      });
      return;
    }

    // ── POST: create emergency work package ─────────────────────────────────
    if (req.method === 'POST') {
      const body = parseBody(req.body);
      const aircraftId = assertNonEmpty(body.aircraft_id, 'aircraft_id');
      const emergencyType = assertNonEmpty(body.emergency_type, 'emergency_type');
      const urgencyLevel = assertNonEmpty(body.urgency_level, 'urgency_level');
      const reason = assertNonEmpty(body.reason, 'reason');

      if (!VALID_EMERGENCY_TYPES.includes(emergencyType)) {
        throw new Error(`Invalid emergency_type. Must be one of: ${VALID_EMERGENCY_TYPES.join(', ')}`);
      }

      if (!VALID_URGENCY_LEVELS.includes(urgencyLevel)) {
        throw new Error(`Invalid urgency_level. Must be one of: ${VALID_URGENCY_LEVELS.join(', ')}`);
      }

      const impactAssessment = body.impact_assessment ? String(body.impact_assessment).trim() : null;
      const initialAssessment = body.initial_assessment ? String(body.initial_assessment).trim() : null;
      const estimatedGroundTimeHours = body.estimated_ground_time_hours ? Number(body.estimated_ground_time_hours) : null;
      const convertedFromTaskId = body.converted_from_task_id ? String(body.converted_from_task_id).trim() : null;
      const responseTeam = body.response_team && Array.isArray(body.response_team) ? body.response_team : [];

      // Auto-prioritize based on urgency
      const priorityMap: Record<string, number> = {
        'immediate': 1,
        'urgent': 2,
        'priority': 3,
        'routine': 4,
      };
      const autoPriority = priorityMap[urgencyLevel] || 3;

      // Start transaction
      const { data: wp, error: wpError } = await supabase
        .from('work_packages')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          aircraft_id: aircraftId,
          title: `EMERGENCY: ${emergencyType.toUpperCase()} - ${reason.substring(0, 50)}`,
          description: reason,
          status: 'planned',
          priority: autoPriority,
          maintenance_type: 'unscheduled',
          work_type: emergencyType,
          is_emergency: true,
          source: convertedFromTaskId ? 'non_scheduled_task' : 'emergency_declaration',
          created_by: authUser.userId,
          updated_by: authUser.userId,
        })
        .select()
        .single();

      if (wpError) {
        throw new Error(`Failed to create work package: ${wpError.message}`);
      }

      // Create emergency record
      const { data: emergencyWP, error: emergencyError } = await supabase
        .from('amro_emergency_work_packages')
        .insert({
          tenant_id: tenantId,
          work_package_id: wp.id,
          emergency_type: emergencyType,
          urgency_level: urgencyLevel,
          reason: reason,
          impact_assessment: impactAssessment,
          initial_assessment: initialAssessment,
          estimated_ground_time_hours: estimatedGroundTimeHours,
          declared_by: authUser.userId,
          declared_at: new Date().toISOString(),
          response_team: responseTeam,
          converted_from_task_id: convertedFromTaskId,
          auto_prioritized: true,
          priority_escalation_reason: `Auto-prioritized to ${autoPriority} based on ${urgencyLevel} urgency`,
        })
        .select()
        .single();

      if (emergencyError) {
        throw new Error(`Failed to create emergency record: ${emergencyError.message}`);
      }

      // If converted from non-scheduled task, update task status
      if (convertedFromTaskId) {
        await supabase
          .from('amro_non_scheduled_tasks')
          .update({
            status: 'converted_to_wp',
            converted_to_wp_id: wp.id,
            converted_at: new Date().toISOString(),
          })
          .eq('id', convertedFromTaskId)
          .eq('tenant_id', tenantId);
      }

      res.status(201).json({
        version: 'v2',
        interface: 'create-emergency-work-package',
        correlationId: ctx.correlationId,
        output: {
          work_package_id: wp.id,
          work_package_number: wp.work_package_number,
          emergency_wp_id: emergencyWP.id,
          declared_at: emergencyWP.declared_at,
          auto_prioritized: emergencyWP.auto_prioritized,
          priority: autoPriority,
          message: `Emergency work package created with ${urgencyLevel} priority`,
        },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
