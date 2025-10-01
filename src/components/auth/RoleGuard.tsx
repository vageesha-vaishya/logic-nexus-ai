import { useAuth } from '@/hooks/useAuth';

type AppRole = 'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user';

interface RoleGuardProps {
  children: React.ReactNode;
  roles: AppRole[];
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, roles, fallback = null }: RoleGuardProps) {
  const { hasRole } = useAuth();

  const hasRequiredRole = roles.some(role => hasRole(role));

  if (!hasRequiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
