export type UserRole =
  // CRM Roles
  | 'crm_sales_rep'
  | 'crm_sales_manager'
  | 'crm_account_executive'
  | 'crm_executive'
  // Logistics Roles
  | 'logistics_dispatcher'
  | 'logistics_fleet_manager'
  | 'logistics_ops_manager'
  | 'logistics_executive'
  // Sales Roles
  | 'sales_quote_manager'
  | 'sales_manager'
  | 'sales_executive';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface WidgetInstance {
  id: string;
  type: string;
  title: string;
  size: WidgetSize;
  position: number;
  settings?: Record<string, any>;
}

export interface DashboardTemplate {
  id: string;
  role: UserRole;
  module: 'crm' | 'logistics' | 'sales';
  name: string;
  description: string;
  defaultWidgets: WidgetInstance[];
  createdAt: Date;
}

export interface UserDashboardPreferences {
  userId: string;
  role: UserRole;
  customWidgets: WidgetInstance[];
  customizationApplied: boolean;
  lastModified: Date;
}

export interface DashboardStats {
  [key: string]: string | number;
}
