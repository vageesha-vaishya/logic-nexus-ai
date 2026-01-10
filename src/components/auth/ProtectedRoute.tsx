import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import type { Permission } from '@/config/permissions';

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
  const { user, loading, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requireAuth && !user) {
    console.warn('[ProtectedRoute] Access denied. User not authenticated.');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    console.warn(`[ProtectedRoute] Access denied. User missing required role: ${requiredRole}`);
    return <Navigate to="/unauthorized" state={{ reason: 'missing_role', requiredRole }} replace />;
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAny = requiredPermissions.some(p => hasPermission(p));
    if (!hasAny) {
      console.warn(`[ProtectedRoute] Access denied. User missing required permissions: ${requiredPermissions.join(', ')}`);
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
