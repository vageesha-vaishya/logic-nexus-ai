import { ScopedDataAccess } from '@/lib/db/access';
import { Database } from '@/integrations/supabase/types';

export type PortLocation = Database['public']['Tables']['ports_locations']['Row'];
export type PortLocationInsert = Database['public']['Tables']['ports_locations']['Insert'];
export type PortLocationUpdate = Database['public']['Tables']['ports_locations']['Update'];

/**
 * Service for managing global port locations.
 * This service enforces global access patterns, ensuring ports are available
 * independent of tenant or franchise context.
 */
export class PortsService {
  constructor(private db: ScopedDataAccess) {}

  /**
   * Fetch all port locations.
   * Uses global scope bypass to ensure visibility across all contexts.
   */
  async getAllPorts(): Promise<PortLocation[]> {
    console.log('[PortsService] Fetching all ports (global scope)...');
    try {
      // Use raw client to ensure no scoping interference for this global table
      const { data, error } = await this.db.client
        .from('ports_locations')
        .select('id, location_name, location_code, country, is_active')
        .order('location_name');

      if (error) {
        console.error('[PortsService] Error fetching ports:', error);
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      const active = rows.filter((p: any) => p.is_active !== false);

      console.log(`[PortsService] Fetched ${active.length} ports.`);
      return active as any[];
    } catch (e: any) {
      console.error('[PortsService] Exception during ports fetch:', e?.message || e);
      return [];
    }
  }

  /**
   * Get a single port by ID.
   */
  async getPortById(id: string): Promise<PortLocation | null> {
    const { data, error } = await this.db.from('ports_locations', true)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching port ${id}:`, error);
      throw error;
    }

    return data;
  }

  /**
   * Create a new port location.
   * Enforces global context by removing tenant/franchise scope.
   */
  async createPort(port: PortLocationInsert): Promise<PortLocation> {
    // Ensure no scoping fields are set
    const { tenant_id, franchise_id, ...cleanPort } = port as any;
    
    const { data, error } = await this.db.from('ports_locations', true)
      .insert(cleanPort)
      .select()
      .single();

    if (error) {
      console.error('Error creating port:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update an existing port location.
   */
  async updatePort(id: string, updates: PortLocationUpdate): Promise<PortLocation> {
    // Ensure no scoping fields are set
    const { tenant_id, franchise_id, ...cleanUpdates } = updates as any;

    const { data, error } = await this.db.from('ports_locations', true)
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating port ${id}:`, error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a port location.
   */
  async deletePort(id: string): Promise<void> {
    const { error } = await this.db.from('ports_locations', true)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting port ${id}:`, error);
      throw error;
    }
  }
}
