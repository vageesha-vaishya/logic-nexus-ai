
import { supabase } from '@/integrations/supabase/client';

export interface ServiceCategory {
  id: string;
  domain_id: string;
  code: string;
  name: string;
  description: string | null;
  icon_name: string | null;
  display_order: number;
  is_active: boolean;
}

export interface ServiceType {
  id: string;
  category_id: string | null;
  mode_id: string | null;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export const ServiceArchitectureService = {
  /**
   * Get all categories for a specific domain
   */
  async getCategoriesByDomain(domainId: string): Promise<ServiceCategory[]> {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('domain_id', domainId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data as ServiceCategory[];
  },

  /**
   * Get all service types for a specific category
   */
  async getTypesByCategory(categoryId: string): Promise<ServiceType[]> {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('category_id', categoryId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data as ServiceType[];
  },

  /**
   * Create a new category
   */
  async createCategory(category: Omit<ServiceCategory, 'id'>): Promise<ServiceCategory> {
    const { data, error } = await supabase
      .from('service_categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data as ServiceCategory;
  },

  /**
   * Update a category
   */
  async updateCategory(id: string, updates: Partial<ServiceCategory>): Promise<ServiceCategory> {
    const { data, error } = await supabase
      .from('service_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ServiceCategory;
  },

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('service_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Create a new service type
   */
  async createType(type: Omit<ServiceType, 'id'>): Promise<ServiceType> {
    const { data, error } = await supabase
      .from('service_types')
      .insert(type)
      .select()
      .single();

    if (error) throw error;
    return data as ServiceType;
  },

  /**
   * Update a service type
   */
  async updateType(id: string, updates: Partial<ServiceType>): Promise<ServiceType> {
    const { data, error } = await supabase
      .from('service_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ServiceType;
  },

  /**
   * Delete a service type
   */
  async deleteType(id: string): Promise<void> {
    const { error } = await supabase
      .from('service_types')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get all services linked to a specific service type
   */
  async getServicesByType(typeId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('services')
      .select('id, service_name, service_code, is_active, base_price, pricing_unit, tenant_id')
      .eq('service_type_id', typeId)
      .order('service_name', { ascending: true });

    if (error) throw error;
    return data || [];
  }
};
