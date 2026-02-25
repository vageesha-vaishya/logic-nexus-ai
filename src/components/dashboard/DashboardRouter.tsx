import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardTemplateLoader } from './DashboardTemplateLoader';
import { UserRole } from '@/types/dashboardTemplates';
import { useCRM } from '@/hooks/useCRM';

export function DashboardRouter() {
  const { context } = useCRM();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Determine user role from context
    // For now, default to crm_sales_rep
    // In production, get from auth/user profile
    setUserRole('crm_sales_rep');
    setLoading(false);
  }, [context]);

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
        <div className="p-8 text-red-600">Unable to determine user role</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <DashboardTemplateLoader userRole={userRole} userId={context?.user?.id || ''} />
      </div>
    </DashboardLayout>
  );
}
