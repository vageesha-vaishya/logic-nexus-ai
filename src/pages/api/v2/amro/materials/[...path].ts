/**
 * AMRO Enterprise Materials API
 * 
 * IMPORTANT: This API INTEGRATES WITH EXISTING parts_inventory system.
 * It does NOT use duplicate tables.
 * 
 * Existing tables used:
 * - parts_inventory (enhanced with aviation fields)
 * - amro_item_master (item definitions)
 * - reservations (part reservations for work packages)
 * - amro_purchase_orders (procurement)
 * - suppliers (supplier master data)
 * 
 * @module pages/api/v2/amro/materials
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
 * POST /api/v2/amro/materials/search
 * Search parts inventory with enterprise aviation filters
 */
async function handleSearch(req: ApiRequest, res: ApiResponse, tenantId: string) {
  try {
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
      .select(`
        *,
        item_master:amro_item_master(*),
        supplier:suppliers(*)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .limit(limit)
      .offset(offset);

    // Full-text search on part_number, description, and nomenclature
    if (query) {
      supabaseQuery = supabaseQuery.or(
        `part_number.ilike.%${query}%,description.ilike.%${query}%,nomenclature.ilike.%${query}%`
      );
    }

    // Aviation-specific filters
    if (ata_chapter) {
      supabaseQuery = supabaseQuery.eq('ata_chapter', ata_chapter);
    }
    if (material_group) {
      supabaseQuery = supabaseQuery.eq('material_group', material_group);
    }
    if (warehouse_location) {
      supabaseQuery = supabaseQuery.eq('warehouse_location', warehouse_location);
    }
    if (in_stock_only) {
      supabaseQuery = supabaseQuery.gt('quantity_available', 0);
    }
    if (ercs_only) {
      supabaseQuery = supabaseQuery.eq('ercs_item', true);
    }
    if (safety_only) {
      supabaseQuery = supabaseQuery.eq('safety_item', true);
    }

    supabaseQuery = supabaseQuery.order('part_number');

    const { data, error, count } = await supabaseQuery;

    if (error) {
      logger.error('[Materials API] Search failed', { error, tenantId });
      return sendError(res, 500, 'Failed to search materials', error.message);
    }

    // Transform response to match enterprise format
    const results = (data || []).map((item: any) => ({
      id: item.id,
      part_number: item.part_number,
      description: item.description,
      nomenclature: item.nomenclature,
      nsn: item.nsn,
      cage_code: item.cage_code,
      ata_chapter: item.ata_chapter,
      material_group: item.material_group || 'consumable',
      quantity_available: item.quantity_available,
      quantity_on_hand: item.quantity_on_hand,
      quantity_reserved: item.quantity_reserved,
      reorder_level: item.reorder_level,
      warehouse_location: item.warehouse_location,
      unit_cost: item.unit_cost,
      currency: 'USD',
      total_cost: item.unit_cost * (item.quantity_on_hand || 0),
      supplier: item.supplier,
      item_master: item.item_master,
      ercs_item: item.ercs_item || false,
      safety_item: item.safety_item || false,
      certification_type: item.certification_type,
      shelf_life_days: item.shelf_life_days,
      expiry_date: item.expiry_date,
      criticality: item.criticality,
    }));

    return sendJson(res, 200, {
      total: count || 0,
      results,
      has_more: (count || 0) > offset + limit,
      limit,
      offset,
    });
  } catch (err: any) {
    logger.error('[Materials API] Unexpected error in search', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * GET /api/v2/amro/materials/:id/stock
 * Get stock levels for a specific part
 */
async function handleGetStock(req: ApiRequest, res: ApiResponse, tenantId: string, materialId: string) {
  try {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('parts_inventory')
      .select(`
        *,
        item_master:amro_item_master(*),
        supplier:suppliers(*)
      `)
      .eq('id', materialId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      return sendError(res, 404, 'Material not found');
    }

    const quantityAvailable = Number(data.quantity_available) || 0;
    const quantityOnHand = Number(data.quantity_on_hand) || 0;
    const quantityReserved = Number(data.quantity_reserved) || 0;
    const reorderLevel = Number(data.reorder_level) || 0;

    return sendJson(res, 200, {
      material_id: data.id,
      part_number: data.part_number,
      description: data.description,
      nsn: data.nsn,
      cage_code: data.cage_code,
      stock: {
        available: quantityAvailable,
        on_hand: quantityOnHand,
        reserved: quantityReserved,
        reorder_level: reorderLevel,
        is_low_stock: quantityAvailable <= reorderLevel,
        is_out_of_stock: quantityAvailable <= 0,
      },
      warehouse_location: data.warehouse_location,
      unit_cost: data.unit_cost,
      currency: 'USD',
      supplier: data.supplier,
      ercs_item: data.ercs_item || false,
      safety_item: data.safety_item || false,
      expiry_date: data.expiry_date,
    });
  } catch (err: any) {
    logger.error('[Materials API] Unexpected error in getStock', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * POST /api/v2/amro/materials/:id/reserve
 * Reserve materials for a work package (uses existing reservations table)
 */
async function handleReserve(req: ApiRequest, res: ApiResponse, tenantId: string, materialId: string, userId: string) {
  try {
    const {
      quantity,
      work_package_id,
      task_id,
      notes,
    } = req.body || {};

    if (!quantity || quantity <= 0) {
      return sendError(res, 400, 'Invalid quantity', 'Quantity must be a positive number');
    }

    if (!work_package_id && !task_id) {
      return sendError(res, 400, 'Missing reference', 'work_package_id or task_id is required');
    }

    const supabase = getSupabaseAdminClient();

    // Check current stock
    const { data: material, error: fetchError } = await supabase
      .from('parts_inventory')
      .select('*')
      .eq('id', materialId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !material) {
      return sendError(res, 404, 'Material not found');
    }

    const quantityAvailable = Number(material.quantity_available) || 0;

    if (quantity > quantityAvailable) {
      return sendError(res, 400, 'Insufficient stock', {
        requested: quantity,
        available: quantityAvailable,
      });
    }

    // Create reservation using existing reservations table
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert({
        tenant_id: tenantId,
        inventory_id: materialId,
        work_package_id,
        task_id,
        reserved_quantity: quantity,
        status: 'confirmed',
        reserved_by: userId,
        notes,
      })
      .select()
      .single();

    if (reservationError) {
      logger.error('[Materials API] Failed to create reservation', { error: reservationError });
      return sendError(res, 500, 'Failed to create reservation', reservationError.message);
    }

    logger.info('[Materials API] Reservation created', {
      materialId,
      quantity,
      reservationId: reservation.id,
      userId,
      work_package_id,
    });

    return sendJson(res, 201, {
      reservation,
      message: 'Material reserved successfully',
    });
  } catch (err: any) {
    logger.error('[Materials API] Unexpected error in reserve', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * POST /api/v2/amro/materials/purchase-order
 * Generate purchase order (uses existing amro_purchase_orders)
 */
async function handlePurchaseOrder(req: ApiRequest, res: ApiResponse, tenantId: string, userId: string) {
  try {
    const {
      materials,
      work_package_id,
      supplier_id,
      priority = 'standard',
      notes,
    } = req.body || {};

    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return sendError(res, 400, 'Invalid materials', 'Materials array is required');
    }

    if (!supplier_id) {
      return sendError(res, 400, 'Missing supplier', 'supplier_id is required');
    }

    const supabase = getSupabaseAdminClient();

    // Generate PO number
    const poNumber = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    let subtotal = 0;
    const poItems = [];

    // Build PO items and calculate costs
    for (const mat of materials) {
      const { data: material } = await supabase
        .from('parts_inventory')
        .select('*')
        .eq('id', mat.inventory_id || mat.id)
        .eq('tenant_id', tenantId)
        .single();

      if (!material) {
        return sendError(res, 404, `Material not found: ${mat.inventory_id || mat.id}`);
      }

      const unitPrice = Number(material.unit_cost) || mat.unit_price || 0;
      const lineTotal = unitPrice * mat.quantity;
      subtotal += lineTotal;

      poItems.push({
        part_inventory_id: material.id,
        quantity_ordered: mat.quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        notes: mat.notes,
      });
    }

    // Create purchase order using existing amro_purchase_orders table
    const { data: po, error: poError } = await supabase
      .from('amro_purchase_orders')
      .insert({
        tenant_id: tenantId,
        po_number: poNumber,
        supplier_id,
        status: 'draft',
        total_amount: subtotal,
        currency: 'USD',
        work_package_id,
        notes,
        created_by: userId,
        metadata: { priority },
      })
      .select()
      .single();

    if (poError) {
      logger.error('[Materials API] Failed to create PO', { error: poError });
      return sendError(res, 500, 'Failed to create purchase order', poError.message);
    }

    // Create PO items
    const itemsToInsert = poItems.map((item) => ({
      tenant_id: tenantId,
      purchase_order_id: po.id,
      ...item,
    }));

    const { error: itemsError } = await supabase
      .from('amro_purchase_order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      logger.error('[Materials API] Failed to create PO items', { error: itemsError });
      // PO created but items failed - needs manual review
    }

    logger.info('[Materials API] Purchase order created', {
      poNumber,
      totalAmount: subtotal,
      userId,
    });

    return sendJson(res, 201, {
      purchase_order: po,
      items_count: poItems.length,
      message: 'Purchase order created successfully',
    });
  } catch (err: any) {
    logger.error('[Materials API] Unexpected error in purchase order', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * GET /api/v2/amro/materials/shortages
 * Get shortage report (uses existing parts_inventory and aog_alerts)
 */
async function handleShortages(req: ApiRequest, res: ApiResponse, tenantId: string) {
  try {
    const supabase = getSupabaseAdminClient();

    // Get parts below reorder level
    const { data: lowStockParts, error } = await supabase
      .from('parts_inventory')
      .select(`
        *,
        supplier:suppliers(*)
      `)
      .eq('tenant_id', tenantId)
      .lte('quantity_available', 'reorder_level')
      .order('criticality', { ascending: false })
      .order('quantity_available', { ascending: true });

    if (error) {
      logger.error('[Materials API] Failed to get shortages', { error });
      return sendError(res, 500, 'Failed to retrieve shortage report', error.message);
    }

    const shortages = (lowStockParts || []).map((item: any) => ({
      inventory_id: item.id,
      part_number: item.part_number,
      description: item.description,
      quantity_required: item.reorder_level,
      quantity_available: item.quantity_available,
      shortage_quantity: item.reorder_level - item.quantity_available,
      estimated_cost: (item.reorder_level - item.quantity_available) * Number(item.unit_cost),
      supplier: item.supplier,
      lead_time_days: item.lead_time_days,
      criticality: item.criticality || 'medium',
      aog_impact: item.criticality === 'critical',
      ercs_item: item.ercs_item || false,
    }));

    return sendJson(res, 200, {
      total_shortages: shortages.length,
      critical_count: shortages.filter((s: any) => s.criticality === 'critical').length,
      shortages,
    });
  } catch (err: any) {
    logger.error('[Materials API] Unexpected error in shortages', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * GET /api/v2/amro/materials/analytics
 * Get materials analytics dashboard data
 */
async function handleAnalytics(req: ApiRequest, res: ApiResponse, tenantId: string) {
  try {
    const supabase = getSupabaseAdminClient();

    // Get all parts for tenant
    const { data: parts, error } = await supabase
      .from('parts_inventory')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      logger.error('[Materials API] Failed to get analytics data', { error });
      return sendError(res, 500, 'Failed to retrieve analytics', error.message);
    }

    // Calculate analytics
    const totalParts = parts?.length || 0;
    const totalValue = parts?.reduce((sum, p) => {
      const qty = Number(p.quantity_on_hand) || 0;
      const cost = Number(p.unit_cost) || 0;
      return sum + (qty * cost);
    }, 0) || 0;
    
    const belowReorder = parts?.filter((p) => 
      Number(p.quantity_available) <= Number(p.reorder_level)
    ).length || 0;
    
    const outOfStock = parts?.filter((p) => 
      Number(p.quantity_available) <= 0
    ).length || 0;
    
    const avgLeadTime = parts?.length
      ? parts.reduce((sum, p) => sum + (Number(p.lead_time_days) || 14), 0) / parts.length
      : 0;

    // Cost by material group
    const costByGroup: Record<string, number> = {};
    parts?.forEach((p) => {
      const group = p.material_group || 'unclassified';
      if (!costByGroup[group]) costByGroup[group] = 0;
      costByGroup[group] += (Number(p.quantity_on_hand) || 0) * (Number(p.unit_cost) || 0);
    });

    // ERCs and safety items
    const ercsItems = parts?.filter((p) => p.ercs_item).length || 0;
    const safetyItems = parts?.filter((p) => p.safety_item).length || 0;

    // Expiry alerts
    const expiryAlerts = parts
      ?.filter((p) => p.expiry_date && new Date(p.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      .map((p) => ({
        inventory_id: p.id,
        part_number: p.part_number,
        description: p.description,
        expiry_date: p.expiry_date,
        days_until_expiry: Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        quantity: p.quantity_available,
      })) || [];

    return sendJson(res, 200, {
      total_parts_in_use: totalParts,
      total_inventory_value: totalValue,
      parts_below_reorder_point: belowReorder,
      parts_out_of_stock: outOfStock,
      average_lead_time_days: Math.round(avgLeadTime),
      cost_by_material_group: costByGroup,
      ercs_items: ercsItems,
      safety_items: safetyItems,
      expiry_alerts: expiryAlerts,
    });
  } catch (err: any) {
    logger.error('[Materials API] Unexpected error in analytics', { error: err.message });
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
    
    // Pattern: /api/v2/amro/materials/search
    if (pathSegments[0] === 'search' && method === 'POST') {
      return await handleSearch(req, res, tenantId);
    }

    // Pattern: /api/v2/amro/materials/:id/stock
    if (pathSegments[1] === 'stock' && method === 'GET') {
      return await handleGetStock(req, res, tenantId, pathSegments[0]);
    }

    // Pattern: /api/v2/amro/materials/:id/reserve
    if (pathSegments[1] === 'reserve' && method === 'POST') {
      return await handleReserve(req, res, tenantId, pathSegments[0], userId);
    }

    // Pattern: /api/v2/amro/materials/purchase-order
    if (pathSegments[0] === 'purchase-order' && method === 'POST') {
      return await handlePurchaseOrder(req, res, tenantId, userId);
    }

    // Pattern: /api/v2/amro/materials/shortages
    if (pathSegments[0] === 'shortages' && method === 'GET') {
      return await handleShortages(req, res, tenantId);
    }

    // Pattern: /api/v2/amro/materials/analytics
    if (pathSegments[0] === 'analytics' && method === 'GET') {
      return await handleAnalytics(req, res, tenantId);
    }

    return sendError(res, 404, 'Not found', 'Invalid endpoint');
  } catch (err: any) {
    logger.error('[Materials API] Unhandled error', { error: err.message, stack: err.stack });
    return sendError(res, 500, 'Internal server error');
  }
}
