/**
 * Dashboard-specific roles for role-based dashboard access and customization.
 * These are distinct from system authorization roles (UserRole in RoleMatrix.ts).
 * Used for dashboard template assignment and widget visibility control.
 */
export type DashboardRole =
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

/**
 * Represents a single widget instance in a dashboard template.
 * @property id - Unique identifier for the widget instance
 * @property type - Must correspond to WidgetType from dashboard.ts ('stats' | 'leads' | 'activities' | 'accounts' | 'contacts' | 'quotes' | 'opportunities' | 'shipments' | 'transfers' | 'custom_chart' | 'insights' | 'financial' | 'volume' | 'kanban')
 * @property title - Display title for the widget
 * @property size - Widget size category
 * @property position - Non-negative integer representing widget position in layout (0-indexed)
 * @property settings - Widget-specific configuration options
 */
export interface WidgetInstance {
  id: string;
  type: 'stats' | 'leads' | 'activities' | 'accounts' | 'contacts' | 'quotes' | 'opportunities' | 'shipments' | 'transfers' | 'custom_chart' | 'insights' | 'financial' | 'volume' | 'kanban';
  title: string;
  size: WidgetSize;
  /** Non-negative integer representing widget position in layout */
  position: number;
  settings?: Record<string, any>;
}

/**
 * Pre-configured dashboard template for a specific dashboard role and module.
 * @property createdAt - ISO 8601 timestamp string when transmitted via JSON
 */
export interface DashboardTemplate {
  id: string;
  /** DashboardRole must be paired with compatible module for this template */
  role: DashboardRole;
  module: 'crm' | 'logistics' | 'sales';
  name: string;
  description: string;
  defaultWidgets: WidgetInstance[];
  /** ISO 8601 timestamp string when transmitted via JSON */
  createdAt: Date;
}

/**
 * User-specific dashboard customization and preferences.
 * @property lastModified - ISO 8601 timestamp string when transmitted via JSON
 */
export interface UserDashboardPreferences {
  userId: string;
  role: DashboardRole;
  customWidgets: WidgetInstance[];
  customizationApplied: boolean;
  /** ISO 8601 timestamp string when transmitted via JSON */
  lastModified: Date;
}

/**
 * Dashboard metrics/statistics with flexible key-value structure.
 * Used for storing various KPIs and metrics without strict schema.
 */
export interface DashboardMetrics {
  [key: string]: string | number | boolean;
}
