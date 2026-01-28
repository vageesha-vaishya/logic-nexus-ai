
import { supabase } from '@/integrations/supabase/client';

export interface PlatformDomain {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

let domainCache: PlatformDomain[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const DomainService = {
  /**
   * Fetches all platform domains with in-memory caching.
   * Useful for dropdowns and type validation.
   */
  async getAllDomains(forceRefresh = false): Promise<PlatformDomain[]> {
    const now = Date.now();
    
    if (!forceRefresh && domainCache && (now - cacheTimestamp < CACHE_TTL)) {
      return domainCache;
    }

    const { data, error } = await supabase
      .from('platform_domains')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching domains:', error);
      throw error;
    }

    domainCache = (data || []) as PlatformDomain[];
    cacheTimestamp = now;
    return domainCache;
  },

  /**
   * Gets a single domain by code (e.g., 'LOGISTICS').
   * Uses cached data if available.
   */
  async getDomainByCode(code: string): Promise<PlatformDomain | undefined> {
    const domains = await this.getAllDomains();
    return domains.find(d => d.code === code);
  },

  /**
   * Creates a new domain.
   */
  async createDomain(domain: Omit<PlatformDomain, 'id' | 'created_at' | 'updated_at'>): Promise<PlatformDomain> {
    // Check for duplicate code
    const existing = await this.getDomainByCode(domain.code);
    if (existing) {
      throw new Error(`Domain with code "${domain.code}" already exists.`);
    }

    const { data, error } = await supabase
      .from('platform_domains')
      .insert(domain)
      .select()
      .single();

    if (error) throw error;
    this.invalidateCache();
    return data;
  },

  /**
   * Updates an existing domain.
   */
  async updateDomain(id: string, updates: Partial<PlatformDomain>): Promise<PlatformDomain> {
    // Check for duplicate code if code is being updated
    if (updates.code) {
      const existing = await this.getDomainByCode(updates.code);
      if (existing && existing.id !== id) {
        throw new Error(`Domain with code "${updates.code}" already exists.`);
      }
    }

    const { data, error } = await supabase
      .from('platform_domains')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    this.invalidateCache();
    return data;
  },

  /**
   * Deletes a domain.
   */
  async deleteDomain(id: string): Promise<void> {
    const { error } = await supabase
      .from('platform_domains')
      .delete()
      .eq('id', id);

    if (error) throw error;
    this.invalidateCache();
  },

  /**
   * Invalidates the cache. Call this after mutations.
   */
  invalidateCache() {
    domainCache = null;
    cacheTimestamp = 0;
  }
};
