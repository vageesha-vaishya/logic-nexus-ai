-- Migration: Autonomous Booking Agents Schema
-- Description: Adds booking_agents and booking_executions tables for Phase 4: Autonomous Logistics

-- 1. Create booking_agents table
CREATE TABLE IF NOT EXISTS public.booking_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    strategy TEXT NOT NULL CHECK (strategy IN ('best_value', 'cheapest', 'fastest', 'custom')),
    is_active BOOLEAN DEFAULT false,
    configuration JSONB DEFAULT '{}'::jsonb, -- e.g. { "max_price": 5000, "preferred_carriers": ["..."] }
    last_run_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create booking_executions table (Audit Log for Agents)
CREATE TABLE IF NOT EXISTS public.booking_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.booking_agents(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL, -- Reference to quote_options or quotes
    shipment_id UUID REFERENCES public.shipments(id), -- Nullable if booking failed
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    log JSONB DEFAULT '{}'::jsonb, -- Detailed decision log
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.booking_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_executions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Booking Agents: Tenant isolation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'booking_agents' AND policyname = 'Tenant can view their booking agents'
  ) THEN
    CREATE POLICY "Tenant can view their booking agents" ON public.booking_agents
        FOR SELECT USING (auth.uid() IN (
            SELECT user_id FROM public.user_roles WHERE tenant_id = booking_agents.tenant_id
        ));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'booking_agents' AND policyname = 'Tenant can manage their booking agents'
  ) THEN
    CREATE POLICY "Tenant can manage their booking agents" ON public.booking_agents
        FOR ALL USING (auth.uid() IN (
            SELECT user_id FROM public.user_roles WHERE tenant_id = booking_agents.tenant_id
        ));
  END IF;
END $$;

-- Booking Executions: Tenant isolation (via agent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'booking_executions' AND policyname = 'Tenant can view booking executions'
  ) THEN
    CREATE POLICY "Tenant can view booking executions" ON public.booking_executions
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.booking_agents
                WHERE booking_agents.id = booking_executions.agent_id
                AND booking_agents.tenant_id IN (
                    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
                )
            )
        );
  END IF;
END $$;

-- 5. Trigger for updated_at
DROP TRIGGER IF EXISTS update_booking_agents_modtime ON public.booking_agents;
CREATE TRIGGER update_booking_agents_modtime
    BEFORE UPDATE ON public.booking_agents
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_booking_agents_tenant ON public.booking_agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_booking_executions_agent ON public.booking_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_booking_executions_shipment ON public.booking_executions(shipment_id);
