-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
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
DROP FUNCTION IF EXISTS public.has_role(check_user_id UUID, check_role public.app_role);
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

DROP FUNCTION IF EXISTS public.is_platform_admin(check_user_id UUID);
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(check_user_id, 'platform_admin'::public.app_role);
$$;

DROP FUNCTION IF EXISTS public.get_user_tenant_id(check_user_id UUID);
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

DROP FUNCTION IF EXISTS public.get_user_franchise_id(check_user_id UUID);
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
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Platform admins can view all profiles" ON public.profiles;
CREATE POLICY "Platform admins can view all profiles" ON public.profiles FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view tenant profiles" ON public.profiles;
CREATE POLICY "Tenant admins can view tenant profiles" ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    public.get_user_tenant_id(id) = public.get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Franchise admins can view franchise profiles" ON public.profiles;
CREATE POLICY "Franchise admins can view franchise profiles" ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    public.get_user_franchise_id(id) = public.get_user_franchise_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Platform admins can update all profiles" ON public.profiles;
CREATE POLICY "Platform admins can update all profiles" ON public.profiles FOR UPDATE
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can insert profiles" ON public.profiles;
CREATE POLICY "Platform admins can insert profiles" ON public.profiles FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- RLS Policies for tenants
DROP POLICY IF EXISTS "Platform admins full access to tenants" ON public.tenants;
CREATE POLICY "Platform admins full access to tenants" ON public.tenants FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view own tenant" ON public.tenants;
CREATE POLICY "Tenant admins can view own tenant" ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can update own tenant" ON public.tenants;
CREATE POLICY "Tenant admins can update own tenant" ON public.tenants FOR UPDATE
  USING (id = public.get_user_tenant_id(auth.uid()));

