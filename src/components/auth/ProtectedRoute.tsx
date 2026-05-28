import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { PLATFORM_ADMIN_ROLE, type AppRole, type Permission } from '@/config/permissions';
import { logger } from '@/lib/logger';
import { useDomain } from '@/contexts/DomainContext';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useCoreDomainAccess, useCoreModuleAccess } from '@/hooks/useCoreAccess';
import {
  AddDomainPrompt,
  RequestAccessPrompt,
  SwitchTenantPrompt,
  UpgradePrompt,
} from './remedy';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  requireAuth?: boolean;
  requiredPermissions?: Permission[];
  accessDeniedMessage?: string;
  requiredDomainCode?: string;
  /**
   * MV-4: when provided, ProtectedRoute consults useModuleAccess() and
   * renders the appropriate remedy page on deny (per reason) instead of
   * the legacy /unauthorized redirect. Legacy props (requiredRole,
   * requiredPermissions, requiredDomainCode) keep working alongside —
   * they evaluate first, before moduleCode. Migration is incremental.
   */
  moduleCode?: string;
  /** Optional human-readable label for the module (used in remedy copy). */
  moduleLabel?: string;
  /**
   * Phase 1 Slice E Part 2 — the new unified module gate per master
   * design §8.2.2. When set, ProtectedRoute calls
   * `core.has_module_access(tenant, code, action)` and enforces the
   * boolean directly. Use this on NEW routes; legacy props remain for
   * existing ones until tenant_module_access is populated and the
   * shadow-mode parity check (logged below) shows agreement.
   */
  requiredModule?: string;
  requiredAction?: 'read' | 'write' | 'delete';
}

export function ProtectedRoute({
  children,
  requiredRole,
  requireAuth = true,
  requiredPermissions,
  accessDeniedMessage,
  requiredDomainCode,
  moduleCode,
  moduleLabel,
  requiredModule,
  requiredAction = 'read',
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
    // Phase 1 Slice E Part 2 — shadow parity log via a sub-component so
    // the useQuery only runs when requiredDomainCode is set (legacy
    // callers without QueryClientProvider in tests stay unaffected).
    return (
      <DomainShadowParity
        requiredDomainCode={normalizedRequiredDomainCode}
        localAllowed={true}
      >
        {requiredModule ? (
          <RequiredModuleGate
            requiredModule={requiredModule}
            requiredAction={requiredAction}
            moduleLabel={moduleLabel}
          >
            {moduleCode ? (
              <ModuleAccessGate moduleCode={moduleCode} moduleLabel={moduleLabel}>
                {children}
              </ModuleAccessGate>
            ) : (
              children
            )}
          </RequiredModuleGate>
        ) : moduleCode ? (
          <ModuleAccessGate moduleCode={moduleCode} moduleLabel={moduleLabel}>
            {children}
          </ModuleAccessGate>
        ) : (
          children
        )}
      </DomainShadowParity>
    );
  }

  // Phase 1 Slice E Part 2 — `requiredModule` is the new unified gate
  // (master design §8.2.2). Enforced via core.has_module_access.
  if (requiredModule) {
    return (
      <RequiredModuleGate
        requiredModule={requiredModule}
        requiredAction={requiredAction}
        moduleLabel={moduleLabel}
      >
        {moduleCode ? (
          <ModuleAccessGate moduleCode={moduleCode} moduleLabel={moduleLabel}>
            {children}
          </ModuleAccessGate>
        ) : (
          children
        )}
      </RequiredModuleGate>
    );
  }

  // MV-4 — moduleCode-driven access check + smart remedy pages.
  // The actual hook call lives in <ModuleAccessGate> so it only runs
  // when moduleCode is set — keeps legacy callers (which don't pass
  // moduleCode and may not have QueryClientProvider in test setups)
  // from triggering the new pipeline. Legacy /unauthorized redirects
  // above evaluate first, so routes gated by requiredRole still use
  // the old path even if moduleCode is also passed.
  if (moduleCode) {
    return (
      <ModuleAccessGate moduleCode={moduleCode} moduleLabel={moduleLabel}>
        {children}
      </ModuleAccessGate>
    );
  }

  return <>{children}</>;
}

/**
 * Phase 1 Slice E Part 2 — runs `core.user_has_domain_access` as a
 * shadow check next to the legacy `availableDomains` decision. Only
 * mounts when ProtectedRoute determined `requiredDomainCode` allowed
 * via the legacy path, so the comparison is meaningful (both sides
 * answered yes/no for the same user). Logs parity drift; does not
 * affect rendering.
 */
