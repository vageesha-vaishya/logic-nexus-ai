import React from 'react';
import { UserRole } from '@/types/dashboardTemplates';
import { SalesRepDashboard } from './crm/SalesRepDashboard';
import { SalesManagerDashboard } from './crm/SalesManagerDashboard';
import { AccountExecutiveDashboard } from './crm/AccountExecutiveDashboard';
import { ExecutiveDashboard as CRMExecutiveDashboard } from './crm/ExecutiveDashboard';
import { DispatcherDashboard } from './logistics/DispatcherDashboard';
import { FleetManagerDashboard } from './logistics/FleetManagerDashboard';
import { OpsManagerDashboard } from './logistics/OpsManagerDashboard';
import { LogisticsExecutiveDashboard } from './logistics/LogisticsExecutiveDashboard';
import { QuoteManagerDashboard } from './sales/QuoteManagerDashboard';
import { SalesManagerDashboard as SalesModuleSalesManager } from './sales/SalesManagerDashboard';
import { SalesExecutiveDashboard } from './sales/SalesExecutiveDashboard';

const templateMap: Record<UserRole, React.ComponentType<any>> = {
  crm_sales_rep: SalesRepDashboard,
  crm_sales_manager: SalesManagerDashboard,
  crm_account_executive: AccountExecutiveDashboard,
  crm_executive: CRMExecutiveDashboard,
  logistics_dispatcher: DispatcherDashboard,
  logistics_fleet_manager: FleetManagerDashboard,
  logistics_ops_manager: OpsManagerDashboard,
  logistics_executive: LogisticsExecutiveDashboard,
  sales_quote_manager: QuoteManagerDashboard,
  sales_manager: SalesModuleSalesManager,
  sales_executive: SalesExecutiveDashboard,
};

interface DashboardTemplateLoaderProps {
  userRole: UserRole;
  userId: string;
}

/**
 * DashboardTemplateLoader - Routes to the appropriate dashboard based on user role.
 *
 * Supports 11 different role-based dashboard templates across 3 modules:
 * - CRM: Sales Rep, Sales Manager, Account Executive, Executive
 * - Logistics: Dispatcher, Fleet Manager, Operations Manager, Executive
 * - Sales: Quote Manager, Sales Manager, Executive
 *
 * @param userRole - The user's dashboard role (from UserRole type)
 * @param userId - The user's ID for data access control
 * @returns The appropriate dashboard component for the user's role
 */
export function DashboardTemplateLoader({ userRole, userId }: DashboardTemplateLoaderProps) {
  const Component = templateMap[userRole];

  if (!Component) {
    return (
      <div className="p-8 text-red-600 bg-red-50 rounded border border-red-200">
        <p className="font-semibold">Unknown dashboard role: {userRole}</p>
        <p className="text-sm mt-2">Please contact your administrator to configure your dashboard access.</p>
      </div>
    );
  }

  return <Component userId={userId} />;
}
