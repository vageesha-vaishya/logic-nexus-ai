import { createClient } from '@supabase/supabase-js';

// Assuming you have a supabase client exported from here, or we use a generic one if not found.
// Based on previous tool usage, likely src/lib/supabase.ts exists.
import { supabase } from '@/integrations/supabase/client'; 

export interface AccountData {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  industry?: string;
  website?: string;
  billing_address?: any;
  shipping_address?: any;
  created_by?: string;
  [key: string]: any;
}

export interface ContactData {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  mobile?: string;
  title?: string;
  created_by?: string;
  [key: string]: any;
}

export interface AssignmentResult {
  success: boolean;
  tenant_id: string;
  franchise_id: string;
  account_id: string;
  contact_id: string;
  message: string;
}

/**
 * Assigns an Account and Contact to a Franchisee within a Tenant.
 * Uses a database transaction (RPC) to ensure data integrity.
 */
export async function assignAccountContactToFranchise(
  tenantId: string,
  franchiseId: string,
  accountData: AccountData,
  contactData: ContactData
): Promise<AssignmentResult> {
  // Cast until types regenerate
  const { data, error } = await (supabase as any).rpc('assign_franchisee_account_contact', {
    p_tenant_id: tenantId,
    p_franchise_id: franchiseId,
    p_account_data: accountData,
    p_contact_data: contactData
  });

  if (error) {
    console.error('Error assigning franchisee data:', error);
    throw new Error(error.message);
  }

  return data as AssignmentResult;
}

/**
 * Verifies that the records are correctly linked to the franchisee and each other.
 */
export async function verifyAssignment(
  accountId: string, 
  contactId: string, 
  franchiseId: string,
  tenantId: string
): Promise<{
  accountValid: boolean;
  contactValid: boolean;
  relationshipValid: boolean;
  details: any;
}> {
  // Check Account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, tenant_id, franchise_id, name')
    .eq('id', accountId)
    .single();

  if (accountError) throw new Error(`Account verification failed: ${accountError.message}`);

  // Check Contact
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('id, tenant_id, franchise_id, account_id, email')
    .eq('id', contactId)
    .single();

  if (contactError) throw new Error(`Contact verification failed: ${contactError.message}`);

  const accountValid = account.franchise_id === franchiseId && account.tenant_id === tenantId;
  const contactValid = contact.franchise_id === franchiseId && contact.tenant_id === tenantId;
  const relationshipValid = contact.account_id === accountId;

  return {
    accountValid,
    contactValid,
    relationshipValid,
    details: {
      account: {
        matchesFranchise: account.franchise_id === franchiseId,
        matchesTenant: account.tenant_id === tenantId
      },
      contact: {
        matchesFranchise: contact.franchise_id === franchiseId,
        matchesTenant: contact.tenant_id === tenantId,
        linkedToAccount: contact.account_id === accountId
      }
    }
  };
}
