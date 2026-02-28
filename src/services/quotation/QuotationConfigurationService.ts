import { SupabaseClient } from '@supabase/supabase-js';

export interface QuotationConfiguration {
  id: string;
  tenant_id: string;
  default_module: 'composer' | 'legacy' | 'smart';
  smart_mode_enabled: boolean;
  smart_mode_settings: Record<string, any>;
  multi_option_enabled: boolean;
  auto_ranking_criteria: Record<string, number>;
}

export class QuotationConfigurationService {
  constructor(private db: any) {}

  /**
   * Get the quotation configuration for the current tenant.
   * If not found, creates a default one.
   */
  async getConfiguration(tenantId: string): Promise<QuotationConfiguration> {
    const { data, error } = await this.db
      .from('quotation_configuration')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // Create default if missing
      return this.createDefaultConfiguration(tenantId);
    }

    return data;
  }

  /**
   * Update the quotation configuration.
   */
  async updateConfiguration(tenantId: string, updates: Partial<QuotationConfiguration>): Promise<QuotationConfiguration> {
    const { data, error } = await this.db
      .from('quotation_configuration')
      .update(updates)
      .eq('tenant_id', tenantId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Configuration not found');
    return data[0];
  }

  /**
   * Toggle Smart Quote Mode for a specific user session preference.
   * Note: This updates the user profile, not the tenant config.
   */
  async setUserSmartModePreference(userId: string, enabled: boolean): Promise<void> {
    const { data: profile } = await this.db
      .from('profiles')
      .select('quotation_preferences')
      .eq('id', userId)
      .single();

    const preferences = profile?.quotation_preferences || {};
    preferences.smart_mode_active = enabled;

    const { error } = await this.db
      .from('profiles')
      .update({ quotation_preferences: preferences })
      .eq('id', userId);

    if (error) throw error;
  }

  /**
   * Create default configuration (Composer as default).
   */
  private async createDefaultConfiguration(tenantId: string): Promise<QuotationConfiguration> {
    const { data, error } = await this.db
      .from('quotation_configuration')
      .insert({
        tenant_id: tenantId,
        default_module: 'composer',
        smart_mode_enabled: false,
        multi_option_enabled: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
