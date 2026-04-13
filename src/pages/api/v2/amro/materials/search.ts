/**
 * AMRO Materials Search API
 * POST /api/v2/amro/materials/search
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { logger } from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      .select('*', { count: 'exact' })
      .limit(limit)
      .offset(offset);

    // Full-text search
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
      logger.error('[Materials API] Search failed', { error });
      return res.status(500).json({ error: 'Failed to search materials', details: error.message });
    }

    return res.status(200).json({
      total: count || 0,
      results: data || [],
      has_more: (count || 0) > offset + limit,
    });
  } catch (err: any) {
    logger.error('[Materials API] Unexpected error', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
