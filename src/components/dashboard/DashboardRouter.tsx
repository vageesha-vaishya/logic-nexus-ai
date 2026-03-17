import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardTemplateLoader } from './DashboardTemplateLoader';
import { UserRole } from '@/types/dashboardTemplates';
import { useCRM } from '@/hooks/useCRM';
import { logger } from '@/lib/logger';

// Map auth system roles to dashboard roles
const AUTH_ROLE_TO_DASHBOARD_ROLE: Record<string, UserRole> = {
  platform_admin: 'enterprise_executive',
  tenant_admin: 'enterprise_operations',
  franchise_admin: 'enterprise_operations',
  user: 'crm_sales_rep',
};

const ROLE_ALIASES: Record<string, UserRole> = {
  operations: 'enterprise_operations',
  executive: 'enterprise_executive',
};

const VALID_DASHBOARD_ROLES = new Set<UserRole>([
  'enterprise_operations',
  'enterprise_executive',
  'crm_sales_rep',
  'crm_sales_manager',
  'crm_account_executive',
  'crm_executive',
  'logistics_dispatcher',
  'logistics_fleet_manager',
  'logistics_ops_manager',
  'logistics_executive',
  'sales_quote_manager',
  'sales_manager',
  'sales_executive',
]);

export function DashboardRouter() {
  const { context, user, scopedDb } = useCRM();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const contextRoleToDashboardRole = (): UserRole => {
      if (context?.isPlatformAdmin) {
        return AUTH_ROLE_TO_DASHBOARD_ROLE.platform_admin;
      }
      if (context?.isTenantAdmin) {
        return AUTH_ROLE_TO_DASHBOARD_ROLE.tenant_admin;
      }
      if (context?.isFranchiseAdmin) {
        return AUTH_ROLE_TO_DASHBOARD_ROLE.franchise_admin;
      }
      return AUTH_ROLE_TO_DASHBOARD_ROLE.user;
    };

    const normalizeDashboardRole = (rawRole: unknown): UserRole => {
      if (typeof rawRole !== 'string' || rawRole.trim().length === 0) {
        return contextRoleToDashboardRole();
      }

      const candidate = rawRole.trim();
      const aliasResolved = ROLE_ALIASES[candidate] ?? candidate;
      if (VALID_DASHBOARD_ROLES.has(aliasResolved as UserRole)) {
        return aliasResolved as UserRole;
      }

      logger.warn('Unknown dashboard_role profile value. Falling back to context role mapping.', {
        userId: user?.id,
        dashboardRole: candidate,
        component: 'DashboardRouter',
      });
      return contextRoleToDashboardRole();
    };

    const determineDashboardRole = async () => {
      try {
        if (!user?.id) {
          setLoading(false);
          return;
        }

        // Method 1: Fetch dashboard_role directly from profiles table
        const { data: profileData, error } = await scopedDb
          .from('profiles')
          .select('dashboard_role')
          .eq('id', user.id)
          .single();

        if (!error && profileData?.dashboard_role) {
          setUserRole(normalizeDashboardRole(profileData.dashboard_role));
          setLoading(false);
          return;
        }

        setUserRole(contextRoleToDashboardRole());
      } catch (error) {
        logger.error('Failed to determine dashboard role', {
          error,
          userId: user?.id,
          component: 'DashboardRouter',
        });
        setUserRole(contextRoleToDashboardRole());
      } finally {
        setLoading(false);
      }
    };

    determineDashboardRole();
  }, [user?.id, context, scopedDb]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!userRole) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Dashboard Configuration Error
          </h1>
          <p className="text-gray-600">
            Unable to determine your dashboard role. Please contact your administrator.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              <strong>Debug Info:</strong> User ID: {user?.id}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <DashboardTemplateLoader userRole={userRole} userId={user?.id || ''} />
      </div>
    </DashboardLayout>
  );
}
