/**
 * AMRO Enterprise Routes
 * 
 * Enterprise-grade routes for:
 * - Materials Management (integrates with existing parts_inventory)
 * - Tooling & Equipment Management (new tables)
 * - Compliance & Regulatory Management (new tables)
 * 
 * @module routes/enterprise.routes
 */

import { Router } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

const router = Router();

// ============================================================================
// HELPERS
// ============================================================================

function getSupabaseAdminClient(): SupabaseClient {
  const url = String(
    process.env.AMRO_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '',
  ).replace(/\/$/, '');
  const serviceKey = String(
    process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '',
  ).trim();
  
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(url, serviceKey);
}

// ============================================================================
// MATERIALS ENDPOINTS (uses existing parts_inventory)
// ============================================================================

/**
 * POST /api/v2/amro/enterprise/materials/search
 * Search parts inventory with enterprise aviation filters
 */
router.post('/materials/search', asyncHandler(async (req: AuthRequest, res) => {
  const {
    query = '',
    ata_chapter,
    material_group,
    warehouse_location,
    in_stock_only = false,
    ercs_only = false,
    safety_only = false,
    limit = 50,
    offset = 0,
  } = req.body || {};

  const supabase = getSupabaseAdminClient();

  let supabaseQuery = supabase
    .from('parts_inventory')
    .select('*', { count: 'exact' })
    .limit(limit)
    .offset(offset);

  // Search
  if (query) {
    supabaseQuery = supabaseQuery.or(
      `part_number.ilike.%${query}%,description.ilike.%${query}%,nomenclature.ilike.%${query}%`
    );
  }

  // Filters
  if (ata_chapter) supabaseQuery = supabaseQuery.eq('ata_chapter', ata_chapter);
  if (material_group) supabaseQuery = supabaseQuery.eq('material_group', material_group);
  if (warehouse_location) supabaseQuery = supabaseQuery.eq('warehouse_location', warehouse_location);
  if (in_stock_only) supabaseQuery = supabaseQuery.gt('quantity_available', 0);
  if (ercs_only) supabaseQuery = supabaseQuery.eq('ercs_item', true);
  if (safety_only) supabaseQuery = supabaseQuery.eq('safety_item', true);

  supabaseQuery = supabaseQuery.order('part_number');

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logger.error('[Enterprise Materials] Search failed', { error });
    return res.status(500).json({ error: 'Failed to search materials', details: error.message });
  }

  return res.status(200).json({
    total: count || 0,
    results: data || [],
    has_more: (count || 0) > offset + limit,
  });
}));

/**
 * GET /api/v2/amro/enterprise/materials/:id/stock
 * Get stock levels for a part
 */
router.get('/materials/:id/stock', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('parts_inventory')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Material not found' });
  }

  return res.status(200).json({
    material_id: data.id,
    part_number: data.part_number,
    description: data.description,
    nsn: data.nsn,
    cage_code: data.cage_code,
    stock: {
      available: data.quantity_available || 0,
      on_hand: data.quantity_on_hand || 0,
      reserved: data.quantity_reserved || 0,
      reorder_level: data.reorder_level || 0,
      is_low_stock: (data.quantity_available || 0) <= (data.reorder_level || 0),
      is_out_of_stock: (data.quantity_available || 0) <= 0,
    },
    warehouse_location: data.warehouse_location,
    unit_cost: data.unit_cost,
    ercs_item: data.ercs_item || false,
    safety_item: data.safety_item || false,
    expiry_date: data.expiry_date,
  });
}));

/**
 * GET /api/v2/amro/enterprise/materials/shortages
 * Get shortage report
 */
