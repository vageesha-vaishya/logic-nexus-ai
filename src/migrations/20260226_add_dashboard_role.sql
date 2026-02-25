-- Add dashboard_role column to profiles table
-- Maps user to dashboard template role (crm_sales_rep, crm_sales_manager, etc.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_dashboard_role ON profiles(dashboard_role);

-- Add comment explaining the column
COMMENT ON COLUMN profiles.dashboard_role IS 'Dashboard role determines which dashboard template is shown (crm_sales_rep, crm_sales_manager, crm_account_executive, crm_executive, logistics_dispatcher, logistics_fleet_manager, logistics_ops_manager, logistics_executive, sales_quote_manager, sales_manager, sales_executive)';
