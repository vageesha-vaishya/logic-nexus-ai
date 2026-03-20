import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { PLATFORM_ADMIN_ROLE, type AppRole, type Permission } from '@/config/permissions';
import { logger } from '@/lib/logger';
import { useDomain } from '@/contexts/DomainContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  requireAuth?: boolean;
  requiredPermissions?: Permission[];
  accessDeniedMessage?: string;
  requiredDomainCode?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole,
  requireAuth = true,
  requiredPermissions,
  accessDeniedMessage,
  requiredDomainCode
}: ProtectedRouteProps) {
  const { user, loading, hasRole, hasPermission, isPlatformAdmin } = useAuth();
  const { isLoading: loadingDomains, availableDomains } = useDomain();
  const location = useLocation();
  const isSettingsRoute =
    location.pathname === '/dashboard/settings' ||
    location.pathname.startsWith('/dashboard/settings/');
  const e2eBypassEnabled =
    import.meta.env.MODE === 'test' ||
    String(import.meta.env.VITE_ENABLE_E2E_AUTH_BYPASS || '').trim().toLowerCase() === 'true';
  const e2eBypassAuth =
    e2eBypassEnabled &&
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.webdriver &&
    window.localStorage.getItem('e2e:bypass-auth') === '1';

  if (e2eBypassAuth) {
    return <>{children}</>;
  }

  if (loading) {
    logger.debug('ProtectedRoute waiting for auth loading', { path: location.pathname, component: 'ProtectedRoute' });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requiredDomainCode && loadingDomains) {
    logger.debug('ProtectedRoute waiting for domain loading', {
      path: location.pathname,
      requiredDomainCode,
      component: 'ProtectedRoute',
    });
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

  if (isSettingsRoute && !isPlatformAdmin()) {
    logger.warn('Access denied. Settings route requires verified platform admin access.', { userId: user?.id, path: location.pathname, component: 'ProtectedRoute' });
    return (
      <Navigate
        to="/unauthorized"
        state={{
          reason: 'missing_role',
          requiredRole: PLATFORM_ADMIN_ROLE,
          from: location.pathname + location.search,
          message: accessDeniedMessage || 'Access denied - Platform admin privileges required',
        }}
        replace
      />
    );
  }

  const hasRequiredRole = requiredRole
    ? requiredRole === PLATFORM_ADMIN_ROLE
      ? isPlatformAdmin()
      : hasRole(requiredRole) || isPlatformAdmin()
    : true;

  if (!hasRequiredRole) {
    logger.warn(`Access denied. User missing required role: ${requiredRole}`, { userId: user?.id, role: requiredRole, component: 'ProtectedRoute' });
    return (
      <Navigate
        to="/unauthorized"
        state={{
          reason: 'missing_role',
          requiredRole,
          from: location.pathname + location.search,
          message: accessDeniedMessage,
        }}
        replace
      />
    );
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

  if (requiredDomainCode) {
    if (isPlatformAdmin()) {
      return <>{children}</>;
    }
    const normalizedRequiredDomainCode = requiredDomainCode.trim().toUpperCase();
    const hasRequiredDomain = availableDomains.some((domain) => String(domain.code || '').trim().toUpperCase() === normalizedRequiredDomainCode);
    if (!hasRequiredDomain) {
      logger.warn(`Access denied. User missing required domain: ${normalizedRequiredDomainCode}`, {
        userId: user?.id,
        component: 'ProtectedRoute',
      });
      return (
        <Navigate
          to="/unauthorized"
          state={{
            reason: 'missing_domain',
            requiredDomainCode: normalizedRequiredDomainCode,
            from: location.pathname + location.search,
            message: accessDeniedMessage || `Access denied - ${normalizedRequiredDomainCode} domain assignment required`,
          }}
          replace
        />
      );
    }
  }

  return <>{children}</>;
}
