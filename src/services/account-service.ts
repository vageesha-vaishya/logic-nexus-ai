import { SupabaseClient } from '@supabase/supabase-js';
import { AccountInput, AccountValidationService } from '../lib/account-validation';

export class AccountService {
  constructor(private supabase: SupabaseClient) {}

  async createOrUpdateAccount(accountData: AccountInput, tenantId: string, accountId?: string) {
    // 1. Validate Input (Client-Side)
    const validation = AccountValidationService.validate(accountData);
    if (!validation.success) {
      throw new Error(`Validation Failed: ${validation.error?.message}`);
    }

    const { name, tax_id, billing_address, shipping_address, primary_contact, references, notes, website, email, phone } = validation.data!;

    // 2. Call RPC (Database-Side Logic & Transactions)
    const { data, error } = await this.supabase.rpc('manage_account', {
      p_account_id: accountId || null,
      p_tenant_id: tenantId,
      p_name: name,
      p_tax_id: tax_id ? AccountValidationService.formatTaxId(tax_id) : null,
      p_website: website || null,
      p_account_email: email || null,
      p_account_phone: phone || null,
      p_billing_address: billing_address || null,
      p_shipping_address: shipping_address || null,
      p_contact_data: primary_contact || null,
      p_references: references || null,
      p_notes: notes || null,
    });

    if (error) {
      // Handle known RPC errors (Duplicate Tax ID, Name)
      if (error.message.includes('Duplicate Account')) {
        throw new Error(`Conflict: ${error.message}`);
      }
      throw error;
    }

    return data;
  }

  async getAccountWithDetails(accountId: string) {
    const { data, error } = await this.supabase
      .from('accounts')
      .select(`
        *,
        contacts(*),
        account_references(*),
        account_notes(*)
      `)
      .eq('id', accountId)
      .single();

    if (error) throw error;
    return data;
  }
}
