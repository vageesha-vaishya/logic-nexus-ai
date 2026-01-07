import { supabase } from '@/integrations/supabase/client';
import { Permission, ROLE_PERMISSIONS } from '@/config/permissions';
import { ROLE_MATRIX, UserRole } from '@/lib/auth/RoleMatrix';

export interface DbRole {
  id: string;
  label: string;
  description: string;
  level: number;
  can_manage_scopes: string[];
  is_system: boolean;
}

export interface DbPermission {
  id: string;
  category: string;
  description: string;
}

export const RoleService = {
  /**
   * Fetches all defined roles from the database
   */
  async getRoles() {
    const { data, error } = await supabase
      .from('auth_roles')
      .select('*')
      .order('level', { ascending: true });
    
    if (error) throw error;
    return data as DbRole[];
  },

  /**
   * Fetches all available permissions
   */
  async getPermissions() {
    const { data, error } = await supabase
      .from('auth_permissions')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) throw error;
    return data as DbPermission[];
  },

  /**
   * Fetches the mapping of roles to permissions
   */
  async getRolePermissions() {
    const { data, error } = await supabase
      .from('auth_role_permissions')
      .select('role_id, permission_id');
    
    if (error) throw error;
    
    // Transform to Record<roleId, permissionId[]>
    const map: Record<string, string[]> = {};
    data.forEach(item => {
      if (!map[item.role_id]) map[item.role_id] = [];
      map[item.role_id].push(item.permission_id);
    });
    
    return map;
  },

  /**
   * Updates the permissions for a specific role
   */
  async updateRolePermissions(roleId: string, permissionIds: string[]) {
    // 1. Delete existing
    const { error: deleteError } = await supabase
      .from('auth_role_permissions')
      .delete()
      .eq('role_id', roleId);
    
    if (deleteError) throw deleteError;

    // 2. Insert new
    if (permissionIds.length > 0) {
      const { error: insertError } = await supabase
        .from('auth_role_permissions')
        .insert(
          permissionIds.map(pId => ({
            role_id: roleId,
            permission_id: pId
          }))
        );
      
      if (insertError) throw insertError;
    }

    // 3. Log Audit
    await supabase.from('audit_logs').insert({
      action: 'role.permissions.update',
      resource_type: 'auth_role',
      details: { roleId, permissionCount: permissionIds.length }
    });
  },

  /**
   * Utility to seed the database from static config
   * Useful for initial setup
   */
  async seedFromConfig() {
    // 1. Upsert Roles
    const roles = Object.values(ROLE_MATRIX).map(r => ({
      id: r.id,
      label: r.label,
      description: r.description,
      level: r.level,
      can_manage_scopes: r.canManageScopes,
      is_system: true
    }));

    const { error: rolesError } = await supabase
      .from('auth_roles')
      .upsert(roles, { onConflict: 'id' });
    
    if (rolesError) console.error('Error seeding roles:', rolesError);

    // 2. Collect all unique permissions
    const allPermissions = new Set<string>();
    Object.values(ROLE_PERMISSIONS).forEach(perms => {
      perms.forEach(p => allPermissions.add(p));
    });

    // 3. Upsert Permissions
    const permsList = Array.from(allPermissions).map(p => ({
      id: p,
      category: p.split('.')[0] || 'general',
      description: p
    }));

    const { error: permsError } = await supabase
      .from('auth_permissions')
      .upsert(permsList, { onConflict: 'id' });
      
    if (permsError) console.error('Error seeding permissions:', permsError);

    // 4. Upsert Role Permissions
    for (const [roleId, perms] of Object.entries(ROLE_PERMISSIONS)) {
      // First clean up for this role (optional, but safer for re-seeding)
      // await supabase.from('auth_role_permissions').delete().eq('role_id', roleId);
      
      const links = perms.map(p => ({
        role_id: roleId,
        permission_id: p
      }));
      
      const { error: linkError } = await supabase
        .from('auth_role_permissions')
        .upsert(links, { onConflict: 'role_id, permission_id' }); // Requires constraint
        
      if (linkError) console.error(`Error seeding permissions for ${roleId}:`, linkError);
    }
  }
};
