/**
 * AMRO Enterprise Tooling API
 * 
 * Provides enterprise-grade tooling management functionality including:
 * - Tooling registry search and retrieval
 * - Tool availability checking
 * - Tool reservation system
 * - Calibration management and logging
 * - Calibration due reports
 * - Utilization analytics
 * 
 * @module pages/api/v2/amro/tooling
 */

import type { ApiRequest, ApiResponse } from '../../_utils/types';
import { applyCors, authenticateRequest, handlePreflight } from '../../_utils/http';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { logger } from '@/lib/logger';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function sendJson(res: ApiResponse, status: number, data: unknown) {
  res.status(status).json(data);
}

function sendError(res: ApiResponse, status: number, error: string, details?: unknown) {
  res.status(status).json({
    error,
    status,
    details,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * POST /api/v2/amro/tooling/search
 * Search tooling registry with filters
 */
async function handleSearch(req: ApiRequest, res: ApiResponse, tenantId: string) {
  try {
    const {
      query = '',
      tool_category,
      tool_type,
      calibration_required,
      limit = 50,
      offset = 0,
    } = req.body || {};

    const supabase = getSupabaseAdminClient();

    let supabaseQuery = supabase
      .from('amro_tooling_registry')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .limit(limit)
      .offset(offset);

    // Full-text search
    if (query) {
      supabaseQuery = supabaseQuery.or(
        `tool_code.ilike.%${query}%,tool_name.ilike.%${query}%,manufacturer.ilike.%${query}%`
      );
    }

    // Filters
    if (tool_category) {
      supabaseQuery = supabaseQuery.eq('tool_category', tool_category);
    }
    if (tool_type) {
      supabaseQuery = supabaseQuery.eq('tool_type', tool_type);
    }
    if (calibration_required !== undefined) {
      supabaseQuery = supabaseQuery.eq('calibration_required', calibration_required);
    }

    supabaseQuery = supabaseQuery.order('tool_code');

    const { data, error, count } = await supabaseQuery;

    if (error) {
      logger.error('[Tooling API] Search failed', { error, tenantId });
      return sendError(res, 500, 'Failed to search tooling', error.message);
    }

    return sendJson(res, 200, {
      total: count || 0,
      results: data || [],
      has_more: (count || 0) > offset + limit,
      limit,
      offset,
    });
  } catch (err: any) {
    logger.error('[Tooling API] Unexpected error in search', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * GET /api/v2/amro/tooling/:id/availability
 * Check tool availability for specific dates
 */
async function handleAvailability(req: ApiRequest, res: ApiResponse, tenantId: string, toolId: string) {
  try {
    const { required_date, quantity_required = 1 } = req.query || {};

    const supabase = getSupabaseAdminClient();

    // Get tool details
    const { data: tool, error: toolError } = await supabase
      .from('amro_tooling_registry')
      .select('*')
      .eq('id', toolId)
      .eq('tenant_id', tenantId)
      .single();

    if (toolError || !tool) {
      return sendError(res, 404, 'Tool not found');
    }

    // Get available instances
    const { data: instances, error: instancesError } = await supabase
      .from('amro_tooling_instances')
      .select('*')
      .eq('tool_id', toolId)
      .eq('tenant_id', tenantId)
      .eq('current_status', 'available')
      .eq('lifecycle_status', 'active');

    if (instancesError) {
      logger.error('[Tooling API] Failed to get instances', { error: instancesError });
      return sendError(res, 500, 'Failed to get tool instances', instancesError.message);
    }

    const availableInstances = instances || [];
    const quantityAvailable = availableInstances.length;

    // Check calibration status for each instance
    const instancesWithCalibration = availableInstances.map((instance) => {
      const calStatus = instance.calibration_status;
      return {
        instance_id: instance.id,
        serial_number: instance.serial_number,
        location: instance.tool_crib_location || 'Unknown',
        status: instance.current_status,
        calibration_status: calStatus,
        next_calibration_due: instance.next_calibration_due,
      };
    });

    return sendJson(res, 200, {
      tool_id: tool.id,
      tool_code: tool.tool_code,
      tool_name: tool.tool_name,
      quantity_required: Number(quantity_required),
      quantity_available: quantityAvailable,
      available_instances: instancesWithCalibration,
      reservation_available: quantityAvailable >= Number(quantity_required),
      estimated_ready_date: quantityAvailable < Number(quantity_required) ? null : null,
    });
  } catch (err: any) {
    logger.error('[Tooling API] Unexpected error in availability', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * POST /api/v2/amro/tooling/:id/reserve
 * Reserve tool for a work package
 */
async function handleReserve(req: ApiRequest, res: ApiResponse, tenantId: string, toolId: string, userId: string) {
  try {
    const {
      tool_instance_id,
      quantity = 1,
      work_package_template_id,
      work_package_id,
      reservation_date,
      return_date,
      notes,
    } = req.body || {};

    if (!reservation_date || !return_date) {
      return sendError(res, 400, 'Invalid dates', 'reservation_date and return_date are required');
    }

    if (new Date(return_date) <= new Date(reservation_date)) {
      return sendError(res, 400, 'Invalid dates', 'return_date must be after reservation_date');
    }

    const supabase = getSupabaseAdminClient();

    // Check if tool exists
    const { data: tool, error: toolError } = await supabase
      .from('amro_tooling_registry')
      .select('*')
      .eq('id', toolId)
      .eq('tenant_id', tenantId)
      .single();

    if (toolError || !tool) {
      return sendError(res, 404, 'Tool not found');
    }

    // Create reservation
    const { data: reservation, error: reservationError } = await supabase
      .from('amro_tool_reservations')
      .insert({
        tenant_id: tenantId,
        tool_id: toolId,
        tool_instance_id,
        work_package_template_id,
        work_package_id,
        quantity_reserved: quantity,
        reserved_by: userId,
        reservation_date: new Date(reservation_date),
        return_date: new Date(return_date),
        status: 'confirmed',
        notes,
      })
      .select()
      .single();

    if (reservationError) {
      logger.error('[Tooling API] Failed to create reservation', { error: reservationError });
      return sendError(res, 500, 'Failed to create reservation', reservationError.message);
    }

    // Update tool instance status if specific instance reserved
    if (tool_instance_id) {
      await supabase
        .from('amro_tooling_instances')
        .update({
          current_status: 'in_use',
          current_assignment_id: work_package_template_id || work_package_id,
          updated_by: userId,
        })
        .eq('id', tool_instance_id);
    }

    logger.info('[Tooling API] Reservation created', {
      toolId,
      reservationId: reservation.id,
      userId,
    });

    return sendJson(res, 201, {
      reservation,
      message: 'Tool reserved successfully',
    });
  } catch (err: any) {
    logger.error('[Tooling API] Unexpected error in reserve', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * GET /api/v2/amro/tooling/calibration-due
 * Get calibration due list
 */
async function handleCalibrationDue(req: ApiRequest, res: ApiResponse, tenantId: string) {
  try {
    const supabase = getSupabaseAdminClient();
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Get all tool instances with calibration requirements
    const { data: instances, error } = await supabase
      .from('amro_tooling_instances')
      .select(`
        *,
        tool:amro_tooling_registry(*)
      `)
      .eq('tenant_id', tenantId)
      .eq('lifecycle_status', 'active')
      .not('next_calibration_due', 'is', null);

    if (error) {
      logger.error('[Tooling API] Failed to get calibration due list', { error });
      return sendError(res, 500, 'Failed to get calibration due list', error.message);
    }

    const overdue: any[] = [];
    const due_30_days: any[] = [];
    const due_60_days: any[] = [];
    const due_90_days: any[] = [];

    instances?.forEach((instance) => {
      const tool = instance.tool;
      const nextDue = new Date(instance.next_calibration_due);

      const item = {
        id: instance.id,
        tool_id: instance.tool_id,
        tool_code: tool?.tool_code,
        tool_name: tool?.tool_name,
        serial_number: instance.serial_number,
        next_calibration_due: instance.next_calibration_due,
        calibration_status: instance.calibration_status,
        location: instance.tool_crib_location,
        current_status: instance.current_status,
      };

      if (nextDue < now) {
        overdue.push(item);
      } else if (nextDue <= thirtyDays) {
        due_30_days.push(item);
      } else if (nextDue <= sixtyDays) {
        due_60_days.push(item);
      } else if (nextDue <= ninetyDays) {
        due_90_days.push(item);
      }
    });

    return sendJson(res, 200, {
      overdue,
      due_30_days,
      due_60_days,
      due_90_days,
      total_tools_requiring_calibration: overdue.length + due_30_days.length + due_60_days.length + due_90_days.length,
    });
  } catch (err: any) {
    logger.error('[Tooling API] Unexpected error in calibration-due', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * POST /api/v2/amro/tooling/:id/calibration-log
 * Log calibration for a tool instance
 */
async function handleCalibrationLog(req: ApiRequest, res: ApiResponse, tenantId: string, toolId: string, userId: string) {
  try {
    const {
      tool_instance_id,
      calibration_date,
      next_calibration_due,
      calibration_standard,
      calibration_result,
      as_found_data,
      as_left_data,
      out_of_tolerance = false,
      oot_investigation,
      certificate_number,
      calibration_certificate_url,
      calibration_organization,
      notes,
    } = req.body || {};

    if (!tool_instance_id || !calibration_date || !next_calibration_due || !calibration_standard || !calibration_result || !certificate_number) {
      return sendError(res, 400, 'Missing required fields', 'tool_instance_id, calibration_date, next_calibration_due, calibration_standard, calibration_result, and certificate_number are required');
    }

    const supabase = getSupabaseAdminClient();

    // Create calibration log entry
    const { data: log, error: logError } = await supabase
      .from('amro_calibration_logs')
      .insert({
        tenant_id: tenantId,
        tool_id: toolId,
        tool_instance_id,
        calibration_date: new Date(calibration_date),
        next_calibration_due: new Date(next_calibration_due),
        calibration_standard,
        calibration_result,
        as_found_data,
        as_left_data,
        out_of_tolerance,
        oot_investigation,
        certificate_number,
        calibration_certificate_url,
        calibrated_by: userId,
        calibration_organization,
        notes,
        created_by: userId,
      })
      .select()
      .single();

    if (logError) {
      logger.error('[Tooling API] Failed to log calibration', { error: logError });
      return sendError(res, 500, 'Failed to log calibration', logError.message);
    }

    // Update tool instance
    const calibrationStatus = out_of_tolerance ? 'expired' : 'valid';
    await supabase
      .from('amro_tooling_instances')
      .update({
        last_calibration_date: new Date(calibration_date),
        next_calibration_due: new Date(next_calibration_due),
        calibration_certificate: certificate_number,
        calibration_status: calibrationStatus,
        updated_by: userId,
      })
      .eq('id', tool_instance_id);

    logger.info('[Tooling API] Calibration logged', {
      toolId,
      toolInstanceId: tool_instance_id,
      calibrationDate: calibration_date,
      userId,
    });

    return sendJson(res, 201, {
      calibration_log: log,
      message: 'Calibration logged successfully',
    });
  } catch (err: any) {
    logger.error('[Tooling API] Unexpected error in calibration-log', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * GET /api/v2/amro/tooling/analytics
 * Get tooling analytics dashboard data
 */
async function handleAnalytics(req: ApiRequest, res: ApiResponse, tenantId: string) {
  try {
    const supabase = getSupabaseAdminClient();

    // Get all tools for tenant
    const { data: tools, error } = await supabase
      .from('amro_tooling_registry')
      .select(`
        *,
        instances:amro_tooling_instances(*)
      `)
      .eq('tenant_id', tenantId);

    if (error) {
      logger.error('[Tooling API] Failed to get analytics data', { error });
      return sendError(res, 500, 'Failed to retrieve analytics', error.message);
    }

    // Calculate analytics
    const totalTools = tools?.length || 0;
    let toolsAvailable = 0;
    let toolsInUse = 0;
    let toolsUnderMaintenance = 0;
    let calibrationOverdue = 0;
    let calibrationDue30Days = 0;

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    tools?.forEach((tool) => {
      const instances = tool.instances || [];
      instances.forEach((instance: any) => {
        if (instance.current_status === 'available') toolsAvailable++;
        if (instance.current_status === 'in_use') toolsInUse++;
        if (instance.current_status === 'under_maintenance') toolsUnderMaintenance++;
        
        const nextCal = instance.next_calibration_due ? new Date(instance.next_calibration_due) : null;
        if (nextCal && nextCal < now) calibrationOverdue++;
        if (nextCal && nextCal <= thirtyDays && nextCal >= now) calibrationDue30Days++;
      });
    });

    const utilizationRate = totalTools > 0 ? (toolsInUse / totalTools) * 100 : 0;

    // Cost by category
    const costByCategory: Record<string, number> = {};
    tools?.forEach((t) => {
      const category = t.tool_category;
      if (!costByCategory[category]) costByCategory[category] = 0;
      costByCategory[category] += Number(t.purchase_cost) || 0;
    });

    // Tools requiring attention
    const toolsRequiringAttention = tools
      ?.filter((t) => {
        const instances = t.instances || [];
        return instances.some((i: any) => 
          i.calibration_status === 'expired' || 
          i.current_status === 'unserviceable' ||
          i.lifecycle_status === 'pending_repair'
        );
      })
      .map((t) => t.tool_code) || [];

    return sendJson(res, 200, {
      total_tools: totalTools,
      tools_available: toolsAvailable,
      tools_in_use: toolsInUse,
      tools_under_maintenance: toolsUnderMaintenance,
      calibration_overdue: calibrationOverdue,
      calibration_due_30_days: calibrationDue30Days,
      utilization_rate: Math.round(utilizationRate * 100) / 100,
      cost_by_category: costByCategory,
      tools_requiring_attention: toolsRequiringAttention,
    });
  } catch (err: any) {
    logger.error('[Tooling API] Unexpected error in analytics', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Apply CORS
  await applyCors(req, res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight(res);
  }

  // Authenticate
  const auth = await authenticateRequest(req, res);
  if (!auth) return;

  const { tenantId, userId } = auth;
  const { method, query } = req;

  try {
    // Route based on path and method
    const pathSegments = (query._path as string || '').split('/').filter(Boolean);
    
    // Pattern: /api/v2/amro/tooling/search
    if (pathSegments[0] === 'search' && method === 'POST') {
      return await handleSearch(req, res, tenantId);
    }

    // Pattern: /api/v2/amro/tooling/:id/availability
    if (pathSegments[1] === 'availability' && method === 'GET') {
      return await handleAvailability(req, res, tenantId, pathSegments[0]);
    }

    // Pattern: /api/v2/amro/tooling/:id/reserve
    if (pathSegments[1] === 'reserve' && method === 'POST') {
      return await handleReserve(req, res, tenantId, pathSegments[0], userId);
    }

    // Pattern: /api/v2/amro/tooling/calibration-due
    if (pathSegments[0] === 'calibration-due' && method === 'GET') {
      return await handleCalibrationDue(req, res, tenantId);
    }

    // Pattern: /api/v2/amro/tooling/:id/calibration-log
    if (pathSegments[1] === 'calibration-log' && method === 'POST') {
      return await handleCalibrationLog(req, res, tenantId, pathSegments[0], userId);
    }

    // Pattern: /api/v2/amro/tooling/analytics
    if (pathSegments[0] === 'analytics' && method === 'GET') {
      return await handleAnalytics(req, res, tenantId);
    }

    return sendError(res, 404, 'Not found', 'Invalid endpoint');
  } catch (err: any) {
    logger.error('[Tooling API] Unhandled error', { error: err.message, stack: err.stack });
    return sendError(res, 500, 'Internal server error');
  }
}
