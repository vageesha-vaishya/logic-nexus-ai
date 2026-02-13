-- Migration: 20260222000000_email_sequences.sql
-- Description: Adds tables for Email Sequences (Drip Campaigns)

-- 1. Sequences Table
CREATE TABLE IF NOT EXISTS public.email_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    stop_on_reply BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}', -- Future proofing (e.g., schedule constraints)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Sequence Steps Table
CREATE TABLE IF NOT EXISTS public.email_sequence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID REFERENCES public.email_sequences(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL, -- 1, 2, 3...
    template_id UUID REFERENCES public.email_templates(id),
    delay_hours INTEGER DEFAULT 24, -- Delay from previous step (or enrollment for step 1)
    type TEXT NOT NULL DEFAULT 'email' CHECK (type IN ('email', 'task')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sequence_id, step_order)
);

-- 3. Enrollments Table
CREATE TABLE IF NOT EXISTS public.email_sequence_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID REFERENCES public.email_sequences(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    lead_id UUID, -- Optional link to leads table if exists
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'paused', 'failed', 'unsubscribed')),
    current_step_order INTEGER DEFAULT 0, -- 0 means just enrolled, waiting for step 1
    next_step_due_at TIMESTAMPTZ,
    last_step_completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sequence_id, recipient_email)
);

-- 4. Enrollment Logs (Optional but good for debugging)
CREATE TABLE IF NOT EXISTS public.email_sequence_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID REFERENCES public.email_sequence_enrollments(id) ON DELETE CASCADE,
    step_order INTEGER,
    action TEXT NOT NULL, -- 'sent', 'failed', 'skipped'
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. RLS Policies

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_logs ENABLE ROW LEVEL SECURITY;

-- Simple Tenant-based policies
CREATE POLICY "Tenant users can view sequences" ON public.email_sequences
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "Tenant admins can manage sequences" ON public.email_sequences
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

-- Steps follow sequence access (simplified for now, usually would check tenant via sequence)
CREATE POLICY "Tenant users can view steps" ON public.email_sequence_steps
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.email_sequences s WHERE s.id = sequence_id AND s.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)));

CREATE POLICY "Tenant admins can manage steps" ON public.email_sequence_steps
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.email_sequences s WHERE s.id = sequence_id AND s.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.email_sequences s WHERE s.id = sequence_id AND s.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)));

-- Enrollments policies
CREATE POLICY "Tenant users can view enrollments" ON public.email_sequence_enrollments
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.email_sequences s WHERE s.id = sequence_id AND s.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)));

CREATE POLICY "Tenant admins can manage enrollments" ON public.email_sequence_enrollments
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.email_sequences s WHERE s.id = sequence_id AND s.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.email_sequences s WHERE s.id = sequence_id AND s.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)));


-- 6. RPC: Get Due Sequence Steps
CREATE OR REPLACE FUNCTION public.get_due_sequence_steps(p_batch_size INTEGER DEFAULT 50)
RETURNS TABLE (
    enrollment_id UUID,
    sequence_id UUID,
    recipient_email TEXT,
    recipient_name TEXT,
    step_id UUID,
    step_order INTEGER,
    template_id UUID,
    delay_hours INTEGER,
    step_type TEXT,
    tenant_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS enrollment_id,
        e.sequence_id,
        e.recipient_email,
        e.recipient_name,
        stp.id AS step_id,
        stp.step_order,
        stp.template_id,
        stp.delay_hours,
        stp.type AS step_type,
        s.tenant_id
    FROM public.email_sequence_enrollments e
    JOIN public.email_sequences s ON e.sequence_id = s.id
    JOIN public.email_sequence_steps stp ON stp.sequence_id = e.sequence_id
    WHERE 
        e.status = 'active'
        AND s.status = 'active'
        AND e.next_step_due_at <= now()
        AND stp.step_order = (e.current_step_order + 1)
    ORDER BY e.next_step_due_at ASC
    LIMIT p_batch_size;
END;
$$;