router.get('/materials/shortages', asyncHandler(async (req: AuthRequest, res) => {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('parts_inventory')
    .select('*')
    .lte('quantity_available', 'reorder_level')
    .order('criticality', { ascending: false })
    .order('quantity_available', { ascending: true });

  if (error) {
    logger.error('[Enterprise Materials] Failed to get shortages', { error });
    return res.status(500).json({ error: 'Failed to retrieve shortages', details: error.message });
  }

  const shortages = (data || []).map((item: any) => ({
    inventory_id: item.id,
    part_number: item.part_number,
    description: item.description,
    quantity_required: item.reorder_level,
    quantity_available: item.quantity_available,
    shortage_quantity: (item.reorder_level || 0) - (item.quantity_available || 0),
    estimated_cost: ((item.reorder_level || 0) - (item.quantity_available || 0)) * (item.unit_cost || 0),
    lead_time_days: item.lead_time_days,
    criticality: item.criticality || 'medium',
    aog_impact: item.criticality === 'critical',
    ercs_item: item.ercs_item || false,
  }));

  return res.status(200).json({
    total_shortages: shortages.length,
    critical_count: shortages.filter((s: any) => s.criticality === 'critical').length,
    shortages,
  });
}));

/**
 * GET /api/v2/amro/enterprise/materials/analytics
 * Get materials analytics
 */
router.get('/materials/analytics', asyncHandler(async (req: AuthRequest, res) => {
  const supabase = getSupabaseAdminClient();

  const { data: parts, error } = await supabase
    .from('parts_inventory')
    .select('*');

  if (error) {
    logger.error('[Enterprise Materials] Failed to get analytics', { error });
    return res.status(500).json({ error: 'Failed to retrieve analytics', details: error.message });
  }

  const totalParts = parts?.length || 0;
  const totalValue = parts?.reduce((sum, p) => {
    return sum + ((p.quantity_on_hand || 0) * (p.unit_cost || 0));
  }, 0) || 0;
  
  const belowReorder = parts?.filter((p) => 
    (p.quantity_available || 0) <= (p.reorder_level || 0)
  ).length || 0;
  
  const outOfStock = parts?.filter((p) => 
    (p.quantity_available || 0) <= 0
  ).length || 0;

  const costByGroup: Record<string, number> = {};
  parts?.forEach((p: any) => {
    const group = p.material_group || 'unclassified';
    if (!costByGroup[group]) costByGroup[group] = 0;
    costByGroup[group] += (p.quantity_on_hand || 0) * (p.unit_cost || 0);
  });

  const expiryAlerts = parts
    ?.filter((p: any) => p.expiry_date && new Date(p.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
    .map((p: any) => ({
      inventory_id: p.id,
      part_number: p.part_number,
      description: p.description,
      expiry_date: p.expiry_date,
      days_until_expiry: Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      quantity: p.quantity_available,
    })) || [];

  return res.status(200).json({
    total_parts_in_use: totalParts,
    total_inventory_value: totalValue,
    parts_below_reorder_point: belowReorder,
    parts_out_of_stock: outOfStock,
    cost_by_material_group: costByGroup,
    ercs_items: parts?.filter((p: any) => p.ercs_item).length || 0,
    safety_items: parts?.filter((p: any) => p.safety_item).length || 0,
    expiry_alerts: expiryAlerts,
  });
}));

// ============================================================================
// TOOLING ENDPOINTS (new tables)
// ============================================================================

/**
 * POST /api/v2/amro/enterprise/tooling/search
 * Search tooling registry
 */
router.post('/tooling/search', asyncHandler(async (req: AuthRequest, res) => {
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
    .limit(limit)
    .offset(offset);

  if (query) {
    supabaseQuery = supabaseQuery.or(
      `tool_code.ilike.%${query}%,tool_name.ilike.%${query}%,manufacturer.ilike.%${query}%`
    );
  }

  if (tool_category) supabaseQuery = supabaseQuery.eq('tool_category', tool_category);
  if (tool_type) supabaseQuery = supabaseQuery.eq('tool_type', tool_type);
  if (calibration_required !== undefined) supabaseQuery = supabaseQuery.eq('calibration_required', calibration_required);

  supabaseQuery = supabaseQuery.order('tool_code');

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logger.error('[Enterprise Tooling] Search failed', { error });
    return res.status(500).json({ error: 'Failed to search tools', details: error.message });
  }

  return res.status(200).json({
    total: count || 0,
    results: data || [],
    has_more: (count || 0) > offset + limit,
  });
}));

/**
 * GET /api/v2/amro/enterprise/tooling/:id/availability
 * Check tool availability
 */
router.get('/tooling/:id/availability', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const supabase = getSupabaseAdminClient();

  const { data: tool, error: toolError } = await supabase
    .from('amro_tooling_registry')
    .select('*')
    .eq('id', id)
    .single();

  if (toolError || !tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  const { data: instances, error: instancesError } = await supabase
    .from('amro_tooling_instances')
    .select('*')
    .eq('tool_id', id)
    .eq('current_status', 'available')
    .eq('lifecycle_status', 'active');

  if (instancesError) {
    logger.error('[Enterprise Tooling] Failed to get instances', { error: instancesError });
    return res.status(500).json({ error: 'Failed to get tool instances', details: instancesError.message });
  }

  return res.status(200).json({
    tool_id: tool.id,
    tool_code: tool.tool_code,
    tool_name: tool.tool_name,
    quantity_available: instances?.length || 0,
    available_instances: instances || [],
    reservation_available: (instances?.length || 0) > 0,
  });
}));

