
-- Migration: Email Infrastructure Phase 2 (AI Threat Detection)
-- Date: 2026-02-19
-- Description: Adds threat detection columns to emails and creates security_incidents table.

-- 1. Create threat_level enum
DO $$ BEGIN
    CREATE TYPE public.email_threat_level AS ENUM ('safe', 'suspicious', 'malicious');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add threat columns to emails table
ALTER TABLE public.emails
ADD COLUMN IF NOT EXISTS threat_level public.email_threat_level DEFAULT 'safe',
ADD COLUMN IF NOT EXISTS threat_score NUMERIC(3, 2) DEFAULT 0.00, -- 0.00 to 1.00
ADD COLUMN IF NOT EXISTS threat_details JSONB DEFAULT '{}'::jsonb;

-- 3. Create security_incidents table
CREATE TABLE IF NOT EXISTS public.security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
    
    threat_level public.email_threat_level NOT NULL,
    threat_type TEXT NOT NULL, -- e.g., 'Phishing', 'BEC', 'Malware', 'Spam'
    description TEXT,
    ai_analysis JSONB,
    
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_incidents

-- Policy: Platform admins can manage all incidents
DROP POLICY IF EXISTS "Platform admins can manage all incidents" ON public.security_incidents;
CREATE POLICY "Platform admins can manage all incidents"
    ON public.security_incidents FOR ALL
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

-- Policy: Tenant admins can view incidents for their tenant
DROP POLICY IF EXISTS "Tenant admins can view own incidents" ON public.security_incidents;
CREATE POLICY "Tenant admins can view own incidents"
    ON public.security_incidents FOR SELECT
    TO authenticated
    USING (
        public.is_tenant_admin(auth.uid()) 
        AND tenant_id = public.get_user_tenant_id(auth.uid())
    );

-- Policy: Tenant admins can update incidents (e.g. resolve them)
DROP POLICY IF EXISTS "Tenant admins can update own incidents" ON public.security_incidents;
CREATE POLICY "Tenant admins can update own incidents"
    ON public.security_incidents FOR UPDATE
    TO authenticated
    USING (
        public.is_tenant_admin(auth.uid()) 
        AND tenant_id = public.get_user_tenant_id(auth.uid())
    )
    WITH CHECK (
        public.is_tenant_admin(auth.uid()) 
        AND tenant_id = public.get_user_tenant_id(auth.uid())
    );

-- Indexing
CREATE INDEX IF NOT EXISTS idx_emails_threat_level ON public.emails(threat_level);
CREATE INDEX IF NOT EXISTS idx_security_incidents_tenant_id ON public.security_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON public.security_incidents(status);
