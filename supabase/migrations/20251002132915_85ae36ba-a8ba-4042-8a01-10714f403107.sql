-- Create custom_roles table for user-defined roles
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system_role BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Create custom_role_permissions table to store permissions for each custom role
CREATE TABLE IF NOT EXISTS public.custom_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role_id, permission_key)
);

-- Create user_custom_roles table to assign custom roles to users
CREATE TABLE IF NOT EXISTS public.user_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Enable RLS on custom_roles
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_roles
CREATE POLICY "Platform admins can manage all custom roles"
  ON public.custom_roles FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant custom roles"
  ON public.custom_roles FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant custom roles"
  ON public.custom_roles FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Enable RLS on custom_role_permissions
ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_role_permissions
CREATE POLICY "Platform admins can manage all custom role permissions"
  ON public.custom_role_permissions FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant custom role permissions"
  ON public.custom_role_permissions FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin') AND 
    role_id IN (SELECT id FROM public.custom_roles WHERE tenant_id = get_user_tenant_id(auth.uid()))
  );

CREATE POLICY "Users can view custom role permissions"
  ON public.custom_role_permissions FOR SELECT
  USING (
    role_id IN (SELECT id FROM public.custom_roles WHERE tenant_id = get_user_tenant_id(auth.uid()))
  );

-- Enable RLS on user_custom_roles
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_custom_roles
CREATE POLICY "Platform admins can manage all user custom roles"
  ON public.user_custom_roles FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant user custom roles"
  ON public.user_custom_roles FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Franchise admins can manage franchise user custom roles"
  ON public.user_custom_roles FOR ALL
  USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can view own custom roles"
  ON public.user_custom_roles FOR SELECT
  USING (user_id = auth.uid());

-- Create updated_at trigger for custom_roles
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user's custom role permissions
CREATE OR REPLACE FUNCTION public.get_user_custom_permissions(check_user_id UUID)
RETURNS TABLE(permission_key TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT crp.permission_key
  FROM public.user_custom_roles ucr
  JOIN public.custom_role_permissions crp ON ucr.role_id = crp.role_id
  JOIN public.custom_roles cr ON crp.role_id = cr.id
  WHERE ucr.user_id = check_user_id
    AND cr.is_active = true;
$$;