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
      // Use scopedDb with global flag to ensure consistent access pattern
      // Select all necessary fields for LocationSelect and increase limit to ensure we get all ports
      const { data, error } = await this.db.from('ports_locations', true)
        .select('id, location_name, location_code, country, city, location_type, is_active')
        .order('location_name')
        .limit(5000);

      if (error) {
        console.error('[PortsService] Error fetching ports:', error);
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      const active = rows.filter((p: PortLocation) => p.is_active !== false);

      console.log(`[PortsService] Fetched ${active.length} ports.`);
      return active;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[PortsService] Exception during ports fetch:', message);
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
    const { ...cleanPort } = port;
    if ('tenant_id' in cleanPort) delete (cleanPort as Record<string, unknown>)['tenant_id'];
    if ('franchise_id' in cleanPort) delete (cleanPort as Record<string, unknown>)['franchise_id'];
    
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
    const { ...cleanUpdates } = updates;
    if ('tenant_id' in cleanUpdates) delete (cleanUpdates as Record<string, unknown>)['tenant_id'];
    if ('franchise_id' in cleanUpdates) delete (cleanUpdates as Record<string, unknown>)['franchise_id'];

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
