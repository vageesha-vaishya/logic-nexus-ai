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
    const { data, error } = await this.db.from('ports_locations', true)
      .select('*')
      .order('location_name');
      
    if (error) {
      console.error('Error fetching ports:', error);
      throw error;
    }
    
    return data || [];
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
