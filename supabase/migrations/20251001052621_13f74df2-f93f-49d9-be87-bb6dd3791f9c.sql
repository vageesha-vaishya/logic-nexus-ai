-- Add lead scoring and workflow fields
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
CREATE POLICY "Platform admins can manage all scoring rules"
ON public.lead_scoring_rules
FOR ALL
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant scoring rules"
ON public.lead_scoring_rules
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
CREATE POLICY "Platform admins can manage all assignment rules"
ON public.lead_assignment_rules
FOR ALL
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant assignment rules"
ON public.lead_assignment_rules
FOR ALL
USING (
  has_role(auth.uid(), 'tenant_admin') 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Create function to calculate lead score
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
CREATE OR REPLACE FUNCTION public.update_lead_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.lead_score := public.calculate_lead_score(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_lead_score
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_score();