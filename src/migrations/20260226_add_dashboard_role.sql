-- Add dashboard_role column to profiles table
-- Maps user to dashboard template role (crm_sales_rep, crm_sales_manager, etc.)

-- Step 1: Add the column if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';

-- Step 2: Set column comment
COMMENT ON COLUMN public.profiles.dashboard_role IS 'Dashboard role determines which dashboard template is shown';

-- Step 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_dashboard_role ON public.profiles(dashboard_role);

-- Step 4: Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'dashboard_role';
