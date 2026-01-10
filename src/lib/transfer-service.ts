import { supabase } from '@/integrations/supabase/client';

export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
export type TransferType = 'tenant_to_tenant' | 'tenant_to_franchise' | 'franchise_to_franchise';
export type TransferEntityType = 'lead' | 'opportunity' | 'quote' | 'shipment' | 'account' | 'contact' | 'activity';

export interface EntityTransfer {
  id: string;
  source_tenant_id: string;
  source_franchise_id?: string;
  target_tenant_id: string;
  target_franchise_id?: string;
  transfer_type: TransferType;
  status: TransferStatus;
  requested_by: string;
  approved_by?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  items?: EntityTransferItem[];
}

export interface EntityTransferItem {
  id: string;
  transfer_id: string;
  entity_type: TransferEntityType;
  entity_id: string;
  status: TransferStatus;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTransferPayload {
  source_tenant_id: string;
  source_franchise_id?: string;
  target_tenant_id: string;
  target_franchise_id?: string;
  transfer_type: TransferType;
  items: { entity_type: TransferEntityType; entity_id: string }[];
}

export const TransferService = {
  async createTransfer(payload: CreateTransferPayload) {
    const { items, ...transferData } = payload;
    
    // Start transaction (manual via client)
    const { data: transfer, error: transferError } = await supabase
      .from('entity_transfers')
      .insert({
        ...transferData,
        requested_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (transferError) throw transferError;

    const itemsData = items.map(item => ({
      transfer_id: transfer.id,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      status: 'pending'
    }));

    const { error: itemsError } = await supabase
      .from('entity_transfer_items')
      .insert(itemsData);

    if (itemsError) {
      // Cleanup if items fail (optional but good)
      await supabase.from('entity_transfers').delete().eq('id', transfer.id);
      throw itemsError;
    }

    return transfer;
  },

  async getTransfers() {
    const { data, error } = await supabase
      .from('entity_transfers')
      .select(`
        *,
        source_tenant:tenants!source_tenant_id(name),
        target_tenant:tenants!target_tenant_id(name),
        source_franchise:franchises!source_franchise_id(name),
        target_franchise:franchises!target_franchise_id(name),
        requester:profiles!entity_transfers_requested_by_fkey_profiles(email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getTransfer(id: string) {
    const { data, error } = await supabase
      .from('entity_transfers')
      .select(`
        *,
        source_tenant:tenants!source_tenant_id(name),
        target_tenant:tenants!target_tenant_id(name),
        source_franchise:franchises!source_franchise_id(name),
        target_franchise:franchises!target_franchise_id(name),
        requester:profiles!entity_transfers_requested_by_fkey_profiles(email),
        items:entity_transfer_items(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async approveTransfer(id: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('execute_transfer', {
      p_transfer_id: id,
      p_approver_id: user.id
    });

    if (error) throw error;
    return data;
  },

  async rejectTransfer(id: string, reason: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('entity_transfers')
      .update({
        status: 'rejected',
        approved_by: user.id, // Act as rejector
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }
};
