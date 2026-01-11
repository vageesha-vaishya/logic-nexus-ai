import { ScopedDataAccess } from '@/lib/db/access';
import { WidgetConfig } from '@/types/dashboard';

export interface DashboardPreferences {
  user_id: string;
  tenant_id?: string;
  franchise_id?: string;
  widgets: WidgetConfig[];
  updated_at?: string;
}

export const DashboardService = {
  async getPreferences(db: ScopedDataAccess, userId?: string) {
    const targetUserId = userId || (await db.client.auth.getUser()).data.user?.id;
    if (!targetUserId) throw new Error('User ID required');

    // Use maybeSingle() to return null if no record exists instead of error
    const { data, error } = await db.client
      .from('dashboard_preferences')
      .select('widgets')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (error) throw error;
    return data?.widgets as WidgetConfig[] | null;
  },

  async savePreferences(db: ScopedDataAccess, widgets: WidgetConfig[]) {
    const user = (await db.client.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { tenantId, franchiseId } = db.accessContext;

    const payload: any = {
      user_id: user.id,
      widgets,
      updated_at: new Date().toISOString(),
    };

    if (tenantId) payload.tenant_id = tenantId;
    if (franchiseId) payload.franchise_id = franchiseId;

    const { error } = await db.client
      .from('dashboard_preferences')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) throw error;
  },

  async getTeamMembers(db: ScopedDataAccess) {
    const { isPlatformAdmin, tenantId, adminOverrideEnabled } = db.accessContext;
    
    // Determine effective tenant to filter by
    // If not Platform Admin (or overriding), enforce tenant scope
    const effectiveTenantId = (!isPlatformAdmin || adminOverrideEnabled) ? tenantId : null;

    let query;

    if (effectiveTenantId) {
      // Filter profiles by tenant_id via user_roles
      // Use !inner to enforce the join filter
      query = db.client.from('profiles')
        .select('id, first_name, last_name, email, avatar_url, user_roles!inner(tenant_id)')
        .eq('user_roles.tenant_id', effectiveTenantId);
    } else {
      // Platform Admin (no override) sees all profiles
      query = db.client.from('profiles')
        .select('id, first_name, last_name, email, avatar_url');
    }

    const { data, error } = await query.order('first_name');
    if (error) throw error;

    // Deduplicate users (in case of multiple roles per tenant)
    const uniqueUsers = Array.from(new Map(data?.map((item: any) => [item.id, item])).values());
    
    return uniqueUsers;
  }
};
