
import { ReactNode } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { UserRole, ROLE_MATRIX } from '@/lib/auth/RoleMatrix';

interface PermissionGuardProps {
  children: ReactNode;
  requiredRole?: UserRole; // Minimum role level (inclusive of higher roles)
  requiredPermission?: string; // e.g. 'user.create'
  requireScope?: 'global' | 'tenant' | 'franchise';
  fallback?: ReactNode;
}

export function PermissionGuard({ 
  children, 
  requiredRole, 
  requiredPermission,
  requireScope,
  fallback = null 
}: PermissionGuardProps) {
  const { context } = useCRM();
  
  // Determine current user's role
  const currentUserRole: UserRole = context.isPlatformAdmin ? 'platform_admin' 
    : context.isTenantAdmin ? 'tenant_admin'
    : context.isFranchiseAdmin ? 'franchise_admin'
    : 'user';

  // Check Role Level
  if (requiredRole) {
    const userLevel = ROLE_MATRIX[currentUserRole].level;
    const requiredLevel = ROLE_MATRIX[requiredRole].level;
    
    // Lower level number = higher privilege. 
    // If userLevel > requiredLevel, they don't have access.
    if (userLevel > requiredLevel) {
      return <>{fallback}</>;
    }
  }

  // Check Permissions
  if (requiredPermission) {
    const permissions = ROLE_MATRIX[currentUserRole].defaultPermissions;
    const hasPermission = permissions.includes('*') || permissions.includes(requiredPermission);
    if (!hasPermission) {
      return <>{fallback}</>;
    }
  }

  // Check Scope
  if (requireScope) {
    const scopes = ROLE_MATRIX[currentUserRole].canManageScopes;
    if (!scopes.includes(requireScope)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
