-- Create CRM enums
DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'account_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.account_type AS ENUM ('prospect','customer','partner','vendor');
  ELSE
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
  ) THEN
    CREATE TYPE public.account_status AS ENUM ('active','inactive','pending');
  ELSE
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
  ) THEN
    CREATE TYPE public.lead_status AS ENUM ('new','contacted','qualified','proposal','negotiation','won','lost');
  ELSE
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
  ) THEN
    CREATE TYPE public.lead_source AS ENUM ('website','referral','email','phone','social','event','other');
  ELSE
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
  ) THEN
    CREATE TYPE public.activity_type AS ENUM ('call','email','meeting','task','note');
  ELSE
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
  ) THEN
    CREATE TYPE public.activity_status AS ENUM ('planned','in_progress','completed','cancelled');
  ELSE
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
  ) THEN
    CREATE TYPE public.priority_level AS ENUM ('low','medium','high','urgent');
  ELSE
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
CREATE TABLE public.accounts (
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
CREATE TABLE public.contacts (
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
CREATE TABLE public.leads (
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
CREATE TABLE public.activities (
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
CREATE POLICY "Platform admins can manage all accounts"
  ON public.accounts FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant accounts"
  ON public.accounts FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Franchise admins can manage franchise accounts"
  ON public.accounts FOR ALL
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

CREATE POLICY "Users can view franchise accounts"
  ON public.accounts FOR SELECT
  USING (franchise_id = public.get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can create franchise accounts"
  ON public.accounts FOR INSERT
  WITH CHECK (franchise_id = public.get_user_franchise_id(auth.uid()));

-- RLS Policies for Contacts
CREATE POLICY "Platform admins can manage all contacts"
  ON public.contacts FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant contacts"
  ON public.contacts FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Franchise admins can manage franchise contacts"
  ON public.contacts FOR ALL
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

CREATE POLICY "Users can view franchise contacts"
  ON public.contacts FOR SELECT
  USING (franchise_id = public.get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can create franchise contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (franchise_id = public.get_user_franchise_id(auth.uid()));

-- RLS Policies for Leads
CREATE POLICY "Platform admins can manage all leads"
  ON public.leads FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant leads"
  ON public.leads FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Franchise admins can manage franchise leads"
  ON public.leads FOR ALL
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

CREATE POLICY "Users can view franchise leads"
  ON public.leads FOR SELECT
  USING (franchise_id = public.get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can create franchise leads"
  ON public.leads FOR INSERT
  WITH CHECK (franchise_id = public.get_user_franchise_id(auth.uid()));

-- RLS Policies for Activities
CREATE POLICY "Platform admins can manage all activities"
  ON public.activities FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant activities"
  ON public.activities FOR ALL
  USING (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Franchise admins can manage franchise activities"
  ON public.activities FOR ALL
  USING (
    public.has_role(auth.uid(), 'franchise_admin') AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

CREATE POLICY "Users can view assigned activities"
  ON public.activities FOR SELECT
  USING (
    assigned_to = auth.uid() OR
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

CREATE POLICY "Users can create activities"
  ON public.activities FOR INSERT
  WITH CHECK (franchise_id = public.get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can update own activities"
  ON public.activities FOR UPDATE
  USING (assigned_to = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_accounts_tenant_id ON public.accounts(tenant_id);
CREATE INDEX idx_accounts_franchise_id ON public.accounts(franchise_id);
CREATE INDEX idx_accounts_owner_id ON public.accounts(owner_id);
CREATE INDEX idx_accounts_status ON public.accounts(status);

CREATE INDEX idx_contacts_tenant_id ON public.contacts(tenant_id);
CREATE INDEX idx_contacts_franchise_id ON public.contacts(franchise_id);
CREATE INDEX idx_contacts_account_id ON public.contacts(account_id);
CREATE INDEX idx_contacts_owner_id ON public.contacts(owner_id);

CREATE INDEX idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX idx_leads_franchise_id ON public.leads(franchise_id);
CREATE INDEX idx_leads_owner_id ON public.leads(owner_id);
CREATE INDEX idx_leads_status ON public.leads(status);

CREATE INDEX idx_activities_tenant_id ON public.activities(tenant_id);
CREATE INDEX idx_activities_franchise_id ON public.activities(franchise_id);
CREATE INDEX idx_activities_assigned_to ON public.activities(assigned_to);
CREATE INDEX idx_activities_account_id ON public.activities(account_id);
CREATE INDEX idx_activities_contact_id ON public.activities(contact_id);
CREATE INDEX idx_activities_lead_id ON public.activities(lead_id);
CREATE INDEX idx_activities_due_date ON public.activities(due_date);
CREATE INDEX idx_activities_status ON public.activities(status);