-- RLS Policies for franchises
DROP POLICY IF EXISTS "Platform admins full access to franchises" ON public.franchises;
CREATE POLICY "Platform admins full access to franchises" ON public.franchises FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant franchises" ON public.franchises;
CREATE POLICY "Tenant admins can manage tenant franchises" ON public.franchises FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can view own franchise" ON public.franchises;
CREATE POLICY "Franchise admins can view own franchise" ON public.franchises FOR SELECT
  USING (id = public.get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can update own franchise" ON public.franchises;
CREATE POLICY "Franchise admins can update own franchise" ON public.franchises FOR UPDATE
  USING (id = public.get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view own franchise" ON public.franchises;
CREATE POLICY "Users can view own franchise" ON public.franchises FOR SELECT
  USING (id = public.get_user_franchise_id(auth.uid()));

-- RLS Policies for user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins full access to roles" ON public.user_roles;
CREATE POLICY "Platform admins full access to roles" ON public.user_roles FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant roles" ON public.user_roles;
CREATE POLICY "Tenant admins can manage tenant roles" ON public.user_roles FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Franchise admins can view franchise roles" ON public.user_roles;
CREATE POLICY "Franchise admins can view franchise roles" ON public.user_roles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

-- RLS Policies for invitations
DROP POLICY IF EXISTS "Platform admins full access to invitations" ON public.invitations;
CREATE POLICY "Platform admins full access to invitations" ON public.invitations FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant invitations" ON public.invitations;
CREATE POLICY "Tenant admins can manage tenant invitations" ON public.invitations FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Franchise admins can manage franchise invitations" ON public.invitations;
CREATE POLICY "Franchise admins can manage franchise invitations" ON public.invitations FOR ALL
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

-- RLS Policies for audit_logs
DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Platform admins can view all audit logs" ON public.audit_logs FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view tenant audit logs" ON public.audit_logs;
CREATE POLICY "Tenant admins can view tenant audit logs" ON public.audit_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    user_id IN (
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- Trigger to auto-create profile on user signup
DROP FUNCTION IF EXISTS public.handle_new_user();
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating updated_at timestamp
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_franchises_updated_at ON public.franchises;
CREATE TRIGGER update_franchises_updated_at BEFORE UPDATE ON public.franchises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_franchise_id ON public.user_roles(franchise_id);
CREATE INDEX IF NOT EXISTS idx_franchises_tenant_id ON public.franchises(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
-- Create CRM enums
DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'account_type' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.account_type AS ENUM ('prospect','customer','partner','vendor');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['prospect','customer','partner','vendor'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'account_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.account_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'account_status' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.account_status AS ENUM ('active','inactive','pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['active','inactive','pending'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'account_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.account_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'lead_status' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.lead_status AS ENUM ('new','contacted','qualified','proposal','negotiation','won','lost');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['new','contacted','qualified','proposal','negotiation','won','lost'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'lead_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.lead_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'lead_source' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.lead_source AS ENUM ('website','referral','email','phone','social','event','other');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['website','referral','email','phone','social','event','other'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'lead_source' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.lead_source ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'activity_type' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.activity_type AS ENUM ('call','email','meeting','task','note');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['call','email','meeting','task','note'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'activity_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.activity_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'activity_status' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.activity_status AS ENUM ('planned','in_progress','completed','cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['planned','in_progress','completed','cancelled'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'activity_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.activity_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'priority_level' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.priority_level AS ENUM ('low','medium','high','urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['low','medium','high','urgent'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'priority_level' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.priority_level ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

-- Accounts table (Companies/Organizations)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  account_type public.account_type DEFAULT 'prospect',
  status public.account_status DEFAULT 'active',
  industry TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  billing_address JSONB DEFAULT '{}'::jsonb,
  shipping_address JSONB DEFAULT '{}'::jsonb,
  annual_revenue DECIMAL(15,2),
  employee_count INTEGER,
  description TEXT,
  owner_id UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Contacts table (People)
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  linkedin_url TEXT,
  address JSONB DEFAULT '{}'::jsonb,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  owner_id UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Leads table (Potential customers)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  status public.lead_status DEFAULT 'new',
  source public.lead_source DEFAULT 'other',
  estimated_value DECIMAL(15,2),
  expected_close_date DATE,
  description TEXT,
  notes TEXT,
  owner_id UUID REFERENCES public.profiles(id),
  converted_account_id UUID REFERENCES public.accounts(id),
  converted_contact_id UUID REFERENCES public.contacts(id),
  converted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activities table (Tasks, Calls, Meetings, Emails)
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  activity_type public.activity_type NOT NULL,
  status public.activity_status DEFAULT 'planned',
  priority public.priority_level DEFAULT 'medium',
  subject TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all CRM tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Accounts
DROP POLICY IF EXISTS "Platform admins can manage all accounts" ON public.accounts;
CREATE POLICY "Platform admins can manage all accounts" ON public.accounts FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant accounts" ON public.accounts;
CREATE POLICY "Tenant admins can manage tenant accounts" ON public.accounts FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Franchise admins can manage franchise accounts" ON public.accounts;
CREATE POLICY "Franchise admins can manage franchise accounts" ON public.accounts FOR ALL
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view franchise accounts" ON public.accounts;
CREATE POLICY "Users can view franchise accounts" ON public.accounts FOR SELECT
  USING (franchise_id = public.get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can create franchise accounts" ON public.accounts;
CREATE POLICY "Users can create franchise accounts" ON public.accounts FOR INSERT
  WITH CHECK (franchise_id = public.get_user_franchise_id(auth.uid()));

-- RLS Policies for Contacts
DROP POLICY IF EXISTS "Platform admins can manage all contacts" ON public.contacts;
CREATE POLICY "Platform admins can manage all contacts" ON public.contacts FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant contacts" ON public.contacts;
CREATE POLICY "Tenant admins can manage tenant contacts" ON public.contacts FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Franchise admins can manage franchise contacts" ON public.contacts;
CREATE POLICY "Franchise admins can manage franchise contacts" ON public.contacts FOR ALL
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view franchise contacts" ON public.contacts;
CREATE POLICY "Users can view franchise contacts" ON public.contacts FOR SELECT
  USING (franchise_id = public.get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can create franchise contacts" ON public.contacts;
CREATE POLICY "Users can create franchise contacts" ON public.contacts FOR INSERT
  WITH CHECK (franchise_id = public.get_user_franchise_id(auth.uid()));

-- RLS Policies for Leads
DROP POLICY IF EXISTS "Platform admins can manage all leads" ON public.leads;
CREATE POLICY "Platform admins can manage all leads" ON public.leads FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant leads" ON public.leads;
CREATE POLICY "Tenant admins can manage tenant leads" ON public.leads FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Franchise admins can manage franchise leads" ON public.leads;
CREATE POLICY "Franchise admins can manage franchise leads" ON public.leads FOR ALL
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view franchise leads" ON public.leads;
CREATE POLICY "Users can view franchise leads" ON public.leads FOR SELECT
  USING (franchise_id = public.get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can create franchise leads" ON public.leads;
CREATE POLICY "Users can create franchise leads" ON public.leads FOR INSERT
  WITH CHECK (franchise_id = public.get_user_franchise_id(auth.uid()));

-- RLS Policies for Activities
DROP POLICY IF EXISTS "Platform admins can manage all activities" ON public.activities;
CREATE POLICY "Platform admins can manage all activities" ON public.activities FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant activities" ON public.activities;
CREATE POLICY "Tenant admins can manage tenant activities" ON public.activities FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Franchise admins can manage franchise activities" ON public.activities;
CREATE POLICY "Franchise admins can manage franchise activities" ON public.activities FOR ALL
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view assigned activities" ON public.activities;
CREATE POLICY "Users can view assigned activities" ON public.activities FOR SELECT
  USING (
    assigned_to = auth.uid() OR
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can create activities" ON public.activities;
CREATE POLICY "Users can create activities" ON public.activities FOR INSERT
  WITH CHECK (franchise_id = public.get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own activities" ON public.activities;
CREATE POLICY "Users can update own activities" ON public.activities FOR UPDATE
  USING (assigned_to = auth.uid());

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_activities_updated_at ON public.activities;
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON public.accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_franchise_id ON public.accounts(franchise_id);
CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON public.accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts(status);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON public.contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_franchise_id ON public.contacts(franchise_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON public.contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_id ON public.contacts(owner_id);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_franchise_id ON public.leads(franchise_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON public.leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

CREATE INDEX IF NOT EXISTS idx_activities_tenant_id ON public.activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_franchise_id ON public.activities(franchise_id);
CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON public.activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_account_id ON public.activities(account_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON public.activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON public.activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON public.activities(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_status ON public.activities(status);-- Update RLS policies for profiles table to handle tenant/franchise access

-- Drop existing policies that need modification
DROP POLICY IF EXISTS "Franchise admins can view franchise profiles" ON public.profiles;
DROP POLICY IF EXISTS "Tenant admins can view tenant profiles" ON public.profiles;

-- Tenant admins can view all profiles in their tenant (including all franchises)
DROP POLICY IF EXISTS "Tenant admins can view tenant profiles" ON public.profiles;
CREATE POLICY "Tenant admins can view tenant profiles" ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'tenant_admin') AND
  id IN (
    SELECT user_id FROM public.user_roles
    WHERE tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Franchise admins can view profiles in their franchise only
DROP POLICY IF EXISTS "Franchise admins can view franchise profiles" ON public.profiles;
CREATE POLICY "Franchise admins can view franchise profiles" ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'franchise_admin') AND
  id IN (
    SELECT user_id FROM public.user_roles
    WHERE franchise_id = get_user_franchise_id(auth.uid())
  )
);

-- Platform admins can update user roles
DROP POLICY IF EXISTS "Platform admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Platform admins can update user roles" ON public.user_roles;
CREATE POLICY "Platform admins can update user roles" ON public.user_roles
FOR UPDATE
USING (is_platform_admin(auth.uid()));

-- Tenant admins can update roles for users in their tenant
DROP POLICY IF EXISTS "Tenant admins can update tenant user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Tenant admins can update tenant user roles" ON public.user_roles;
CREATE POLICY "Tenant admins can update tenant user roles" ON public.user_roles
FOR UPDATE
USING (
  has_role(auth.uid(), 'tenant_admin') AND
  tenant_id = get_user_tenant_id(auth.uid())
);

-- Franchise admins can update roles for users in their franchise
DROP POLICY IF EXISTS "Franchise admins can update franchise user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Franchise admins can update franchise user roles" ON public.user_roles;
CREATE POLICY "Franchise admins can update franchise user roles" ON public.user_roles
FOR UPDATE
USING (
  has_role(auth.uid(), 'franchise_admin') AND
  franchise_id = get_user_franchise_id(auth.uid())
);-- Create opportunity_stage enum
DO $$ BEGIN
    CREATE TYPE opportunity_stage AS ENUM (
  'prospecting',
  'qualification',
  'needs_analysis',
  'value_proposition',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create opportunities table
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  
  -- Basic Information
  name TEXT NOT NULL,
  description TEXT,
  stage opportunity_stage NOT NULL DEFAULT 'prospecting',
  amount NUMERIC(15, 2),
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  close_date DATE,
  
  -- Relationships
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  owner_id UUID,
  
  -- Sales Details
  lead_source lead_source,
  next_step TEXT,
  competitors TEXT,
  campaign_id UUID,
  
  -- Additional Details
  type TEXT,
  forecast_category TEXT,
  expected_revenue NUMERIC(15, 2),
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_close_date CHECK (close_date >= CURRENT_DATE OR stage IN ('closed_won', 'closed_lost'))
);

-- Enable RLS
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Platform admins can manage all opportunities" ON public.opportunities;
CREATE POLICY "Platform admins can manage all opportunities" ON public.opportunities
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant opportunities" ON public.opportunities;
CREATE POLICY "Tenant admins can manage tenant opportunities" ON public.opportunities
  FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Franchise admins can manage franchise opportunities" ON public.opportunities;
CREATE POLICY "Franchise admins can manage franchise opportunities" ON public.opportunities
  FOR ALL
  USING (
    has_role(auth.uid(), 'franchise_admin') 
    AND franchise_id = get_user_franchise_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view franchise opportunities" ON public.opportunities;
CREATE POLICY "Users can view franchise opportunities" ON public.opportunities
  FOR SELECT
  USING (franchise_id = get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can create franchise opportunities" ON public.opportunities;
CREATE POLICY "Users can create franchise opportunities" ON public.opportunities
  FOR INSERT
  WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update assigned opportunities" ON public.opportunities;
CREATE POLICY "Users can update assigned opportunities" ON public.opportunities
  FOR UPDATE
  USING (owner_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant ON public.opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_franchise ON public.opportunities(franchise_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_account ON public.opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_contact ON public.opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON public.opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON public.opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_close_date ON public.opportunities(close_date);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_opportunities_updated_at ON public.opportunities;
CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Add lead scoring and workflow fields
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'unqualified',
ADD COLUMN IF NOT EXISTS last_activity_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS conversion_probability INTEGER;

-- Create lead scoring criteria table
CREATE TABLE IF NOT EXISTS public.lead_scoring_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  criteria_type TEXT NOT NULL,
  criteria_value TEXT NOT NULL,
  score_points INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.lead_scoring_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_scoring_rules
DROP POLICY IF EXISTS "Platform admins can manage all scoring rules" ON public.lead_scoring_rules;
CREATE POLICY "Platform admins can manage all scoring rules" ON public.lead_scoring_rules
FOR ALL
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant scoring rules" ON public.lead_scoring_rules;
CREATE POLICY "Tenant admins can manage tenant scoring rules" ON public.lead_scoring_rules
FOR ALL
USING (
  has_role(auth.uid(), 'tenant_admin') 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Create lead assignment rules table
CREATE TABLE IF NOT EXISTS public.lead_assignment_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  criteria JSONB NOT NULL,
  assigned_to UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.lead_assignment_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_assignment_rules
DROP POLICY IF EXISTS "Platform admins can manage all assignment rules" ON public.lead_assignment_rules;
CREATE POLICY "Platform admins can manage all assignment rules" ON public.lead_assignment_rules
FOR ALL
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant assignment rules" ON public.lead_assignment_rules;
CREATE POLICY "Tenant admins can manage tenant assignment rules" ON public.lead_assignment_rules
FOR ALL
USING (
  has_role(auth.uid(), 'tenant_admin') 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Create function to calculate lead score
DROP FUNCTION IF EXISTS public.calculate_lead_score(lead_id UUID);
CREATE OR REPLACE FUNCTION public.calculate_lead_score(lead_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_score INTEGER := 0;
  lead_rec RECORD;
BEGIN
  SELECT * INTO lead_rec FROM public.leads WHERE id = lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Score based on status
  total_score := total_score + CASE lead_rec.status
    WHEN 'qualified' THEN 30
    WHEN 'contacted' THEN 20
    WHEN 'proposal' THEN 40
    WHEN 'negotiation' THEN 50
    WHEN 'new' THEN 10
    ELSE 0
  END;

  -- Score based on estimated value
  IF lead_rec.estimated_value IS NOT NULL THEN
    total_score := total_score + CASE
      WHEN lead_rec.estimated_value >= 100000 THEN 30
      WHEN lead_rec.estimated_value >= 50000 THEN 20
      WHEN lead_rec.estimated_value >= 10000 THEN 10
      ELSE 5
    END;
  END IF;

  -- Score based on recent activity
  IF lead_rec.last_activity_date IS NOT NULL THEN
    IF lead_rec.last_activity_date > (NOW() - INTERVAL '7 days') THEN
      total_score := total_score + 15;
    ELSIF lead_rec.last_activity_date > (NOW() - INTERVAL '30 days') THEN
      total_score := total_score + 10;
    END IF;
  END IF;

  -- Score based on source
  total_score := total_score + CASE lead_rec.source
    WHEN 'referral' THEN 15
    WHEN 'website' THEN 10
    WHEN 'event' THEN 12
    ELSE 5
  END;

  RETURN total_score;
END;
$$;

-- Create trigger to update lead score
DROP FUNCTION IF EXISTS public.update_lead_score();
CREATE OR REPLACE FUNCTION public.update_lead_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.lead_score := public.calculate_lead_score(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_lead_score ON public.leads;
CREATE TRIGGER trigger_update_lead_score
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_score();-- Fix search_path security warnings for lead scoring functions
DROP FUNCTION IF EXISTS public.calculate_lead_score(lead_id UUID);
CREATE OR REPLACE FUNCTION public.calculate_lead_score(lead_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_score INTEGER := 0;
  lead_rec RECORD;
BEGIN
  SELECT * INTO lead_rec FROM public.leads WHERE id = lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Score based on status
  total_score := total_score + CASE lead_rec.status
    WHEN 'qualified' THEN 30
    WHEN 'contacted' THEN 20
    WHEN 'proposal' THEN 40
    WHEN 'negotiation' THEN 50
    WHEN 'new' THEN 10
    ELSE 0
  END;

  -- Score based on estimated value
  IF lead_rec.estimated_value IS NOT NULL THEN
    total_score := total_score + CASE
      WHEN lead_rec.estimated_value >= 100000 THEN 30
      WHEN lead_rec.estimated_value >= 50000 THEN 20
      WHEN lead_rec.estimated_value >= 10000 THEN 10
      ELSE 5
    END;
  END IF;

  -- Score based on recent activity
  IF lead_rec.last_activity_date IS NOT NULL THEN
    IF lead_rec.last_activity_date > (NOW() - INTERVAL '7 days') THEN
      total_score := total_score + 15;
    ELSIF lead_rec.last_activity_date > (NOW() - INTERVAL '30 days') THEN
      total_score := total_score + 10;
    END IF;
  END IF;

  -- Score based on source
  total_score := total_score + CASE lead_rec.source
    WHEN 'referral' THEN 15
    WHEN 'website' THEN 10
    WHEN 'event' THEN 12
    ELSE 5
  END;

  RETURN total_score;
END;
$$;

DROP FUNCTION IF EXISTS public.update_lead_score();
CREATE OR REPLACE FUNCTION public.update_lead_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.lead_score := public.calculate_lead_score(NEW.id);
  RETURN NEW;
END;
$$;-- Add custom_fields column to leads table for flexible data storage
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Add index for better performance on custom fields queries
CREATE INDEX IF NOT EXISTS idx_leads_custom_fields ON public.leads USING GIN (custom_fields);-- Create assignment history table
CREATE TABLE IF NOT EXISTS public.lead_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_from UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id) NOT NULL,
  assignment_method TEXT NOT NULL, -- 'manual', 'round_robin', 'rule_based', 'territory'
  rule_id UUID REFERENCES public.lead_assignment_rules(id),
  reason TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  tenant_id UUID NOT NULL,
  franchise_id UUID
);

-- Enable RLS
ALTER TABLE public.lead_assignment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all assignment history" ON public.lead_assignment_history;
CREATE POLICY "Platform admins can manage all assignment history" ON public.lead_assignment_history FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view tenant assignment history" ON public.lead_assignment_history;
CREATE POLICY "Tenant admins can view tenant assignment history" ON public.lead_assignment_history FOR SELECT
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can view franchise assignment history" ON public.lead_assignment_history;
CREATE POLICY "Franchise admins can view franchise assignment history" ON public.lead_assignment_history FOR SELECT
  USING (has_role(auth.uid(), 'franchise_admin'::app_role) AND franchise_id = get_user_franchise_id(auth.uid()));

-- Create user capacity/availability table
CREATE TABLE IF NOT EXISTS public.user_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  max_leads INTEGER DEFAULT 50,
  current_leads INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  last_assigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.user_capacity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all user capacity" ON public.user_capacity;
CREATE POLICY "Platform admins can manage all user capacity" ON public.user_capacity FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant user capacity" ON public.user_capacity;
CREATE POLICY "Tenant admins can manage tenant user capacity" ON public.user_capacity FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view own capacity" ON public.user_capacity;
CREATE POLICY "Users can view own capacity" ON public.user_capacity FOR SELECT
  USING (user_id = auth.uid());

-- Create assignment queue table
CREATE TABLE IF NOT EXISTS public.lead_assignment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'assigned', 'failed'
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.lead_assignment_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all assignment queue" ON public.lead_assignment_queue;
CREATE POLICY "Platform admins can manage all assignment queue" ON public.lead_assignment_queue FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view tenant assignment queue" ON public.lead_assignment_queue;
CREATE POLICY "Tenant admins can view tenant assignment queue" ON public.lead_assignment_queue FOR SELECT
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

-- Create territories table
CREATE TABLE IF NOT EXISTS public.territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all territories" ON public.territories;
CREATE POLICY "Platform admins can manage all territories" ON public.territories FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant territories" ON public.territories;
CREATE POLICY "Tenant admins can manage tenant territories" ON public.territories FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

-- Create territory assignments (users to territories)
CREATE TABLE IF NOT EXISTS public.territory_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(territory_id, user_id)
);

-- Enable RLS
ALTER TABLE public.territory_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all territory assignments" ON public.territory_assignments;
CREATE POLICY "Platform admins can manage all territory assignments" ON public.territory_assignments FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage territory assignments" ON public.territory_assignments;
CREATE POLICY "Tenant admins can manage territory assignments" ON public.territory_assignments FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) AND 
    territory_id IN (
      SELECT id FROM public.territories WHERE tenant_id = get_user_tenant_id(auth.uid())
    )
  );

-- Update lead_assignment_rules to include more options
ALTER TABLE public.lead_assignment_rules 
  ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'round_robin', -- 'round_robin', 'load_balance', 'territory', 'specific_user'
  ADD COLUMN IF NOT EXISTS territory_id UUID REFERENCES public.territories(id),
  ADD COLUMN IF NOT EXISTS max_leads_per_user INTEGER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assignment_history_lead ON public.lead_assignment_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_assigned_to ON public.lead_assignment_history(assigned_to);
CREATE INDEX IF NOT EXISTS idx_user_capacity_user ON public.user_capacity(user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_queue_status ON public.lead_assignment_queue(status);
CREATE INDEX IF NOT EXISTS idx_territories_tenant ON public.territories(tenant_id);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_user_capacity_updated_at ON public.user_capacity;
CREATE TRIGGER update_user_capacity_updated_at
  BEFORE UPDATE ON public.user_capacity
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_territories_updated_at ON public.territories;
CREATE TRIGGER update_territories_updated_at
  BEFORE UPDATE ON public.territories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Create function to increment user lead count
DROP FUNCTION IF EXISTS public.increment_user_lead_count(p_user_id UUID, p_tenant_id UUID);
CREATE OR REPLACE FUNCTION public.increment_user_lead_count(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update user capacity
  INSERT INTO public.user_capacity (user_id, tenant_id, current_leads, last_assigned_at)
  VALUES (p_user_id, p_tenant_id, 1, NOW())
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET
    current_leads = user_capacity.current_leads + 1,
    last_assigned_at = NOW();
END;
$$;

-- Create function to decrement user lead count
DROP FUNCTION IF EXISTS public.decrement_user_lead_count(p_user_id UUID, p_tenant_id UUID);
CREATE OR REPLACE FUNCTION public.decrement_user_lead_count(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_capacity
  SET current_leads = GREATEST(0, current_leads - 1)
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
END;
$$;-- Create email accounts table
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  provider TEXT NOT NULL CHECK (provider IN ('office365', 'gmail', 'smtp_imap', 'other')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- OAuth tokens for Office365/Gmail
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- SMTP/IMAP settings for generic providers
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_use_tls BOOLEAN DEFAULT true,
  imap_host TEXT,
  imap_port INTEGER,
  imap_username TEXT,
  imap_password TEXT,
  imap_use_ssl BOOLEAN DEFAULT true,
  
  -- Sync settings
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_frequency INTEGER DEFAULT 5, -- minutes
  auto_sync_enabled BOOLEAN DEFAULT true,
  
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, email_address)
);

-- Create emails table
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  
  -- Email metadata
  message_id TEXT NOT NULL, -- Provider's message ID
  thread_id TEXT,
  subject TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {email, name}
  cc_emails JSONB DEFAULT '[]'::jsonb,
  bcc_emails JSONB DEFAULT '[]'::jsonb,
  reply_to TEXT,
  
  -- Content
  body_text TEXT,
  body_html TEXT,
  snippet TEXT, -- Preview/summary
  
  -- Attachments
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb, -- Array of {name, size, type, url}
  
  -- Status and flags
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT DEFAULT 'received' CHECK (status IN ('draft', 'sending', 'sent', 'received', 'failed', 'bounced')),
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  
  -- Categorization
  folder TEXT DEFAULT 'inbox', -- inbox, sent, drafts, trash, spam, archive
  labels JSONB DEFAULT '[]'::jsonb, -- Array of label names
  category TEXT, -- primary, social, promotions, updates, forums
  
  -- Associations
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  account_id_crm UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(account_id, message_id)
);

-- Create email filters table
CREATE TABLE IF NOT EXISTS public.email_filters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0, -- Higher priority filters run first
  is_active BOOLEAN DEFAULT true,
  
  -- Filter conditions (all must match)
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {field, operator, value}
  -- field: from, to, subject, body, has_attachment, etc.
  -- operator: contains, equals, starts_with, ends_with, matches, etc.
  
  -- Actions to perform
  actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {action, value}
  -- action: move_to_folder, add_label, mark_as_read, mark_as_starred, forward_to, delete, etc.
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create email templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  created_by UUID,
  
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  
  -- Template variables
  variables JSONB DEFAULT '[]'::jsonb, -- Array of variable names that can be replaced
  
  category TEXT, -- sales, support, marketing, etc.
  is_shared BOOLEAN DEFAULT false, -- Available to all users in tenant
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON public.email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_tenant_id ON public.email_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_franchise_id ON public.email_accounts(franchise_id);

CREATE INDEX IF NOT EXISTS idx_emails_account_id ON public.emails(account_id);
CREATE INDEX IF NOT EXISTS idx_emails_tenant_id ON public.emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emails_franchise_id ON public.emails(franchise_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON public.emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON public.emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_direction ON public.emails(direction);
CREATE INDEX IF NOT EXISTS idx_emails_folder ON public.emails(folder);
CREATE INDEX IF NOT EXISTS idx_emails_lead_id ON public.emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_emails_contact_id ON public.emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON public.emails(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_filters_user_id ON public.email_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_email_filters_account_id ON public.email_filters(account_id);
CREATE INDEX IF NOT EXISTS idx_email_filters_priority ON public.email_filters(priority DESC);

CREATE INDEX IF NOT EXISTS idx_email_templates_tenant_id ON public.email_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_franchise_id ON public.email_templates(franchise_id);

-- Enable RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_accounts
DROP POLICY IF EXISTS "Users can view own email accounts" ON public.email_accounts;
CREATE POLICY "Users can view own email accounts" ON public.email_accounts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own email accounts" ON public.email_accounts;
CREATE POLICY "Users can create own email accounts" ON public.email_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own email accounts" ON public.email_accounts;
CREATE POLICY "Users can update own email accounts" ON public.email_accounts FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own email accounts" ON public.email_accounts;
CREATE POLICY "Users can delete own email accounts" ON public.email_accounts FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins can manage all email accounts" ON public.email_accounts;
CREATE POLICY "Platform admins can manage all email accounts" ON public.email_accounts FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS Policies for emails
DROP POLICY IF EXISTS "Users can view emails from their accounts" ON public.emails;
CREATE POLICY "Users can view emails from their accounts" ON public.emails FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create emails" ON public.emails;
CREATE POLICY "Users can create emails" ON public.emails FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their emails" ON public.emails;
CREATE POLICY "Users can update their emails" ON public.emails FOR UPDATE
  USING (
    account_id IN (
      SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform admins can manage all emails" ON public.emails;
CREATE POLICY "Platform admins can manage all emails" ON public.emails FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS Policies for email_filters
DROP POLICY IF EXISTS "Users can manage own email filters" ON public.email_filters;
CREATE POLICY "Users can manage own email filters" ON public.email_filters FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins can manage all email filters" ON public.email_filters;
CREATE POLICY "Platform admins can manage all email filters" ON public.email_filters FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS Policies for email_templates
DROP POLICY IF EXISTS "Users can view tenant templates" ON public.email_templates;
CREATE POLICY "Users can view tenant templates" ON public.email_templates FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) AND
    (is_shared = true OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create templates" ON public.email_templates;
CREATE POLICY "Users can create templates" ON public.email_templates FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid()) AND
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update own templates" ON public.email_templates;
CREATE POLICY "Users can update own templates" ON public.email_templates FOR UPDATE
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own templates" ON public.email_templates;
CREATE POLICY "Users can delete own templates" ON public.email_templates FOR DELETE
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Platform admins can manage all templates" ON public.email_templates;
CREATE POLICY "Platform admins can manage all templates" ON public.email_templates FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_email_accounts_updated_at ON public.email_accounts;
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_emails_updated_at ON public.emails;
CREATE TRIGGER update_emails_updated_at
  BEFORE UPDATE ON public.emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_filters_updated_at ON public.email_filters;
CREATE TRIGGER update_email_filters_updated_at
  BEFORE UPDATE ON public.email_filters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Make tenant_id nullable in email_accounts to support platform admins
ALTER TABLE public.email_accounts ALTER COLUMN tenant_id DROP NOT NULL;

-- Update RLS policies for email_accounts to handle null tenant_id
DROP POLICY IF EXISTS "Platform admins can manage all email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can create own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can view own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can update own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can delete own email accounts" ON public.email_accounts;

-- Recreate policies with proper null handling
DROP POLICY IF EXISTS "Platform admins can manage all email accounts" ON public.email_accounts;
CREATE POLICY "Platform admins can manage all email accounts" ON public.email_accounts
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can manage own email accounts" ON public.email_accounts;
CREATE POLICY "Users can manage own email accounts" ON public.email_accounts
  FOR ALL
  USING (user_id = auth.uid());-- Create OAuth configurations table
CREATE TABLE IF NOT EXISTS public.oauth_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('office365', 'gmail', 'other')),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  tenant_id_provider TEXT, -- For Office 365 Azure AD tenant ID
  redirect_uri TEXT NOT NULL,
  scopes JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.oauth_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage own OAuth configs" ON public.oauth_configurations;
CREATE POLICY "Users can manage own OAuth configs" ON public.oauth_configurations
  FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins can manage all OAuth configs" ON public.oauth_configurations;
CREATE POLICY "Platform admins can manage all OAuth configs" ON public.oauth_configurations
  FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Create index
CREATE INDEX IF NOT EXISTS idx_oauth_configurations_user_provider ON public.oauth_configurations(user_id, provider);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_oauth_configurations_updated_at ON public.oauth_configurations;
CREATE TRIGGER update_oauth_configurations_updated_at
  BEFORE UPDATE ON public.oauth_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Make tenant_id nullable in emails table for platform admins
ALTER TABLE public.emails ALTER COLUMN tenant_id DROP NOT NULL;-- Optimize email address searches
CREATE INDEX IF NOT EXISTS idx_emails_from_email_lower ON public.emails (lower(from_email));

-- GIN indexes on recipient arrays for JSONB containment lookups
CREATE INDEX IF NOT EXISTS idx_emails_to_emails_gin ON public.emails USING GIN (to_emails jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_emails_cc_emails_gin ON public.emails USING GIN (cc_emails jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_emails_bcc_emails_gin ON public.emails USING GIN (bcc_emails jsonb_path_ops);-- Add additional fields to emails table for better email management
ALTER TABLE public.emails
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS importance text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS in_reply_to text,
ADD COLUMN IF NOT EXISTS email_references text[],
ADD COLUMN IF NOT EXISTS size_bytes integer,
ADD COLUMN IF NOT EXISTS raw_headers jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS conversation_id text,
ADD COLUMN IF NOT EXISTS internet_message_id text,
ADD COLUMN IF NOT EXISTS has_inline_images boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_error text,
ADD COLUMN IF NOT EXISTS last_sync_attempt timestamp with time zone;

-- Add index for better performance on Office 365 conversation tracking
CREATE INDEX IF NOT EXISTS idx_emails_conversation_id ON public.emails(conversation_id);
CREATE INDEX IF NOT EXISTS idx_emails_internet_message_id ON public.emails(internet_message_id);
CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to ON public.emails(in_reply_to);

-- Add index for sync error tracking
CREATE INDEX IF NOT EXISTS idx_emails_sync_error ON public.emails(sync_error) WHERE sync_error IS NOT NULL;-- Create custom_roles table for user-defined roles
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
DROP POLICY IF EXISTS "Platform admins can manage all custom roles" ON public.custom_roles;
CREATE POLICY "Platform admins can manage all custom roles" ON public.custom_roles FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant custom roles" ON public.custom_roles;
CREATE POLICY "Tenant admins can manage tenant custom roles" ON public.custom_roles FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant custom roles" ON public.custom_roles;
CREATE POLICY "Users can view tenant custom roles" ON public.custom_roles FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Enable RLS on custom_role_permissions
ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_role_permissions
DROP POLICY IF EXISTS "Platform admins can manage all custom role permissions" ON public.custom_role_permissions;
CREATE POLICY "Platform admins can manage all custom role permissions" ON public.custom_role_permissions FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant custom role permissions" ON public.custom_role_permissions;
CREATE POLICY "Tenant admins can manage tenant custom role permissions" ON public.custom_role_permissions FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin') AND 
    role_id IN (SELECT id FROM public.custom_roles WHERE tenant_id = get_user_tenant_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Users can view custom role permissions" ON public.custom_role_permissions;
CREATE POLICY "Users can view custom role permissions" ON public.custom_role_permissions FOR SELECT
  USING (
    role_id IN (SELECT id FROM public.custom_roles WHERE tenant_id = get_user_tenant_id(auth.uid()))
  );

-- Enable RLS on user_custom_roles
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_custom_roles
DROP POLICY IF EXISTS "Platform admins can manage all user custom roles" ON public.user_custom_roles;
CREATE POLICY "Platform admins can manage all user custom roles" ON public.user_custom_roles FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant user custom roles" ON public.user_custom_roles;
CREATE POLICY "Tenant admins can manage tenant user custom roles" ON public.user_custom_roles FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can manage franchise user custom roles" ON public.user_custom_roles;
CREATE POLICY "Franchise admins can manage franchise user custom roles" ON public.user_custom_roles FOR ALL
  USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view own custom roles" ON public.user_custom_roles;
CREATE POLICY "Users can view own custom roles" ON public.user_custom_roles FOR SELECT
  USING (user_id = auth.uid());

-- Create updated_at trigger for custom_roles
DROP TRIGGER IF EXISTS update_custom_roles_updated_at ON public.custom_roles;
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user's custom role permissions
DROP FUNCTION IF EXISTS public.get_user_custom_permissions(check_user_id UUID);
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
$$;-- Add access_type column to custom_role_permissions to support grant/deny
ALTER TABLE public.custom_role_permissions 
ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'grant' 
CHECK (access_type IN ('grant', 'deny'));

-- Drop and recreate the function with new return type
DROP FUNCTION IF EXISTS public.get_user_custom_permissions(check_user_id UUID);
CREATE OR REPLACE FUNCTION public.get_user_custom_permissions(check_user_id UUID)
RETURNS TABLE(permission_key TEXT, access_type TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT crp.permission_key, crp.access_type
  FROM public.user_custom_roles ucr
  JOIN public.custom_role_permissions crp ON ucr.role_id = crp.role_id
  JOIN public.custom_roles cr ON crp.role_id = cr.id
  WHERE ucr.user_id = check_user_id
    AND cr.is_active = true
  ORDER BY crp.permission_key;
$$;-- Remove duplicate platform_admin roles (keep only the first one for each user)
DELETE FROM public.user_roles
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, role) id
  FROM public.user_roles
  ORDER BY user_id, role, assigned_at ASC
);

-- Add unique constraint to prevent duplicate role assignments
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_role_unique;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role);-- Create function to handle lead assignment in a transaction
create or replace function assign_lead_with_transaction(
  p_lead_id uuid,
  p_assigned_to uuid,
  p_assignment_method text,
  p_rule_id uuid,
  p_tenant_id uuid,
  p_franchise_id uuid
) returns void as $$
begin
  -- Start transaction
  begin
    -- Update lead owner
    update leads
    set owner_id = p_assigned_to
    where id = p_lead_id;

    -- Record assignment history
    insert into lead_assignment_history (
      lead_id,
      assigned_to,
      assignment_method,
      rule_id,
      tenant_id,
      franchise_id,
      assigned_by
    ) values (
      p_lead_id,
      p_assigned_to,
      p_assignment_method,
      p_rule_id,
      p_tenant_id,
      p_franchise_id,
      null -- automated assignment
    );

    -- Update user capacity
    update user_capacity
    set 
      current_leads = current_leads + 1,
      last_assigned_at = now()
    where user_id = p_assigned_to
    and tenant_id = p_tenant_id;

    -- Commit transaction
    commit;
  exception
    when others then
      -- Rollback transaction on error
      rollback;
      raise;
  end;
end;
$$ language plpgsql;-- Add parent_account_id column to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS parent_account_id uuid;

-- Add foreign key constraint (self-referencing)
ALTER TABLE public.accounts ADD CONSTRAINT fk_parent_account FOREIGN KEY (parent_account_id)
REFERENCES public.accounts(id)
ON DELETE SET NULL;

-- Add check constraint to prevent self-reference
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS chk_not_self_parent;
ALTER TABLE public.accounts ADD CONSTRAINT chk_not_self_parent CHECK (id != parent_account_id);

-- Add index for performance on parent lookups
CREATE INDEX IF NOT EXISTS idx_accounts_parent_id ON public.accounts(parent_account_id);

-- Add index for tenant + parent queries
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_parent ON public.accounts(tenant_id, parent_account_id);-- Phase 0: Subscription & Billing Infrastructure

-- Create enum types for subscription system
DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'subscription_tier' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.subscription_tier AS ENUM ('free','basic','starter','business','professional','enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['free','basic','starter','business','professional','enterprise'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'subscription_tier' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.subscription_tier ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'billing_period' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.billing_period AS ENUM ('monthly','annual');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['monthly','annual'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'billing_period' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.billing_period ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'subscription_status' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.subscription_status AS ENUM ('active','trial','past_due','canceled','expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['active','trial','past_due','canceled','expired'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'subscription_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.subscription_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'plan_type' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.plan_type AS ENUM ('crm_base','service_addon','bundle');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['crm_base','service_addon','bundle'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'plan_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.plan_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

-- 1. Subscription Plans Table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan_type plan_type NOT NULL DEFAULT 'crm_base',
  tier subscription_tier,
  billing_period billing_period NOT NULL DEFAULT 'monthly',
  price_monthly NUMERIC(10,2) NOT NULL,
  price_annual NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tenant Subscriptions Table
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'trial',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, plan_id, status)
);

-- 3. Usage Records Table
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  feature_key TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  limit_count INTEGER,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Subscription Invoices Table
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT UNIQUE,
  amount_due NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  invoice_pdf_url TEXT,
  billing_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Subscription Features Table
CREATE TABLE IF NOT EXISTS public.subscription_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  feature_category TEXT NOT NULL,
  description TEXT,
  is_usage_based BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Update Tenants Table with Stripe fields
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS payment_method JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}'::jsonb;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant ON public.tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON public.tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe ON public.tenant_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_feature ON public.usage_records(tenant_id, feature_key);
CREATE INDEX IF NOT EXISTS idx_usage_records_period ON public.usage_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_tenant ON public.subscription_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_stripe ON public.subscription_invoices(stripe_invoice_id);

-- Create helper function: Check if tenant has a specific feature
DROP FUNCTION IF EXISTS public.tenant_has_feature(_tenant_id UUID, _feature_key TEXT);
CREATE OR REPLACE FUNCTION public.tenant_has_feature(
  _tenant_id UUID,
  _feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_subscriptions ts
    JOIN public.subscription_plans sp ON ts.plan_id = sp.id
    WHERE ts.tenant_id = _tenant_id
      AND ts.status = 'active'
      AND ts.current_period_end > now()
      AND (
        sp.features @> jsonb_build_array(jsonb_build_object('key', _feature_key))
        OR sp.features @> jsonb_build_array(_feature_key)
      )
  );
$$;

-- Create helper function: Check usage limit for a feature
DROP FUNCTION IF EXISTS public.check_usage_limit(_tenant_id UUID, _feature_key TEXT);
CREATE OR REPLACE FUNCTION public.check_usage_limit(
  _tenant_id UUID,
  _feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_usage INTEGER;
  usage_limit INTEGER;
BEGIN
  -- Get current usage for the current period
  SELECT usage_count, limit_count
  INTO current_usage, usage_limit
  FROM public.usage_records
  WHERE tenant_id = _tenant_id
    AND feature_key = _feature_key
    AND period_start <= now()
    AND period_end >= now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no usage record exists, assume allowed
  IF current_usage IS NULL THEN
    RETURN true;
  END IF;
  
  -- If no limit set, assume unlimited
  IF usage_limit IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if under limit
  RETURN current_usage < usage_limit;
END;
$$;

-- Create helper function: Increment feature usage
DROP FUNCTION IF EXISTS public.increment_feature_usage(_tenant_id UUID, _feature_key TEXT, _increment INTEGER);
CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  _tenant_id UUID,
  _feature_key TEXT,
  _increment INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usage_records (
    tenant_id,
    feature_key,
    usage_count,
    period_start,
    period_end
  )
  VALUES (
    _tenant_id,
    _feature_key,
    _increment,
    date_trunc('month', now()),
    date_trunc('month', now()) + INTERVAL '1 month'
  )
  ON CONFLICT (tenant_id, feature_key, period_start)
  DO UPDATE SET
    usage_count = usage_records.usage_count + _increment,
    updated_at = now();
END;
$$;

-- Create helper function: Get tenant's current plan tier
DROP FUNCTION IF EXISTS public.get_tenant_plan_tier(_tenant_id UUID);
CREATE OR REPLACE FUNCTION public.get_tenant_plan_tier(
  _tenant_id UUID
)
RETURNS subscription_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.tier
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON ts.plan_id = sp.id
  WHERE ts.tenant_id = _tenant_id
    AND ts.status = 'active'
    AND sp.plan_type = 'crm_base'
  ORDER BY ts.current_period_end DESC
  LIMIT 1;
$$;

-- Enable RLS on all subscription tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_features ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (Public read for active plans)
DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active subscription plans" ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Platform admins can manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can manage subscription plans" ON public.subscription_plans
  FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- RLS Policies for tenant_subscriptions
DROP POLICY IF EXISTS "Platform admins can manage all subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Platform admins can manage all subscriptions" ON public.tenant_subscriptions
  FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view own subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Tenant admins can view own subscriptions" ON public.tenant_subscriptions
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Tenant admins can update own subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Tenant admins can update own subscriptions" ON public.tenant_subscriptions
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- RLS Policies for usage_records
DROP POLICY IF EXISTS "Platform admins can manage all usage records" ON public.usage_records;
CREATE POLICY "Platform admins can manage all usage records" ON public.usage_records
  FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view own usage records" ON public.usage_records;
CREATE POLICY "Tenant admins can view own usage records" ON public.usage_records
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- RLS Policies for subscription_invoices
DROP POLICY IF EXISTS "Platform admins can manage all invoices" ON public.subscription_invoices;
CREATE POLICY "Platform admins can manage all invoices" ON public.subscription_invoices
  FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view own invoices" ON public.subscription_invoices;
CREATE POLICY "Tenant admins can view own invoices" ON public.subscription_invoices
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- RLS Policies for subscription_features (Public read)
DROP POLICY IF EXISTS "Anyone can view subscription features" ON public.subscription_features;
CREATE POLICY "Anyone can view subscription features" ON public.subscription_features
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Platform admins can manage subscription features" ON public.subscription_features;
CREATE POLICY "Platform admins can manage subscription features" ON public.subscription_features
  FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- Add updated_at trigger for all subscription tables
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_subscriptions_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER update_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_records_updated_at ON public.usage_records;
CREATE TRIGGER update_usage_records_updated_at
  BEFORE UPDATE ON public.usage_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_invoices_updated_at ON public.subscription_invoices;
CREATE TRIGGER update_subscription_invoices_updated_at
  BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_features_updated_at ON public.subscription_features;
CREATE TRIGGER update_subscription_features_updated_at
  BEFORE UPDATE ON public.subscription_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Create enums for logistics
DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'shipment_status' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.shipment_status AS ENUM ('draft','confirmed','in_transit','customs','out_for_delivery','delivered','cancelled','on_hold','returned');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['draft','confirmed','in_transit','customs','out_for_delivery','delivered','cancelled','on_hold','returned'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'shipment_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.shipment_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'shipment_type' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.shipment_type AS ENUM ('ocean_freight','air_freight','inland_trucking','railway_transport','courier','movers_packers');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['ocean_freight','air_freight','inland_trucking','railway_transport','courier','movers_packers'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'shipment_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.shipment_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'container_type' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.container_type AS ENUM ('20ft_standard','40ft_standard','40ft_high_cube','45ft_high_cube','reefer','open_top','flat_rack','tank');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['20ft_standard','40ft_standard','40ft_high_cube','45ft_high_cube','reefer','open_top','flat_rack','tank'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'container_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.container_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'vehicle_status' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.vehicle_status AS ENUM ('available','in_use','maintenance','out_of_service');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['available','in_use','maintenance','out_of_service'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'vehicle_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.vehicle_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'tracking_event_type' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.tracking_event_type AS ENUM ('created','confirmed','picked_up','in_transit','customs_clearance','customs_released','arrived_at_hub','out_for_delivery','delivered','delayed','exception','returned');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['created','confirmed','picked_up','in_transit','customs_clearance','customs_released','arrived_at_hub','out_for_delivery','delivered','delayed','exception','returned'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'tracking_event_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.tracking_event_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

-- Warehouses table
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  warehouse_type TEXT,
  address JSONB DEFAULT '{}'::jsonb,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  capacity_sqft NUMERIC,
  current_utilization NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  operating_hours JSONB DEFAULT '{}'::jsonb,
  facilities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  capacity_kg NUMERIC,
  capacity_cbm NUMERIC,
  status vehicle_status DEFAULT 'available',
  current_location JSONB,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  insurance_expiry DATE,
  registration_expiry DATE,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, vehicle_number)
);

-- Shipments table
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  shipment_number TEXT NOT NULL,
  shipment_type shipment_type NOT NULL,
  status shipment_status DEFAULT 'draft',
  
  -- Customer references
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  -- Origin and destination
  origin_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  destination_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  origin_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  destination_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  
  -- Dates
  pickup_date TIMESTAMPTZ,
  estimated_delivery_date TIMESTAMPTZ,
  actual_delivery_date TIMESTAMPTZ,
  
  -- Cargo details
  total_weight_kg NUMERIC,
  total_volume_cbm NUMERIC,
  total_packages INTEGER DEFAULT 0,
  container_type container_type,
  container_number TEXT,
  
  -- Financial
  declared_value NUMERIC,
  freight_charges NUMERIC,
  insurance_charges NUMERIC,
  customs_charges NUMERIC,
  other_charges NUMERIC,
  total_charges NUMERIC,
  currency TEXT DEFAULT 'USD',
  
  -- Tracking
  current_location JSONB,
  current_status_description TEXT,
  
  -- Additional info
  service_level TEXT,
  priority_level TEXT DEFAULT 'normal',
  special_instructions TEXT,
  customs_required BOOLEAN DEFAULT false,
  insurance_required BOOLEAN DEFAULT false,
  
  -- References
  reference_number TEXT,
  purchase_order_number TEXT,
  invoice_number TEXT,
  
  -- Assignments
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, shipment_number)
);

-- Shipment items table
CREATE TABLE IF NOT EXISTS public.shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  dimensions JSONB,
  package_type TEXT,
  hs_code TEXT,
  value NUMERIC,
  currency TEXT DEFAULT 'USD',
  is_hazardous BOOLEAN DEFAULT false,
  hazard_class TEXT,
  special_handling TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tracking events table
CREATE TABLE IF NOT EXISTS public.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  event_type tracking_event_type NOT NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  location JSONB,
  location_name TEXT,
  description TEXT,
  notes TEXT,
  is_milestone BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Routes table
CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  route_name TEXT NOT NULL,
  route_code TEXT NOT NULL,
  origin_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  destination_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  waypoints JSONB DEFAULT '[]'::jsonb,
  distance_km NUMERIC,
  estimated_duration_hours NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, route_code)
);

-- Shipping rates table
CREATE TABLE IF NOT EXISTS public.shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shipment_type shipment_type NOT NULL,
  service_level TEXT,
  origin_country TEXT,
  destination_country TEXT,
  origin_zone TEXT,
  destination_zone TEXT,
  min_weight_kg NUMERIC,
  max_weight_kg NUMERIC,
  rate_per_kg NUMERIC,
  base_rate NUMERIC,
  currency TEXT DEFAULT 'USD',
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customs documents table
CREATE TABLE IF NOT EXISTS public.customs_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  issuing_authority TEXT,
  document_url TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Warehouse inventory table
CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  item_description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  location_in_warehouse TEXT,
  received_date TIMESTAMPTZ DEFAULT now(),
  expected_dispatch_date TIMESTAMPTZ,
  status TEXT DEFAULT 'stored',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON public.shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_franchise ON public.shipments(franchise_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_shipment_number ON public.shipments(shipment_number);
CREATE INDEX IF NOT EXISTS idx_shipments_account ON public.shipments(account_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment ON public.tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_date ON public.tracking_events(event_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON public.vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON public.warehouses(tenant_id);

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for warehouses
DROP POLICY IF EXISTS "Platform admins can manage all warehouses" ON public.warehouses;
CREATE POLICY "Platform admins can manage all warehouses" ON public.warehouses FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant warehouses" ON public.warehouses;
CREATE POLICY "Tenant admins can manage tenant warehouses" ON public.warehouses FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise users can view franchise warehouses" ON public.warehouses;
CREATE POLICY "Franchise users can view franchise warehouses" ON public.warehouses FOR SELECT
  USING (franchise_id = get_user_franchise_id(auth.uid()));

-- RLS Policies for vehicles
DROP POLICY IF EXISTS "Platform admins can manage all vehicles" ON public.vehicles;
CREATE POLICY "Platform admins can manage all vehicles" ON public.vehicles FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant vehicles" ON public.vehicles;
CREATE POLICY "Tenant admins can manage tenant vehicles" ON public.vehicles FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise users can view franchise vehicles" ON public.vehicles;
CREATE POLICY "Franchise users can view franchise vehicles" ON public.vehicles FOR SELECT
  USING (franchise_id = get_user_franchise_id(auth.uid()));

-- RLS Policies for shipments
DROP POLICY IF EXISTS "Platform admins can manage all shipments" ON public.shipments;
CREATE POLICY "Platform admins can manage all shipments" ON public.shipments FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant shipments" ON public.shipments;
CREATE POLICY "Tenant admins can manage tenant shipments" ON public.shipments FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can manage franchise shipments" ON public.shipments;
CREATE POLICY "Franchise admins can manage franchise shipments" ON public.shipments FOR ALL
  USING (has_role(auth.uid(), 'franchise_admin'::app_role) AND franchise_id = get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view assigned shipments" ON public.shipments;
CREATE POLICY "Users can view assigned shipments" ON public.shipments FOR SELECT
  USING (assigned_to = auth.uid() OR franchise_id = get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can create franchise shipments" ON public.shipments;
CREATE POLICY "Users can create franchise shipments" ON public.shipments FOR INSERT
  WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- RLS Policies for shipment items
DROP POLICY IF EXISTS "Platform admins can manage all shipment items" ON public.shipment_items;
CREATE POLICY "Platform admins can manage all shipment items" ON public.shipment_items FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can manage items for accessible shipments" ON public.shipment_items;
CREATE POLICY "Users can manage items for accessible shipments" ON public.shipment_items FOR ALL
  USING (shipment_id IN (
    SELECT id FROM public.shipments 
    WHERE franchise_id = get_user_franchise_id(auth.uid()) 
    OR assigned_to = auth.uid()
  ));

-- RLS Policies for tracking events
DROP POLICY IF EXISTS "Platform admins can manage all tracking events" ON public.tracking_events;
CREATE POLICY "Platform admins can manage all tracking events" ON public.tracking_events FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view tracking for accessible shipments" ON public.tracking_events;
CREATE POLICY "Users can view tracking for accessible shipments" ON public.tracking_events FOR SELECT
  USING (shipment_id IN (
    SELECT id FROM public.shipments 
    WHERE franchise_id = get_user_franchise_id(auth.uid()) 
    OR assigned_to = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can create tracking events for accessible shipments" ON public.tracking_events;
CREATE POLICY "Users can create tracking events for accessible shipments" ON public.tracking_events FOR INSERT
  WITH CHECK (shipment_id IN (
    SELECT id FROM public.shipments 
    WHERE franchise_id = get_user_franchise_id(auth.uid()) 
    OR assigned_to = auth.uid()
  ));

-- RLS Policies for routes
DROP POLICY IF EXISTS "Platform admins can manage all routes" ON public.routes;
CREATE POLICY "Platform admins can manage all routes" ON public.routes FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant routes" ON public.routes;
CREATE POLICY "Tenant admins can manage tenant routes" ON public.routes FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant routes" ON public.routes;
CREATE POLICY "Users can view tenant routes" ON public.routes FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for shipping rates
DROP POLICY IF EXISTS "Platform admins can manage all shipping rates" ON public.shipping_rates;
CREATE POLICY "Platform admins can manage all shipping rates" ON public.shipping_rates FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant shipping rates" ON public.shipping_rates;
CREATE POLICY "Tenant admins can manage tenant shipping rates" ON public.shipping_rates FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant shipping rates" ON public.shipping_rates;
CREATE POLICY "Users can view tenant shipping rates" ON public.shipping_rates FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for customs documents
DROP POLICY IF EXISTS "Platform admins can manage all customs documents" ON public.customs_documents;
CREATE POLICY "Platform admins can manage all customs documents" ON public.customs_documents FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can manage customs documents for accessible shipments" ON public.customs_documents;
CREATE POLICY "Users can manage customs documents for accessible shipments" ON public.customs_documents FOR ALL
  USING (shipment_id IN (
    SELECT id FROM public.shipments 
    WHERE franchise_id = get_user_franchise_id(auth.uid()) 
    OR assigned_to = auth.uid()
  ));

-- RLS Policies for warehouse inventory
DROP POLICY IF EXISTS "Platform admins can manage all warehouse inventory" ON public.warehouse_inventory;
CREATE POLICY "Platform admins can manage all warehouse inventory" ON public.warehouse_inventory FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant warehouse inventory" ON public.warehouse_inventory;
CREATE POLICY "Tenant admins can manage tenant warehouse inventory" ON public.warehouse_inventory FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND 
    warehouse_id IN (SELECT id FROM public.warehouses WHERE tenant_id = get_user_tenant_id(auth.uid())));

DROP POLICY IF EXISTS "Users can view franchise warehouse inventory" ON public.warehouse_inventory;
CREATE POLICY "Users can view franchise warehouse inventory" ON public.warehouse_inventory FOR SELECT
  USING (warehouse_id IN (SELECT id FROM public.warehouses WHERE franchise_id = get_user_franchise_id(auth.uid())));

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_warehouses_updated_at ON public.warehouses;
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipments_updated_at ON public.shipments;
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipment_items_updated_at ON public.shipment_items;
CREATE TRIGGER update_shipment_items_updated_at BEFORE UPDATE ON public.shipment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_routes_updated_at ON public.routes;
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipping_rates_updated_at ON public.shipping_rates;
CREATE TRIGGER update_shipping_rates_updated_at BEFORE UPDATE ON public.shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customs_documents_updated_at ON public.customs_documents;
CREATE TRIGGER update_customs_documents_updated_at BEFORE UPDATE ON public.customs_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_warehouse_inventory_updated_at ON public.warehouse_inventory;
CREATE TRIGGER update_warehouse_inventory_updated_at BEFORE UPDATE ON public.warehouse_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- Create quotes table
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  quote_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  opportunity_id UUID,
  account_id UUID,
  contact_id UUID,
  owner_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE,
  subtotal NUMERIC(15,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  shipping_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  terms_conditions TEXT,
  notes TEXT,
  billing_address JSONB DEFAULT '{}'::jsonb,
  shipping_address JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE
);

-- Create quote_items table
CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  line_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON public.quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_franchise_id ON public.quotes(franchise_id);
CREATE INDEX IF NOT EXISTS idx_quotes_account_id ON public.quotes(account_id);
CREATE INDEX IF NOT EXISTS idx_quotes_opportunity_id ON public.quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON public.quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.quote_items(quote_id);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotes
DROP POLICY IF EXISTS "Platform admins can manage all quotes" ON public.quotes;
CREATE POLICY "Platform admins can manage all quotes" ON public.quotes FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant quotes" ON public.quotes;
CREATE POLICY "Tenant admins can manage tenant quotes" ON public.quotes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can manage franchise quotes" ON public.quotes;
CREATE POLICY "Franchise admins can manage franchise quotes" ON public.quotes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view franchise quotes" ON public.quotes;
CREATE POLICY "Users can view franchise quotes" ON public.quotes FOR SELECT
  TO authenticated
  USING (franchise_id = get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can create franchise quotes" ON public.quotes;
CREATE POLICY "Users can create franchise quotes" ON public.quotes FOR INSERT
  TO authenticated
  WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- RLS Policies for quote_items
DROP POLICY IF EXISTS "Platform admins can manage all quote items" ON public.quote_items;
CREATE POLICY "Platform admins can manage all quote items" ON public.quote_items FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can manage items for accessible quotes" ON public.quote_items;
CREATE POLICY "Users can manage items for accessible quotes" ON public.quote_items FOR ALL
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM public.quotes
      WHERE franchise_id = get_user_franchise_id(auth.uid())
        OR owner_id = auth.uid()
    )
  );

-- Update trigger
DROP TRIGGER IF EXISTS update_quotes_updated_at ON public.quotes;
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_items_updated_at ON public.quote_items;
CREATE TRIGGER update_quote_items_updated_at
  BEFORE UPDATE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Create service catalog table
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('ocean', 'air', 'trucking', 'courier', 'moving')),
  description TEXT,
  base_price NUMERIC,
  pricing_unit TEXT, -- per kg, per container, per mile, etc.
  transit_time_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, service_code)
);

-- Create carrier rates table
CREATE TABLE IF NOT EXISTS public.carrier_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  carrier_name TEXT NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('spot', 'contract')),
  origin_location TEXT,
  destination_location TEXT,
  base_rate NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  valid_from DATE NOT NULL,
  valid_until DATE,
  weight_break_min NUMERIC,
  weight_break_max NUMERIC,
  surcharges JSONB DEFAULT '[]', -- fuel surcharge, security fees, etc.
  accessorial_fees JSONB DEFAULT '[]',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create compliance rules table
CREATE TABLE IF NOT EXISTS public.compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  service_type TEXT CHECK (service_type IN ('ocean', 'air', 'trucking', 'courier', 'moving', 'all')),
  regulation_agency TEXT, -- CBP, FMC, FMCSA, TSA, etc.
  rule_description TEXT,
  validation_criteria JSONB NOT NULL, -- JSON schema for validation
  required_documents JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create document templates table
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  document_type TEXT NOT NULL, -- commercial_invoice, bill_of_lading, airway_bill, etc.
  service_type TEXT,
  template_content TEXT NOT NULL, -- HTML template with placeholders
  required_fields JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add mode-specific fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN service_type TEXT CHECK (service_type IN ('ocean', 'air', 'trucking', 'courier', 'moving')),
ADD COLUMN incoterms TEXT,
ADD COLUMN origin_location JSONB DEFAULT '{}',
ADD COLUMN destination_location JSONB DEFAULT '{}',
ADD COLUMN cargo_details JSONB DEFAULT '{}',
ADD COLUMN special_handling JSONB DEFAULT '[]',
ADD COLUMN regulatory_data JSONB DEFAULT '{}',
ADD COLUMN compliance_status TEXT DEFAULT 'pending' CHECK (compliance_status IN ('pending', 'validated', 'requires_review', 'non_compliant')),
ADD COLUMN carrier_id UUID,
ADD COLUMN service_id UUID REFERENCES public.services(id);

-- Create rate calculation history table
CREATE TABLE IF NOT EXISTS public.rate_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  carrier_rate_id UUID REFERENCES public.carrier_rates(id),
  calculation_breakdown JSONB NOT NULL, -- detailed cost breakdown
  applied_surcharges JSONB DEFAULT '[]',
  applied_discounts JSONB DEFAULT '[]',
  final_rate NUMERIC NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  calculated_by UUID REFERENCES auth.users(id)
);

-- Create quote documents table
CREATE TABLE IF NOT EXISTS public.quote_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_url TEXT,
  document_data JSONB,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id)
);

-- Create compliance checks table
CREATE TABLE IF NOT EXISTS public.compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.compliance_rules(id),
  check_status TEXT NOT NULL CHECK (check_status IN ('passed', 'failed', 'warning', 'pending')),
  check_details JSONB,
  checked_at TIMESTAMPTZ DEFAULT now(),
  checked_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for services
DROP POLICY IF EXISTS "Tenant users can view services" ON public.services;
CREATE POLICY "Tenant users can view services" ON public.services FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS "Tenant admins can manage services" ON public.services;
CREATE POLICY "Tenant admins can manage services" ON public.services FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can manage all services" ON public.services;
CREATE POLICY "Platform admins can manage all services" ON public.services FOR ALL USING (is_platform_admin(auth.uid()));

-- RLS Policies for carrier_rates
DROP POLICY IF EXISTS "Tenant users can view rates" ON public.carrier_rates;
CREATE POLICY "Tenant users can view rates" ON public.carrier_rates FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS "Tenant admins can manage rates" ON public.carrier_rates;
CREATE POLICY "Tenant admins can manage rates" ON public.carrier_rates FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can manage all rates" ON public.carrier_rates;
CREATE POLICY "Platform admins can manage all rates" ON public.carrier_rates FOR ALL USING (is_platform_admin(auth.uid()));

-- RLS Policies for compliance_rules
DROP POLICY IF EXISTS "Tenant users can view compliance rules" ON public.compliance_rules;
CREATE POLICY "Tenant users can view compliance rules" ON public.compliance_rules FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS "Tenant admins can manage compliance rules" ON public.compliance_rules;
CREATE POLICY "Tenant admins can manage compliance rules" ON public.compliance_rules FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can manage all compliance rules" ON public.compliance_rules;
CREATE POLICY "Platform admins can manage all compliance rules" ON public.compliance_rules FOR ALL USING (is_platform_admin(auth.uid()));

-- RLS Policies for document_templates
DROP POLICY IF EXISTS "Tenant users can view templates" ON public.document_templates;
CREATE POLICY "Tenant users can view templates" ON public.document_templates FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS "Tenant admins can manage templates" ON public.document_templates;
CREATE POLICY "Tenant admins can manage templates" ON public.document_templates FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can manage all templates" ON public.document_templates;
CREATE POLICY "Platform admins can manage all templates" ON public.document_templates FOR ALL USING (is_platform_admin(auth.uid()));

-- RLS Policies for rate_calculations
DROP POLICY IF EXISTS "Users can view calculations for accessible quotes" ON public.rate_calculations;
CREATE POLICY "Users can view calculations for accessible quotes" ON public.rate_calculations FOR SELECT USING (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can create calculations" ON public.rate_calculations;
CREATE POLICY "Users can create calculations" ON public.rate_calculations FOR INSERT WITH CHECK (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);

-- RLS Policies for quote_documents
DROP POLICY IF EXISTS "Users can view documents for accessible quotes" ON public.quote_documents;
CREATE POLICY "Users can view documents for accessible quotes" ON public.quote_documents FOR SELECT USING (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can create documents" ON public.quote_documents;
CREATE POLICY "Users can create documents" ON public.quote_documents FOR INSERT WITH CHECK (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);

-- RLS Policies for compliance_checks
DROP POLICY IF EXISTS "Users can view compliance checks for accessible quotes" ON public.compliance_checks;
CREATE POLICY "Users can view compliance checks for accessible quotes" ON public.compliance_checks FOR SELECT USING (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can create compliance checks" ON public.compliance_checks;
CREATE POLICY "Users can create compliance checks" ON public.compliance_checks FOR INSERT WITH CHECK (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_services_tenant ON public.services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_type ON public.services(service_type);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_tenant ON public.carrier_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_service ON public.carrier_rates(service_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_dates ON public.carrier_rates(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_quotes_service_type ON public.quotes(service_type);
CREATE INDEX IF NOT EXISTS idx_rate_calculations_quote ON public.rate_calculations(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_documents_quote ON public.quote_documents(quote_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_quote ON public.compliance_checks(quote_id);

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_carrier_rates_updated_at ON public.carrier_rates;
CREATE TRIGGER update_carrier_rates_updated_at BEFORE UPDATE ON public.carrier_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_compliance_rules_updated_at ON public.compliance_rules;
CREATE TRIGGER update_compliance_rules_updated_at BEFORE UPDATE ON public.compliance_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- Add common Salesforce Account standard fields to public.accounts
-- This migration is additive and keeps existing JSONB addresses for compatibility.

BEGIN;

-- Core identifiers and links
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS account_site TEXT,
  ADD COLUMN IF NOT EXISTS parent_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Contact and company details
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS fax TEXT,
  ADD COLUMN IF NOT EXISTS ticker_symbol TEXT,
  ADD COLUMN IF NOT EXISTS ownership TEXT,          -- e.g., Public, Private, Subsidiary
  ADD COLUMN IF NOT EXISTS rating TEXT,             -- e.g., Hot, Warm, Cold
  ADD COLUMN IF NOT EXISTS sic_code TEXT,
  ADD COLUMN IF NOT EXISTS duns_number TEXT,
  ADD COLUMN IF NOT EXISTS naics_code TEXT;

-- Structured Billing Address (to align with Salesforce fields)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS billing_street TEXT,
  ADD COLUMN IF NOT EXISTS billing_city TEXT,
  ADD COLUMN IF NOT EXISTS billing_state TEXT,
  ADD COLUMN IF NOT EXISTS billing_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS billing_country TEXT;

-- Structured Shipping Address (to align with Salesforce fields)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS shipping_street TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state TEXT,
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_country TEXT;

-- Optional commercial metadata
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS number_of_locations INTEGER,
  ADD COLUMN IF NOT EXISTS active BOOLEAN,
  ADD COLUMN IF NOT EXISTS sla TEXT,
  ADD COLUMN IF NOT EXISTS sla_expiration_date DATE,
  ADD COLUMN IF NOT EXISTS customer_priority TEXT,
  ADD COLUMN IF NOT EXISTS support_tier TEXT,
  ADD COLUMN IF NOT EXISTS upsell_opportunity TEXT;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_accounts_parent_account_id ON public.accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON public.accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_accounts_duns_number ON public.accounts(duns_number);
CREATE INDEX IF NOT EXISTS idx_accounts_sic_code ON public.accounts(sic_code);

COMMIT;-- Add Salesforce linkage fields to opportunities for external sync
BEGIN;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS salesforce_opportunity_id TEXT,
  ADD COLUMN IF NOT EXISTS salesforce_sync_status TEXT CHECK (salesforce_sync_status IN ('pending','success','error')),
  ADD COLUMN IF NOT EXISTS salesforce_last_synced TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS salesforce_error TEXT;

-- Helpful index for quick lookups
CREATE INDEX IF NOT EXISTS idx_opportunities_salesforce_id ON public.opportunities(salesforce_opportunity_id);

COMMIT;DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'transport_mode' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.transport_mode AS ENUM ('ocean','air','inland_trucking','courier','movers_packers');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['ocean','air','inland_trucking','courier','movers_packers'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'transport_mode' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.transport_mode ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'contract_type' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.contract_type AS ENUM ('spot','contracted');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['spot','contracted'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'contract_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.contract_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'quote_status' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.quote_status AS ENUM ('draft','sent','accepted','expired','cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['draft','sent','accepted','expired','cancelled'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'quote_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.quote_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'compliance_status' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.compliance_status AS ENUM ('pass','warn','fail');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['pass','warn','fail'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'compliance_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.compliance_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'document_type' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.document_type AS ENUM ('commercial_invoice','bill_of_lading','air_waybill','packing_list','customs_form','quote_pdf');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['commercial_invoice','bill_of_lading','air_waybill','packing_list','customs_form','quote_pdf'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'document_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.document_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

-- Carriers
CREATE TABLE IF NOT EXISTS public.carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid,
  mode public.transport_mode NOT NULL,
  name text NOT NULL,
  scac text,
  iata text,
  mc_dot text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

-- Services
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid,
  mode public.transport_mode NOT NULL,
  name text NOT NULL,
  description text,
  transit_profile jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Service Details (mode-specific attributes)
CREATE TABLE IF NOT EXISTS public.service_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  attributes jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.service_details ENABLE ROW LEVEL SECURITY;

-- Rates
CREATE TABLE IF NOT EXISTS public.rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid,
  mode public.transport_mode NOT NULL,
  carrier_id uuid REFERENCES public.carriers(id) ON DELETE SET NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  validity_start date,
  validity_end date,
  contract_type public.contract_type NOT NULL,
  base_price numeric,
  currency text DEFAULT 'USD',
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rates_lane_idx ON public.rates (mode, origin, destination);
CREATE INDEX IF NOT EXISTS rates_validity_idx ON public.rates (validity_start, validity_end);
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;

-- Rate Components (surcharges/accessorials)
CREATE TABLE IF NOT EXISTS public.rate_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  rate_id uuid NOT NULL REFERENCES public.rates(id) ON DELETE CASCADE,
  component_type text NOT NULL,
  calc_method text NOT NULL, -- flat | percent | per_unit
  value numeric NOT NULL,
  min_amount numeric,
  max_amount numeric,
  notes text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rate_components ENABLE ROW LEVEL SECURITY;

-- Quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid,
  quote_number text UNIQUE,
  customer_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status public.quote_status DEFAULT 'draft'::public.quote_status,
  version_current integer DEFAULT 1,
  total numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'customer_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS quotes_customer_idx ON public.quotes (customer_id);
  END IF;
END $$;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Quote Items
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  mode public.transport_mode NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  dims jsonb, -- dimensions and units
  weight jsonb, -- weight and units
  incoterms text,
  base_cost numeric DEFAULT 0,
  surcharges_total numeric DEFAULT 0,
  accessorials_total numeric DEFAULT 0,
  total numeric DEFAULT 0,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_items_quote_idx ON public.quote_items (quote_id);
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Quote Versions (snapshot)
CREATE TABLE IF NOT EXISTS public.quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  total numeric,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS quote_versions_unique ON public.quote_versions (quote_id, version_number);
ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

-- Quote Events (audit)
CREATE TABLE IF NOT EXISTS public.quote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- created | sent | revised | approved | converted | cancelled
  actor_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_events_quote_idx ON public.quote_events (quote_id);
ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;

-- Compliance Checks
CREATE TABLE IF NOT EXISTS public.compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  mode public.transport_mode NOT NULL,
  checklist jsonb NOT NULL,
  status public.compliance_status NOT NULL,
  messages jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;

-- Documents
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  type public.document_type NOT NULL,
  status text DEFAULT 'generated',
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies will be added in a subsequent migration to match tenant scoping.-- Opportunity ↔ Quote relationship, primary quote, and syncing
BEGIN;

-- Ensure quotes table has opportunity linkage and primary flag
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS opportunity_id UUID,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Add foreign key for opportunity linkage if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname = 'quotes_opportunity_id_fkey'
  ) THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_opportunity_id_fkey FOREIGN KEY (opportunity_id)
      REFERENCES public.opportunities(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Enforce only one primary quote per opportunity
CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_primary_per_opportunity
  ON public.quotes(opportunity_id)
  WHERE is_primary IS TRUE;

-- Add primary_quote_id on opportunities for fast access
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS primary_quote_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.opportunities'::regclass
      AND conname = 'opportunities_primary_quote_id_fkey'
  ) THEN
    ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_primary_quote_id_fkey FOREIGN KEY (primary_quote_id)
      REFERENCES public.quotes(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Function: when making a quote primary, demote any existing primary for the same opportunity
DROP FUNCTION IF EXISTS public.ensure_single_primary_quote();
CREATE OR REPLACE FUNCTION public.ensure_single_primary_quote()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary IS TRUE AND NEW.opportunity_id IS NOT NULL THEN
    -- Demote other primary quotes for this opportunity
    UPDATE public.quotes q
      SET is_primary = FALSE
    WHERE q.opportunity_id = NEW.opportunity_id
      AND q.id <> NEW.id
      AND q.is_primary IS TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: update opportunity amount and primary_quote_id from the primary quote
DROP FUNCTION IF EXISTS public.sync_opportunity_from_primary_quote();
CREATE OR REPLACE FUNCTION public.sync_opportunity_from_primary_quote()
RETURNS TRIGGER AS $$
DECLARE
  v_total NUMERIC;
  v_other_primary UUID;
BEGIN

  IF NEW.opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- If deleting a primary quote, clear or switch primary on the opportunity
    IF OLD.is_primary IS TRUE THEN
      SELECT q.id INTO v_other_primary
      FROM public.quotes q
      WHERE q.opportunity_id = OLD.opportunity_id
        AND q.is_primary IS TRUE
      ORDER BY q.updated_at DESC
      LIMIT 1;

      UPDATE public.opportunities o
        SET primary_quote_id = v_other_primary,
            amount = COALESCE((SELECT q.total_amount FROM public.quotes q WHERE q.id = v_other_primary), 0),
            updated_at = now()
      WHERE o.id = OLD.opportunity_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Determine total from quotes table to avoid referencing absent columns
  SELECT COALESCE(q.total_amount, 0)
    INTO v_total
  FROM public.quotes q
  WHERE q.id = NEW.id;

  -- INSERT/UPDATE path
  IF NEW.is_primary IS TRUE THEN
    UPDATE public.opportunities o
      SET primary_quote_id = NEW.id,
          amount = COALESCE(v_total, 0),
          updated_at = now()
    WHERE o.id = NEW.opportunity_id;
  ELSIF NEW.is_primary IS FALSE THEN
    -- If this quote was primary and is now demoted, select another primary or clear
    IF OLD IS NOT NULL AND OLD.is_primary IS TRUE THEN
      SELECT q.id INTO v_other_primary
      FROM public.quotes q
      WHERE q.opportunity_id = NEW.opportunity_id
        AND q.is_primary IS TRUE
      ORDER BY q.updated_at DESC
      LIMIT 1;

      UPDATE public.opportunities o
        SET primary_quote_id = v_other_primary,
            amount = COALESCE((SELECT q.total_amount FROM public.quotes q WHERE q.id = v_other_primary), 0),
            updated_at = now()
      WHERE o.id = NEW.opportunity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: ensure single primary on insert/update
DROP TRIGGER IF EXISTS trg_quotes_ensure_single_primary ON public.quotes;
CREATE TRIGGER trg_quotes_ensure_single_primary
  BEFORE INSERT OR UPDATE OF is_primary, opportunity_id ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_primary_quote();

-- Trigger: sync opportunity amount and primary quote on insert/update/delete
DROP TRIGGER IF EXISTS trg_quotes_sync_opportunity ON public.quotes;
CREATE TRIGGER trg_quotes_sync_opportunity
  AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_opportunity_from_primary_quote();

-- Recalculate quote totals when items change and cascade to opportunity via above trigger
DROP FUNCTION IF EXISTS public.recalculate_quote_total_trigger();
CREATE OR REPLACE FUNCTION public.recalculate_quote_total_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_total NUMERIC;
  v_quote_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_quote_id := OLD.quote_id;
  ELSE
    v_quote_id := NEW.quote_id;
  END IF;

  -- Supports both schemas of quote_items
  SELECT COALESCE(SUM(COALESCE(qi.line_total, qi.total, 0)), 0)
    INTO v_total
  FROM public.quote_items qi
  WHERE qi.quote_id = v_quote_id;

  -- Always update total_amount
  UPDATE public.quotes q
    SET total_amount = v_total,
        updated_at = now()
  WHERE q.id = v_quote_id;

  -- Conditionally update total if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'total'
  ) THEN
    UPDATE public.quotes q
      SET total = v_total,
          updated_at = now()
    WHERE q.id = v_quote_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers on quote_items to recalc totals
DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_ins ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_ins
  AFTER INSERT ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_quote_total_trigger();

DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_upd ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_upd
  AFTER UPDATE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_quote_total_trigger();

DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_del ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_del
  AFTER DELETE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_quote_total_trigger();

COMMIT;-- Opportunity items table and syncing from primary quote items
BEGIN;

-- Create opportunity_items table mirroring quote_items (commerce schema)
CREATE TABLE IF NOT EXISTS public.opportunity_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  line_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.opportunity_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_opportunity_items_opportunity_id ON public.opportunity_items(opportunity_id);

-- Minimal RLS policies aligned with quotes access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_items'
      AND policyname = 'Platform admins manage all opportunity items'
  ) THEN
    DROP POLICY IF EXISTS "Platform admins manage all opportunity items" ON public.opportunity_items;
CREATE POLICY "Platform admins manage all opportunity items" ON public.opportunity_items FOR ALL
      USING (is_platform_admin(auth.uid()));
  END IF;
END$$;

-- Function: sync opportunity_items from a primary quote's items
DROP FUNCTION IF EXISTS public.sync_opportunity_items_from_quote(p_quote_id UUID);
CREATE OR REPLACE FUNCTION public.sync_opportunity_items_from_quote(p_quote_id UUID)
RETURNS VOID AS $$
DECLARE
  v_opportunity UUID;
  v_is_primary BOOLEAN;
BEGIN
  SELECT q.opportunity_id, q.is_primary INTO v_opportunity, v_is_primary
  FROM public.quotes q
  WHERE q.id = p_quote_id;

  IF v_opportunity IS NULL OR v_is_primary IS NOT TRUE THEN
    RETURN;
  END IF;

  -- Replace all items for the opportunity with the quote's items
  DELETE FROM public.opportunity_items oi WHERE oi.opportunity_id = v_opportunity;

  INSERT INTO public.opportunity_items (
    opportunity_id, line_number, product_name, description, quantity,
    unit_price, discount_percent, discount_amount, tax_amount, line_total
  )
  SELECT v_opportunity, qi.line_number, qi.product_name, qi.description, qi.quantity,
         qi.unit_price, qi.discount_percent, qi.discount_amount, qi.tax_amount, 
         COALESCE(qi.line_total, qi.quantity * qi.unit_price * (1 - COALESCE(qi.discount_percent,0)/100))
  FROM public.quote_items qi
  WHERE qi.quote_id = p_quote_id
  ORDER BY qi.line_number;
END;
$$ LANGUAGE plpgsql;

-- Extend quote_items triggers to also run syncing after recalculation
DROP FUNCTION IF EXISTS public.recalculate_and_sync_quote_trigger();
CREATE OR REPLACE FUNCTION public.recalculate_and_sync_quote_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_quote_id UUID;
  v_total NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_quote_id := OLD.quote_id;
  ELSE
    v_quote_id := NEW.quote_id;
  END IF;

  -- Recalculate quote total (supports both schemas of quote_items)
  SELECT COALESCE(SUM(COALESCE(qi.line_total, qi.total, 0)), 0)
    INTO v_total
  FROM public.quote_items qi
  WHERE qi.quote_id = v_quote_id;

  -- Always update total_amount
  UPDATE public.quotes q
    SET total_amount = v_total,
        updated_at = now()
  WHERE q.id = v_quote_id;

  -- Conditionally update total if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'total'
  ) THEN
    UPDATE public.quotes q
      SET total = v_total,
          updated_at = now()
    WHERE q.id = v_quote_id;
  END IF;

  -- Sync opportunity items from the quote
  PERFORM public.sync_opportunity_items_from_quote(v_quote_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_ins ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_ins
  AFTER INSERT ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_and_sync_quote_trigger();

DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_upd ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_upd
  AFTER UPDATE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_and_sync_quote_trigger();

DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_del ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_del
  AFTER DELETE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_and_sync_quote_trigger();

COMMIT;-- Bidirectional syncing: reflect opportunity_items changes back to primary quote_items
BEGIN;

DROP FUNCTION IF EXISTS public.sync_quote_items_from_opportunity_trigger();
CREATE OR REPLACE FUNCTION public.sync_quote_items_from_opportunity_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_opportunity_id UUID;
  v_quote UUID;
  v_total NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_opportunity_id := OLD.opportunity_id;
  ELSE
    v_opportunity_id := NEW.opportunity_id;
  END IF;

  -- Determine primary quote for the opportunity
  SELECT primary_quote_id INTO v_quote
  FROM public.opportunities
  WHERE id = v_opportunity_id;

  IF v_quote IS NULL THEN
    -- Fallback to any quote marked primary
    SELECT q.id INTO v_quote
    FROM public.quotes q
    WHERE q.opportunity_id = v_opportunity_id AND q.is_primary = TRUE
    ORDER BY q.created_at DESC
    LIMIT 1;
  END IF;

  IF v_quote IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Replace quote_items with opportunity_items snapshot
  DELETE FROM public.quote_items qi WHERE qi.quote_id = v_quote;

  INSERT INTO public.quote_items (
    quote_id, line_number, product_name, description, quantity,
    unit_price, discount_percent, discount_amount, tax_amount, line_total
  )
  SELECT v_quote, oi.line_number, oi.product_name, oi.description, oi.quantity,
         oi.unit_price, oi.discount_percent, oi.discount_amount, oi.tax_amount,
         COALESCE(oi.line_total, oi.quantity * oi.unit_price * (1 - COALESCE(oi.discount_percent,0)/100))
  FROM public.opportunity_items oi
  WHERE oi.opportunity_id = v_opportunity_id
  ORDER BY oi.line_number;

  -- Recalculate totals after syncing
  SELECT COALESCE(SUM(COALESCE(qi.line_total, qi.total, 0)), 0)
    INTO v_total
  FROM public.quote_items qi
  WHERE qi.quote_id = v_quote;

  UPDATE public.quotes q
    SET total_amount = v_total,
        updated_at = now()
  WHERE q.id = v_quote;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'total'
  ) THEN
    UPDATE public.quotes q
      SET total = v_total,
          updated_at = now()
    WHERE q.id = v_quote;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers on opportunity_items to sync to primary quote
DROP TRIGGER IF EXISTS trg_opp_items_sync_ins ON public.opportunity_items;
CREATE TRIGGER trg_opp_items_sync_ins
  AFTER INSERT ON public.opportunity_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_quote_items_from_opportunity_trigger();

DROP TRIGGER IF EXISTS trg_opp_items_sync_upd ON public.opportunity_items;
CREATE TRIGGER trg_opp_items_sync_upd
  AFTER UPDATE ON public.opportunity_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_quote_items_from_opportunity_trigger();

DROP TRIGGER IF EXISTS trg_opp_items_sync_del ON public.opportunity_items;
CREATE TRIGGER trg_opp_items_sync_del
  AFTER DELETE ON public.opportunity_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_quote_items_from_opportunity_trigger();

COMMIT;-- Create carriers database
CREATE TABLE IF NOT EXISTS public.carriers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  carrier_name TEXT NOT NULL,
  carrier_code TEXT,
  carrier_type TEXT CHECK (carrier_type IN ('ocean', 'air', 'trucking', 'courier', 'rail')),
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address JSONB DEFAULT '{}',
  website TEXT,
  service_routes JSONB DEFAULT '[]',
  rating NUMERIC(3,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create consignees database
CREATE TABLE IF NOT EXISTS public.consignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address JSONB DEFAULT '{}',
  tax_id TEXT,
  customs_id TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create ports and locations database
CREATE TABLE IF NOT EXISTS public.ports_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  location_name TEXT NOT NULL,
  location_code TEXT,
  location_type TEXT CHECK (location_type IN ('seaport', 'airport', 'inland_port', 'warehouse', 'terminal')),
  country TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  coordinates JSONB DEFAULT '{}',
  facilities JSONB DEFAULT '[]',
  operating_hours TEXT,
  customs_available BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add references to quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES public.carriers(id),
  ADD COLUMN IF NOT EXISTS consignee_id UUID REFERENCES public.consignees(id),
  ADD COLUMN IF NOT EXISTS origin_port_id UUID REFERENCES public.ports_locations(id),
  ADD COLUMN IF NOT EXISTS destination_port_id UUID REFERENCES public.ports_locations(id);

-- Enable RLS
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ports_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for carriers
DROP POLICY IF EXISTS "Platform admins can manage all carriers" ON public.carriers;
CREATE POLICY "Platform admins can manage all carriers" ON public.carriers FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage carriers" ON public.carriers;
CREATE POLICY "Tenant admins can manage carriers" ON public.carriers FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant carriers" ON public.carriers;
CREATE POLICY "Users can view tenant carriers" ON public.carriers FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for consignees
DROP POLICY IF EXISTS "Platform admins can manage all consignees" ON public.consignees;
CREATE POLICY "Platform admins can manage all consignees" ON public.consignees FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage consignees" ON public.consignees;
CREATE POLICY "Tenant admins can manage consignees" ON public.consignees FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant consignees" ON public.consignees;
CREATE POLICY "Users can view tenant consignees" ON public.consignees FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for ports_locations
DROP POLICY IF EXISTS "Platform admins can manage all ports" ON public.ports_locations;
CREATE POLICY "Platform admins can manage all ports" ON public.ports_locations FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage ports" ON public.ports_locations;
CREATE POLICY "Tenant admins can manage ports" ON public.ports_locations FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant ports" ON public.ports_locations;
CREATE POLICY "Users can view tenant ports" ON public.ports_locations FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carriers_tenant ON public.carriers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consignees_tenant ON public.consignees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ports_tenant ON public.ports_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_carrier ON public.quotes(carrier_id);
CREATE INDEX IF NOT EXISTS idx_quotes_consignee ON public.quotes(consignee_id);
CREATE INDEX IF NOT EXISTS idx_quotes_origin_port ON public.quotes(origin_port_id);
CREATE INDEX IF NOT EXISTS idx_quotes_destination_port ON public.quotes(destination_port_id);-- Create package categories table (container types)
CREATE TABLE IF NOT EXISTS public.package_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  category_name TEXT NOT NULL,
  category_code TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create package sizes table
CREATE TABLE IF NOT EXISTS public.package_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  size_name TEXT NOT NULL,
  size_code TEXT,
  length_ft NUMERIC,
  width_ft NUMERIC,
  height_ft NUMERIC,
  max_weight_kg NUMERIC,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create cargo types table
CREATE TABLE IF NOT EXISTS public.cargo_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cargo_type_name TEXT NOT NULL,
  cargo_code TEXT,
  requires_special_handling BOOLEAN DEFAULT false,
  hazmat_class TEXT,
  temperature_controlled BOOLEAN DEFAULT false,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create incoterms table
CREATE TABLE IF NOT EXISTS public.incoterms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  incoterm_code TEXT NOT NULL,
  incoterm_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add pricing fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS cost_price NUMERIC,
ADD COLUMN IF NOT EXISTS sell_price NUMERIC,
ADD COLUMN IF NOT EXISTS margin_amount NUMERIC,
ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS additional_costs JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS incoterm_id UUID,
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add cargo details to quote_items
ALTER TABLE public.quote_items
ADD COLUMN IF NOT EXISTS package_category_id UUID,
ADD COLUMN IF NOT EXISTS package_size_id UUID,
ADD COLUMN IF NOT EXISTS cargo_type_id UUID,
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
ADD COLUMN IF NOT EXISTS volume_cbm NUMERIC,
ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Enable RLS
ALTER TABLE public.package_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoterms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for package_categories
DROP POLICY IF EXISTS "Platform admins can manage all package categories" ON public.package_categories;
CREATE POLICY "Platform admins can manage all package categories" ON public.package_categories FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage package categories" ON public.package_categories;
CREATE POLICY "Tenant admins can manage package categories" ON public.package_categories FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant package categories" ON public.package_categories;
CREATE POLICY "Users can view tenant package categories" ON public.package_categories FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for package_sizes
DROP POLICY IF EXISTS "Platform admins can manage all package sizes" ON public.package_sizes;
CREATE POLICY "Platform admins can manage all package sizes" ON public.package_sizes FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage package sizes" ON public.package_sizes;
CREATE POLICY "Tenant admins can manage package sizes" ON public.package_sizes FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant package sizes" ON public.package_sizes;
CREATE POLICY "Users can view tenant package sizes" ON public.package_sizes FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for cargo_types
DROP POLICY IF EXISTS "Platform admins can manage all cargo types" ON public.cargo_types;
CREATE POLICY "Platform admins can manage all cargo types" ON public.cargo_types FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage cargo types" ON public.cargo_types;
CREATE POLICY "Tenant admins can manage cargo types" ON public.cargo_types FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant cargo types" ON public.cargo_types;
CREATE POLICY "Users can view tenant cargo types" ON public.cargo_types FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for incoterms
DROP POLICY IF EXISTS "Platform admins can manage all incoterms" ON public.incoterms;
CREATE POLICY "Platform admins can manage all incoterms" ON public.incoterms FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage incoterms" ON public.incoterms;
CREATE POLICY "Tenant admins can manage incoterms" ON public.incoterms FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant incoterms" ON public.incoterms;
CREATE POLICY "Users can view tenant incoterms" ON public.incoterms FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_package_categories_updated_at ON public.package_categories;
CREATE TRIGGER update_package_categories_updated_at
BEFORE UPDATE ON public.package_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_package_sizes_updated_at ON public.package_sizes;
CREATE TRIGGER update_package_sizes_updated_at
BEFORE UPDATE ON public.package_sizes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cargo_types_updated_at ON public.cargo_types;
CREATE TRIGGER update_cargo_types_updated_at
BEFORE UPDATE ON public.cargo_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_incoterms_updated_at ON public.incoterms;
CREATE TRIGGER update_incoterms_updated_at
BEFORE UPDATE ON public.incoterms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Fix RLS policy for consignees to allow platform admins global access
-- Ensures platform admins can SELECT/INSERT/UPDATE/DELETE across all rows

-- Enable RLS (idempotent)
ALTER TABLE public.consignees ENABLE ROW LEVEL SECURITY;

-- Drop and recreate platform admin policy with proper USING/WITH CHECK
DROP POLICY IF EXISTS "Platform admins can manage all consignees" ON public.consignees;

DROP POLICY IF EXISTS "Platform admins can manage all consignees" ON public.consignees;
CREATE POLICY "Platform admins can manage all consignees" ON public.consignees
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Keep tenant-scoped policies as defined elsewhere; this file only fixes admin policy.-- Allow tenant members (any role within tenant) to view subscription and usage
-- This complements existing admin-only policies by adding broader read access.

-- Tenant subscriptions: permit SELECT for users scoped to their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_subscriptions'
      AND policyname = 'Tenant members can view own subscriptions'
  ) THEN
    DROP POLICY IF EXISTS "Tenant members can view own subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Tenant members can view own subscriptions" ON public.tenant_subscriptions
      FOR SELECT
      USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
      );
  END IF;
END$$;

-- Usage records: permit SELECT for users scoped to their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'usage_records'
      AND policyname = 'Tenant members can view own usage records'
  ) THEN
    DROP POLICY IF EXISTS "Tenant members can view own usage records" ON public.usage_records;
CREATE POLICY "Tenant members can view own usage records" ON public.usage_records
      FOR SELECT
      USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
      );
  END IF;
END$$;

-- Subscription invoices: optional read for tenant members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_invoices'
      AND policyname = 'Tenant members can view own subscription invoices'
  ) THEN
    DROP POLICY IF EXISTS "Tenant members can view own subscription invoices" ON public.subscription_invoices;
CREATE POLICY "Tenant members can view own subscription invoices" ON public.subscription_invoices
      FOR SELECT
      USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
      );
  END IF;
END$$;-- Add INSERT policy for tenant_subscriptions and seed Starter plan
-- Ensures tenant admins can create subscriptions scoped to their tenant
-- and adds a base Starter plan for end-to-end testing.

BEGIN;

-- INSERT policy: Tenant admins can create subscriptions for their own tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_subscriptions'
      AND policyname = 'Tenant admins can create own subscriptions'
  ) THEN
    DROP POLICY IF EXISTS "Tenant admins can create own subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Tenant admins can create own subscriptions" ON public.tenant_subscriptions
      FOR INSERT
      WITH CHECK (
        public.has_role(auth.uid(), 'tenant_admin'::app_role)
        AND tenant_id = public.get_user_tenant_id(auth.uid())
      );
  END IF;
END$$;

-- Seed Starter plan if it does not already exist
INSERT INTO public.subscription_plans (
  name,
  slug,
  plan_type,
  tier,
  billing_period,
  price_monthly,
  price_annual,
  currency,
  features,
  limits,
  is_active,
  sort_order,
  description
)
VALUES (
  'Starter',
  'starter',
  'crm_base',
  'starter',
  'monthly',
  49.00,
  470.40,
  'USD',
  '["leads","accounts","contacts","opportunities","activities","basic reporting"]'::jsonb,
  '{"users":5,"emails_per_month":5000,"api_calls":100000}'::jsonb,
  true,
  1,
  'Perfect for small teams getting started with CRM'
)
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  plan_type = EXCLUDED.plan_type,
  tier = EXCLUDED.tier,
  billing_period = EXCLUDED.billing_period,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  currency = EXCLUDED.currency,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description,
  updated_at = now();

COMMIT;-- Seed sample services per tenant for Ocean, Air, Trucking, Courier, Railways, Movers & Packers
-- Also extend the services.service_type CHECK constraint to include railway_transport
BEGIN;

-- Ensure CHECK constraint allows railway_transport
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_service_type_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_service_type_check
  CHECK (service_type IN ('ocean', 'air', 'trucking', 'courier', 'moving', 'railway_transport'));

-- Helper CTE of tenants
WITH tenants AS (
  SELECT id FROM public.tenants
)

-- Ocean Freight - Standard
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'OCEAN_STD', 'Ocean Freight - Standard', 'ocean',
       'FCL/LCL general ocean freight service', 1200, 'per container', 25,
       true, '{"container":"20ft","incoterms":["FOB","CIF","EXW"]}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'OCEAN_STD'
);

-- Air Freight - Express
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'AIR_EXP', 'Air Freight - Express', 'air',
       'Priority air freight for urgent shipments', 5, 'per kg', 3,
       true, '{"service_level":"express","iata_required":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'AIR_EXP'
);

-- Inland Trucking - LTL
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'TRUCK_LTL', 'Inland Trucking - LTL', 'trucking',
       'Less-than-truckload domestic road transport', 2, 'per mile', 5,
       true, '{"equipment":"box_truck","hazmat_supported":false}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'TRUCK_LTL'
);

-- Courier - Standard Parcel
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'COURIER_STD', 'Courier - Standard', 'courier',
       'Door-to-door parcel delivery', 10, 'per parcel', 2,
       true, '{"max_weight_kg":30,"tracking":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'COURIER_STD'
);

-- Railways - Standard Container
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'RAIL_STD', 'Railways - Standard', 'railway_transport',
       'Intermodal rail transport for containers', 800, 'per container', 10,
       true, '{"container":"40ft","waybill_required":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'RAIL_STD'
);

-- Movers & Packers - Residential Move
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'MOVE_PACK', 'Movers & Packers - Residential', 'moving',
       'Pack and move residential goods', 1500, 'per job', 3,
       true, '{"includes_packing":true,"insurance_available":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'MOVE_PACK'
);

COMMIT;-- Create function to fetch database schema (tables and columns with constraints)
DROP FUNCTION IF EXISTS public.get_database_schema();
CREATE OR REPLACE FUNCTION public.get_database_schema()
RETURNS TABLE (
  table_name text,
  column_name text,
  data_type text,
  is_nullable boolean,
  column_default text,
  is_primary_key boolean,
  is_foreign_key boolean,
  references_table text,
  references_column text
)
AS $$
  WITH cols AS (
    SELECT 
      c.table_name, 
      c.column_name, 
      c.data_type, 
      (c.is_nullable = 'YES') AS is_nullable, 
      c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
  ),
  pk AS (
    SELECT 
      kcu.table_name, 
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name 
      AND tc.table_schema = kcu.table_schema 
      AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = 'public' 
      AND tc.constraint_type = 'PRIMARY KEY'
  ),
  fk AS (
    SELECT
      kcu.table_name,
      kcu.column_name,
      ccu.table_name AS references_table,
      ccu.column_name AS references_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name 
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name 
      AND rc.constraint_schema = tc.table_schema
    JOIN information_schema.key_column_usage ccu
      ON ccu.constraint_name = rc.unique_constraint_name 
      AND ccu.constraint_schema = rc.unique_constraint_schema 
      AND ccu.ordinal_position = kcu.ordinal_position
    WHERE tc.table_schema = 'public' 
      AND tc.constraint_type = 'FOREIGN KEY'
  )
  SELECT 
    cols.table_name::text,
    cols.column_name::text,
    cols.data_type::text,
    cols.is_nullable,
    cols.column_default::text,
    (pk.column_name IS NOT NULL) AS is_primary_key,
    (fk.column_name IS NOT NULL) AS is_foreign_key,
    fk.references_table::text,
    fk.references_column::text
  FROM cols
  LEFT JOIN pk 
    ON pk.table_name = cols.table_name 
    AND pk.column_name = cols.column_name
  LEFT JOIN fk 
    ON fk.table_name = cols.table_name 
    AND fk.column_name = cols.column_name
  ORDER BY cols.table_name, cols.column_name;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;-- Function: List public tables and views with RLS, counts, and row estimate
DROP FUNCTION IF EXISTS public.get_database_tables();
CREATE OR REPLACE FUNCTION public.get_database_tables()
RETURNS TABLE (
  table_name text,
  table_type text,
  rls_enabled boolean,
  policy_count bigint,
  column_count integer,
  index_count integer,
  row_estimate bigint
)
AS $$
  WITH cols AS (
    SELECT table_name, COUNT(*) AS column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_name
  ),
  idx AS (
    SELECT tablename AS table_name, COUNT(*) AS index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    GROUP BY tablename
  ),
  pol AS (
    SELECT tablename AS table_name, COUNT(*) AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
  )
  SELECT 
    c.relname::text AS table_name,
    CASE WHEN c.relkind = 'r' THEN 'table' WHEN c.relkind = 'v' THEN 'view' ELSE c.relkind::text END AS table_type,
    CASE WHEN c.relkind = 'r' THEN c.relrowsecurity ELSE NULL END AS rls_enabled,
    COALESCE(pol.policy_count, 0) AS policy_count,
    COALESCE(cols.column_count, 0) AS column_count,
    COALESCE(idx.index_count, 0) AS index_count,
    CASE WHEN c.relkind = 'r' THEN c.reltuples::bigint ELSE NULL END AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN cols ON cols.table_name = c.relname
  LEFT JOIN idx ON idx.table_name = c.relname
  LEFT JOIN pol ON pol.table_name = c.relname
  WHERE n.nspname = 'public' AND c.relkind IN ('r','v')
  ORDER BY c.relname;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Function: List constraints across public tables (PK, FK, UNIQUE, CHECK)
DROP FUNCTION IF EXISTS public.get_table_constraints();
CREATE OR REPLACE FUNCTION public.get_table_constraints()
RETURNS TABLE (
  table_name text,
  constraint_name text,
  constraint_type text,
  constraint_details text
)
AS $$
  WITH tc AS (
    SELECT * FROM information_schema.table_constraints
    WHERE table_schema = 'public'
  ),
  kcu AS (
    SELECT * FROM information_schema.key_column_usage
    WHERE table_schema = 'public'
  ),
  ccu AS (
    SELECT * FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
  ),
  chk AS (
    SELECT * FROM information_schema.check_constraints
  ),
  fk AS (
    SELECT 
      tc.table_name,
      tc.constraint_name,
      'FOREIGN KEY'::text AS constraint_type,
      format('columns: %s; references: %s(%s)',
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position),
        max(ccu.table_name),
        string_agg(ccu.column_name, ', ' ORDER BY ccu.column_name)
      ) AS constraint_details
    FROM tc
    JOIN kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name AND kcu.table_schema = tc.table_schema
    JOIN ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    GROUP BY tc.table_name, tc.constraint_name
  ),
  pk AS (
    SELECT 
      tc.table_name,
      tc.constraint_name,
      'PRIMARY KEY'::text AS constraint_type,
      format('columns: %s', string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)) AS constraint_details
    FROM tc
    JOIN kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
    GROUP BY tc.table_name, tc.constraint_name
  ),
  uq AS (
    SELECT 
      tc.table_name,
      tc.constraint_name,
      'UNIQUE'::text AS constraint_type,
      format('columns: %s', string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)) AS constraint_details
    FROM tc
    JOIN kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
    GROUP BY tc.table_name, tc.constraint_name
  ),
  ck AS (
    SELECT 
      tc.table_name,
      tc.constraint_name,
      'CHECK'::text AS constraint_type,
      chk.check_clause AS constraint_details
    FROM tc
    JOIN chk ON chk.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'CHECK'
  )
  SELECT * FROM fk
  UNION ALL
  SELECT * FROM pk
  UNION ALL
  SELECT * FROM uq
  UNION ALL
  SELECT * FROM ck
  ORDER BY table_name, constraint_name;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Function: List indexes across public tables
DROP FUNCTION IF EXISTS public.get_table_indexes();
CREATE OR REPLACE FUNCTION public.get_table_indexes()
RETURNS TABLE (
  table_name text,
  index_name text,
  is_unique boolean,
  index_columns text,
  index_definition text
)
AS $$
  SELECT 
    t.relname::text AS table_name,
    i.relname::text AS index_name,
    ix.indisunique AS is_unique,
    array_to_string(array_agg(a.attname ORDER BY a.attnum), ', ') AS index_columns,
    pg_get_indexdef(ix.indexrelid)::text AS index_definition
  FROM pg_class t
  JOIN pg_index ix ON ix.indrelid = t.oid
  JOIN pg_class i ON i.oid = ix.indexrelid
  LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.relname, i.relname, ix.indisunique, ix.indexrelid
  ORDER BY t.relname, i.relname;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;-- Create functions for security overview page

-- Function to get all database enums
DROP FUNCTION IF EXISTS public.get_database_enums();
CREATE OR REPLACE FUNCTION public.get_database_enums()
RETURNS TABLE (
  enum_type text,
  labels text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.typname::text AS enum_type,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)::text AS labels
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.typname
  ORDER BY t.typname;
$$;

-- Function to get RLS status for all tables
DROP FUNCTION IF EXISTS public.get_rls_status();
CREATE OR REPLACE FUNCTION public.get_rls_status()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled,
    COUNT(p.policyname) AS policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  GROUP BY c.relname, c.relrowsecurity
  ORDER BY c.relname;
$$;

-- Function to get all RLS policies
DROP FUNCTION IF EXISTS public.get_rls_policies();
CREATE OR REPLACE FUNCTION public.get_rls_policies()
RETURNS TABLE (
  table_name text,
  policy_name text,
  command text,
  roles text,
  using_expression text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tablename::text AS table_name,
    policyname::text AS policy_name,
    cmd::text AS command,
    roles::text,
    COALESCE(qual, with_check)::text AS using_expression
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
$$;-- Create function to execute read-only SQL queries
DROP FUNCTION IF EXISTS public.execute_sql_query(query_text text);
CREATE OR REPLACE FUNCTION public.execute_sql_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_data jsonb;
BEGIN
  -- Only allow SELECT queries
  IF NOT (query_text ~* '^\s*SELECT') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block any mutations
  IF query_text ~* '(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Execute the query and return as JSON
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result_data;
  
  RETURN COALESCE(result_data, '[]'::jsonb);
END;
$$;-- Create function to get detailed database schema
DROP FUNCTION IF EXISTS public.get_database_schema();
CREATE OR REPLACE FUNCTION public.get_database_schema()
RETURNS TABLE (
  table_name text,
  column_name text,
  data_type text,
  is_nullable boolean,
  column_default text,
  is_primary_key boolean,
  is_foreign_key boolean,
  references_table text,
  references_column text
)
AS $$
  SELECT 
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as is_nullable,
    c.column_default::text,
    CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key,
    CASE WHEN kcu2.table_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
    kcu2.table_name::text as references_table,
    kcu2.column_name::text as references_column
  FROM information_schema.columns c
  LEFT JOIN information_schema.key_column_usage kcu 
    ON c.table_name = kcu.table_name 
    AND c.column_name = kcu.column_name
    AND c.table_schema = kcu.table_schema
  LEFT JOIN information_schema.table_constraints tc 
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
  LEFT JOIN information_schema.referential_constraints rc 
    ON rc.constraint_name = kcu.constraint_name
    AND rc.constraint_schema = kcu.table_schema
  LEFT JOIN information_schema.key_column_usage kcu2 
    ON rc.unique_constraint_name = kcu2.constraint_name
    AND rc.unique_constraint_schema = kcu2.table_schema
  WHERE c.table_schema = 'public'
    AND c.table_name NOT IN ('spatial_ref_sys')
  ORDER BY c.table_name, c.ordinal_position;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Create function to get database tables overview
DROP FUNCTION IF EXISTS public.get_database_tables();
CREATE OR REPLACE FUNCTION public.get_database_tables()
RETURNS TABLE (
  table_name text,
  table_type text,
  rls_enabled boolean,
  policy_count bigint,
  column_count bigint,
  index_count bigint,
  row_estimate bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.tablename::text AS table_name,
    'BASE TABLE'::text AS table_type,
    c.relrowsecurity AS rls_enabled,
    COUNT(DISTINCT p.policyname) AS policy_count,
    COUNT(DISTINCT a.attname) AS column_count,
    COUNT(DISTINCT i.indexrelid) AS index_count,
    c.reltuples::bigint AS row_estimate
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
  LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
  LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_index i ON i.indrelid = c.oid
  WHERE t.schemaname = 'public'
  GROUP BY t.tablename, c.relrowsecurity, c.reltuples
  ORDER BY t.tablename;
$$;

-- Create function to get table constraints
DROP FUNCTION IF EXISTS public.get_table_constraints();
CREATE OR REPLACE FUNCTION public.get_table_constraints()
RETURNS TABLE (
  table_name text,
  constraint_name text,
  constraint_type text,
  constraint_details text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tc.table_name::text,
    tc.constraint_name::text,
    tc.constraint_type::text,
    COALESCE(
      string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position),
      cc.check_clause
    )::text AS constraint_details
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    AND tc.table_name = kcu.table_name
  LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
  WHERE tc.table_schema = 'public'
  GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type, cc.check_clause
  ORDER BY tc.table_name, tc.constraint_name;
$$;

-- Create function to get table indexes
DROP FUNCTION IF EXISTS public.get_table_indexes();
CREATE OR REPLACE FUNCTION public.get_table_indexes()
RETURNS TABLE (
  table_name text,
  index_name text,
  is_unique boolean,
  index_columns text,
  index_definition text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.relname::text AS table_name,
    i.relname::text AS index_name,
    ix.indisunique AS is_unique,
    string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey, a.attnum))::text AS index_columns,
    pg_get_indexdef(ix.indexrelid)::text AS index_definition
  FROM pg_index ix
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  WHERE n.nspname = 'public'
    AND t.relkind = 'r'
  GROUP BY t.relname, i.relname, ix.indisunique, ix.indexrelid
  ORDER BY t.relname, i.relname;
$$;-- Add shipment_type to services and seed sample services per tenant
BEGIN;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'shipment_type' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.shipment_type AS ENUM ('ocean_freight','air_freight','inland_trucking','railway_transport','courier','movers_packers');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['ocean_freight','air_freight','inland_trucking','railway_transport','courier','movers_packers'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'shipment_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.shipment_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

-- Add column to services (safe if already exists)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS shipment_type public.shipment_type;

-- Populate shipment_type from existing columns if present
DO $$
DECLARE
  has_service_type boolean;
  has_mode boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_type'
  ) INTO has_service_type;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'mode'
  ) INTO has_mode;

  IF has_service_type THEN
    UPDATE public.services s
    SET shipment_type = CASE s.service_type
      WHEN 'ocean' THEN 'ocean_freight'::public.shipment_type
      WHEN 'air' THEN 'air_freight'::public.shipment_type
      WHEN 'trucking' THEN 'inland_trucking'::public.shipment_type
      WHEN 'courier' THEN 'courier'::public.shipment_type
      WHEN 'moving' THEN 'movers_packers'::public.shipment_type
      WHEN 'railway_transport' THEN 'railway_transport'::public.shipment_type
      ELSE NULL
    END
    WHERE shipment_type IS NULL;
  ELSIF has_mode THEN
    UPDATE public.services s
    SET shipment_type = CASE s.mode::text
      WHEN 'ocean' THEN 'ocean_freight'::public.shipment_type
      WHEN 'air' THEN 'air_freight'::public.shipment_type
      WHEN 'inland_trucking' THEN 'inland_trucking'::public.shipment_type
      WHEN 'courier' THEN 'courier'::public.shipment_type
      WHEN 'movers_packers' THEN 'movers_packers'::public.shipment_type
      ELSE NULL
    END
    WHERE shipment_type IS NULL;
  END IF;
END $$;

-- Seed sample services per tenant referencing shipment_type
DO $$
DECLARE
  has_old_schema boolean; -- service_code/service_name
  has_mode_schema boolean; -- mode/name
  rec RECORD;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_code'
  ) INTO has_old_schema;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'mode'
  ) INTO has_mode_schema;

  FOR rec IN SELECT id AS tenant_id FROM public.tenants LOOP
    IF has_old_schema THEN
      -- Old schema (service_code/service_name/service_type)
      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'OCEAN_STD', 'Ocean Freight - Standard', 'ocean',
             'FCL/LCL ocean freight', 1200, 'per container', 25,
             true, '{"container":"20ft"}'::jsonb,
             'ocean_freight'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'OCEAN_STD'
      );

      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'AIR_EXP', 'Air Freight - Express', 'air',
             'Priority air freight', 5, 'per kg', 3,
             true, '{"max_weight_kg":500}'::jsonb,
             'air_freight'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'AIR_EXP'
      );

      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'TRUCK_LTL', 'Inland Trucking - LTL', 'trucking',
             'Domestic road transport LTL', 2, 'per mile', 5,
             true, '{"equipment":"box_truck"}'::jsonb,
             'inland_trucking'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'TRUCK_LTL'
      );

      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'COURIER_STD', 'Courier - Standard Parcel', 'courier',
             'Door-to-door parcel delivery', 10, 'per parcel', 2,
             true, '{"tracking":true}'::jsonb,
             'courier'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'COURIER_STD'
      );

      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'MOVE_PACK', 'Movers & Packers - Residential', 'moving',
             'Pack and move household goods', 1500, 'per job', 3,
             true, '{"includes_packing":true}'::jsonb,
             'movers_packers'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'MOVE_PACK'
      );

      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'RAIL_STD', 'Railways - Standard', 'railway_transport',
             'Intermodal rail transport', 800, 'per container', 10,
             true, '{"waybill_required":true}'::jsonb,
             'railway_transport'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'RAIL_STD'
      );

    ELSIF has_mode_schema THEN
      -- New schema (mode/name)
      INSERT INTO public.services (
        tenant_id, mode, name, description, transit_profile, is_active, shipment_type
      )
      SELECT rec.tenant_id, 'ocean'::public.transport_mode, 'Ocean Freight - Standard',
             'FCL/LCL ocean freight', '{"days":25,"unit":"per container"}'::jsonb,
             true, 'ocean_freight'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.name = 'Ocean Freight - Standard'
      );

      INSERT INTO public.services (
        tenant_id, mode, name, description, transit_profile, is_active, shipment_type
      )
      SELECT rec.tenant_id, 'air'::public.transport_mode, 'Air Freight - Express',
             'Priority air freight for urgent shipments', '{"days":3,"unit":"per kg"}'::jsonb,
             true, 'air_freight'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.name = 'Air Freight - Express'
      );

      INSERT INTO public.services (
        tenant_id, mode, name, description, transit_profile, is_active, shipment_type
      )
      SELECT rec.tenant_id, 'inland_trucking'::public.transport_mode, 'Inland Trucking - LTL',
             'Less-than-truckload domestic road transport', '{"days":5,"unit":"per mile"}'::jsonb,
             true, 'inland_trucking'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.name = 'Inland Trucking - LTL'
      );

      INSERT INTO public.services (
        tenant_id, mode, name, description, transit_profile, is_active, shipment_type
      )
      SELECT rec.tenant_id, 'courier'::public.transport_mode, 'Courier - Standard Parcel',
             'Door-to-door parcel delivery', '{"days":2,"unit":"per parcel"}'::jsonb,
             true, 'courier'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.name = 'Courier - Standard Parcel'
      );

      INSERT INTO public.services (
        tenant_id, mode, name, description, transit_profile, is_active, shipment_type
      )
      SELECT rec.tenant_id, 'movers_packers'::public.transport_mode, 'Movers & Packers - Residential',
             'Pack and move residential goods', '{"days":3,"unit":"per job"}'::jsonb,
             true, 'movers_packers'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.name = 'Movers & Packers - Residential'
      );
    END IF;
  END LOOP;
END $$;