/**
 * GET /api/v2/amro/enterprise/tooling/calibration-due
 * Get calibration due list
 */
router.get('/tooling/calibration-due', asyncHandler(async (req: AuthRequest, res) => {
  const supabase = getSupabaseAdminClient();
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const { data: instances, error } = await supabase
    .from('amro_tooling_instances')
    .select(`
      *,
      tool:amro_tooling_registry(*)
    `)
    .eq('lifecycle_status', 'active')
    .not('next_calibration_due', 'is', null);

  if (error) {
    logger.error('[Enterprise Tooling] Failed to get calibration due', { error });
    return res.status(500).json({ error: 'Failed to get calibration due list', details: error.message });
  }

  const overdue: any[] = [];
  const due_30_days: any[] = [];
  const due_60_days: any[] = [];
  const due_90_days: any[] = [];

  instances?.forEach((instance: any) => {
    const nextDue = new Date(instance.next_calibration_due);
    const item = {
      id: instance.id,
      tool_id: instance.tool_id,
      tool_code: instance.tool?.tool_code,
      tool_name: instance.tool?.tool_name,
      serial_number: instance.serial_number,
      next_calibration_due: instance.next_calibration_due,
      calibration_status: instance.calibration_status,
      location: instance.tool_crib_location,
    };

    if (nextDue < now) overdue.push(item);
    else if (nextDue <= thirtyDays) due_30_days.push(item);
    else if (nextDue <= sixtyDays) due_60_days.push(item);
    else if (nextDue <= ninetyDays) due_90_days.push(item);
  });

  return res.status(200).json({
    overdue,
    due_30_days,
    due_60_days,
    due_90_days,
    total_tools_requiring_calibration: overdue.length + due_30_days.length + due_60_days.length + due_90_days.length,
  });
}));

/**
 * GET /api/v2/amro/enterprise/tooling/analytics
 * Get tooling analytics
 */
