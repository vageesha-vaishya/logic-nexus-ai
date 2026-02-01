import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import type { Permission } from '@/config/permissions';
import { logger } from '@/lib/logger';

type AppRole = 'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  requireAuth?: boolean;
  requiredPermissions?: Permission[]; // Optional permissions gate (ANY match)
}

export function ProtectedRoute({ 
  children, 
  requiredRole,
  requireAuth = true,
  requiredPermissions
}: ProtectedRouteProps) {
  const { user, loading, hasRole, hasPermission, isPlatformAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    logger.debug('ProtectedRoute waiting for auth loading', { path: location.pathname, component: 'ProtectedRoute' });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requireAuth && !user) {
    logger.warn('Access denied. User not authenticated.', { path: location.pathname, component: 'ProtectedRoute' });
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Platform Admin bypasses specific role checks
  if (requiredRole && !hasRole(requiredRole) && !isPlatformAdmin()) {
    logger.warn(`Access denied. User missing required role: ${requiredRole}`, { userId: user?.id, role: requiredRole, component: 'ProtectedRoute' });
    return <Navigate to="/unauthorized" state={{ reason: 'missing_role', requiredRole }} replace />;
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAny = requiredPermissions.some(p => hasPermission(p));
    if (!hasAny) {
      logger.warn(`Access denied. User missing required permissions: ${requiredPermissions.join(', ')}`, { userId: user?.id, permissions: requiredPermissions, component: 'ProtectedRoute' });
      return (
        <Navigate
          to="/unauthorized"
          state={{
            reason: 'missing_permissions',
            missingPermissions: requiredPermissions,
            from: location.pathname + location.search,
          }}
          replace
        />
      );
    }
  }

  return <>{children}</>;
}
