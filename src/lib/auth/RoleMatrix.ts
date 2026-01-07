
import { Database } from '@/integrations/supabase/types';

export type UserRole = 'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user';

export interface RoleDefinition {
  id: UserRole;
  label: string;
  description: string;
  level: number; // Hierarchy level (0 = highest)
  canManageRoles: UserRole[]; // Roles this role can create/manage
  canManageScopes: ('global' | 'tenant' | 'franchise')[];
  defaultPermissions: string[];
}

export const ROLE_MATRIX: Record<UserRole, RoleDefinition> = {
  platform_admin: {
    id: 'platform_admin',
    label: 'Platform Administrator',
    description: 'Full system access with global visibility',
    level: 0,
    canManageRoles: ['platform_admin', 'tenant_admin', 'franchise_admin', 'user'],
    canManageScopes: ['global', 'tenant', 'franchise'],
    defaultPermissions: ['*'], // Wildcard for all permissions
  },
  tenant_admin: {
    id: 'tenant_admin',
    label: 'Tenant Administrator',
    description: 'manages a specific tenant and its franchises',
    level: 1,
    canManageRoles: ['franchise_admin', 'user'], // Cannot create other tenant admins or platform admins
    canManageScopes: ['tenant', 'franchise'],
    defaultPermissions: [
      'tenant.settings.manage',
      'franchise.create',
      'franchise.edit',
      'franchise.delete',
      'user.create',
      'user.edit',
      'user.delete',
      'reports.view.tenant',
    ],
  },
  franchise_admin: {
    id: 'franchise_admin',
    label: 'Franchise Administrator',
    description: 'Manages a specific franchise location',
    level: 2,
    canManageRoles: ['user'],
    canManageScopes: ['franchise'],
    defaultPermissions: [
      'franchise.settings.manage',
      'user.create',
      'user.edit',
      'user.delete',
      'reports.view.franchise',
    ],
  },
  user: {
    id: 'user',
    label: 'Standard User',
    description: 'Operational user with restricted access',
    level: 3,
    canManageRoles: [],
    canManageScopes: [],
    defaultPermissions: [
      'leads.view',
      'leads.create',
      'leads.edit',
      'quotes.view',
      'quotes.create',
      'quotes.edit',
    ],
  },
};

/**
 * Validates if a user (actor) can manage another user (target) based on roles.
 */
export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  const actor = ROLE_MATRIX[actorRole];
  return actor.canManageRoles.includes(targetRole);
}

/**
 * Returns the highest role from a list of user roles.
 */
export function getHighestRole(roles: string[]): UserRole {
  const rolePriority: UserRole[] = ['platform_admin', 'tenant_admin', 'franchise_admin', 'user'];
  for (const role of rolePriority) {
    if (roles.includes(role)) return role;
  }
  return 'user';
}

/**
 * Validates hierarchy for sensitive operations
 */
export function validateHierarchy(
  actorRole: UserRole, 
  actorTenantId: string | null, 
  actorFranchiseId: string | null,
  targetTenantId: string | null,
  targetFranchiseId: string | null
): boolean {
  // Platform admin can do anything
  if (actorRole === 'platform_admin') return true;

  // Tenant admin can only act within their tenant
  if (actorRole === 'tenant_admin') {
    if (actorTenantId !== targetTenantId) return false;
    return true; // Can manage any franchise within their tenant
  }

  // Franchise admin can only act within their franchise
  if (actorRole === 'franchise_admin') {
    if (actorTenantId !== targetTenantId) return false;
    if (actorFranchiseId !== targetFranchiseId) return false;
    return true;
  }

  // Users cannot manage anything
  return false;
}