router.get('/tooling/analytics', asyncHandler(async (req: AuthRequest, res) => {
  const supabase = getSupabaseAdminClient();

  const { data: tools, error } = await supabase
    .from('amro_tooling_registry')
    .select(`
      *,
      instances:amro_tooling_instances(*)
    `);

  if (error) {
    logger.error('[Enterprise Tooling] Failed to get analytics', { error });
    return res.status(500).json({ error: 'Failed to retrieve analytics', details: error.message });
  }

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let toolsAvailable = 0;
  let toolsInUse = 0;
  let calibrationOverdue = 0;
  let calibrationDue30Days = 0;

  tools?.forEach((tool: any) => {
    const instances = tool.instances || [];
    instances.forEach((instance: any) => {
      if (instance.current_status === 'available') toolsAvailable++;
      if (instance.current_status === 'in_use') toolsInUse++;
      
      const nextCal = instance.next_calibration_due ? new Date(instance.next_calibration_due) : null;
      if (nextCal && nextCal < now) calibrationOverdue++;
      if (nextCal && nextCal <= thirtyDays && nextCal >= now) calibrationDue30Days++;
    });
  });

  const costByCategory: Record<string, number> = {};
  tools?.forEach((t: any) => {
    const category = t.tool_category;
    if (!costByCategory[category]) costByCategory[category] = 0;
    costByCategory[category] += Number(t.purchase_cost) || 0;
  });

  return res.status(200).json({
    total_tools: tools?.length || 0,
    tools_available: toolsAvailable,
    tools_in_use: toolsInUse,
    calibration_overdue: calibrationOverdue,
    calibration_due_30_days: calibrationDue30Days,
    utilization_rate: tools?.length > 0 ? (toolsInUse / tools.length) * 100 : 0,
    cost_by_category: costByCategory,
  });
}));

// ============================================================================
// COMPLIANCE ENDPOINTS (new tables)
// ============================================================================

/**
 * GET /api/v2/amro/enterprise/compliance/ad-sb-feed
 * Get AD/SB regulatory feed
 */
router.get('/compliance/ad-sb-feed', asyncHandler(async (req: AuthRequest, res) => {
  const { directive_type, regulatory_authority, applicable_only } = req.query;

  const supabase = getSupabaseAdminClient();

  let supabaseQuery = supabase
    .from('amro_compliance_ad_sb_registry')
    .select('*')
    .order('compliance_deadline', { ascending: true });

  if (directive_type) supabaseQuery = supabaseQuery.eq('directive_type', directive_type);
  if (regulatory_authority) supabaseQuery = supabaseQuery.eq('regulatory_authority', regulatory_authority);
  if (applicable_only === 'true') supabaseQuery = supabaseQuery.eq('applicable_to_fleet', true);

  const { data, error } = await supabaseQuery;

  if (error) {
    logger.error('[Enterprise Compliance] AD/SB feed failed', { error });
    return res.status(500).json({ error: 'Failed to retrieve AD/SB feed', details: error.message });
  }

  return res.status(200).json({
    total: data?.length || 0,
    directives: data || [],
    last_updated: new Date().toISOString(),
  });
}));

/**
 * GET /api/v2/amro/enterprise/compliance/fleet-status
 * Get fleet compliance status
 */
