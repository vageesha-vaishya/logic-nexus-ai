import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';
import { Permission, ROLE_PERMISSIONS } from '@/config/permissions';
import { ROLE_MATRIX, UserRole } from '@/lib/auth/RoleMatrix';
import { ScopedDataAccess } from '@/lib/db/access';

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

export class RoleService {
  constructor(private db: ScopedDataAccess) {}

  /**
   * Fetches all defined roles from the database
   */
  async getRoles() {
    const { data, error } = await (this.db.client as any)
      .from('auth_roles')
      .select('*')
      .order('level', { ascending: true });
    
    if (error) throw error;
    return data as DbRole[];
  }

  /**
   * Fetches all available permissions
   */
  async getPermissions() {
    const { data, error } = await (this.db.client as any)
      .from('auth_permissions')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) throw error;
    return data as DbPermission[];
  }

  /**
   * Fetches the mapping of roles to permissions
   */
  async getRolePermissions() {
    const { data, error } = await (this.db.client as any)
      .from('auth_role_permissions')
      .select('role_id, permission_id');
    
    if (error) throw error;
    
    // Transform to Record<roleId, permissionId[]>
    const map: Record<string, string[]> = {};
    (data || []).forEach((item: any) => {
      if (!map[item.role_id]) map[item.role_id] = [];
      map[item.role_id].push(item.permission_id);
    });
    
    return map;
  }

  /**
   * Fetch role inheritance (hierarchy) mapping: parent -> children and child -> parents
   */
  async getRoleHierarchy() {
    const { data, error } = await (this.db.client as any)
      .from('auth_role_hierarchy')
      .select('manager_role_id, target_role_id');
    if (error) {
      const code = (error as any)?.code;
      const message = (error as any)?.message || '';
      if (code === 'PGRST205' || message.includes('auth_role_hierarchy')) {
        return { parentsToChildren: {}, childrenToParents: {}, available: false };
      }
      throw error;
    }
    const parentsToChildren: Record<string, string[]> = {};
    const childrenToParents: Record<string, string[]> = {};
    (data || []).forEach((row: any) => {
      const parent = row.manager_role_id as string;
      const child = row.target_role_id as string;
      if (!parentsToChildren[parent]) parentsToChildren[parent] = [];
      if (!childrenToParents[child]) childrenToParents[child] = [];
      parentsToChildren[parent].push(child);
      childrenToParents[child].push(parent);
    });
    return { parentsToChildren, childrenToParents, available: true };
  }

  /**
   * Updates the permissions for a specific role
   */
  async updateRolePermissions(roleId: string, permissionIds: string[], justification?: string) {
    // 1. Delete existing
    const { error: deleteError } = await (this.db.client as any)
      .from('auth_role_permissions')
      .delete()
      .eq('role_id', roleId);
    
    if (deleteError) throw deleteError;

    // 2. Insert new
    if (permissionIds.length > 0) {
      const { error: insertError } = await (this.db.client as any)
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
    await this.db.client.from('audit_logs').insert({
      action: 'role.permissions.update',
      resource_type: 'auth_role',
      details: { roleId, permissionCount: permissionIds.length, justification: justification || null }
    });
  }

  /**
   * Create a new custom role
   */
  async createRole(role: Omit<DbRole, 'is_system'> & { is_system?: boolean }) {
    const payload = { ...role, is_system: role.is_system ?? false };
    const { data, error } = await (this.db.client as any).from('auth_roles').insert(payload).select().single();
    if (error) throw error;
    await this.db.client.from('audit_logs').insert({
      action: 'role.create',
      resource_type: 'auth_role',
      details: { id: data.id }
    });
    return data as DbRole;
  }

  /**
   * Update an existing role
   */
  async updateRole(roleId: string, updates: Partial<DbRole>) {
    const { data, error } = await (this.db.client as any)
      .from('auth_roles')
      .update(updates)
      .eq('id', roleId)
      .select()
      .single();
    if (error) throw error;
    await this.db.client.from('audit_logs').insert({
      action: 'role.update',
      resource_type: 'auth_role',
      details: { id: roleId, updates }
    });
    return data as DbRole;
  }

  /**
   * Delete a role (cannot delete system roles)
   */
  async deleteRole(roleId: string) {
    const { data: role } = await (this.db.client as any).from('auth_roles').select('is_system').eq('id', roleId).single();
    if (role?.is_system) {
      throw new Error('Cannot delete a system role');
    }
    const { error } = await (this.db.client as any).from('auth_roles').delete().eq('id', roleId);
    if (error) throw error;
    await this.db.client.from('audit_logs').insert({
      action: 'role.delete',
      resource_type: 'auth_role',
      details: { id: roleId }
    });
  }

  /**
   * Set role inheritance: selectedRole inherits from parentRoles
   */
  async setRoleInheritance(selectedRoleId: string, parentRoleIds: string[]) {
    // Remove existing parent links for this child
    const { error: delError } = await (this.db.client as any)
      .from('auth_role_hierarchy')
      .delete()
      .eq('target_role_id', selectedRoleId);
    if (delError) {
      const code = (delError as any)?.code;
      const message = (delError as any)?.message || '';
      if (code === 'PGRST205' || message.includes('auth_role_hierarchy')) {
        throw new Error('Role inheritance table is missing. Please run the migration to create auth_role_hierarchy.');
      }
      throw delError;
    }
    // Insert new links
    if (parentRoleIds.length > 0) {
      const rows = parentRoleIds.map(pid => ({
        manager_role_id: pid,
        target_role_id: selectedRoleId
      }));
      const { error: insError } = await (this.db.client as any).from('auth_role_hierarchy').insert(rows);
      if (insError) {
        const code = (insError as any)?.code;
        const message = (insError as any)?.message || '';
        if (code === 'PGRST205' || message.includes('auth_role_hierarchy')) {
          throw new Error('Role inheritance table is missing. Please run the migration to create auth_role_hierarchy.');
        }
        throw insError;
      }
    }
    await this.db.client.from('audit_logs').insert({
      action: 'role.inheritance.update',
      resource_type: 'auth_role',
      details: { roleId: selectedRoleId, parents: parentRoleIds }
    });
  }

  /**
   * Assign roles to a single user
   */
  async assignRolesToUser(userId: string, assignments: { role: string; tenant_id?: string | null; franchise_id?: string | null }[], replace = false) {
    if (replace) {
      await this.db.from('user_roles').delete().eq('user_id', userId);
    }
    if (assignments.length > 0) {
      const rows = assignments.map(a => ({
        user_id: userId,
        role: a.role,
        tenant_id: a.tenant_id ?? null,
        franchise_id: a.franchise_id ?? null
      }));
      // Use ScopedDataAccess for insert
      const { error } = await this.db.from('user_roles').insert(rows);
      if (error) throw error;
    }
    await this.db.client.from('audit_logs').insert({
      action: 'user.roles.assign',
      resource_type: 'user',
      details: { userId, count: assignments.length, replace }
    });
  }

  /**
   * Bulk assign a role to many users
   */
  async bulkAssignRoles(userIds: string[], assignment: { role: string; tenant_id?: string | null; franchise_id?: string | null }) {
    if (userIds.length === 0) return;
    const rows = userIds.map(uid => ({
      user_id: uid,
      role: assignment.role,
      tenant_id: assignment.tenant_id ?? null,
      franchise_id: assignment.franchise_id ?? null
    }));
    // Use ScopedDataAccess for insert
    const { error } = await this.db.from('user_roles').insert(rows);
    if (error) throw error;
    await this.db.client.from('audit_logs').insert({
      action: 'user.roles.bulk_assign',
      resource_type: 'user',
      details: { userIdsCount: userIds.length, role: assignment.role }
    });
  }

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

    const { error: rolesError } = await (this.db.client as any)
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

    const { error: permsError } = await (this.db.client as any)
      .from('auth_permissions')
      .upsert(permsList, { onConflict: 'id' });
      
    if (permsError) console.error('Error seeding permissions:', permsError);

    // 4. Upsert Role Permissions
    for (const [roleId, perms] of Object.entries(ROLE_PERMISSIONS)) {
      const links = perms.map(p => ({
        role_id: roleId,
        permission_id: p
      }));
      
      const { error: linkError } = await (this.db.client as any)
        .from('auth_role_permissions')
        .upsert(links, { onConflict: 'role_id, permission_id' });
        
      if (linkError) console.error(`Error seeding permissions for ${roleId}:`, linkError);
    }
  }
}
