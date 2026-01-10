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
  source_tenant?: { name: string };
  target_tenant?: { name: string };
  source_franchise?: { name: string };
  target_franchise?: { name: string };
  requester?: { email: string };
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

export interface TransferableEntity {
  id: string;
  name: string;
  type: TransferEntityType;
  tenant_id: string;
  franchise_id?: string;
  description?: string;
  created_at?: string;
}

export interface CreateTransferPayload {
  source_tenant_id: string;
  source_franchise_id?: string;
  target_tenant_id: string;
  target_franchise_id?: string;
  transfer_type: TransferType;
  items: { entity_type: TransferEntityType; entity_id: string }[];
}

export interface TransferValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const ENTITY_TABLE_MAP: Record<TransferEntityType, string> = {
  lead: 'leads',
  opportunity: 'opportunities',
  quote: 'quotes',
  shipment: 'shipments',
  account: 'accounts',
  contact: 'contacts',
  activity: 'activities',
};

const ENTITY_NAME_FIELD: Record<TransferEntityType, string> = {
  lead: 'company_name',
  opportunity: 'name',
  quote: 'quote_number',
  shipment: 'shipment_number',
  account: 'name',
  contact: 'first_name',
  activity: 'subject',
};

export const TransferService = {
  async createTransfer(payload: CreateTransferPayload) {
    const { items, ...transferData } = payload;
    
    const { data: transfer, error: transferError } = await (supabase as any)
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

    const { error: itemsError } = await (supabase as any)
      .from('entity_transfer_items')
      .insert(itemsData);

    if (itemsError) {
      await (supabase as any).from('entity_transfers').delete().eq('id', transfer.id);
      throw itemsError;
    }

    return transfer;
  },

  async getTransfers(filters?: { status?: TransferStatus; tenantId?: string }) {
    let query = (supabase as any)
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

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.tenantId) {
      query = query.or(`source_tenant_id.eq.${filters.tenantId},target_tenant_id.eq.${filters.tenantId}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getTransfer(id: string) {
    const { data, error } = await (supabase as any)
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

  async approveTransfer(id: string): Promise<{ success: boolean; processed?: number; succeeded?: number; failed?: number; message?: string }> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await (supabase as any).rpc('execute_transfer', {
      p_transfer_id: id,
      p_approver_id: user.id
    });

    if (error) throw error;
    return data as { success: boolean; processed?: number; succeeded?: number; failed?: number; message?: string };
  },

  async rejectTransfer(id: string, reason: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { error } = await (supabase as any)
      .from('entity_transfers')
      .update({
        status: 'rejected',
        approved_by: user.id,
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  },

  // Get entities available for transfer from a tenant/franchise
  async getTransferableEntities(
    entityType: TransferEntityType,
    tenantId: string,
    franchiseId?: string,
    search?: string
  ): Promise<TransferableEntity[]> {
    const table = ENTITY_TABLE_MAP[entityType];
    const nameField = ENTITY_NAME_FIELD[entityType];

    let query = (supabase as any)
      .from(table)
      .select(`id, ${nameField}, tenant_id, franchise_id, created_at`)
      .eq('tenant_id', tenantId);

    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }

    if (search) {
      query = query.ilike(nameField, `%${search}%`);
    }

    query = query.limit(50).order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      name: item[nameField] || `${entityType} ${item.id.slice(0, 8)}`,
      type: entityType,
      tenant_id: item.tenant_id,
      franchise_id: item.franchise_id,
      created_at: item.created_at,
    }));
  },

  // Validate transfer before submission
  async validateTransfer(payload: CreateTransferPayload): Promise<TransferValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate source and target are different
    if (payload.source_tenant_id === payload.target_tenant_id) {
      if (!payload.source_franchise_id && !payload.target_franchise_id) {
        errors.push('Source and target must be different');
      } else if (payload.source_franchise_id === payload.target_franchise_id) {
        errors.push('Source and target franchise must be different');
      }
    }

    // Validate items
    if (!payload.items || payload.items.length === 0) {
      errors.push('At least one entity must be selected for transfer');
    }

    // Check if items exist and belong to source
    for (const item of payload.items) {
      const table = ENTITY_TABLE_MAP[item.entity_type];
      const { data, error } = await (supabase as any)
        .from(table)
        .select('id, tenant_id, franchise_id')
        .eq('id', item.entity_id)
        .single();

      if (error || !data) {
        errors.push(`Entity ${item.entity_id} not found`);
        continue;
      }

      if (data.tenant_id !== payload.source_tenant_id) {
        errors.push(`Entity ${item.entity_id} does not belong to source tenant`);
      }

      if (payload.source_franchise_id && data.franchise_id !== payload.source_franchise_id) {
        warnings.push(`Entity ${item.entity_id} belongs to a different franchise than specified`);
      }
    }

    // Validate transfer type matches payload
    if (payload.transfer_type === 'franchise_to_franchise') {
      if (!payload.source_franchise_id || !payload.target_franchise_id) {
        errors.push('Franchise-to-franchise transfer requires both source and target franchises');
      }
      if (payload.source_tenant_id !== payload.target_tenant_id) {
        errors.push('Franchise-to-franchise transfer must be within the same tenant');
      }
    }

    if (payload.transfer_type === 'tenant_to_franchise') {
      if (!payload.target_franchise_id) {
        errors.push('Tenant-to-franchise transfer requires a target franchise');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  // Get available tenants for transfer
  async getAvailableTenants() {
    const { data, error } = await (supabase as any)
      .from('tenants')
      .select('id, name')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  // Get franchises for a tenant
  async getFranchisesForTenant(tenantId: string) {
    const { data, error } = await (supabase as any)
      .from('franchises')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  // Bulk create transfer with multiple entity types
  async createBulkTransfer(
    payload: Omit<CreateTransferPayload, 'items'>,
    entities: { type: TransferEntityType; ids: string[] }[]
  ) {
    const items = entities.flatMap(e => 
      e.ids.map(id => ({ entity_type: e.type, entity_id: id }))
    );

    return this.createTransfer({ ...payload, items });
  },

  // Get transfer statistics
  async getTransferStats(tenantId?: string) {
    let query = (supabase as any)
      .from('entity_transfers')
      .select('status', { count: 'exact' });

    if (tenantId) {
      query = query.or(`source_tenant_id.eq.${tenantId},target_tenant_id.eq.${tenantId}`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Get counts by status
    const stats = {
      total: count || 0,
      pending: 0,
      approved: 0,
      completed: 0,
      rejected: 0,
      failed: 0,
    };

    // Fetch individual counts
    for (const status of ['pending', 'approved', 'completed', 'rejected', 'failed'] as TransferStatus[]) {
      let statusQuery = (supabase as any)
        .from('entity_transfers')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);

      if (tenantId) {
        statusQuery = statusQuery.or(`source_tenant_id.eq.${tenantId},target_tenant_id.eq.${tenantId}`);
      }

      const { count: statusCount } = await statusQuery;
      stats[status] = statusCount || 0;
    }

    return stats;
  },
};