router.get('/compliance/fleet-status', asyncHandler(async (req: AuthRequest, res) => {
  const supabase = getSupabaseAdminClient();

  const { data: requirements, error } = await supabase
    .from('amro_compliance_requirements_enhanced')
    .select('*');

  if (error) {
    logger.error('[Enterprise Compliance] Fleet status failed', { error });
    return res.status(500).json({ error: 'Failed to retrieve fleet status', details: error.message });
  }

  const totalRequirements = requirements?.length || 0;
  const complied = requirements?.filter((r: any) => r.compliance_status === 'complied').length || 0;
  const inProgress = requirements?.filter((r: any) => r.compliance_status === 'in_progress').length || 0;
  const notStarted = requirements?.filter((r: any) => r.compliance_status === 'not_started').length || 0;
  const exempted = requirements?.filter((r: any) => r.compliance_status === 'exempted').length || 0;

  const now = new Date();
  const overdue = requirements?.filter((r: any) => {
    if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
    return new Date(r.compliance_deadline) < now;
  }).length || 0;

  const compliancePercentage = totalRequirements > 0 ? (complied / totalRequirements) * 100 : 0;

  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = requirements
    ?.filter((r: any) => {
      if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
      const deadline = new Date(r.compliance_deadline);
      return deadline >= now && deadline <= ninetyDays;
    })
    .map((r: any) => ({
      requirement_code: r.requirement_code,
      directive_number: r.directive_number,
      compliance_deadline: r.compliance_deadline,
      days_remaining: Math.ceil((new Date(r.compliance_deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      severity_level: r.severity_level,
      aircraft_model: r.aircraft_model,
    }))
    .sort((a: any, b: any) => a.days_remaining - b.days_remaining)
    .slice(0, 20);

  return res.status(200).json({
    total_requirements: totalRequirements,
    complied,
    in_progress: inProgress,
    not_started: notStarted,
    overdue,
    exempted,
    compliance_percentage: Math.round(compliancePercentage * 100) / 100,
    upcoming_deadlines: upcomingDeadlines,
  });
}));

/**
 * GET /api/v2/amro/enterprise/compliance/analytics
 * Get compliance analytics
 */
router.get('/compliance/analytics', asyncHandler(async (req: AuthRequest, res) => {
  const supabase = getSupabaseAdminClient();

  const { data: requirements, error } = await supabase
    .from('amro_compliance_requirements_enhanced')
    .select('*');

  if (error) {
    logger.error('[Enterprise Compliance] Analytics failed', { error });
    return res.status(500).json({ error: 'Failed to retrieve analytics', details: error.message });
  }

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const totalRequirements = requirements?.length || 0;
  const complied = requirements?.filter((r: any) => r.compliance_status === 'complied').length || 0;
  
  const overdue = requirements?.filter((r: any) => {
    if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
    return new Date(r.compliance_deadline) < now;
  }).length || 0;

  const due30Days = requirements?.filter((r: any) => {
    if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
    const deadline = new Date(r.compliance_deadline);
    return deadline >= now && deadline <= thirtyDays;
  }).length || 0;

  const due60Days = requirements?.filter((r: any) => {
    if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
    const deadline = new Date(r.compliance_deadline);
    return deadline > thirtyDays && deadline <= sixtyDays;
  }).length || 0;

  const due90Days = requirements?.filter((r: any) => {
    if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
    const deadline = new Date(r.compliance_deadline);
    return deadline > sixtyDays && deadline <= ninetyDays;
  }).length || 0;

  const fleetCompliancePercentage = totalRequirements > 0 ? (complied / totalRequirements) * 100 : 0;

  const requirementsByType: Record<string, number> = {};
  requirements?.forEach((r: any) => {
    const type = r.requirement_type;
    if (!requirementsByType[type]) requirementsByType[type] = 0;
    requirementsByType[type]++;
  });

  const requirementsByAuthority: Record<string, number> = {};
  requirements?.forEach((r: any) => {
    const authority = r.regulatory_authority;
    if (!requirementsByAuthority[authority]) requirementsByAuthority[authority] = 0;
    requirementsByAuthority[authority]++;
  });

  const requirementsBySeverity: Record<string, number> = {};
  requirements?.forEach((r: any) => {
    const severity = r.severity_level;
    if (!requirementsBySeverity[severity]) requirementsBySeverity[severity] = 0;
    requirementsBySeverity[severity]++;
  });

  return res.status(200).json({
    fleet_compliance_percentage: Math.round(fleetCompliancePercentage * 100) / 100,
    overdue_requirements: overdue,
    due_30_days: due30Days,
    due_60_days: due60Days,
    due_90_days: due90Days,
    requirements_by_type: requirementsByType,
    requirements_by_authority: requirementsByAuthority,
    requirements_by_severity: requirementsBySeverity,
    exemptions_active: requirements?.filter((r: any) => r.exemption_info?.exemption_granted).length || 0,
  });
}));

// ============================================================================
// EXPORT ROUTER
// ============================================================================

export default router;
