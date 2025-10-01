-- Create assignment history table
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
CREATE POLICY "Platform admins can manage all assignment history"
  ON public.lead_assignment_history FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view tenant assignment history"
  ON public.lead_assignment_history FOR SELECT
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Franchise admins can view franchise assignment history"
  ON public.lead_assignment_history FOR SELECT
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
CREATE POLICY "Platform admins can manage all user capacity"
  ON public.user_capacity FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant user capacity"
  ON public.user_capacity FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view own capacity"
  ON public.user_capacity FOR SELECT
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
CREATE POLICY "Platform admins can manage all assignment queue"
  ON public.lead_assignment_queue FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view tenant assignment queue"
  ON public.lead_assignment_queue FOR SELECT
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
CREATE POLICY "Platform admins can manage all territories"
  ON public.territories FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant territories"
  ON public.territories FOR ALL
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
CREATE POLICY "Platform admins can manage all territory assignments"
  ON public.territory_assignments FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage territory assignments"
  ON public.territory_assignments FOR ALL
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
CREATE TRIGGER update_user_capacity_updated_at
  BEFORE UPDATE ON public.user_capacity
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_territories_updated_at
  BEFORE UPDATE ON public.territories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();