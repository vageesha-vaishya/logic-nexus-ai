-- Create app_role enum
CREATE TYPE public.app_role AS ENUM (
  'platform_admin',
  'tenant_admin',
  'franchise_admin',
  'user'
);

-- Create tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  domain TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'professional', 'enterprise')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create franchises table
CREATE TABLE public.franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address JSONB DEFAULT '{}'::jsonb,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role, tenant_id, franchise_id)
);

-- Create invitations table
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create helper functions (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = 'platform_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(check_user_id UUID, check_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = check_role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(check_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_roles
  WHERE user_id = check_user_id
    AND role IN ('tenant_admin', 'franchise_admin', 'user')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_franchise_id(check_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT franchise_id FROM public.user_roles
  WHERE user_id = check_user_id
    AND role IN ('franchise_admin', 'user')
  LIMIT 1;
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Platform admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view tenant profiles"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    public.get_user_tenant_id(id) = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Franchise admins can view franchise profiles"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    public.get_user_franchise_id(id) = public.get_user_franchise_id(auth.uid())
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Platform admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- RLS Policies for tenants
CREATE POLICY "Platform admins full access to tenants"
  ON public.tenants FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can update own tenant"
  ON public.tenants FOR UPDATE
  USING (id = public.get_user_tenant_id(auth.uid()));

-- RLS Policies for franchises
CREATE POLICY "Platform admins full access to franchises"
  ON public.franchises FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant franchises"
  ON public.franchises FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Franchise admins can view own franchise"
  ON public.franchises FOR SELECT
  USING (id = public.get_user_franchise_id(auth.uid()));

CREATE POLICY "Franchise admins can update own franchise"
  ON public.franchises FOR UPDATE
  USING (id = public.get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can view own franchise"
  ON public.franchises FOR SELECT
  USING (id = public.get_user_franchise_id(auth.uid()));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins full access to roles"
  ON public.user_roles FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant roles"
  ON public.user_roles FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Franchise admins can view franchise roles"
  ON public.user_roles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

-- RLS Policies for invitations
CREATE POLICY "Platform admins full access to invitations"
  ON public.invitations FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant invitations"
  ON public.invitations FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Franchise admins can manage franchise invitations"
  ON public.invitations FOR ALL
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

-- RLS Policies for audit_logs
CREATE POLICY "Platform admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view tenant audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    user_id IN (
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_franchises_updated_at BEFORE UPDATE ON public.franchises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX idx_user_roles_franchise_id ON public.user_roles(franchise_id);
CREATE INDEX idx_franchises_tenant_id ON public.franchises(tenant_id);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);