function DomainShadowParity({
  requiredDomainCode,
  localAllowed,
  children,
}: {
  requiredDomainCode: string;
  localAllowed:       boolean;
  children:           React.ReactNode;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const core     = useCoreDomainAccess(requiredDomainCode);

  useEffect(() => {
    if (core.allowed === null) return;
    if (core.allowed !== localAllowed) {
      logger.warn(
        'ProtectedRoute domain-gate parity drift (Slice E shadow mode)',
        {
          userId:    user?.id,
          path:      location.pathname,
          requiredDomainCode,
          localAllowed,
          coreAllowed: core.allowed,
          component: 'ProtectedRoute',
        },
      );
    }
  }, [core.allowed, localAllowed, requiredDomainCode, user?.id, location.pathname]);

  return <>{children}</>;
}

/**
 * Phase 1 Slice E Part 2 — enforces the new `requiredModule` gate via
 * `core.has_module_access`. Platform admins bypass. On deny we render
 * the same RequestAccessPrompt the legacy moduleCode path uses for the
 * 'role' reason — closest match until we expand the helper to return
 * a reason code.
 */
function RequiredModuleGate({
  requiredModule,
  requiredAction,
  moduleLabel,
  children,
}: {
  requiredModule: string;
  requiredAction: 'read' | 'write' | 'delete';
  moduleLabel?:   string;
  children:       React.ReactNode;
}) {
  const { user, isPlatformAdmin } = useAuth();
  const location = useLocation();
  const core     = useCoreModuleAccess(requiredModule, requiredAction);

  if (isPlatformAdmin()) return <>{children}</>;
  if (core.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (core.allowed === false) {
    logger.warn(
      'ProtectedRoute denied requiredModule via core.has_module_access',
      {
        userId:    user?.id,
        path:      location.pathname,
        requiredModule,
        requiredAction,
        component: 'ProtectedRoute',
      },
    );
    return <RequestAccessPrompt moduleLabel={moduleLabel ?? requiredModule} />;
  }
  return <>{children}</>;
}

interface ModuleAccessGateProps {
  moduleCode:   string;
  moduleLabel?: string;
  children:     React.ReactNode;
}

function ModuleAccessGate({ moduleCode, moduleLabel, children }: ModuleAccessGateProps) {
  const { user } = useAuth();
  const location = useLocation();
  const moduleAccess = useModuleAccess(moduleCode);

  // Phase 1 Slice E Part 2 — shadow-mode parity log against
  // core.has_module_access. Runs alongside the legacy resolver; logs
  // disagreement when both sides have a definite answer. Enforcement
  // still rides on the legacy resolver.
  const core = useCoreModuleAccess(moduleCode, 'read');
  useEffect(() => {
    const localAllowed = moduleAccess.access?.allowed;
    if (
      typeof localAllowed === 'boolean' &&
      typeof core.allowed === 'boolean' &&
      localAllowed !== core.allowed
    ) {
      logger.warn(
        'ProtectedRoute module-gate parity drift (Slice E shadow mode)',
        {
          userId:    user?.id,
          path:      location.pathname,
          moduleCode,
          localAllowed,
          coreAllowed: core.allowed,
          reason:    moduleAccess.access?.reason ?? null,
          component: 'ProtectedRoute',
        },
      );
    }
  }, [moduleAccess.access, core.allowed, moduleCode, user?.id, location.pathname]);

  if (moduleAccess.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  const access = moduleAccess.access;
  if (!access || access.allowed) return <>{children}</>;

  logger.warn(`ProtectedRoute denied moduleCode=${moduleCode} reason=${access.reason}`, {
    userId:    user?.id,
    path:      location.pathname,
    reason:    access.reason,
    component: 'ProtectedRoute',
  });
  switch (access.reason) {
    case 'wrong_tenant':
      return <SwitchTenantPrompt />;
    case 'domain_off':
      return <AddDomainPrompt domainCode={access.remedy?.targetPath?.match(/add=([^&]+)/)?.[1]} />;
    case 'role':
      return <RequestAccessPrompt moduleLabel={moduleLabel} />;
    case 'plan':
      return <UpgradePrompt moduleCode={moduleCode} moduleLabel={moduleLabel} />;
    case 'unknown_module':
    default:
      return <Navigate to="/unauthorized" replace />;
  }
}
