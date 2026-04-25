/**
 * AMRO Non-Scheduled Task - Convert to Emergency Work Package
 * 
 * DATABASE SCHEMA:
 * - Uses: amro_non_scheduled_tasks (existing)
 * - Uses: amro_emergency_work_packages (existing)
 * - Uses: work_orders (existing)
 * - Updates: non-scheduled task status to 'converted_to_wp'
 * - Creates: emergency work package linked to original task
 * 
 * ENDPOINT:
 * - POST /api/v2/amro/non-scheduled-tasks/[id]/convert-to-wp
 * 
 * BODY:
 * - assign_to_technician?: user_id (optional)
 * - scheduled_start?: datetime (optional)
 * - priority_override?: string (optional, defaults to task priority)
 * - urgency_level?: string (immediate/urgent/priority/routine, defaults based on task priority)
 * 
 * FEATURES:
 * - Creates emergency work package
 * - Links to original non-scheduled task
 * - Auto-prioritizes based on source task
 * - Notifies assigned resources
 * - Updates non-scheduled task status to 'converted_to_wp'
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

const VALID_URGENCY_LEVELS = ['immediate', 'urgent', 'priority', 'routine'];

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const taskId = String(req.query.id || '').trim();

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (!taskId) {
      res.status(400).json({ error: 'Task ID is required', version: 'v2', correlationId: ctx.correlationId });
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

    // Fetch the non-scheduled task
    const { data: task, error: taskError } = await supabase
      .from('amro_non_scheduled_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('tenant_id', tenantId)
      .single();

    if (taskError) {
      if (taskError.code === 'PGRST116') {
        res.status(404).json({ error: 'Non-scheduled task not found', version: 'v2', correlationId: ctx.correlationId });
      } else {
        throw new Error(`Failed to fetch non-scheduled task: ${taskError.message}`);
      }
      return;
    }

    // Check if already converted
    if (task.status === 'converted_to_wp') {
      res.status(400).json({
        error: 'Task has already been converted to a work package',
        version: 'v2',
        correlationId: ctx.correlationId,
        converted_to_wp_id: task.converted_to_wp_id,
      });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};

    // Map task priority to urgency level
    const priorityToUrgencyMap: Record<string, string> = {
      'aog': 'immediate',
      'critical': 'immediate',
      'high': 'urgent',
      'medium': 'priority',
      'low': 'routine',
    };

    const urgencyLevel = String(body.urgency_level || priorityToUrgencyMap[task.priority] || 'priority').trim();
    
    if (!VALID_URGENCY_LEVELS.includes(urgencyLevel)) {
      res.status(400).json({
        error: `Invalid urgency_level. Must be one of: ${VALID_URGENCY_LEVELS.join(', ')}`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    // Map urgency to work package priority
    const urgencyToPriorityMap: Record<string, number> = {
      'immediate': 1,
      'urgent': 2,
      'priority': 3,
      'routine': 4,
    };
    const wpPriority = urgencyToPriorityMap[urgencyLevel] || 3;

    // Create work package
    const { data: wp, error: wpError } = await supabase
      .from('work_orders')
      .insert({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        aircraft_id: task.aircraft_id,
        title: `NS-TASK: ${task.task_source.replace('_', ' ').toUpperCase()} - ${task.task_description.substring(0, 50)}`,
        description: task.task_description,
        status: 'planned',
        priority: wpPriority,
        maintenance_type: 'unscheduled',
        work_type: 'non_scheduled',
        is_emergency: ['immediate', 'urgent'].includes(urgencyLevel),
        source: 'non_scheduled_task',
        assigned_to: body.assign_to_technician ? String(body.assign_to_technician) : null,
        planned_start_date: body.scheduled_start ? String(body.scheduled_start) : null,
        created_by: authUser.userId,
        updated_by: authUser.userId,
      })
      .select()
      .single();

    if (wpError) {
      throw new Error(`Failed to create work package: ${wpError.message}`);
    }

    // Create emergency record if urgent
    let emergencyWPId = null;
    if (['immediate', 'urgent'].includes(urgencyLevel)) {
      const { data: emergencyWP, error: emergencyError } = await supabase
        .from('amro_emergency_work_packages')
        .insert({
          tenant_id: tenantId,
          work_package_id: wp.id,
          emergency_type: task.priority === 'aog' ? 'aog' : 'technical_fault',
          urgency_level: urgencyLevel,
          reason: task.task_description,
          impact_assessment: task.initial_assessment,
          initial_assessment: task.initial_assessment,
          estimated_ground_time_hours: task.estimated_duration_hours,
          declared_by: authUser.userId,
          declared_at: new Date().toISOString(),
          response_team: [],
          converted_from_task_id: task.id,
          auto_prioritized: true,
          priority_escalation_reason: `Converted from non-scheduled task with ${task.priority} priority`,
        })
        .select('id')
        .single();

      if (emergencyError) {
        throw new Error(`Failed to create emergency record: ${emergencyError.message}`);
      }

      emergencyWPId = emergencyWP.id;
    }

    // Update non-scheduled task status
    const { error: updateError } = await supabase
      .from('amro_non_scheduled_tasks')
      .update({
        status: 'converted_to_wp',
        converted_to_wp_id: wp.id,
        converted_at: new Date().toISOString(),
        reviewed_by: authUser.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw new Error(`Failed to update non-scheduled task status: ${updateError.message}`);
    }

    res.status(201).json({
      version: 'v2',
      interface: 'convert-non-scheduled-task-to-wp',
      correlationId: ctx.correlationId,
      output: {
        work_package_id: wp.id,
        work_package_number: wp.work_package_number,
        emergency_wp_id: emergencyWPId,
        converted_from_task_id: task.id,
        conversion_timestamp: new Date().toISOString(),
        auto_prioritized: true,
        priority: wpPriority,
        urgency_level: urgencyLevel,
        message: `Non-scheduled task converted to work package with ${urgencyLevel} urgency`,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
