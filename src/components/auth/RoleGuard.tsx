import { useAuth } from '@/hooks/useAuth';
import type { AppRole, Permission } from '@/config/permissions';

interface RoleGuardProps {
  children: React.ReactNode;
  roles: AppRole[];
  fallback?: React.ReactNode;
  permissions?: Permission[]; // Optional permissions gate (ANY match)
}

export function RoleGuard({ children, roles, fallback = null, permissions }: RoleGuardProps) {
  const { hasRole, hasPermission, isPlatformAdmin } = useAuth();

  const hasRequiredRole =
    roles.length === 0 ||
    roles.some((role) => (role === 'platform_admin' ? isPlatformAdmin() : hasRole(role))) ||
    isPlatformAdmin();
  const hasRequiredPermission = !permissions || permissions.length === 0 || permissions.some(p => hasPermission(p));

  if (!hasRequiredRole || !hasRequiredPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
