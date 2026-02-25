import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardTemplateLoader } from './DashboardTemplateLoader';
import { UserRole } from '@/types/dashboardTemplates';
import { useCRM } from '@/hooks/useCRM';

// Map auth system roles to dashboard roles
const AUTH_ROLE_TO_DASHBOARD_ROLE: Record<string, UserRole> = {
  platform_admin: 'crm_executive',
  tenant_admin: 'crm_sales_manager',
  franchise_admin: 'crm_account_executive',
  user: 'crm_sales_rep',
};

export function DashboardRouter() {
  const { context, user, scopedDb } = useCRM();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
          setUserRole(profileData.dashboard_role as UserRole);
          setLoading(false);
          return;
        }

        // Method 2: Map auth roles to dashboard roles
        let dashboardRole: UserRole = 'crm_sales_rep';

        if (context?.isPlatformAdmin) {
          dashboardRole = AUTH_ROLE_TO_DASHBOARD_ROLE['platform_admin'];
        } else if (context?.isTenantAdmin) {
          dashboardRole = AUTH_ROLE_TO_DASHBOARD_ROLE['tenant_admin'];
        } else if (context?.isFranchiseAdmin) {
          dashboardRole = AUTH_ROLE_TO_DASHBOARD_ROLE['franchise_admin'];
        } else {
          dashboardRole = AUTH_ROLE_TO_DASHBOARD_ROLE['user'];
        }

        setUserRole(dashboardRole);
      } catch (error) {
        console.error('Failed to determine dashboard role:', error);
        // Default to sales rep if error
        setUserRole('crm_sales_rep');
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
