import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardTemplateLoader } from '../DashboardTemplateLoader';
import type { UserRole } from '@/types/dashboardTemplates';

vi.mock('../crm/SalesRepDashboard', () => ({ SalesRepDashboard: () => <div>CRM Sales Rep Dashboard</div> }));
vi.mock('../crm/SalesManagerDashboard', () => ({ SalesManagerDashboard: () => <div>CRM Sales Manager Dashboard</div> }));
vi.mock('../crm/AccountExecutiveDashboard', () => ({ AccountExecutiveDashboard: () => <div>CRM Account Executive Dashboard</div> }));
vi.mock('../crm/ExecutiveDashboard', () => ({ ExecutiveDashboard: () => <div>CRM Executive Dashboard</div> }));
vi.mock('../logistics/DispatcherDashboard', () => ({ DispatcherDashboard: () => <div>Logistics Dispatcher Dashboard</div> }));
vi.mock('../logistics/FleetManagerDashboard', () => ({ FleetManagerDashboard: () => <div>Logistics Fleet Manager Dashboard</div> }));
vi.mock('../logistics/OpsManagerDashboard', () => ({ OpsManagerDashboard: () => <div>Logistics Ops Manager Dashboard</div> }));
vi.mock('../logistics/LogisticsExecutiveDashboard', () => ({ LogisticsExecutiveDashboard: () => <div>Logistics Executive Dashboard</div> }));
vi.mock('../sales/QuoteManagerDashboard', () => ({ QuoteManagerDashboard: () => <div>Sales Quote Manager Dashboard</div> }));
vi.mock('../sales/SalesManagerDashboard', () => ({ SalesManagerDashboard: () => <div>Sales Manager Dashboard</div> }));
vi.mock('../sales/SalesExecutiveDashboard', () => ({ SalesExecutiveDashboard: () => <div>Sales Executive Dashboard</div> }));

describe('DashboardTemplateLoader', () => {
  it.each([
    ['enterprise_operations', 'Logistics Executive Dashboard'],
    ['enterprise_executive', 'CRM Executive Dashboard'],
    ['crm_sales_rep', 'CRM Sales Rep Dashboard'],
    ['crm_sales_manager', 'CRM Sales Manager Dashboard'],
    ['crm_account_executive', 'CRM Account Executive Dashboard'],
    ['crm_executive', 'CRM Executive Dashboard'],
    ['logistics_dispatcher', 'Logistics Dispatcher Dashboard'],
    ['logistics_fleet_manager', 'Logistics Fleet Manager Dashboard'],
    ['logistics_ops_manager', 'Logistics Ops Manager Dashboard'],
    ['logistics_executive', 'Logistics Executive Dashboard'],
    ['sales_quote_manager', 'Sales Quote Manager Dashboard'],
    ['sales_manager', 'Sales Manager Dashboard'],
    ['sales_executive', 'Sales Executive Dashboard'],
  ])('renders mapped component for role %s', (role, expectedText) => {
    render(<DashboardTemplateLoader userRole={role as UserRole} userId="user-10" />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });
});
