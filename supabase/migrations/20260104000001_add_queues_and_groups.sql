-- Migration to add Queues and Round Robin Groups support
-- Phase 1 of Lead Management Benchmark Implementation

-- 1. Create Queues Table
CREATE TABLE IF NOT EXISTS public.queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    type TEXT CHECK (type IN ('holding', 'round_robin')) DEFAULT 'holding',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for queues
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Queues
CREATE POLICY "Tenant admins can manage queues"
ON public.queues
FOR ALL
USING (
  has_role(auth.uid(), 'tenant_admin') 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can view queues in their tenant"
ON public.queues
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
);


-- 2. Create Queue Members Table
CREATE TABLE IF NOT EXISTS public.queue_members (
    queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (queue_id, user_id)
);

-- Enable RLS for queue_members
ALTER TABLE public.queue_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Queue Members
CREATE POLICY "Tenant admins can manage queue members"
ON public.queue_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_members.queue_id
    AND q.tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'tenant_admin')
  )
);

CREATE POLICY "Users can view queue members in their tenant"
ON public.queue_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_members.queue_id
    AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);


-- 3. Update Leads Table to support Queue Assignment
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS owner_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL;

-- 4. Update Lead Assignment Rules to support Queues and Groups
ALTER TABLE public.lead_assignment_rules 
ADD COLUMN IF NOT EXISTS assigned_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assignment_type TEXT CHECK (assignment_type IN ('user', 'queue', 'round_robin_group')) DEFAULT 'user';

-- 5. Update assign_lead_with_transaction function to handle queues
CREATE OR REPLACE FUNCTION assign_lead_with_transaction(
  p_lead_id uuid,
  p_assigned_to uuid,
  p_assignment_method text,
  p_rule_id uuid,
  p_tenant_id uuid,
  p_franchise_id uuid,
  p_assigned_queue_id uuid DEFAULT NULL,
  p_assignment_type text DEFAULT 'user'
) returns void as $$
DECLARE
  v_final_assigned_to uuid;
  v_final_assigned_queue_id uuid;
  v_member_record record;
BEGIN
  -- Determine final assignment based on type
  IF p_assignment_type = 'queue' THEN
    v_final_assigned_to := NULL;
    v_final_assigned_queue_id := p_assigned_queue_id;
  ELSIF p_assignment_type = 'round_robin_group' THEN
    -- Find best available member in the group (queue)
    -- This logic mimics the global round robin but scoped to queue members
    SELECT qm.user_id INTO v_final_assigned_to
    FROM public.queue_members qm
    JOIN public.user_capacity uc ON uc.user_id = qm.user_id AND uc.tenant_id = p_tenant_id
    WHERE qm.queue_id = p_assigned_queue_id
    AND uc.is_available = true
    AND (uc.max_capacity IS NULL OR uc.current_leads < uc.max_capacity)
    ORDER BY uc.last_assigned_at ASC NULLS FIRST
    LIMIT 1;

    IF v_final_assigned_to IS NULL THEN
        -- Fallback: If no one is available in the group, assign to the queue itself (holding)
        v_final_assigned_to := NULL;
        v_final_assigned_queue_id := p_assigned_queue_id;
        -- Update method to indicate fallback
        p_assignment_method := p_assignment_method || ' (fallback_to_queue)';
    ELSE
        v_final_assigned_queue_id := NULL; -- Assigned to user, not queue
    END IF;

  ELSE -- 'user'
    v_final_assigned_to := p_assigned_to;
    v_final_assigned_queue_id := NULL;
  END IF;

  -- Start transaction
  BEGIN
    -- Update lead owner
    UPDATE leads
    SET 
      owner_id = v_final_assigned_to,
      owner_queue_id = v_final_assigned_queue_id,
      status = CASE WHEN v_final_assigned_to IS NOT NULL THEN 'new' ELSE status END -- Optional status update
    WHERE id = p_lead_id;

    -- Record assignment history
    INSERT INTO lead_assignment_history (
      lead_id,
      assigned_to,
      assignment_method,
      rule_id,
      tenant_id,
      franchise_id,
      assigned_by
    ) VALUES (
      p_lead_id,
      v_final_assigned_to,
      p_assignment_method,
      p_rule_id,
      p_tenant_id,
      p_franchise_id,
      null -- automated assignment
    );

    -- Update user capacity if assigned to a user
    IF v_final_assigned_to IS NOT NULL THEN
        UPDATE user_capacity
        SET 
          current_leads = current_leads + 1,
          last_assigned_at = now()
        WHERE user_id = v_final_assigned_to
        AND tenant_id = p_tenant_id;
    END IF;

    -- Commit transaction (implicit in PL/pgSQL function unless exception)
  EXCEPTION
    WHEN OTHERS THEN
      -- Raise exception to rollback
      RAISE;
  END;
END;
$$ language plpgsql;
