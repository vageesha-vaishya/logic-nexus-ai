-- Create platform_domains table if not exists (from schema_part_12)
CREATE TABLE IF NOT EXISTS public.platform_domains (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on platform_domains
ALTER TABLE public.platform_domains ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for platform_domains (Allow read access to authenticated users)
DROP POLICY IF EXISTS "Authenticated users can view platform domains" ON public.platform_domains;
CREATE POLICY "Authenticated users can view platform domains"
  ON public.platform_domains FOR SELECT
  TO authenticated
  USING (true);

-- Add domain_id to tenants if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'domain_id') THEN
        ALTER TABLE public.tenants ADD COLUMN domain_id uuid REFERENCES public.platform_domains(id);
    END IF;
END $$;

-- Ensure user_preferences table exists (dependency for get_user_tenant_id)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  franchise_id UUID REFERENCES public.franchises(id),
  admin_override_enabled BOOLEAN DEFAULT false,
  theme VARCHAR(20) DEFAULT 'system',
  language VARCHAR(10) DEFAULT 'en',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Ensure policies on user_preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fix is_platform_admin to be strictly safe and avoid recursion
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id AND role = 'platform_admin'
  );
$$;

-- Fix get_user_tenant_id to be strictly safe and handle missing preferences
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(check_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_real_platform_admin BOOLEAN;
  v_override_enabled BOOLEAN;
  v_override_tenant_id UUID;
  v_role_tenant_id UUID;
BEGIN
  -- Check if user is REALLY a platform admin
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = check_user_id AND role = 'platform_admin')
  INTO v_is_real_platform_admin;

  -- Check if override is enabled in preferences (safely)
  BEGIN
      SELECT 
        (admin_override_enabled IS TRUE),
        tenant_id
      INTO v_override_enabled, v_override_tenant_id
      FROM public.user_preferences
      WHERE user_id = check_user_id;
  EXCEPTION WHEN OTHERS THEN
      -- If table missing or other error, assume no override
      v_override_enabled := false;
  END;

  -- Return override tenant if applicable
  IF v_is_real_platform_admin AND v_override_enabled THEN
    RETURN v_override_tenant_id;
  END IF;

  -- Otherwise return normal role-based tenant
  SELECT tenant_id INTO v_role_tenant_id
  FROM public.user_roles
  WHERE user_id = check_user_id
  ORDER BY 
    CASE role 
      WHEN 'tenant_admin' THEN 1 
      WHEN 'franchise_admin' THEN 2 
      ELSE 3 
    END
  LIMIT 1;

  RETURN v_role_tenant_id;
END;
$$;

-- Ensure tenants RLS is correct and uses the safe functions
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON public.tenants;
CREATE POLICY "Platform admins can view all tenants"
  ON public.tenants FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view own tenant" ON public.tenants;
CREATE POLICY "Tenant admins can view own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

-- Insert default domains if they don't exist
INSERT INTO public.platform_domains (code, name, description)
SELECT 'LOGISTICS', 'Logistics', 'Logistics and Supply Chain Management'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_domains WHERE code = 'LOGISTICS');

INSERT INTO public.platform_domains (code, name, description)
SELECT 'REAL_ESTATE', 'Real Estate', 'Real Estate Management'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_domains WHERE code = 'REAL_ESTATE');

INSERT INTO public.platform_domains (code, name, description)
SELECT 'ECOMMERCE', 'E-Commerce', 'E-Commerce and Retail'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_domains WHERE code = 'ECOMMERCE');
