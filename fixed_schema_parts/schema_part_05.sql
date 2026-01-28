  -- Make the column NOT NULL once populated
  ALTER TABLE public.services
    ALTER COLUMN shipment_type SET NOT NULL;
END $$;

COMMIT;-- Shipment attachments table to store uploaded document metadata
-- Dev note: Ensure a storage bucket named 'shipments' exists for file uploads

create table if not exists public.shipment_attachments (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  tenant_id uuid null,
  franchise_id uuid null,
  created_by uuid null,
  name text not null,
  path text not null,
  size bigint null,
  content_type text null,
  public_url text null,
  uploaded_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists idx_shipment_attachments_shipment_id on public.shipment_attachments (shipment_id);
create index if not exists idx_shipment_attachments_uploaded_at on public.shipment_attachments (uploaded_at desc);

-- Enable RLS and add permissive dev policies (adjust in production)
alter table public.shipment_attachments enable row level security;

-- Allow authenticated users to read attachments for now (tighten later)
DROP POLICY IF EXISTS shipment_attachments_read_authenticated ON public.shipment_attachments;
CREATE POLICY shipment_attachments_read_authenticated ON public.shipment_attachments
  for select
  to authenticated
  using (true);

-- Allow authenticated users to insert their own attachment metadata
DROP POLICY IF EXISTS shipment_attachments_insert_authenticated ON public.shipment_attachments;
CREATE POLICY shipment_attachments_insert_authenticated ON public.shipment_attachments
  for insert
  to authenticated
  with check (true);

-- Optional: allow delete by the creator (dev policy)
DROP POLICY IF EXISTS shipment_attachments_delete_by_creator ON public.shipment_attachments;
CREATE POLICY shipment_attachments_delete_by_creator ON public.shipment_attachments
  for delete
  to authenticated
  using (created_by = auth.uid());-- Add custom_fields column to activities table for flexible data storage
BEGIN;

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Helpful index for querying nested keys
CREATE INDEX IF NOT EXISTS idx_activities_custom_fields ON public.activities USING GIN (custom_fields);

COMMIT;-- Safe Migration for UI Themes
CREATE TABLE IF NOT EXISTS public.ui_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tokens jsonb not null,
  scope text not null check (scope in ('platform','tenant','franchise','user')),
  tenant_id uuid null references public.tenants(id) on delete cascade,
  franchise_id uuid null references public.franchises(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create Index (Safe if exists)
CREATE UNIQUE INDEX IF NOT EXISTS ui_themes_scope_name_unique
  ON public.ui_themes (scope, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

ALTER TABLE public.ui_themes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS ui_themes_read_authenticated ON public.ui_themes;
DROP POLICY IF EXISTS ui_themes_user_write ON public.ui_themes;

-- Re-create policies
CREATE POLICY ui_themes_read_authenticated ON public.ui_themes
  FOR SELECT
  TO authenticated
  USING (is_active);

CREATE POLICY ui_themes_user_write ON public.ui_themes
  FOR ALL
  TO authenticated
  USING (scope = 'user' and user_id = auth.uid())
  WITH CHECK (scope = 'user' and user_id = auth.uid());

-- Refresh Schema Cache
NOTIFY pgrst, 'reload config';
-- Quote numbering configuration and generator
-- Pattern: <PREFIX(3)> <YY><MM><DD> <SEQ(8)> ; no separators

-- Tenant-level prefix config
CREATE TABLE IF NOT EXISTS public.quote_number_config_tenant (
  tenant_id uuid PRIMARY KEY,
  prefix text NOT NULL DEFAULT 'QUO',
  CONSTRAINT quote_number_config_tenant_prefix_len CHECK (char_length(prefix) = 3)
);

-- Franchise-level prefix config (overrides tenant when present)
CREATE TABLE IF NOT EXISTS public.quote_number_config_franchise (
  tenant_id uuid NOT NULL,
  franchise_id uuid NOT NULL,
  prefix text NOT NULL DEFAULT 'QUO',
  CONSTRAINT quote_number_config_franchise_prefix_len CHECK (char_length(prefix) = 3),
  CONSTRAINT quote_number_config_franchise_pk PRIMARY KEY (tenant_id, franchise_id)
);

-- Tenant-level sequence storage (independent per tenant)
CREATE TABLE IF NOT EXISTS public.quote_sequences_tenant (
  tenant_id uuid PRIMARY KEY,
  seq_value bigint NOT NULL DEFAULT 0
);

-- Franchise-level sequence storage (independent per franchise within a tenant)
CREATE TABLE IF NOT EXISTS public.quote_sequences_franchise (
  tenant_id uuid NOT NULL,
  franchise_id uuid NOT NULL,
  seq_value bigint NOT NULL DEFAULT 0,
  CONSTRAINT quote_sequences_franchise_pk PRIMARY KEY (tenant_id, franchise_id)
);

-- Function: get next sequence and build quote number
DROP FUNCTION IF EXISTS public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_seq bigint;
  v_date text;
BEGIN
  -- Determine prefix: franchise override > tenant > default
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix INTO v_prefix
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;

    IF v_prefix IS NULL THEN
      SELECT prefix INTO v_prefix
      FROM public.quote_number_config_tenant
      WHERE tenant_id = p_tenant_id;
    END IF;
  ELSE
    SELECT prefix INTO v_prefix
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_prefix IS NULL THEN
    v_prefix := 'QUO';
  END IF;

  -- Acquire next sequence atomically
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO public.quote_sequences_franchise (tenant_id, franchise_id, seq_value)
    VALUES (p_tenant_id, p_franchise_id, 1)
    ON CONFLICT (tenant_id, franchise_id)
    DO UPDATE SET seq_value = public.quote_sequences_franchise.seq_value + 1
    RETURNING seq_value INTO v_seq;
  ELSE
    INSERT INTO public.quote_sequences_tenant (tenant_id, seq_value)
    VALUES (p_tenant_id, 1)
    ON CONFLICT (tenant_id)
    DO UPDATE SET seq_value = public.quote_sequences_tenant.seq_value + 1
    RETURNING seq_value INTO v_seq;
  END IF;

  -- Build date part (YYMMDD) using UTC now()
  v_date := to_char((now() at time zone 'UTC'), 'YYMMDD');

  -- Assemble final number: PREFIX + YYMMDD + 8-digit sequence
  RETURN v_prefix || v_date || lpad(v_seq::text, 8, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_quote_number(uuid, uuid)
IS 'Generates quote_number as <PREFIX(3)><YY><MM><DD><SEQ(8)>, with franchise override and atomic per-tenant/franchise sequence.';

-- Trigger function to set quote_number before insert
DROP FUNCTION IF EXISTS public.trg_set_quote_number_before_insert();
CREATE OR REPLACE FUNCTION public.trg_set_quote_number_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'tenant_id is required to generate quote_number';
    END IF;
    NEW.quote_number := public.generate_quote_number(NEW.tenant_id, NEW.franchise_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on public.quotes
DROP TRIGGER IF EXISTS trg_set_quote_number_before_insert ON public.quotes;
CREATE TRIGGER trg_set_quote_number_before_insert
BEFORE INSERT ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_quote_number_before_insert();-- Extend quote numbering with reset policies and preview RPC

-- Add reset policy to config tables
ALTER TABLE IF EXISTS public.quote_number_config_tenant
  ADD COLUMN IF NOT EXISTS reset_policy text NOT NULL DEFAULT 'none',
  ADD CONSTRAINT quote_number_config_tenant_reset_policy_chk CHECK (reset_policy IN ('none','daily','monthly','yearly'));

ALTER TABLE IF EXISTS public.quote_number_config_franchise
  ADD COLUMN IF NOT EXISTS reset_policy text NOT NULL DEFAULT 'none',
  ADD CONSTRAINT quote_number_config_franchise_reset_policy_chk CHECK (reset_policy IN ('none','daily','monthly','yearly'));

-- Add last reset bucket to sequences
ALTER TABLE IF EXISTS public.quote_sequences_tenant
  ADD COLUMN IF NOT EXISTS last_reset_bucket text;

ALTER TABLE IF EXISTS public.quote_sequences_franchise
  ADD COLUMN IF NOT EXISTS last_reset_bucket text;

-- Helper function: current bucket based on reset policy
DROP FUNCTION IF EXISTS public._current_reset_bucket(p_policy text);
CREATE OR REPLACE FUNCTION public._current_reset_bucket(p_policy text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_bucket text;
BEGIN
  IF p_policy = 'daily' THEN
    v_bucket := to_char((now() at time zone 'UTC'), 'YYYYMMDD');
  ELSIF p_policy = 'monthly' THEN
    v_bucket := to_char((now() at time zone 'UTC'), 'YYYYMM');
  ELSIF p_policy = 'yearly' THEN
    v_bucket := to_char((now() at time zone 'UTC'), 'YYYY');
  ELSE
    v_bucket := 'none';
  END IF;
  RETURN v_bucket;
END;
$$;

-- Replace generator to respect reset policy
DROP FUNCTION IF EXISTS public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_policy text := 'none';
  v_bucket text;
  v_seq bigint;
  v_date text;
BEGIN
  -- Determine prefix and reset policy
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;

    IF v_prefix IS NULL THEN
      SELECT prefix, reset_policy INTO v_prefix, v_policy
      FROM public.quote_number_config_tenant
      WHERE tenant_id = p_tenant_id;
    END IF;
  ELSE
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_prefix IS NULL THEN v_prefix := 'QUO'; END IF;
  IF v_policy IS NULL THEN v_policy := 'none'; END IF;

  v_bucket := public._current_reset_bucket(v_policy);

  -- Acquire next sequence with reset handling
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO public.quote_sequences_franchise (tenant_id, franchise_id, seq_value, last_reset_bucket)
    VALUES (p_tenant_id, p_franchise_id, 1, v_bucket)
    ON CONFLICT (tenant_id, franchise_id)
    DO UPDATE SET
      seq_value = CASE WHEN public.quote_sequences_franchise.last_reset_bucket IS DISTINCT FROM v_bucket THEN 1 ELSE public.quote_sequences_franchise.seq_value + 1 END,
      last_reset_bucket = v_bucket
    RETURNING seq_value INTO v_seq;
  ELSE
    INSERT INTO public.quote_sequences_tenant (tenant_id, seq_value, last_reset_bucket)
    VALUES (p_tenant_id, 1, v_bucket)
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      seq_value = CASE WHEN public.quote_sequences_tenant.last_reset_bucket IS DISTINCT FROM v_bucket THEN 1 ELSE public.quote_sequences_tenant.seq_value + 1 END,
      last_reset_bucket = v_bucket
    RETURNING seq_value INTO v_seq;
  END IF;

  -- Date part (YYMMDD)
  v_date := to_char((now() at time zone 'UTC'), 'YYMMDD');

  RETURN v_prefix || v_date || lpad(v_seq::text, 8, '0');
END;
$$;

-- Preview next quote number without incrementing
DROP FUNCTION IF EXISTS public.preview_next_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.preview_next_quote_number(p_tenant_id uuid, p_franchise_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_policy text := 'none';
  v_bucket text;
  v_seq_current bigint := NULL;
  v_last_bucket text := NULL;
  v_next_seq bigint := 1;
  v_date text;
BEGIN
  -- Determine prefix and policy
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;

    IF v_prefix IS NULL THEN
      SELECT prefix, reset_policy INTO v_prefix, v_policy
      FROM public.quote_number_config_tenant
      WHERE tenant_id = p_tenant_id;
    END IF;
  ELSE
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_prefix IS NULL THEN v_prefix := 'QUO'; END IF;
  IF v_policy IS NULL THEN v_policy := 'none'; END IF;

  v_bucket := public._current_reset_bucket(v_policy);

  -- Read current sequence
  IF p_franchise_id IS NOT NULL THEN
    SELECT seq_value, last_reset_bucket INTO v_seq_current, v_last_bucket
    FROM public.quote_sequences_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  ELSE
    SELECT seq_value, last_reset_bucket INTO v_seq_current, v_last_bucket
    FROM public.quote_sequences_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_seq_current IS NULL THEN
    v_next_seq := 1;
  ELSE
    IF v_last_bucket IS DISTINCT FROM v_bucket THEN
      v_next_seq := 1;
    ELSE
      v_next_seq := v_seq_current + 1;
    END IF;
  END IF;

  v_date := to_char((now() at time zone 'UTC'), 'YYMMDD');
  RETURN v_prefix || v_date || lpad(v_next_seq::text, 8, '0');
END;
$$;-- Consolidated migration: Quote numbering config, sequences, reset policy, and preview RPC
-- This script is idempotent and safe to run in any environment.

-- =============================
-- Tables: Configuration
-- =============================
CREATE TABLE IF NOT EXISTS public.quote_number_config_tenant (
  tenant_id uuid PRIMARY KEY,
  prefix text NOT NULL DEFAULT 'QUO',
  reset_policy text NOT NULL DEFAULT 'none',
  CONSTRAINT quote_number_config_tenant_prefix_len CHECK (char_length(prefix) = 3),
  CONSTRAINT quote_number_config_tenant_reset_policy_chk CHECK (reset_policy IN ('none','daily','monthly','yearly'))
);

-- Add columns/constraints when table already exists
ALTER TABLE IF EXISTS public.quote_number_config_tenant
  ADD COLUMN IF NOT EXISTS reset_policy text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quote_number_config_tenant_reset_policy_chk'
  ) THEN
    ALTER TABLE public.quote_number_config_tenant DROP CONSTRAINT IF EXISTS quote_number_config_tenant_reset_policy_chk;
ALTER TABLE public.quote_number_config_tenant ADD CONSTRAINT quote_number_config_tenant_reset_policy_chk CHECK (reset_policy IN ('none','daily','monthly','yearly'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quote_number_config_franchise (
  tenant_id uuid NOT NULL,
  franchise_id uuid NOT NULL,
  prefix text NOT NULL DEFAULT 'QUO',
  reset_policy text NOT NULL DEFAULT 'none',
  CONSTRAINT quote_number_config_franchise_prefix_len CHECK (char_length(prefix) = 3),
  CONSTRAINT quote_number_config_franchise_reset_policy_chk CHECK (reset_policy IN ('none','daily','monthly','yearly')),
  CONSTRAINT quote_number_config_franchise_pk PRIMARY KEY (tenant_id, franchise_id)
);

ALTER TABLE IF EXISTS public.quote_number_config_franchise
  ADD COLUMN IF NOT EXISTS reset_policy text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quote_number_config_franchise_reset_policy_chk'
  ) THEN
    ALTER TABLE public.quote_number_config_franchise DROP CONSTRAINT IF EXISTS quote_number_config_franchise_reset_policy_chk;
ALTER TABLE public.quote_number_config_franchise ADD CONSTRAINT quote_number_config_franchise_reset_policy_chk CHECK (reset_policy IN ('none','daily','monthly','yearly'));
  END IF;
END $$;

-- =============================
-- Tables: Sequences storage
-- =============================
CREATE TABLE IF NOT EXISTS public.quote_sequences_tenant (
  tenant_id uuid PRIMARY KEY,
  seq_value bigint NOT NULL DEFAULT 0,
  last_reset_bucket text
);

ALTER TABLE IF EXISTS public.quote_sequences_tenant
  ADD COLUMN IF NOT EXISTS last_reset_bucket text;

CREATE TABLE IF NOT EXISTS public.quote_sequences_franchise (
  tenant_id uuid NOT NULL,
  franchise_id uuid NOT NULL,
  seq_value bigint NOT NULL DEFAULT 0,
  last_reset_bucket text,
  CONSTRAINT quote_sequences_franchise_pk PRIMARY KEY (tenant_id, franchise_id)
);

ALTER TABLE IF EXISTS public.quote_sequences_franchise
  ADD COLUMN IF NOT EXISTS last_reset_bucket text;

-- =============================
-- Helper: Current reset bucket
-- =============================
DROP FUNCTION IF EXISTS public._current_reset_bucket(p_policy text);
CREATE OR REPLACE FUNCTION public._current_reset_bucket(p_policy text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_bucket text;
BEGIN
  IF p_policy = 'daily' THEN
    v_bucket := to_char((now() at time zone 'UTC'), 'YYYYMMDD');
  ELSIF p_policy = 'monthly' THEN
    v_bucket := to_char((now() at time zone 'UTC'), 'YYYYMM');
  ELSIF p_policy = 'yearly' THEN
    v_bucket := to_char((now() at time zone 'UTC'), 'YYYY');
  ELSE
    v_bucket := 'none';
  END IF;
  RETURN v_bucket;
END;
$$;

-- =============================
-- Generator: Next quote number (increments sequence)
-- =============================
DROP FUNCTION IF EXISTS public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_policy text := 'none';
  v_bucket text;
  v_seq bigint;
  v_date text;
BEGIN
  -- Determine prefix and reset policy
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;

    IF v_prefix IS NULL THEN
      SELECT prefix, reset_policy INTO v_prefix, v_policy
      FROM public.quote_number_config_tenant
      WHERE tenant_id = p_tenant_id;
    END IF;
  ELSE
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_prefix IS NULL THEN v_prefix := 'QUO'; END IF;
  IF v_policy IS NULL THEN v_policy := 'none'; END IF;

  v_bucket := public._current_reset_bucket(v_policy);

  -- Acquire next sequence with reset handling
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO public.quote_sequences_franchise (tenant_id, franchise_id, seq_value, last_reset_bucket)
    VALUES (p_tenant_id, p_franchise_id, 1, v_bucket)
    ON CONFLICT (tenant_id, franchise_id)
    DO UPDATE SET
      seq_value = CASE WHEN public.quote_sequences_franchise.last_reset_bucket IS DISTINCT FROM v_bucket THEN 1 ELSE public.quote_sequences_franchise.seq_value + 1 END,
      last_reset_bucket = v_bucket
    RETURNING seq_value INTO v_seq;
  ELSE
    INSERT INTO public.quote_sequences_tenant (tenant_id, seq_value, last_reset_bucket)
    VALUES (p_tenant_id, 1, v_bucket)
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      seq_value = CASE WHEN public.quote_sequences_tenant.last_reset_bucket IS DISTINCT FROM v_bucket THEN 1 ELSE public.quote_sequences_tenant.seq_value + 1 END,
      last_reset_bucket = v_bucket
    RETURNING seq_value INTO v_seq;
  END IF;

  -- Date part (YYMMDD)
  v_date := to_char((now() at time zone 'UTC'), 'YYMMDD');

  RETURN v_prefix || v_date || lpad(v_seq::text, 8, '0');
END;
$$;

-- =============================
-- Preview: Next quote number (does not increment)
-- =============================
DROP FUNCTION IF EXISTS public.preview_next_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.preview_next_quote_number(p_tenant_id uuid, p_franchise_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_policy text := 'none';
  v_bucket text;
  v_seq_current bigint := NULL;
  v_last_bucket text := NULL;
  v_next_seq bigint := 1;
  v_date text;
BEGIN
  -- Determine prefix and policy
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;

    IF v_prefix IS NULL THEN
      SELECT prefix, reset_policy INTO v_prefix, v_policy
      FROM public.quote_number_config_tenant
      WHERE tenant_id = p_tenant_id;
    END IF;
  ELSE
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_prefix IS NULL THEN v_prefix := 'QUO'; END IF;
  IF v_policy IS NULL THEN v_policy := 'none'; END IF;

  v_bucket := public._current_reset_bucket(v_policy);

  -- Read current sequence
  IF p_franchise_id IS NOT NULL THEN
    SELECT seq_value, last_reset_bucket INTO v_seq_current, v_last_bucket
    FROM public.quote_sequences_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  ELSE
    SELECT seq_value, last_reset_bucket INTO v_seq_current, v_last_bucket
    FROM public.quote_sequences_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_seq_current IS NULL THEN
    v_next_seq := 1;
  ELSE
    IF v_last_bucket IS DISTINCT FROM v_bucket THEN
      v_next_seq := 1;
    ELSE
      v_next_seq := v_seq_current + 1;
    END IF;
  END IF;

  v_date := to_char((now() at time zone 'UTC'), 'YYMMDD');
  RETURN v_prefix || v_date || lpad(v_next_seq::text, '0', 8);
END;
$$;

-- =============================
-- Grants
-- =============================

-- =============================
-- RLS Policies (basic management)
-- =============================
ALTER TABLE public.quote_number_config_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_franchise ENABLE ROW LEVEL SECURITY;

-- Tenant admins can manage tenant config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_number_config_tenant' AND policyname = 'Tenant admins manage tenant quote config'
  ) THEN
    DROP POLICY IF EXISTS "Tenant admins manage tenant quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Tenant admins manage tenant quote config" ON public.quote_number_config_tenant FOR ALL
      USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Franchise admins can manage franchise config; tenant admins can manage all franchise configs in their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_number_config_franchise' AND policyname = 'Admins manage franchise quote config'
  ) THEN
    DROP POLICY IF EXISTS "Admins manage franchise quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Admins manage franchise quote config" ON public.quote_number_config_franchise FOR ALL
      USING (
        (public.has_role(auth.uid(), 'tenant_admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
        OR (franchise_id = public.get_user_franchise_id(auth.uid()) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      )
      WITH CHECK (
        (public.has_role(auth.uid(), 'tenant_admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
        OR (franchise_id = public.get_user_franchise_id(auth.uid()) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      );
  END IF;
END $$;

-- End of migration-- Create quote numbering configuration tables and functions

-- Create enum for reset policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'quote_reset_policy'
      AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.quote_reset_policy AS ENUM ('none', 'daily', 'monthly', 'yearly');
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
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
  END IF;
END $$;

-- Tenant-level quote numbering configuration
CREATE TABLE IF NOT EXISTS public.quote_number_config_tenant (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Franchise-level quote numbering configuration (overrides tenant config)
CREATE TABLE IF NOT EXISTS public.quote_number_config_franchise (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (tenant_id, franchise_id)
);

-- Table to track quote number sequences
CREATE TABLE IF NOT EXISTS public.quote_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL, -- e.g., '2025-01-15' for daily, '2025-01' for monthly, '2025' for yearly
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (tenant_id, franchise_id, period_key)
);

-- Enable RLS
ALTER TABLE public.quote_number_config_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_franchise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quote_number_config_tenant
DROP POLICY IF EXISTS "Platform admins can manage all tenant configs" ON public.quote_number_config_tenant;
DROP POLICY IF EXISTS "Platform admins can manage all tenant configs" ON public.quote_number_config_tenant;
CREATE POLICY "Platform admins can manage all tenant configs" ON public.quote_number_config_tenant
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage own config" ON public.quote_number_config_tenant;
DROP POLICY IF EXISTS "Tenant admins can manage own config" ON public.quote_number_config_tenant;
CREATE POLICY "Tenant admins can manage own config" ON public.quote_number_config_tenant
  FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant config" ON public.quote_number_config_tenant;
DROP POLICY IF EXISTS "Users can view tenant config" ON public.quote_number_config_tenant;
CREATE POLICY "Users can view tenant config" ON public.quote_number_config_tenant
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for quote_number_config_franchise
DROP POLICY IF EXISTS "Platform admins can manage all franchise configs" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Platform admins can manage all franchise configs" ON public.quote_number_config_franchise;
CREATE POLICY "Platform admins can manage all franchise configs" ON public.quote_number_config_franchise
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage franchise configs" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Tenant admins can manage franchise configs" ON public.quote_number_config_franchise;
CREATE POLICY "Tenant admins can manage franchise configs" ON public.quote_number_config_franchise
  FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can manage own config" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Franchise admins can manage own config" ON public.quote_number_config_franchise;
CREATE POLICY "Franchise admins can manage own config" ON public.quote_number_config_franchise
  FOR ALL
  USING (has_role(auth.uid(), 'franchise_admin'::app_role) AND franchise_id = get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view franchise config" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Users can view franchise config" ON public.quote_number_config_franchise;
CREATE POLICY "Users can view franchise config" ON public.quote_number_config_franchise
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for quote_number_sequences
DROP POLICY IF EXISTS "Platform admins can manage all sequences" ON public.quote_number_sequences;
DROP POLICY IF EXISTS "Platform admins can manage all sequences" ON public.quote_number_sequences;
CREATE POLICY "Platform admins can manage all sequences" ON public.quote_number_sequences
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view sequences" ON public.quote_number_sequences;
DROP POLICY IF EXISTS "Tenant admins can view sequences" ON public.quote_number_sequences;
CREATE POLICY "Tenant admins can view sequences" ON public.quote_number_sequences
  FOR SELECT
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

-- Function to preview next quote number
DROP FUNCTION IF EXISTS public.preview_next_quote_number(p_tenant_id UUID, p_franchise_id UUID);
CREATE OR REPLACE FUNCTION public.preview_next_quote_number(
  p_tenant_id UUID,
  p_franchise_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_reset_policy quote_reset_policy;
  v_period_key TEXT;
  v_next_seq INTEGER;
BEGIN
  -- Get configuration (franchise overrides tenant)
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;
  
  -- Fall back to tenant config if no franchise config
  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;
  
  -- Default values if no config exists
  v_prefix := COALESCE(v_prefix, 'QUO');
  v_reset_policy := COALESCE(v_reset_policy, 'none'::quote_reset_policy);
  
  -- Determine period key based on reset policy
  v_period_key := CASE v_reset_policy
    WHEN 'daily' THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')
    WHEN 'monthly' THEN to_char(CURRENT_DATE, 'YYYY-MM')
    WHEN 'yearly' THEN to_char(CURRENT_DATE, 'YYYY')
    ELSE 'none'
  END;
  
  -- Get next sequence number
  SELECT COALESCE(last_sequence, 0) + 1 INTO v_next_seq
  FROM quote_number_sequences
  WHERE tenant_id = p_tenant_id
    AND (franchise_id = p_franchise_id OR (franchise_id IS NULL AND p_franchise_id IS NULL))
    AND period_key = v_period_key;
  
  v_next_seq := COALESCE(v_next_seq, 1);
  
  -- Format: PREFIX-YYYYMMDD-NNNN or PREFIX-YYYYMM-NNNN or PREFIX-YYYY-NNNN or PREFIX-NNNN
  RETURN CASE v_reset_policy
    WHEN 'daily' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'monthly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'yearly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    ELSE v_prefix || '-' || lpad(v_next_seq::TEXT, 6, '0')
  END;
END;
$$;

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_quote_number_config_tenant_updated_at ON public.quote_number_config_tenant;
CREATE TRIGGER update_quote_number_config_tenant_updated_at
  BEFORE UPDATE ON public.quote_number_config_tenant
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_number_config_franchise_updated_at ON public.quote_number_config_franchise;
CREATE TRIGGER update_quote_number_config_franchise_updated_at
  BEFORE UPDATE ON public.quote_number_config_franchise
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_number_sequences_updated_at ON public.quote_number_sequences;
CREATE TRIGGER update_quote_number_sequences_updated_at
  BEFORE UPDATE ON public.quote_number_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Create function to list implemented database functions and procedures in public schema
DROP FUNCTION IF EXISTS public.get_database_functions();
CREATE OR REPLACE FUNCTION public.get_database_functions()
RETURNS TABLE (
  name text,
  schema text,
  kind text,
  return_type text,
  argument_types text,
  language text,
  volatility text,
  security_definer boolean,
  description text
)
AS $$
  SELECT
    p.proname::text AS name,
    n.nspname::text AS schema,
    CASE p.prokind 
      WHEN 'f' THEN 'function' 
      WHEN 'p' THEN 'procedure' 
      WHEN 'a' THEN 'aggregate' 
      WHEN 'w' THEN 'window' 
      ELSE p.prokind::text 
    END AS kind,
    pg_catalog.format_type(p.prorettype, NULL)::text AS return_type,
    pg_catalog.pg_get_function_identity_arguments(p.oid)::text AS argument_types,
    l.lanname::text AS language,
    CASE p.provolatile 
      WHEN 'i' THEN 'immutable' 
      WHEN 's' THEN 'stable' 
      WHEN 'v' THEN 'volatile' 
      ELSE p.provolatile::text 
    END AS volatility,
    p.prosecdef AS security_definer,
    pg_catalog.obj_description(p.oid, 'pg_proc')::text AS description
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
  ORDER BY n.nspname, p.proname;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;-- Create the generate_quote_number function that increments the sequence
DROP FUNCTION IF EXISTS public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.generate_quote_number(
  p_tenant_id uuid,
  p_franchise_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_reset_policy quote_reset_policy;
  v_period_key TEXT;
  v_next_seq INTEGER;
  v_quote_number TEXT;
BEGIN
  -- Get configuration (franchise overrides tenant)
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;
  
  -- Fall back to tenant config if no franchise config
  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;
  
  -- Default values if no config exists
  v_prefix := COALESCE(v_prefix, 'QUO');
  v_reset_policy := COALESCE(v_reset_policy, 'none'::quote_reset_policy);
  
  -- Determine period key based on reset policy
  v_period_key := CASE v_reset_policy
    WHEN 'daily' THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')
    WHEN 'monthly' THEN to_char(CURRENT_DATE, 'YYYY-MM')
    WHEN 'yearly' THEN to_char(CURRENT_DATE, 'YYYY')
    ELSE 'none'
  END;
  
  -- Get and increment sequence number atomically
  INSERT INTO quote_number_sequences (
    tenant_id,
    franchise_id,
    period_key,
    last_sequence,
    created_at,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_franchise_id,
    v_period_key,
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT (tenant_id, COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), period_key)
  DO UPDATE SET
    last_sequence = quote_number_sequences.last_sequence + 1,
    updated_at = NOW()
  RETURNING last_sequence INTO v_next_seq;
  
  -- Format: PREFIX-YYYYMMDD-NNNN or PREFIX-YYYYMM-NNNN or PREFIX-YYYY-NNNN or PREFIX-NNNN
  v_quote_number := CASE v_reset_policy
    WHEN 'daily' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'monthly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'yearly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    ELSE v_prefix || '-' || lpad(v_next_seq::TEXT, 6, '0')
  END;
  
  RETURN v_quote_number;
END;
$$;-- Add missing columns to quote_number_config_tenant
ALTER TABLE public.quote_number_config_tenant
ADD COLUMN IF NOT EXISTS suffix TEXT,
ADD COLUMN IF NOT EXISTS start_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS allow_manual_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_reset_bucket TEXT;

-- Add missing columns to quote_number_config_franchise
ALTER TABLE public.quote_number_config_franchise
ADD COLUMN IF NOT EXISTS suffix TEXT,
ADD COLUMN IF NOT EXISTS start_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS allow_manual_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_reset_bucket TEXT;

-- Update the quote_reset_policy enum to include weekly and per_customer
ALTER TYPE quote_reset_policy ADD VALUE IF NOT EXISTS 'weekly';
ALTER TYPE quote_reset_policy ADD VALUE IF NOT EXISTS 'per_customer';-- Create trigger to auto-generate quote_number if not provided
DROP FUNCTION IF EXISTS public.auto_generate_quote_number();
CREATE OR REPLACE FUNCTION public.auto_generate_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if quote_number is not already set
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := public.generate_quote_number(NEW.tenant_id, NEW.franchise_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_generate_quote_number ON public.quotes;

-- Create trigger on quotes table
DROP TRIGGER IF EXISTS trigger_auto_generate_quote_number ON public.quotes;
CREATE TRIGGER trigger_auto_generate_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_quote_number();-- Drop any existing constraint or index
DROP INDEX IF EXISTS quote_number_sequences_unique_idx;

-- Create a unique partial index for tenant sequences (where franchise_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS quote_number_sequences_tenant_unique_idx ON public.quote_number_sequences (tenant_id, period_key)
WHERE franchise_id IS NULL;

-- Create a unique index for franchise sequences (where franchise_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS quote_number_sequences_franchise_unique_idx ON public.quote_number_sequences (tenant_id, franchise_id, period_key)
WHERE franchise_id IS NOT NULL;-- Update generate_quote_number to work with the new unique indexes
DROP FUNCTION IF EXISTS public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_prefix TEXT;
  v_reset_policy quote_reset_policy;
  v_period_key TEXT;
  v_next_seq INTEGER;
  v_quote_number TEXT;
BEGIN
  -- Get configuration (franchise overrides tenant)
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;
  
  -- Fall back to tenant config if no franchise config
  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;
  
  -- Default values if no config exists
  v_prefix := COALESCE(v_prefix, 'QUO');
  v_reset_policy := COALESCE(v_reset_policy, 'none'::quote_reset_policy);
  
  -- Determine period key based on reset policy
  v_period_key := CASE v_reset_policy
    WHEN 'daily' THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')
    WHEN 'monthly' THEN to_char(CURRENT_DATE, 'YYYY-MM')
    WHEN 'yearly' THEN to_char(CURRENT_DATE, 'YYYY')
    ELSE 'none'
  END;
  
  -- Handle franchise sequences
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO quote_number_sequences (
      tenant_id,
      franchise_id,
      period_key,
      last_sequence,
      created_at,
      updated_at
    )
    VALUES (
      p_tenant_id,
      p_franchise_id,
      v_period_key,
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (tenant_id, franchise_id, period_key)
    WHERE franchise_id IS NOT NULL
    DO UPDATE SET
      last_sequence = quote_number_sequences.last_sequence + 1,
      updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  ELSE
    -- Handle tenant sequences (franchise_id IS NULL)
    INSERT INTO quote_number_sequences (
      tenant_id,
      franchise_id,
      period_key,
      last_sequence,
      created_at,
      updated_at
    )
    VALUES (
      p_tenant_id,
      NULL,
      v_period_key,
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (tenant_id, period_key)
    WHERE franchise_id IS NULL
    DO UPDATE SET
      last_sequence = quote_number_sequences.last_sequence + 1,
      updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  END IF;
  
  -- Format: PREFIX-YYYYMMDD-NNNN or PREFIX-YYYYMM-NNNN or PREFIX-YYYY-NNNN or PREFIX-NNNN
  v_quote_number := CASE v_reset_policy
    WHEN 'daily' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'monthly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'yearly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    ELSE v_prefix || '-' || lpad(v_next_seq::TEXT, 6, '0')
  END;
  
  RETURN v_quote_number;
END;
$function$;-- Update generate_quote_number to work with the new unique indexes
DROP FUNCTION IF EXISTS public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_prefix TEXT;
  v_reset_policy quote_reset_policy;
  v_period_key TEXT;
  v_next_seq INTEGER;
  v_quote_number TEXT;
BEGIN
  -- Get configuration (franchise overrides tenant)
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;
  
  -- Fall back to tenant config if no franchise config
  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;
  
  -- Default values if no config exists
  v_prefix := COALESCE(v_prefix, 'QUO');
  v_reset_policy := COALESCE(v_reset_policy, 'none'::quote_reset_policy);
  
  -- Determine period key based on reset policy
  v_period_key := CASE v_reset_policy
    WHEN 'daily' THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')
    WHEN 'monthly' THEN to_char(CURRENT_DATE, 'YYYY-MM')
    WHEN 'yearly' THEN to_char(CURRENT_DATE, 'YYYY')
    ELSE 'none'
  END;
  
  -- Handle franchise sequences
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO quote_number_sequences (
      tenant_id,
      franchise_id,
      period_key,
      last_sequence,
      created_at,
      updated_at
    )
    VALUES (
      p_tenant_id,
      p_franchise_id,
      v_period_key,
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (tenant_id, franchise_id, period_key)
    WHERE franchise_id IS NOT NULL
    DO UPDATE SET
      last_sequence = quote_number_sequences.last_sequence + 1,
      updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  ELSE
    -- Handle tenant sequences (franchise_id IS NULL)
    INSERT INTO quote_number_sequences (
      tenant_id,
      franchise_id,
      period_key,
      last_sequence,
      created_at,
      updated_at
    )
    VALUES (
      p_tenant_id,
      NULL,
      v_period_key,
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (tenant_id, period_key)
    WHERE franchise_id IS NULL
    DO UPDATE SET
      last_sequence = quote_number_sequences.last_sequence + 1,
      updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  END IF;
  
  -- Format: PREFIX-YYYYMMDD-NNNN or PREFIX-YYYYMM-NNNN or PREFIX-YYYY-NNNN or PREFIX-NNNN
  v_quote_number := CASE v_reset_policy
    WHEN 'daily' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'monthly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'yearly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    ELSE v_prefix || '-' || lpad(v_next_seq::TEXT, 6, '0')
  END;
  
  RETURN v_quote_number;
END;
$function$;-- Fix quote number generation upsert logic and unique indexes
-- - Adds partial unique indexes for tenant/franchise sequences
-- - Replaces generate_quote_number to use valid ON CONFLICT targets

BEGIN;

-- Ensure partial unique indexes exist to enforce one row per period
-- Tenant-level (franchise_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_number_sequences_tenant_period
  ON public.quote_number_sequences (tenant_id, period_key)
  WHERE franchise_id IS NULL;

-- Franchise-level (franchise_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_number_sequences_franchise_period
  ON public.quote_number_sequences (tenant_id, franchise_id, period_key)
  WHERE franchise_id IS NOT NULL;

-- Replace generator function to upsert using the above indexes
DROP FUNCTION IF EXISTS public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.generate_quote_number(
  p_tenant_id uuid,
  p_franchise_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_reset_policy quote_reset_policy;
  v_period_key TEXT;
  v_next_seq INTEGER;
  v_quote_number TEXT;
BEGIN
  -- Get configuration (franchise overrides tenant)
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;

  -- Fall back to tenant config if no franchise config
  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  -- Defaults if no config exists
  v_prefix := COALESCE(v_prefix, 'QUO');
  v_reset_policy := COALESCE(v_reset_policy, 'none'::quote_reset_policy);

  -- Determine period key
  v_period_key := CASE v_reset_policy
    WHEN 'daily' THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')
    WHEN 'monthly' THEN to_char(CURRENT_DATE, 'YYYY-MM')
    WHEN 'yearly' THEN to_char(CURRENT_DATE, 'YYYY')
    ELSE 'none'
  END;

  -- Upsert into sequences and fetch next value
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO public.quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence)
    VALUES (p_tenant_id, p_franchise_id, v_period_key, 1)
    ON CONFLICT (tenant_id, franchise_id, period_key)
    DO UPDATE SET last_sequence = public.quote_number_sequences.last_sequence + 1,
                  updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  ELSE
    INSERT INTO public.quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence)
    VALUES (p_tenant_id, NULL, v_period_key, 1)
    ON CONFLICT (tenant_id, period_key)
    DO UPDATE SET last_sequence = public.quote_number_sequences.last_sequence + 1,
                  updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  END IF;

  -- Build final quote number string
  v_quote_number := CASE v_reset_policy
    WHEN 'daily' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'monthly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'yearly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    ELSE v_prefix || '-' || lpad(v_next_seq::TEXT, 6, '0')
  END;

  RETURN v_quote_number;
END;
$$;

COMMIT;-- Implement required quote number format: PREFIX-YYMMDD-##### (daily reset)
-- Also updates preview function to reflect the same format

BEGIN;

-- Generator: PREFIX-YYMMDD-##### with tenant/franchise scope and daily reset
DROP FUNCTION IF EXISTS public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.generate_quote_number(
  p_tenant_id uuid,
  p_franchise_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_reset_policy quote_reset_policy;
  v_period_key TEXT;
  v_next_seq INTEGER;
  v_quote_number TEXT;
BEGIN
  -- Prefer franchise config, fallback to tenant
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;

  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  v_prefix := COALESCE(v_prefix, 'QUO');
  -- Force daily reset to meet requested format
  v_reset_policy := 'daily'::quote_reset_policy;

  -- Period key for sequences: canonical YYYY-MM-DD bucket
  v_period_key := to_char(CURRENT_DATE, 'YYYY-MM-DD');

  -- Upsert/increment sequence per scope
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO public.quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence)
    VALUES (p_tenant_id, p_franchise_id, v_period_key, 1)
    ON CONFLICT (tenant_id, franchise_id, period_key)
    DO UPDATE SET last_sequence = public.quote_number_sequences.last_sequence + 1,
                  updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  ELSE
    INSERT INTO public.quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence)
    VALUES (p_tenant_id, NULL, v_period_key, 1)
    ON CONFLICT (tenant_id, period_key)
    DO UPDATE SET last_sequence = public.quote_number_sequences.last_sequence + 1,
                  updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  END IF;

  -- Format: PREFIX-YYMMDD-#####
  v_quote_number := v_prefix || '-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' || lpad(v_next_seq::TEXT, 5, '0');

  RETURN v_quote_number;
END;
$$;

-- Preview next without incrementing the sequence
DROP FUNCTION IF EXISTS public.preview_next_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.preview_next_quote_number(
  p_tenant_id uuid,
  p_franchise_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_period_key TEXT := to_char(CURRENT_DATE, 'YYYY-MM-DD');
  v_next_seq INTEGER := 1;
  v_quote_number TEXT;
BEGIN
  -- Prefer franchise config, fallback to tenant
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix INTO v_prefix
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;

  IF v_prefix IS NULL THEN
    SELECT prefix INTO v_prefix
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  v_prefix := COALESCE(v_prefix, 'QUO');

  -- Determine next sequence without updating
  IF p_franchise_id IS NOT NULL THEN
    SELECT COALESCE(last_sequence + 1, 1) INTO v_next_seq
    FROM public.quote_number_sequences
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id AND period_key = v_period_key;
  ELSE
    SELECT COALESCE(last_sequence + 1, 1) INTO v_next_seq
    FROM public.quote_number_sequences
    WHERE tenant_id = p_tenant_id AND franchise_id IS NULL AND period_key = v_period_key;
  END IF;

  -- Format: PREFIX-YYMMDD-#####
  v_quote_number := v_prefix || '-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' || lpad(v_next_seq::TEXT, 5, '0');
  RETURN v_quote_number;
END;
$$;

COMMIT;-- Create function to list database functions
DROP FUNCTION IF EXISTS public.get_database_functions();
CREATE OR REPLACE FUNCTION public.get_database_functions()
RETURNS TABLE(
  name text,
  schema text,
  kind text,
  return_type text,
  argument_types text,
  language text,
  volatility text,
  security_definer boolean,
  description text
)
AS $$
  SELECT
    p.proname::text AS name,
    n.nspname::text AS schema,
    CASE p.prokind 
      WHEN 'f' THEN 'function' 
      WHEN 'p' THEN 'procedure' 
      WHEN 'a' THEN 'aggregate' 
      WHEN 'w' THEN 'window' 
      ELSE p.prokind::text 
    END AS kind,
    pg_catalog.format_type(p.prorettype, NULL)::text AS return_type,
    pg_catalog.pg_get_function_identity_arguments(p.oid)::text AS argument_types,
    l.lanname::text AS language,
    CASE p.provolatile 
      WHEN 'i' THEN 'immutable' 
      WHEN 's' THEN 'stable' 
      WHEN 'v' THEN 'volatile' 
      ELSE p.provolatile::text 
    END AS volatility,
    p.prosecdef AS security_definer,
    pg_catalog.obj_description(p.oid, 'pg_proc')::text AS description
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
  ORDER BY n.nspname, p.proname;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;-- Add foreign key constraints for quotes table relationships
-- This enables proper joins between quotes and related tables

-- Add foreign key for opportunity_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotes_opportunity_id_fkey' 
    AND table_name = 'quotes'
  ) THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_opportunity_id_fkey FOREIGN KEY (opportunity_id)
    REFERENCES public.opportunities(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for account_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotes_account_id_fkey' 
    AND table_name = 'quotes'
  ) THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES public.accounts(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for contact_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotes_contact_id_fkey' 
    AND table_name = 'quotes'
  ) THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_contact_id_fkey FOREIGN KEY (contact_id)
    REFERENCES public.contacts(id)
    ON DELETE SET NULL;
  END IF;
END $$;-- Create service_types table
CREATE TABLE IF NOT EXISTS public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create service_type_mappings table
CREATE TABLE IF NOT EXISTS public.service_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  conditions JSONB DEFAULT '{}'::jsonb,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_type_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_types (platform admin only)
DROP POLICY IF EXISTS "Platform admins can manage all service types" ON public.service_types;
CREATE POLICY "Platform admins can manage all service types" ON public.service_types
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "All users can view service types" ON public.service_types;
CREATE POLICY "All users can view service types" ON public.service_types
  FOR SELECT
  USING (true);

-- RLS Policies for service_type_mappings
DROP POLICY IF EXISTS "Platform admins can manage all mappings" ON public.service_type_mappings;
CREATE POLICY "Platform admins can manage all mappings" ON public.service_type_mappings
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant mappings" ON public.service_type_mappings;
CREATE POLICY "Tenant admins can manage tenant mappings" ON public.service_type_mappings
  FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view tenant mappings" ON public.service_type_mappings;
CREATE POLICY "Users can view tenant mappings" ON public.service_type_mappings
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_type_mappings_service_id 
  ON public.service_type_mappings(service_id);
  
CREATE INDEX IF NOT EXISTS idx_service_type_mappings_tenant_id 
  ON public.service_type_mappings(tenant_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_service_types_updated_at ON public.service_types;
CREATE TRIGGER update_service_types_updated_at
  BEFORE UPDATE ON public.service_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_type_mappings_updated_at ON public.service_type_mappings;
CREATE TRIGGER update_service_type_mappings_updated_at
  BEFORE UPDATE ON public.service_type_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Make service_types table publicly readable for all users
-- This is useful for lookup/reference data that should be accessible everywhere

DROP POLICY IF EXISTS "All users can view service types" ON public.service_types;

DROP POLICY IF EXISTS "Anyone can view service types" ON public.service_types;
CREATE POLICY "Anyone can view service types" ON public.service_types
FOR SELECT
TO public
USING (true);

-- Also ensure services can be viewed by authenticated users with proper tenant access
-- (policies already exist, just documenting the expected behavior)
-- Ensure platform admins have full access to service_types
DROP POLICY IF EXISTS "Platform admins can manage all service types" ON public.service_types;

DROP POLICY IF EXISTS "Platform admins can manage all service types" ON public.service_types;
CREATE POLICY "Platform admins can manage all service types" ON public.service_types
FOR ALL
TO public
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Ensure platform admins have full access to services
DROP POLICY IF EXISTS "Platform admins can manage all services" ON public.services;

DROP POLICY IF EXISTS "Platform admins can manage all services" ON public.services;
CREATE POLICY "Platform admins can manage all services" ON public.services
FOR ALL
TO public
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));
-- Seed service types with transportation modes
INSERT INTO public.service_types (name, description, is_active) VALUES
('Air Freight', 'Air cargo transportation services', true),
('Ocean Freight', 'Sea cargo transportation services', true),
('Road Freight', 'Ground transportation by truck', true),
('Rail Freight', 'Railway cargo transportation', true),
('Courier Service', 'Express delivery and courier services', true),
('Warehousing', 'Storage and distribution services', true),
('Customs Clearance', 'Import/export customs processing', true),
('Freight Forwarding', 'Multi-modal logistics coordination', true),
('Moving Services', 'Residential and commercial moving', true)
ON CONFLICT (name) DO NOTHING;

-- Seed services with different shipment types
DO $$
DECLARE
  v_tenant_id uuid := '9e2686ba-ef3c-42df-aea6-dcc880436b9f';
  v_service_id uuid;
  v_exists boolean;
  v_tenant_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.tenants WHERE id = v_tenant_id) INTO v_tenant_exists;
  IF NOT v_tenant_exists THEN
    RETURN;
  END IF;
  -- Insert Air services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Express', 'AIR-EXP', 'Express air freight service', 500.00, 2, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Standard', 'AIR-STD', 'Standard air freight service', 300.00, 5, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Economy', 'AIR-ECO', 'Economy air freight service', 200.00, 7, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'USA Domestic Air Priority', 'USA-AIR-PRI', 'Priority air service within USA', 250.00, 1, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'USA Domestic Air Standard', 'USA-AIR-STD', 'Standard air service within USA', 150.00, 3, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'International Air Express', 'INTL-AIR-EXP', 'Express international air freight', 800.00, 3, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'International Air Standard', 'INTL-AIR-STD', 'Standard international air freight', 500.00, 7, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Ocean services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'Ocean FCL', 'OCN-FCL', 'Full Container Load ocean freight', 2000.00, 30, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'Ocean LCL', 'OCN-LCL', 'Less than Container Load ocean freight', 800.00, 35, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'International Ocean FCL', 'INTL-OCN-FCL', 'International full container ocean freight', 3000.00, 28, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'International Ocean LCL', 'INTL-OCN-LCL', 'International less than container ocean freight', 1200.00, 35, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Trucking services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'Road Express', 'RD-EXP', 'Express road freight service', 150.00, 3, true),
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'Road Standard', 'RD-STD', 'Standard road freight service', 100.00, 5, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Courier services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'Same Day', 'COR-SAME', 'Same day courier delivery', 50.00, 0, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'Next Day', 'COR-NEXT', 'Next day courier delivery', 30.00, 1, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, '2-Day', 'COR-2DAY', '2-day courier delivery', 20.00, 2, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Moving services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'Local Move', 'MOV-LOCAL', 'Local residential or commercial move', 300.00, 1, true),
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'Long Distance Move', 'MOV-LD', 'Long distance moving service', 1500.00, 5, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Create service type mappings (check existence first)
  -- USA Domestic Air Priority mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'USA-AIR-PRI' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.service_type_mappings WHERE tenant_id = v_tenant_id AND service_type = 'air' AND service_id = v_service_id) INTO v_exists;
    IF NOT v_exists THEN
      INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
      (v_tenant_id, 'air', v_service_id, false, 1, true, '{"scope": "domestic", "country": "USA"}'::jsonb);
    END IF;
  END IF;

  -- International Air Express mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'INTL-AIR-EXP' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.service_type_mappings WHERE tenant_id = v_tenant_id AND service_type = 'air' AND service_id = v_service_id) INTO v_exists;
    IF NOT v_exists THEN
      INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
      (v_tenant_id, 'air', v_service_id, true, 1, true, '{"scope": "international"}'::jsonb);
    END IF;
  END IF;

  -- International Ocean FCL mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'INTL-OCN-FCL' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.service_type_mappings WHERE tenant_id = v_tenant_id AND service_type = 'ocean' AND service_id = v_service_id) INTO v_exists;
    IF NOT v_exists THEN
      INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
      (v_tenant_id, 'ocean', v_service_id, true, 1, true, '{"scope": "international", "container_type": "FCL"}'::jsonb);
    END IF;
  END IF;
  
  -- Courier Next Day mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'COR-NEXT' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.service_type_mappings WHERE tenant_id = v_tenant_id AND service_type = 'courier' AND service_id = v_service_id) INTO v_exists;
    IF NOT v_exists THEN
      INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
      (v_tenant_id, 'courier', v_service_id, true, 1, true, '{"scope": "express"}'::jsonb);
    END IF;
  END IF;
END $$;
-- Seed service types with transportation modes
INSERT INTO public.service_types (name, description, is_active) VALUES
('Air Freight', 'Air cargo transportation services', true),
('Ocean Freight', 'Sea cargo transportation services', true),
('Road Freight', 'Ground transportation by truck', true),
('Rail Freight', 'Railway cargo transportation', true),
('Courier Service', 'Express delivery and courier services', true),
('Warehousing', 'Storage and distribution services', true),
('Customs Clearance', 'Import/export customs processing', true),
('Freight Forwarding', 'Multi-modal logistics coordination', true),
('Moving Services', 'Residential and commercial moving', true),
('Trucking', 'Ground transportation by truck', true)
ON CONFLICT (name) DO NOTHING;

-- Seed services with different modes and types
DO $$
DECLARE
  v_tenant_id uuid := '9e2686ba-ef3c-42df-aea6-dcc880436b9f';
  v_tenant_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.tenants WHERE id = v_tenant_id) INTO v_tenant_exists;
  IF NOT v_tenant_exists THEN
    RETURN;
  END IF;

  -- Air services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Express', 'AIR-EXP', 'Express air freight service', 500.00, 2, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Standard', 'AIR-STD', 'Standard air freight service', 300.00, 5, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Economy', 'AIR-ECO', 'Economy air freight service', 200.00, 7, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'USA Domestic Air Priority', 'USA-AIR-PRI', 'Priority air service within USA', 250.00, 1, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'USA Domestic Air Standard', 'USA-AIR-STD', 'Standard air service within USA', 150.00, 3, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'International Air Express', 'INTL-AIR-EXP', 'Express international air freight', 800.00, 3, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'International Air Standard', 'INTL-AIR-STD', 'Standard international air freight', 500.00, 7, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Ocean services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'Ocean FCL', 'OCN-FCL', 'Full Container Load ocean freight', 2000.00, 30, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'Ocean LCL', 'OCN-LCL', 'Less than Container Load ocean freight', 800.00, 35, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'International Ocean FCL', 'INTL-OCN-FCL', 'International full container ocean freight', 3000.00, 28, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'International Ocean LCL', 'INTL-OCN-LCL', 'International less than container ocean freight', 1200.00, 35, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Trucking services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'Road Express', 'RD-EXP', 'Express road freight service', 150.00, 3, true),
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'Road Standard', 'RD-STD', 'Standard road freight service', 100.00, 5, true),
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'USA Domestic Trucking', 'USA-TRK-DOM', 'Domestic trucking within USA', 120.00, 4, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Courier services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'Same Day', 'COR-SAME', 'Same day courier delivery', 50.00, 0, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'Next Day', 'COR-NEXT', 'Next day courier delivery', 30.00, 1, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, '2-Day', 'COR-2DAY', '2-day courier delivery', 20.00, 2, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'International Courier Express', 'INTL-COR-EXP', 'Express international courier', 100.00, 3, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Moving services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'Local Move', 'MOV-LOCAL', 'Local residential or commercial move', 300.00, 1, true),
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'Long Distance Move', 'MOV-LD', 'Long distance moving service', 1500.00, 5, true),
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'International Move', 'MOV-INTL', 'International moving service', 5000.00, 30, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;
  
END $$;
-- Seed service types with transportation modes
INSERT INTO public.service_types (name, description, is_active) VALUES
('Air Freight', 'Air cargo transportation services', true),
('Ocean Freight', 'Sea cargo transportation services', true),
('Road Freight', 'Ground transportation by truck', true),
('Rail Freight', 'Railway cargo transportation', true),
('Courier Service', 'Express delivery and courier services', true),
('Warehousing', 'Storage and distribution services', true),
('Customs Clearance', 'Import/export customs processing', true),
('Freight Forwarding', 'Multi-modal logistics coordination', true),
('Moving Services', 'Residential and commercial moving', true),
('Trucking', 'Ground transportation by truck', true)
ON CONFLICT (name) DO NOTHING;

-- Seed services with different modes and types
DO $$
DECLARE
  v_tenant_id uuid := '9e2686ba-ef3c-42df-aea6-dcc880436b9f';
  v_tenant_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.tenants WHERE id = v_tenant_id) INTO v_tenant_exists;
  IF NOT v_tenant_exists THEN
    RETURN;
  END IF;

  -- Air services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Express', 'AIR-EXP', 'Express air freight service', 500.00, 2, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Standard', 'AIR-STD', 'Standard air freight service', 300.00, 5, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Economy', 'AIR-ECO', 'Economy air freight service', 200.00, 7, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'USA Domestic Air Priority', 'USA-AIR-PRI', 'Priority air service within USA', 250.00, 1, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'USA Domestic Air Standard', 'USA-AIR-STD', 'Standard air service within USA', 150.00, 3, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'International Air Express', 'INTL-AIR-EXP', 'Express international air freight', 800.00, 3, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'International Air Standard', 'INTL-AIR-STD', 'Standard international air freight', 500.00, 7, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Ocean services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'Ocean FCL', 'OCN-FCL', 'Full Container Load ocean freight', 2000.00, 30, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'Ocean LCL', 'OCN-LCL', 'Less than Container Load ocean freight', 800.00, 35, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'International Ocean FCL', 'INTL-OCN-FCL', 'International full container ocean freight', 3000.00, 28, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'International Ocean LCL', 'INTL-OCN-LCL', 'International less than container ocean freight', 1200.00, 35, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Trucking services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'Road Express', 'RD-EXP', 'Express road freight service', 150.00, 3, true),
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'Road Standard', 'RD-STD', 'Standard road freight service', 100.00, 5, true),
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'USA Domestic Trucking', 'USA-TRK-DOM', 'Domestic trucking within USA', 120.00, 4, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Courier services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'Same Day', 'COR-SAME', 'Same day courier delivery', 50.00, 0, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'Next Day', 'COR-NEXT', 'Next day courier delivery', 30.00, 1, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, '2-Day', 'COR-2DAY', '2-day courier delivery', 20.00, 2, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'International Courier Express', 'INTL-COR-EXP', 'Express international courier', 100.00, 3, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Moving services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'Local Move', 'MOV-LOCAL', 'Local residential or commercial move', 300.00, 1, true),
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'Long Distance Move', 'MOV-LD', 'Long distance moving service', 1500.00, 5, true),
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'International Move', 'MOV-INTL', 'International moving service', 5000.00, 30, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;
  
END $$;
-- Seed service types with transportation modes
INSERT INTO public.service_types (name, description, is_active) VALUES
('Air Freight', 'Air cargo transportation services', true),
('Ocean Freight', 'Sea cargo transportation services', true),
('Road Freight', 'Ground transportation by truck', true),
('Rail Freight', 'Railway cargo transportation', true),
('Courier Service', 'Express delivery and courier services', true),
('Warehousing', 'Storage and distribution services', true),
('Customs Clearance', 'Import/export customs processing', true),
('Freight Forwarding', 'Multi-modal logistics coordination', true),
('Moving Services', 'Residential and commercial moving', true)
ON CONFLICT (name) DO NOTHING;

-- Seed services with different shipment types
DO $$
DECLARE
  v_tenant_id uuid := '9e2686ba-ef3c-42df-aea6-dcc880436b9f';
  v_service_id uuid;
  v_tenant_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.tenants WHERE id = v_tenant_id) INTO v_tenant_exists;
  IF NOT v_tenant_exists THEN
    RETURN;
  END IF;
  -- Insert Air services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Express', 'AIR-EXP', 'Express air freight service', 500.00, 2, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Standard', 'AIR-STD', 'Standard air freight service', 300.00, 5, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Economy', 'AIR-ECO', 'Economy air freight service', 200.00, 7, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'USA Domestic Air Priority', 'USA-AIR-PRI', 'Priority air service within USA', 250.00, 1, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'USA Domestic Air Standard', 'USA-AIR-STD', 'Standard air service within USA', 150.00, 3, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'International Air Express', 'INTL-AIR-EXP', 'Express international air freight', 800.00, 3, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'International Air Standard', 'INTL-AIR-STD', 'Standard international air freight', 500.00, 7, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Ocean services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'Ocean FCL', 'OCN-FCL', 'Full Container Load ocean freight', 2000.00, 30, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'Ocean LCL', 'OCN-LCL', 'Less than Container Load ocean freight', 800.00, 35, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'International Ocean FCL', 'INTL-OCN-FCL', 'International full container ocean freight', 3000.00, 28, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'International Ocean LCL', 'INTL-OCN-LCL', 'International less than container ocean freight', 1200.00, 35, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Trucking services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'Road Express', 'RD-EXP', 'Express road freight service', 150.00, 3, true),
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'Road Standard', 'RD-STD', 'Standard road freight service', 100.00, 5, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Courier services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'Same Day', 'COR-SAME', 'Same day courier delivery', 50.00, 0, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'Next Day', 'COR-NEXT', 'Next day courier delivery', 30.00, 1, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, '2-Day', 'COR-2DAY', '2-day courier delivery', 20.00, 2, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Moving services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'Local Move', 'MOV-LOCAL', 'Local residential or commercial move', 300.00, 1, true),
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'Long Distance Move', 'MOV-LD', 'Long distance moving service', 1500.00, 5, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Create service type mappings with EXISTS checks
  -- USA Domestic Air Priority mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'USA-AIR-PRI' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings 
    WHERE tenant_id = v_tenant_id AND service_type = 'air' AND service_id = v_service_id
  ) THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
    (v_tenant_id, 'air', v_service_id, false, 1, true, '{"scope": "domestic", "country": "USA"}'::jsonb);
  END IF;

  -- International Air Express mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'INTL-AIR-EXP' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings 
    WHERE tenant_id = v_tenant_id AND service_type = 'air' AND service_id = v_service_id
  ) THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
    (v_tenant_id, 'air', v_service_id, true, 1, true, '{"scope": "international"}'::jsonb);
  END IF;

  -- International Ocean FCL mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'INTL-OCN-FCL' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings 
    WHERE tenant_id = v_tenant_id AND service_type = 'ocean' AND service_id = v_service_id
  ) THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
    (v_tenant_id, 'ocean', v_service_id, true, 1, true, '{"scope": "international", "container_type": "FCL"}'::jsonb);
  END IF;
  
  -- Courier Next Day mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'COR-NEXT' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings 
    WHERE tenant_id = v_tenant_id AND service_type = 'courier' AND service_id = v_service_id
  ) THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
    (v_tenant_id, 'courier', v_service_id, true, 1, true, '{"scope": "express"}'::jsonb);
  END IF;
END $$;
-- Fix duplicate service types by keeping the oldest record (by created_at)
-- Note: service_type_mappings uses TEXT for service_type, not UUID foreign key,
-- so no updates needed there - just delete duplicates

WITH ranked_duplicates AS (
  SELECT 
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id::text ASC) as rn
  FROM service_types
)
DELETE FROM service_types
WHERE id IN (
  SELECT id FROM ranked_duplicates WHERE rn > 1
);-- Service Type ↔ Service mapping table with tenant scoping and RLS
BEGIN;

-- Create mapping table
CREATE TABLE IF NOT EXISTS public.service_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  conditions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Align service_type values with existing services constraint
ALTER TABLE public.service_type_mappings DROP CONSTRAINT IF EXISTS service_type_mappings_type_check;
ALTER TABLE public.service_type_mappings
  ADD CONSTRAINT service_type_mappings_type_check
  CHECK (service_type IN ('ocean','air','trucking','courier','moving','railway_transport'));

-- Dedup constraints
ALTER TABLE public.service_type_mappings DROP CONSTRAINT IF EXISTS service_type_mappings_unique_pair;
ALTER TABLE public.service_type_mappings ADD CONSTRAINT service_type_mappings_unique_pair UNIQUE (tenant_id, service_type, service_id);

-- Only one default per tenant + service_type
CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_per_type_tenant
  ON public.service_type_mappings(tenant_id, service_type)
  WHERE is_default = true;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_stm_tenant ON public.service_type_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stm_tenant_type ON public.service_type_mappings(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_stm_active ON public.service_type_mappings(is_active);

-- Enable RLS
ALTER TABLE public.service_type_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all service type mappings" ON public.service_type_mappings;
DROP POLICY IF EXISTS "Platform admins can manage all service type mappings" ON public.service_type_mappings;
CREATE POLICY "Platform admins can manage all service type mappings" ON public.service_type_mappings
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage own service type mappings" ON public.service_type_mappings;
DROP POLICY IF EXISTS "Tenant admins can manage own service type mappings" ON public.service_type_mappings;
CREATE POLICY "Tenant admins can manage own service type mappings" ON public.service_type_mappings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant service type mappings" ON public.service_type_mappings;
DROP POLICY IF EXISTS "Users can view tenant service type mappings" ON public.service_type_mappings;
CREATE POLICY "Users can view tenant service type mappings" ON public.service_type_mappings
FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_service_type_mappings_updated_at ON public.service_type_mappings;
CREATE TRIGGER update_service_type_mappings_updated_at
  BEFORE UPDATE ON public.service_type_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;-- Create service_types table for managing allowed service type values

CREATE TABLE IF NOT EXISTS public.service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_types_active ON public.service_types(is_active);
CREATE INDEX IF NOT EXISTS idx_service_types_name ON public.service_types(name);

-- Enable RLS
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Platform admins can manage all service types" ON public.service_types;
DROP POLICY IF EXISTS "Platform admins can manage all service types" ON public.service_types;
CREATE POLICY "Platform admins can manage all service types" ON public.service_types
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "All authenticated users can view service types" ON public.service_types;
DROP POLICY IF EXISTS "All authenticated users can view service types" ON public.service_types;
CREATE POLICY "All authenticated users can view service types" ON public.service_types
FOR SELECT
TO authenticated
USING (true);

-- updated_at trigger
DROP FUNCTION IF EXISTS public.set_updated_at();
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_service_types_updated_at ON public.service_types;
CREATE TRIGGER update_service_types_updated_at
BEFORE UPDATE ON public.service_types
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Seed common service types
INSERT INTO public.service_types (name, description)
VALUES
  ('ocean', 'Ocean freight'),
  ('air', 'Air freight'),
  ('trucking', 'Road transport'),
  ('courier', 'Courier/parcel delivery'),
  ('moving', 'Relocation services'),
  ('railway_transport', 'Rail transport')
ON CONFLICT (name) DO NOTHING;-- Align allowed service_type values in services with mappings and service_types
BEGIN;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_service_type_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_service_type_check
  CHECK (service_type IN ('ocean','air','trucking','courier','moving','railway_transport'));

COMMIT;-- Seed default service types (idempotent)
BEGIN;

INSERT INTO public.service_types (name, description, is_active)
VALUES
  ('ocean', 'Ocean freight', true),
  ('air', 'Air freight', true),
  ('trucking', 'Inland trucking', true),
  ('courier', 'Courier/Express', true),
  ('moving', 'Movers & Packers', true),
  ('railway_transport', 'Railway transport', true)
ON CONFLICT (name)
DO UPDATE SET is_active = EXCLUDED.is_active;

COMMIT;-- Seed USA and International services and map to service types per tenant
BEGIN;

-- Ensure base services have scope metadata (idempotent updates)
UPDATE public.services s
SET metadata = COALESCE(s.metadata, '{}'::jsonb) || '{"scope":"international","region":"global"}'::jsonb
WHERE s.service_code IN ('OCEAN_STD','AIR_EXP')
  AND (s.metadata IS NULL OR NOT (s.metadata ? 'scope'));

UPDATE public.services s
SET metadata = COALESCE(s.metadata, '{}'::jsonb) || '{"scope":"domestic","country":"US"}'::jsonb
WHERE s.service_code IN ('TRUCK_LTL','COURIER_STD','MOVE_PACK','RAIL_STD')
  AND (s.metadata IS NULL OR NOT (s.metadata ? 'scope'));

-- Insert additional USA/International service variants per tenant (idempotent)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
-- USA Domestic Courier (explicit)
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.tenant_id, 'COURIER_US_STD', 'Courier - USA Standard', 'courier',
       'Domestic USA parcel delivery', 12, 'per parcel', 2,
       true, '{"scope":"domestic","country":"US","tracking":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.tenant_id AND s.service_code = 'COURIER_US_STD'
);

-- International Courier
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.tenant_id, 'COURIER_INT_STD', 'Courier - International Standard', 'courier',
       'International parcel delivery', 15, 'per parcel', 5,
       true, '{"scope":"international","tracking":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.tenant_id AND s.service_code = 'COURIER_INT_STD'
);

-- USA Domestic Trucking (explicit)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.tenant_id, 'TRUCK_US_LTL', 'Inland Trucking - USA LTL', 'trucking',
       'Domestic USA road transport (LTL)', 2.0, 'per mile', 5,
       true, '{"scope":"domestic","country":"US","equipment":"box_truck"}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.tenant_id AND s.service_code = 'TRUCK_US_LTL'
);

-- International Trucking (Cross-border NA)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.tenant_id, 'TRUCK_INT_XB', 'Inland Trucking - Cross-border NA', 'trucking',
       'International cross-border trucking (US/CA/MX)', 2.5, 'per mile', 7,
       true, '{"scope":"international","region":"North America","equipment":"dry van"}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.tenant_id AND s.service_code = 'TRUCK_INT_XB'
);

-- Map service types to services with USA/International rules (idempotent)
-- Ocean: default International
WITH svc AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'OCEAN_STD'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT svc.tenant_id, 'ocean', svc.id, true, 100, '{"scope":"international"}'::jsonb, true
FROM svc
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = svc.tenant_id AND m.service_type = 'ocean' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Air: default International
WITH svc AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'AIR_EXP'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT svc.tenant_id, 'air', svc.id, true, 100, '{"scope":"international"}'::jsonb, true
FROM svc
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = svc.tenant_id AND m.service_type = 'air' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Trucking: default USA Domestic, plus International non-default
WITH us AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'TRUCK_US_LTL'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT us.tenant_id, 'trucking', us.id, true, 100, '{"scope":"domestic","country":"US"}'::jsonb, true
FROM us
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = us.tenant_id AND m.service_type = 'trucking' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

WITH intl AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'TRUCK_INT_XB'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT intl.tenant_id, 'trucking', intl.id, false, 50, '{"scope":"international","region":"North America"}'::jsonb, true
FROM intl
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Courier: default USA Domestic, plus International non-default
WITH us AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code IN ('COURIER_US_STD','COURIER_STD') -- prefer explicit USA service, fallback to existing std
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT us.tenant_id, 'courier', us.id, true, 100, '{"scope":"domestic","country":"US"}'::jsonb, true
FROM us
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = us.tenant_id AND m.service_type = 'courier' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

WITH intl AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'COURIER_INT_STD'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT intl.tenant_id, 'courier', intl.id, false, 50, '{"scope":"international"}'::jsonb, true
FROM intl
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Moving: default USA Domestic
WITH svc AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'MOVE_PACK'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT svc.tenant_id, 'moving', svc.id, true, 100, '{"scope":"domestic","country":"US"}'::jsonb, true
FROM svc
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = svc.tenant_id AND m.service_type = 'moving' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Railways: default USA Domestic
WITH svc AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'RAIL_STD'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT svc.tenant_id, 'railway_transport', svc.id, true, 100, '{"scope":"domestic","country":"US"}'::jsonb, true
FROM svc
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = svc.tenant_id AND m.service_type = 'railway_transport' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

COMMIT;
-- Normalize and deduplicate service_types entries, and enforce normalized uniqueness
BEGIN;

-- 2) Merge duplicates: keep one per normalized name, prefer oldest id; aggregate flags/descriptions
WITH agg AS (
  SELECT 
    lower(trim(name)) AS norm_name,
    MIN(id::text)::uuid AS keep_id,
    BOOL_OR(COALESCE(is_active, true)) AS any_active,
    (ARRAY_REMOVE(ARRAY_AGG(description), NULL))[1] AS any_desc
  FROM public.service_types
  GROUP BY lower(trim(name))
),
to_update AS (
  SELECT st.id, st.name, st.is_active, st.description, a.any_active, a.any_desc
  FROM public.service_types st
  JOIN agg a ON st.id = a.keep_id
)
UPDATE public.service_types st
SET 
  is_active = COALESCE(u.any_active, st.is_active),
  description = COALESCE(u.any_desc, st.description)
FROM to_update u
WHERE st.id = u.id;

-- 3) Delete duplicates, keeping the chosen keep_id
WITH keep AS (
  SELECT lower(trim(name)) AS norm_name, MIN(id::text)::uuid AS keep_id
  FROM public.service_types
  GROUP BY lower(trim(name))
)
DELETE FROM public.service_types st
USING keep k
WHERE lower(trim(st.name)) = k.norm_name
  AND st.id <> k.keep_id;

-- 1) Normalize names to trimmed lower-case for consistent uniqueness
UPDATE public.service_types

-- 4) Enforce uniqueness on normalized name to prevent reoccurrence (case/space-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_service_types_norm_name
  ON public.service_types ((lower(trim(name))));

COMMIT;
-- Relax service_type constraints to allow broader set from service_types table
BEGIN;

-- Drop hard-coded CHECK constraint on services.service_type
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_service_type_check;

-- Drop hard-coded CHECK constraint on service_type_mappings.service_type
ALTER TABLE public.service_type_mappings DROP CONSTRAINT IF EXISTS service_type_mappings_type_check;

COMMIT;-- Expand service_types table to be unbounded
-- Remove any length constraints and make it more flexible

-- Drop existing constraints if any
ALTER TABLE service_types 
  ALTER COLUMN name TYPE text,
  ALTER COLUMN description TYPE text;

-- Ensure the table is ready for any type of service type data
-- Add index for better performance on name lookups
CREATE INDEX IF NOT EXISTS idx_service_types_name ON service_types(name);
CREATE INDEX IF NOT EXISTS idx_service_types_active ON service_types(is_active) WHERE is_active = true;

-- Add a comment to document the unbounded nature
COMMENT ON TABLE service_types IS 'Unbounded service types table - accepts any service type without restrictions';-- Carrier ↔ Service Type mapping table with tenant scoping and codes
BEGIN;

-- First, add missing columns to carriers table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carriers' AND column_name = 'mode') THEN
    ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS mode TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carriers' AND column_name = 'scac') THEN
    ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS scac TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carriers' AND column_name = 'iata') THEN
    ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS iata TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carriers' AND column_name = 'mc_dot') THEN
    ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS mc_dot TEXT;
  END IF;
END $$;

-- Create mapping table
CREATE TABLE IF NOT EXISTS public.carrier_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  carrier_id UUID NOT NULL REFERENCES public.carriers(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  code_type TEXT,
  code_value TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Allowed service_type values
ALTER TABLE public.carrier_service_types DROP CONSTRAINT IF EXISTS carrier_service_types_type_check;
ALTER TABLE public.carrier_service_types
  ADD CONSTRAINT carrier_service_types_type_check
  CHECK (service_type IN ('ocean','air','trucking','courier','moving','railway_transport'));

-- Dedup per tenant + carrier + service_type
ALTER TABLE public.carrier_service_types DROP CONSTRAINT IF EXISTS carrier_service_types_unique_pair;
ALTER TABLE public.carrier_service_types
  ADD CONSTRAINT carrier_service_types_unique_pair UNIQUE (tenant_id, carrier_id, service_type);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cst_tenant ON public.carrier_service_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cst_tenant_type ON public.carrier_service_types(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_cst_active ON public.carrier_service_types(is_active);

-- Enable RLS
ALTER TABLE public.carrier_service_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all carrier type mappings" ON public.carrier_service_types;
DROP POLICY IF EXISTS "Platform admins can manage all carrier type mappings" ON public.carrier_service_types;
CREATE POLICY "Platform admins can manage all carrier type mappings" ON public.carrier_service_types FOR ALL TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage own carrier type mappings" ON public.carrier_service_types;
DROP POLICY IF EXISTS "Tenant admins can manage own carrier type mappings" ON public.carrier_service_types;
CREATE POLICY "Tenant admins can manage own carrier type mappings" ON public.carrier_service_types FOR ALL TO authenticated
USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant carrier type mappings" ON public.carrier_service_types;
DROP POLICY IF EXISTS "Users can view tenant carrier type mappings" ON public.carrier_service_types;
CREATE POLICY "Users can view tenant carrier type mappings" ON public.carrier_service_types FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_carrier_service_types_updated_at ON public.carrier_service_types;
CREATE TRIGGER update_carrier_service_types_updated_at
  BEFORE UPDATE ON public.carrier_service_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;-- Seed carriers with SCAC/IATA codes and map to service types per tenant
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'carriers'
      AND column_name = 'carrier_name'
  ) THEN
    ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS carrier_name TEXT;
  END IF;
END $$;

-- Common tenants CTE for Ocean carriers (SCAC)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, carrier_name, scac)
SELECT t.tenant_id, 'ocean', c.name, c.scac
FROM tenants t
CROSS JOIN (
  VALUES
    ('Maersk', 'MAEU'),
    ('MSC', 'MSCU'),
    ('CMA CGM', 'CMDU'),
    ('Hapag-Lloyd', 'HLCU'),
    ('COSCO', 'COSU')
) AS c(name, scac)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.carrier_name = c.name AND x.mode = 'ocean'
);

-- Air carriers (IATA)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, carrier_name, iata)
SELECT t.tenant_id, 'air', c.name, c.iata
FROM tenants t
CROSS JOIN (
  VALUES
    ('American Airlines Cargo', 'AA'),
    ('Delta Cargo', 'DL'),
    ('United Cargo', 'UA'),
    ('Lufthansa Cargo', 'LH'),
    ('Emirates SkyCargo', 'EK')
) AS c(name, iata)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.carrier_name = c.name AND x.mode = 'air'
);

-- Courier carriers (SCAC)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, carrier_name, scac)
SELECT t.tenant_id, 'courier', c.name, c.scac
FROM tenants t
CROSS JOIN (
  VALUES
    ('DHL Express', 'DHLA'),
    ('FedEx', 'FDXG'),
    ('UPS', 'UPSN')
) AS c(name, scac)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.carrier_name = c.name AND x.mode = 'courier'
);

-- Inland trucking carriers (MC/DOT)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, carrier_name, mc_dot)
SELECT t.tenant_id, 'inland_trucking', c.name, c.mc_dot
FROM tenants t
CROSS JOIN (
  VALUES
    ('Schneider National', 'DOT-264184'),
    ('J.B. Hunt', 'DOT-223911'),
    ('XPO Logistics', 'DOT-218683'),
    ('R+L Carriers', 'DOT-437075'),
    ('Old Dominion Freight Line', 'DOT-90849')
) AS c(name, mc_dot)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.carrier_name = c.name AND x.mode = 'inland_trucking'
);

-- Movers/Packers
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, carrier_name)
SELECT t.tenant_id, 'movers_packers', c.name
FROM tenants t
CROSS JOIN (
  VALUES
    ('Allied Van Lines'),
    ('North American Van Lines'),
    ('United Van Lines')
) AS c(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.carrier_name = c.name AND x.mode = 'movers_packers'
);

-- Map carriers to service_types with code metadata
-- Ocean → ocean (SCAC)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'ocean', 'SCAC', c.scac, true, true
FROM public.carriers c
WHERE c.mode = 'ocean' AND c.scac IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Air → air (IATA)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'air', 'IATA', c.iata, true, true
FROM public.carriers c
WHERE c.mode = 'air' AND c.iata IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Courier → courier (SCAC)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'courier', 'SCAC', c.scac, true, true
FROM public.carriers c
WHERE c.mode = 'courier' AND c.scac IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Inland trucking → trucking (MC_DOT)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'trucking', 'MC_DOT', c.mc_dot, true, true
FROM public.carriers c
WHERE c.mode = 'inland_trucking' AND c.mc_dot IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Movers/Packers → moving (no code)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, is_primary, is_active)
SELECT c.tenant_id, c.id, 'moving', true, true
FROM public.carriers c
WHERE c.mode = 'movers_packers'
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

COMMIT;
-- Remove duplicate carrier names, keeping only the oldest entry per tenant
BEGIN;

-- Delete duplicates, keeping only the one with the smallest id (oldest)
DELETE FROM public.carriers c1
WHERE EXISTS (
  SELECT 1 FROM public.carriers c2
  WHERE c1.tenant_id = c2.tenant_id
    AND c1.carrier_name = c2.carrier_name
    AND c1.id > c2.id
);

-- Add a unique constraint to prevent future duplicates
ALTER TABLE public.carriers DROP CONSTRAINT IF EXISTS carriers_unique_name_per_tenant;
ALTER TABLE public.carriers
  ADD CONSTRAINT carriers_unique_name_per_tenant 
  UNIQUE (tenant_id, carrier_name);

COMMIT;-- Carrier ↔ Service Type mapping table with tenant scoping and codes
BEGIN;

-- Create mapping table
CREATE TABLE IF NOT EXISTS public.carrier_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  carrier_id UUID NOT NULL REFERENCES public.carriers(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  code_type TEXT, -- e.g., 'SCAC', 'IATA', 'MC_DOT'
  code_value TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Allowed service_type values aligned with service_types/mappings
ALTER TABLE public.carrier_service_types DROP CONSTRAINT IF EXISTS carrier_service_types_type_check;
ALTER TABLE public.carrier_service_types
  ADD CONSTRAINT carrier_service_types_type_check
  CHECK (service_type IN ('ocean','air','trucking','courier','moving','railway_transport'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'carrier_service_types_unique_pair'
      AND conrelid = 'public.carrier_service_types'::regclass
  ) THEN
    ALTER TABLE public.carrier_service_types
      ADD CONSTRAINT carrier_service_types_unique_pair UNIQUE (tenant_id, carrier_id, service_type);
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_cst_tenant ON public.carrier_service_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cst_tenant_type ON public.carrier_service_types(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_cst_active ON public.carrier_service_types(is_active);

-- Enable RLS
ALTER TABLE public.carrier_service_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all carrier type mappings" ON public.carrier_service_types;
DROP POLICY IF EXISTS "Platform admins can manage all carrier type mappings" ON public.carrier_service_types;
CREATE POLICY "Platform admins can manage all carrier type mappings" ON public.carrier_service_types
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage own carrier type mappings" ON public.carrier_service_types;
DROP POLICY IF EXISTS "Tenant admins can manage own carrier type mappings" ON public.carrier_service_types;
CREATE POLICY "Tenant admins can manage own carrier type mappings" ON public.carrier_service_types
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant carrier type mappings" ON public.carrier_service_types;
DROP POLICY IF EXISTS "Users can view tenant carrier type mappings" ON public.carrier_service_types;
CREATE POLICY "Users can view tenant carrier type mappings" ON public.carrier_service_types
FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_carrier_service_types_updated_at ON public.carrier_service_types;
CREATE TRIGGER update_carrier_service_types_updated_at
  BEFORE UPDATE ON public.carrier_service_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
-- Seed carriers with SCAC/IATA codes and map to service types per tenant
BEGIN;

-- Common tenants CTE
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
-- Ocean carriers (SCAC)
INSERT INTO public.carriers (tenant_id, mode, name, scac)
SELECT t.tenant_id, 'ocean'::public.transport_mode, c.name, c.scac
FROM tenants t
JOIN (
  VALUES
    ('Maersk', 'MAEU'),
    ('MSC', 'MSCU'),
    ('CMA CGM', 'CMDU'),
    ('Hapag-Lloyd', 'HLCU'),
    ('COSCO', 'COSU')
) AS c(name, scac) ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.name = c.name AND x.mode = 'ocean'::public.transport_mode
);

-- Air carriers (IATA)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, name, iata)
SELECT t.tenant_id, 'air'::public.transport_mode, c.name, c.iata
FROM tenants t
JOIN (
  VALUES
    ('American Airlines Cargo', 'AA'),
    ('Delta Cargo', 'DL'),
    ('United Cargo', 'UA'),
    ('Lufthansa Cargo', 'LH'),
    ('Emirates SkyCargo', 'EK')
) AS c(name, iata) ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.name = c.name AND x.mode = 'air'::public.transport_mode
);

-- Courier carriers (SCAC where applicable)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, name, scac)
SELECT t.tenant_id, 'courier'::public.transport_mode, c.name, c.scac
FROM tenants t
JOIN (
  VALUES
    ('DHL Express', 'DHLA'),
    ('FedEx', 'FDXG'),
    ('UPS', 'UPSN')
) AS c(name, scac) ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.name = c.name AND x.mode = 'courier'::public.transport_mode
);

-- Inland trucking carriers (MC/DOT as available)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, name, mc_dot)
SELECT t.tenant_id, 'inland_trucking'::public.transport_mode, c.name, c.mc_dot
FROM tenants t
JOIN (
  VALUES
    ('Schneider National', 'DOT-264184'),
    ('J.B. Hunt', 'DOT-223911'),
    ('XPO Logistics', 'DOT-218683'),
    ('R+L Carriers', 'DOT-437075'),
    ('Old Dominion Freight Line', 'DOT-90849')
) AS c(name, mc_dot) ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.name = c.name AND x.mode = 'inland_trucking'::public.transport_mode
);

-- Movers/Packers (moving)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, name)
SELECT t.tenant_id, 'movers_packers'::public.transport_mode, c.name
FROM tenants t
JOIN (
  VALUES
    ('Allied Van Lines'),
    ('North American Van Lines'),
    ('United Van Lines')
) AS c(name) ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.name = c.name AND x.mode = 'movers_packers'::public.transport_mode
);

-- Map carriers to service_types with code metadata
-- Ocean → ocean (SCAC)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'ocean', 'SCAC', c.scac, true, true
FROM public.carriers c
WHERE c.mode = 'ocean'::public.transport_mode AND c.scac IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Air → air (IATA)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'air', 'IATA', c.iata, true, true
FROM public.carriers c
WHERE c.mode = 'air'::public.transport_mode AND c.iata IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Courier → courier (SCAC)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'courier', 'SCAC', c.scac, true, true
FROM public.carriers c
WHERE c.mode = 'courier'::public.transport_mode AND c.scac IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Inland trucking → trucking (MC_DOT)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'trucking', 'MC_DOT', c.mc_dot, true, true
FROM public.carriers c
WHERE c.mode = 'inland_trucking'::public.transport_mode AND c.mc_dot IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Movers/Packers → moving (no code)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, is_primary, is_active)
SELECT c.tenant_id, c.id, 'moving', true, true
FROM public.carriers c
WHERE c.mode = 'movers_packers'::public.transport_mode
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

COMMIT;BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'carriers'
      AND column_name = 'carrier_code'
  ) THEN
    ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS carrier_code TEXT;
  END IF;
END $$;

-- Deduplicate by tenant + lower(name)
WITH dupes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, lower(carrier_name)
      ORDER BY id DESC
    ) AS rn
  FROM public.carriers
)
DELETE FROM public.carriers c
USING dupes d
WHERE c.id = d.id
  AND d.rn > 1;

-- Deduplicate by tenant + code (non-null)
WITH dupes_code AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, carrier_code
      ORDER BY id DESC
    ) AS rn
  FROM public.carriers
  WHERE carrier_code IS NOT NULL
)
DELETE FROM public.carriers c
USING dupes_code d
WHERE c.id = d.id
  AND d.rn > 1;

-- Enforce uniqueness per tenant
CREATE UNIQUE INDEX IF NOT EXISTS carriers_tenant_name_unique
  ON public.carriers (tenant_id, lower(carrier_name));

CREATE UNIQUE INDEX IF NOT EXISTS carriers_tenant_code_unique
  ON public.carriers (tenant_id, carrier_code)
  WHERE carrier_code IS NOT NULL;

COMMIT;
-- Cargo Details module: table, indexes, RLS policies, triggers
BEGIN;

-- Create cargo_details table
CREATE TABLE IF NOT EXISTS public.cargo_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  cargo_type_id UUID REFERENCES public.cargo_types(id) ON DELETE SET NULL,
  commodity_description TEXT,
  hs_code TEXT,
  package_count INTEGER DEFAULT 0,
  total_weight_kg NUMERIC(12,3),
  total_volume_cbm NUMERIC(12,3),
  dimensions JSONB DEFAULT '{}'::jsonb, -- optional per-package dims {length_cm,width_cm,height_cm}
  hazmat BOOLEAN DEFAULT false,
  hazmat_class TEXT,
  temperature_controlled BOOLEAN DEFAULT false,
  requires_special_handling BOOLEAN DEFAULT false,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Align allowed service_type values (kept flexible; constrain to known set if present)
ALTER TABLE public.cargo_details DROP CONSTRAINT IF EXISTS cargo_details_service_type_check;
ALTER TABLE public.cargo_details
  ADD CONSTRAINT cargo_details_service_type_check
  CHECK (service_type IN ('ocean','air','trucking','courier','moving','railway_transport'));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_cargo_details_tenant ON public.cargo_details(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cargo_details_service ON public.cargo_details(service_id);
CREATE INDEX IF NOT EXISTS idx_cargo_details_type ON public.cargo_details(service_type);
CREATE INDEX IF NOT EXISTS idx_cargo_details_active ON public.cargo_details(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.cargo_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins manage all cargo details" ON public.cargo_details;
DROP POLICY IF EXISTS "Platform admins manage all cargo details" ON public.cargo_details;
CREATE POLICY "Platform admins manage all cargo details" ON public.cargo_details
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage own cargo details" ON public.cargo_details;
DROP POLICY IF EXISTS "Tenant admins manage own cargo details" ON public.cargo_details;
CREATE POLICY "Tenant admins manage own cargo details" ON public.cargo_details
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant cargo details" ON public.cargo_details;
DROP POLICY IF EXISTS "Users can view tenant cargo details" ON public.cargo_details;
CREATE POLICY "Users can view tenant cargo details" ON public.cargo_details
FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_cargo_details_updated_at ON public.cargo_details;
CREATE TRIGGER update_cargo_details_updated_at
  BEFORE UPDATE ON public.cargo_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;-- Ensure package_categories and package_sizes exist (idempotent)
BEGIN;

-- package_categories
CREATE TABLE IF NOT EXISTS public.package_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  category_name TEXT NOT NULL,
  category_code TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- package_sizes
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
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- quote_items extensions (safe re-apply)
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS package_category_id UUID,
  ADD COLUMN IF NOT EXISTS package_size_id UUID;

-- Enable RLS (safe, idempotent)
ALTER TABLE public.package_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_sizes ENABLE ROW LEVEL SECURITY;

-- updated_at triggers (recreate safely)
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

COMMIT;-- Create quotation_versions table for tracking quote versions
CREATE TABLE IF NOT EXISTS public.quotation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  major INTEGER NOT NULL DEFAULT 1,
  minor INTEGER NOT NULL DEFAULT 0,
  change_reason TEXT,
  valid_until DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quotation_version_options table for carrier rate options per version
CREATE TABLE IF NOT EXISTS public.quotation_version_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quotation_version_id UUID NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  carrier_rate_id UUID NOT NULL,
  recommended BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create customer_selections table for tracking which option customer chose
CREATE TABLE IF NOT EXISTS public.customer_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  quotation_version_id UUID NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  quotation_version_option_id UUID NOT NULL REFERENCES public.quotation_version_options(id) ON DELETE CASCADE,
  reason TEXT,
  selected_by UUID,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_version_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_selections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotation_versions
DROP POLICY IF EXISTS "Users can view franchise quote versions" ON public.quotation_versions;
CREATE POLICY "Users can view franchise quote versions" ON public.quotation_versions FOR SELECT
  USING (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create quote versions" ON public.quotation_versions;
CREATE POLICY "Users can create quote versions" ON public.quotation_versions FOR INSERT
  WITH CHECK (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Platform admins full access to quote versions" ON public.quotation_versions;
CREATE POLICY "Platform admins full access to quote versions" ON public.quotation_versions FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS Policies for quotation_version_options
DROP POLICY IF EXISTS "Users can view franchise version options" ON public.quotation_version_options;
CREATE POLICY "Users can view franchise version options" ON public.quotation_version_options FOR SELECT
  USING (
    quotation_version_id IN (
      SELECT qv.id FROM public.quotation_versions qv
      JOIN public.quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create version options" ON public.quotation_version_options;
CREATE POLICY "Users can create version options" ON public.quotation_version_options FOR INSERT
  WITH CHECK (
    quotation_version_id IN (
      SELECT qv.id FROM public.quotation_versions qv
      JOIN public.quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Platform admins full access to version options" ON public.quotation_version_options;
CREATE POLICY "Platform admins full access to version options" ON public.quotation_version_options FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS Policies for customer_selections
DROP POLICY IF EXISTS "Users can view franchise customer selections" ON public.customer_selections;
CREATE POLICY "Users can view franchise customer selections" ON public.customer_selections FOR SELECT
  USING (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create customer selections" ON public.customer_selections;
CREATE POLICY "Users can create customer selections" ON public.customer_selections FOR INSERT
  WITH CHECK (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Platform admins full access to customer selections" ON public.customer_selections;
CREATE POLICY "Platform admins full access to customer selections" ON public.customer_selections FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Create function for recording customer selection
DROP FUNCTION IF EXISTS public.record_customer_selection(p_tenant_id UUID, p_quote_id UUID, p_version_id UUID, p_option_id UUID, p_reason TEXT, p_user_id UUID);
CREATE OR REPLACE FUNCTION public.record_customer_selection(
  p_tenant_id UUID,
  p_quote_id UUID,
  p_version_id UUID,
  p_option_id UUID,
  p_reason TEXT,
  p_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_selections (
    tenant_id,
    quote_id,
    quotation_version_id,
    quotation_version_option_id,
    reason,
    selected_by
  ) VALUES (
    p_tenant_id,
    p_quote_id,
    p_version_id,
    p_option_id,
    p_reason,
    p_user_id
  );
END;
$$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quotation_versions_quote_id ON public.quotation_versions(quote_id);
CREATE INDEX IF NOT EXISTS idx_quotation_version_options_version_id ON public.quotation_version_options(quotation_version_id);
CREATE INDEX IF NOT EXISTS idx_customer_selections_quote_id ON public.customer_selections(quote_id);-- Retrofit carrier rates module tables to support quote versioning

-- Add missing columns to carrier_rates if they don't exist
DO $$ 
BEGIN
  -- Add carrier_id column for proper foreign key relationship
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'carrier_id'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN IF NOT EXISTS carrier_id UUID;
  END IF;

  -- Add origin_port_id for route-based rates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'origin_port_id'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN IF NOT EXISTS origin_port_id UUID;
  END IF;

  -- Add destination_port_id for route-based rates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'destination_port_id'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN IF NOT EXISTS destination_port_id UUID;
  END IF;

  -- Add mode for transportation type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'mode'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN IF NOT EXISTS mode TEXT;
  END IF;

  -- Add rate_reference_id for linking to quotes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'rate_reference_id'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN IF NOT EXISTS rate_reference_id TEXT;
  END IF;

  -- Add status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Create carrier_rate_charges table for detailed charge breakdown
CREATE TABLE IF NOT EXISTS public.carrier_rate_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  carrier_rate_id UUID NOT NULL,
  charge_type TEXT NOT NULL,
  basis TEXT,
  quantity NUMERIC DEFAULT 1,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on carrier_rate_charges
ALTER TABLE public.carrier_rate_charges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for carrier_rate_charges
DROP POLICY IF EXISTS "Platform admins can manage all carrier rate charges" ON public.carrier_rate_charges;
CREATE POLICY "Platform admins can manage all carrier rate charges" ON public.carrier_rate_charges FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage carrier rate charges" ON public.carrier_rate_charges;
CREATE POLICY "Tenant admins can manage carrier rate charges" ON public.carrier_rate_charges FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view tenant carrier rate charges" ON public.carrier_rate_charges;
CREATE POLICY "Users can view tenant carrier rate charges" ON public.carrier_rate_charges FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  -- Add FK from carrier_rates to carriers if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'carrier_rates_carrier_id_fkey'
  ) THEN
    ALTER TABLE public.carrier_rates DROP CONSTRAINT IF EXISTS carrier_rates_carrier_id_fkey;
ALTER TABLE public.carrier_rates ADD CONSTRAINT carrier_rates_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id) ON DELETE CASCADE;
  END IF;

  -- Add FK from carrier_rate_charges to carrier_rates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'carrier_rate_charges_carrier_rate_id_fkey'
  ) THEN
    ALTER TABLE public.carrier_rate_charges DROP CONSTRAINT IF EXISTS carrier_rate_charges_carrier_rate_id_fkey;
ALTER TABLE public.carrier_rate_charges ADD CONSTRAINT carrier_rate_charges_carrier_rate_id_fkey FOREIGN KEY (carrier_rate_id) REFERENCES public.carrier_rates(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carrier_rates_carrier_id ON public.carrier_rates(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_origin_port ON public.carrier_rates(origin_port_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_destination_port ON public.carrier_rates(destination_port_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_reference ON public.carrier_rates(rate_reference_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rate_charges_rate_id ON public.carrier_rate_charges(carrier_rate_id);-- Grant permissions on quotation_versions tables

-- Grant permissions on quotation_versions table

-- Grant permissions on quotation_version_options table

-- Grant permissions on customer_selections table

-- Grant permissions on carrier_rate_charges table

-- Grant usage on sequences if they exist
DO $$
BEGIN
  -- Grant sequence permissions if using serial columns
  IF EXISTS (
    SELECT 1 FROM information_schema.sequences 
    WHERE sequence_schema = 'public' 
    AND sequence_name LIKE 'quotation%'
  ) THEN
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
  END IF;
END $$;-- Add missing version_number and kind columns to quotation_versions

ALTER TABLE public.quotation_versions 
ADD COLUMN IF NOT EXISTS version_number INTEGER,
ADD COLUMN IF NOT EXISTS kind TEXT CHECK (kind IN ('minor', 'major'));

-- Create a computed version number based on major.minor format or use a simple counter
-- For now, we'll use a simple sequential version_number
UPDATE public.quotation_versions 
SET version_number = (major * 1000 + minor)
WHERE version_number IS NULL;

-- Set kind based on whether it's a major version bump
UPDATE public.quotation_versions 
SET kind = CASE 
  WHEN minor = 0 THEN 'major'
  ELSE 'minor'
END
WHERE kind IS NULL;

-- Make version_number NOT NULL after populating
ALTER TABLE public.quotation_versions 
ALTER COLUMN version_number SET NOT NULL;

-- Create index for version_number ordering
CREATE INDEX IF NOT EXISTS idx_quotation_versions_version_number 
ON public.quotation_versions(quote_id, version_number DESC);-- Add status column to quotation_versions
ALTER TABLE public.quotation_versions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';-- Create cargo_details table for storing detailed cargo information
CREATE TABLE IF NOT EXISTS public.cargo_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  service_type TEXT,
  service_id UUID,
  cargo_type_id UUID,
  commodity_description TEXT,
  hs_code TEXT,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  dimensions_cm JSONB,
  value_amount NUMERIC,
  value_currency TEXT DEFAULT 'USD',
  special_requirements TEXT,
  is_hazardous BOOLEAN DEFAULT FALSE,
  hazmat_un_number TEXT,
  hazmat_class TEXT,
  temperature_controlled BOOLEAN DEFAULT FALSE,
  temperature_range JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.cargo_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cargo_details
DROP POLICY IF EXISTS "Platform admins can manage all cargo details" ON public.cargo_details;
DROP POLICY IF EXISTS "Platform admins can manage all cargo details" ON public.cargo_details;
CREATE POLICY "Platform admins can manage all cargo details" ON public.cargo_details FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage cargo details" ON public.cargo_details;
DROP POLICY IF EXISTS "Tenant admins can manage cargo details" ON public.cargo_details;
CREATE POLICY "Tenant admins can manage cargo details" ON public.cargo_details FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view tenant cargo details" ON public.cargo_details;
DROP POLICY IF EXISTS "Users can view tenant cargo details" ON public.cargo_details;
CREATE POLICY "Users can view tenant cargo details" ON public.cargo_details FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can create cargo details" ON public.cargo_details;
DROP POLICY IF EXISTS "Users can create cargo details" ON public.cargo_details;
CREATE POLICY "Users can create cargo details" ON public.cargo_details FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Grant permissions

-- Create index
CREATE INDEX IF NOT EXISTS idx_cargo_details_tenant ON public.cargo_details(tenant_id);
-- Carrier Rate & Quotation Management Module (idempotent)
-- Core schema: carrier rates, charges, attachments, quotation versions, options, selections

BEGIN;

-- ===============
-- Charge Type Master
-- ===============
CREATE TABLE IF NOT EXISTS public.charge_types (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed standard charge types
INSERT INTO public.charge_types (code, name, description)
VALUES
  ('OFT', 'Ocean Freight', 'Base ocean freight'),
  ('AFT', 'Air Freight', 'Base air freight'),
  ('THC', 'Terminal Handling', 'Origin/Destination terminal handling'),
  ('BAF', 'Bunker Adjustment', 'Fuel surcharge'),
  ('CAF', 'Currency Adjustment', 'Currency fluctuation'),
  ('DOC', 'Documentation', 'Documentation fees'),
  ('AMS', 'Automated Manifest System', 'AMS filing'),
  ('ISF', 'Importer Security Filing', 'ISF filing'),
  ('ISPS', 'International Ship & Port Security', 'ISPS surcharge')
ON CONFLICT (code) DO NOTHING;

-- ===============
-- Carrier Rates
-- ===============
-- Extend existing carrier_rates table with module-specific columns
ALTER TABLE public.carrier_rates
  ADD COLUMN IF NOT EXISTS carrier_id uuid REFERENCES public.carriers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS origin_port_id uuid REFERENCES public.ports_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_port_id uuid REFERENCES public.ports_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS container_category_id uuid REFERENCES public.package_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS container_size_id uuid REFERENCES public.package_sizes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS scac_code text,
  ADD COLUMN IF NOT EXISTS vessel_flight_no text,
  ADD COLUMN IF NOT EXISTS rate_reference_id text,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS markup_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_subtotal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS etd date,
  ADD COLUMN IF NOT EXISTS eta date,
  ADD COLUMN IF NOT EXISTS sailing_frequency text,
  ADD COLUMN IF NOT EXISTS cut_off_date date,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS free_time_days integer,
  ADD COLUMN IF NOT EXISTS demurrage_rate numeric,
  ADD COLUMN IF NOT EXISTS detention_rate numeric,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active','expiring','expired','removed','selected')),
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_carrier_rates_route ON public.carrier_rates(origin_port_id, destination_port_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_carrier ON public.carrier_rates(carrier_id);

-- RLS
ALTER TABLE public.carrier_rates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rates' AND policyname = 'Platform admins manage all carrier rates'
  ) THEN
    DROP POLICY IF EXISTS "Platform admins manage all carrier rates" ON public.carrier_rates;
CREATE POLICY "Platform admins manage all carrier rates" ON public.carrier_rates FOR ALL
      USING (public.is_platform_admin(auth.uid()))
      WITH CHECK (public.is_platform_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rates' AND policyname = 'Tenant admins manage tenant carrier rates'
  ) THEN
    DROP POLICY IF EXISTS "Tenant admins manage tenant carrier rates" ON public.carrier_rates;
CREATE POLICY "Tenant admins manage tenant carrier rates" ON public.carrier_rates FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rates' AND policyname = 'Users can view tenant carrier rates'
  ) THEN
    DROP POLICY IF EXISTS "Users can view tenant carrier rates" ON public.carrier_rates;
CREATE POLICY "Users can view tenant carrier rates" ON public.carrier_rates FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Charges
CREATE TABLE IF NOT EXISTS public.carrier_rate_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  carrier_rate_id uuid NOT NULL REFERENCES public.carrier_rates(id) ON DELETE CASCADE,
  charge_type text NOT NULL REFERENCES public.charge_types(code) ON UPDATE CASCADE,
  basis text,
  quantity numeric DEFAULT 1,
  amount numeric NOT NULL,
  currency text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carrier_rate_charges_rate ON public.carrier_rate_charges(carrier_rate_id);
ALTER TABLE public.carrier_rate_charges ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rate_charges' AND policyname = 'Manage charges by tenant admins'
  ) THEN
    DROP POLICY IF EXISTS "Manage charges by tenant admins" ON public.carrier_rate_charges;
CREATE POLICY "Manage charges by tenant admins" ON public.carrier_rate_charges FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rate_charges' AND policyname = 'Users can view tenant charges'
  ) THEN
    DROP POLICY IF EXISTS "Users can view tenant charges" ON public.carrier_rate_charges;
CREATE POLICY "Users can view tenant charges" ON public.carrier_rate_charges FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Attachments
CREATE TABLE IF NOT EXISTS public.carrier_rate_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  carrier_rate_id uuid NOT NULL REFERENCES public.carrier_rates(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.carrier_rate_attachments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rate_attachments' AND policyname = 'Manage attachments by tenant admins'
  ) THEN
    DROP POLICY IF EXISTS "Manage attachments by tenant admins" ON public.carrier_rate_attachments;
CREATE POLICY "Manage attachments by tenant admins" ON public.carrier_rate_attachments FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rate_attachments' AND policyname = 'Users can view tenant attachments'
  ) THEN
    DROP POLICY IF EXISTS "Users can view tenant attachments" ON public.carrier_rate_attachments;
CREATE POLICY "Users can view tenant attachments" ON public.carrier_rate_attachments FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Totals recalculation trigger for charges
DROP FUNCTION IF EXISTS public.recalc_carrier_rate_total_trigger();
CREATE OR REPLACE FUNCTION public.recalc_carrier_rate_total_trigger()
RETURNS trigger
AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE','DELETE') THEN
    UPDATE public.carrier_rates r
    SET charges_subtotal = (
      SELECT COALESCE(SUM(c.amount * COALESCE(c.quantity, 1)), 0)
      FROM public.carrier_rate_charges c
      WHERE c.carrier_rate_id = COALESCE(NEW.carrier_rate_id, OLD.carrier_rate_id)
    ),
    total_amount = COALESCE(base_rate, 0) + COALESCE(markup_amount, 0) + (
      SELECT COALESCE(SUM(c.amount * COALESCE(c.quantity, 1)), 0)
      FROM public.carrier_rate_charges c
      WHERE c.carrier_rate_id = COALESCE(NEW.carrier_rate_id, OLD.carrier_rate_id)
    ),
    updated_at = now()
    WHERE r.id = COALESCE(NEW.carrier_rate_id, OLD.carrier_rate_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_total_on_charge_ins ON public.carrier_rate_charges;
CREATE TRIGGER trg_recalc_total_on_charge_ins
  AFTER INSERT ON public.carrier_rate_charges
  FOR EACH ROW EXECUTE FUNCTION public.recalc_carrier_rate_total_trigger();

DROP TRIGGER IF EXISTS trg_recalc_total_on_charge_upd ON public.carrier_rate_charges;
CREATE TRIGGER trg_recalc_total_on_charge_upd
  AFTER UPDATE ON public.carrier_rate_charges
  FOR EACH ROW EXECUTE FUNCTION public.recalc_carrier_rate_total_trigger();

DROP TRIGGER IF EXISTS trg_recalc_total_on_charge_del ON public.carrier_rate_charges;
CREATE TRIGGER trg_recalc_total_on_charge_del
  AFTER DELETE ON public.carrier_rate_charges
  FOR EACH ROW EXECUTE FUNCTION public.recalc_carrier_rate_total_trigger();

-- Recalc totals when base or markup changes
DROP FUNCTION IF EXISTS public.recalc_carrier_rate_on_rate_update();
CREATE OR REPLACE FUNCTION public.recalc_carrier_rate_on_rate_update()
RETURNS trigger
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.charges_subtotal := (
      SELECT COALESCE(SUM(c.amount * COALESCE(c.quantity, 1)), 0)
      FROM public.carrier_rate_charges c
      WHERE c.carrier_rate_id = NEW.id
    );
    NEW.total_amount := COALESCE(NEW.base_rate, 0) + COALESCE(NEW.markup_amount, 0) + COALESCE(NEW.charges_subtotal, 0);
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_total_on_rate_upd ON public.carrier_rates;
CREATE TRIGGER trg_recalc_total_on_rate_upd
  BEFORE UPDATE ON public.carrier_rates
  FOR EACH ROW EXECUTE FUNCTION public.recalc_carrier_rate_on_rate_update();

-- ===============
-- Quotation Versioning & Selection
-- ===============
CREATE TABLE IF NOT EXISTS public.quotation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  major integer NOT NULL DEFAULT 1,
  minor integer NOT NULL DEFAULT 0,
  change_reason text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','selected','archived')),
  valid_until date,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_version ON public.quotation_versions(quote_id, major, minor);
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_versions' AND policyname = 'Tenant admins manage quotation versions'
  ) THEN
    DROP POLICY IF EXISTS "Tenant admins manage quotation versions" ON public.quotation_versions;
CREATE POLICY "Tenant admins manage quotation versions" ON public.quotation_versions FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_versions' AND policyname = 'Users can view quotation versions'
  ) THEN
    DROP POLICY IF EXISTS "Users can view quotation versions" ON public.quotation_versions;
CREATE POLICY "Users can view quotation versions" ON public.quotation_versions FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quotation_version_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quotation_version_id uuid NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  carrier_rate_id uuid NOT NULL REFERENCES public.carrier_rates(id) ON DELETE RESTRICT,
  recommended boolean DEFAULT false,
  notes text,
  total_amount numeric,
  transit_days integer,
  status text DEFAULT 'active' CHECK (status IN ('active','removed','selected')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qvo_version ON public.quotation_version_options(quotation_version_id);
ALTER TABLE public.quotation_version_options ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_version_options' AND policyname = 'Tenant admins manage version options'
  ) THEN
    DROP POLICY IF EXISTS "Tenant admins manage version options" ON public.quotation_version_options;
CREATE POLICY "Tenant admins manage version options" ON public.quotation_version_options FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_version_options' AND policyname = 'Users can view version options'
  ) THEN
    DROP POLICY IF EXISTS "Users can view version options" ON public.quotation_version_options;
CREATE POLICY "Users can view version options" ON public.quotation_version_options FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Populate option summary fields from carrier_rate
DROP FUNCTION IF EXISTS public.populate_option_from_rate();
CREATE OR REPLACE FUNCTION public.populate_option_from_rate()
RETURNS trigger
AS $$
DECLARE
  v_total numeric;
  v_transit integer;
BEGIN
  SELECT r.total_amount, r.transit_time_days INTO v_total, v_transit
  FROM public.carrier_rates r WHERE r.id = NEW.carrier_rate_id;
  NEW.total_amount := v_total;
  NEW.transit_days := v_transit;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_qvo_populate ON public.quotation_version_options;
CREATE TRIGGER trg_qvo_populate
  BEFORE INSERT ON public.quotation_version_options
  FOR EACH ROW EXECUTE FUNCTION public.populate_option_from_rate();

-- Selection events
CREATE TABLE IF NOT EXISTS public.quotation_selection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  quotation_version_id uuid NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  selected_option_id uuid NOT NULL REFERENCES public.quotation_version_options(id) ON DELETE RESTRICT,
  reason text,
  selected_by uuid,
  selected_at timestamptz DEFAULT now()
);
ALTER TABLE public.quotation_selection_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_selection_events' AND policyname = 'Tenant admins manage selection events'
  ) THEN
    DROP POLICY IF EXISTS "Tenant admins manage selection events" ON public.quotation_selection_events;
CREATE POLICY "Tenant admins manage selection events" ON public.quotation_selection_events FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_selection_events' AND policyname = 'Users can view selection events'
  ) THEN
    DROP POLICY IF EXISTS "Users can view selection events" ON public.quotation_selection_events;
CREATE POLICY "Users can view selection events" ON public.quotation_selection_events FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Helper: record customer selection and update statuses
DROP FUNCTION IF EXISTS public.record_customer_selection(p_tenant_id uuid, p_quote_id uuid, p_version_id uuid, p_option_id uuid, p_reason text, p_user_id uuid);
CREATE OR REPLACE FUNCTION public.record_customer_selection(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_version_id uuid,
  p_option_id uuid,
  p_reason text,
  p_user_id uuid
) RETURNS void
AS $$
BEGIN
  INSERT INTO public.quotation_selection_events (tenant_id, quote_id, quotation_version_id, selected_option_id, reason, selected_by)
  VALUES (p_tenant_id, p_quote_id, p_version_id, p_option_id, p_reason, p_user_id);

  -- Mark selected option and carrier rate
  UPDATE public.quotation_version_options SET status = 'selected' WHERE id = p_option_id;
  UPDATE public.carrier_rates r
  SET status = 'selected'
  WHERE r.id = (SELECT carrier_rate_id FROM public.quotation_version_options WHERE id = p_option_id);

  -- Set other options in the version to removed
  UPDATE public.quotation_version_options SET status = 'removed'
  WHERE quotation_version_id = p_version_id AND id <> p_option_id;

  -- Update version status
  UPDATE public.quotation_versions SET status = 'selected' WHERE id = p_version_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;-- Ensure roles can see tables in PostgREST schema cache
DO $$
BEGIN
  -- Schema usage for anon/authenticated
  BEGIN
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT USAGE ON SCHEMA public TO anon;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Grants for quotation_versions
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotation_versions TO authenticated;
    GRANT SELECT ON TABLE public.quotation_versions TO anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table public.quotation_versions not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for quotation_versions: %', SQLERRM;
  END;

  -- Grants for quotation_version_options
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotation_version_options TO authenticated;
    GRANT SELECT ON TABLE public.quotation_version_options TO anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table public.quotation_version_options not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for quotation_version_options: %', SQLERRM;
  END;

  -- Grants for carrier_rates (read used in UI)
  BEGIN
    GRANT SELECT ON TABLE public.carrier_rates TO authenticated;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table public.carrier_rates not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for carrier_rates: %', SQLERRM;
  END;

  -- RPC execute rights for selection flow
  BEGIN
    GRANT EXECUTE ON FUNCTION public.record_customer_selection(uuid, uuid, uuid, uuid, text, uuid) TO authenticated;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Function public.record_customer_selection not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for record_customer_selection: %', SQLERRM;
  END;
END $$;

-- Hint PostgREST to reload schema cache (no-op if not supported); safe to call manually if needed:
-- SELECT pg_notify('postgrest', 'reload schema');-- Create quotation_packages table
CREATE TABLE IF NOT EXISTS public.quotation_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  package_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  length_cm NUMERIC,
  width_cm NUMERIC,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotation_packages ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotation_packages_quote_id ON public.quotation_packages(quote_id);
CREATE INDEX IF NOT EXISTS idx_quotation_packages_tenant_id ON public.quotation_packages(tenant_id);

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all quotation packages" ON public.quotation_packages;
CREATE POLICY "Platform admins can manage all quotation packages" ON public.quotation_packages
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant quotation packages" ON public.quotation_packages;
CREATE POLICY "Tenant admins can manage tenant quotation packages" ON public.quotation_packages
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view franchise quotation packages" ON public.quotation_packages;
CREATE POLICY "Users can view franchise quotation packages" ON public.quotation_packages
  FOR SELECT
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create quotation packages" ON public.quotation_packages;
CREATE POLICY "Users can create quotation packages" ON public.quotation_packages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update quotation packages" ON public.quotation_packages;
CREATE POLICY "Users can update quotation packages" ON public.quotation_packages
  FOR UPDATE
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_quotation_packages_updated_at ON public.quotation_packages;
CREATE TRIGGER update_quotation_packages_updated_at
  BEFORE UPDATE ON public.quotation_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions

DECLARE
  tenant_nullable text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'carriers'
      AND column_name = 'carrier_type'
  ) THEN
    ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS carrier_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'carriers'
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
  END IF;

  SELECT is_nullable
  INTO tenant_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'carriers'
    AND column_name = 'tenant_id';

  IF tenant_nullable IS NULL OR tenant_nullable = 'YES' THEN
    INSERT INTO carriers (carrier_name, carrier_type, is_active) VALUES
      -- Ocean Carriers
      ('Mediterranean Shipping Company (MSC)', 'ocean', true),
      ('Maersk', 'ocean', true),
      ('CMA CGM', 'ocean', true),
      ('COSCO Shipping Lines', 'ocean', true),
      ('Hapag-Lloyd', 'ocean', true),
      ('Ocean Network Express (ONE)', 'ocean', true),
      ('Evergreen Marine Corporation', 'ocean', true),
      ('HMM Co. Ltd.', 'ocean', true),
      ('Zim Integrated Shipping Services', 'ocean', true),
      ('Yang Ming Marine Transport Corporation', 'ocean', true),

      -- Air Cargo Carriers
      ('FedEx Express', 'air_cargo', true),
      ('UPS Airlines', 'air_cargo', true),
      ('DHL Aviation', 'air_cargo', true),
      ('Qatar Airways Cargo', 'air_cargo', true),
      ('Emirates SkyCargo', 'air_cargo', true),
      ('Cathay Pacific Cargo', 'air_cargo', true),
      ('Lufthansa Cargo', 'air_cargo', true),
      ('Korean Air Cargo', 'air_cargo', true),
      ('Singapore Airlines Cargo', 'air_cargo', true),
      ('Cargolux', 'air_cargo', true),

      -- Trucking & Courier Companies
      ('UPS', 'courier', true),
      ('FedEx', 'courier', true),
      ('XPO Logistics', 'trucking', true),
      ('J.B. Hunt Transport Services', 'trucking', true),
      ('Knight-Swift Transportation', 'trucking', true),
      ('Schneider National', 'trucking', true),
      ('Werner Enterprises', 'trucking', true),
      ('U.S. Xpress Enterprises', 'trucking', true),
      ('Old Dominion Freight Line', 'trucking', true),
      ('YRC Worldwide', 'trucking', true),

      -- Movers and Packers
      ('Allied Van Lines', 'movers_and_packers', true),
      ('North American Van Lines', 'movers_and_packers', true),
      ('Atlas Van Lines', 'movers_and_packers', true),
      ('United Van Lines', 'movers_and_packers', true),
      ('Mayflower Transit', 'movers_and_packers', true);
  END IF;
END $$;
-- Seed global carriers data
-- Note: This inserts carriers for each tenant in the system
-- Platform admins can see all, tenants can only see their own

INSERT INTO public.carriers (
  tenant_id,
  carrier_name,
  carrier_type,
  carrier_code,
  scac,
  iata,
  is_active
)
SELECT 
  t.id as tenant_id,
  c.carrier_name,
  c.carrier_type,
  c.carrier_code,
  c.scac,
  c.iata,
  true as is_active
FROM public.tenants t
CROSS JOIN (
  VALUES
    -- Ocean Carriers
    ('Mediterranean Shipping Company (MSC)', 'ocean', 'MSC', 'MSCU', NULL),
    ('Maersk', 'ocean', 'MAERSK', 'MAEU', NULL),
    ('CMA CGM', 'ocean', 'CMACGM', 'CMDU', NULL),
    ('COSCO Shipping Lines', 'ocean', 'COSCO', 'COSU', NULL),
    ('Hapag-Lloyd', 'ocean', 'HAPAG', 'HLCU', NULL),
    ('Ocean Network Express (ONE)', 'ocean', 'ONE', 'ONEY', NULL),
    ('Evergreen Marine Corporation', 'ocean', 'EVERGREEN', 'EGLV', NULL),
    ('HMM Co. Ltd.', 'ocean', 'HMM', 'HDMU', NULL),
    ('Zim Integrated Shipping Services', 'ocean', 'ZIM', 'ZIMU', NULL),
    ('Yang Ming Marine Transport Corporation', 'ocean', 'YANGMING', 'YMLU', NULL),
    
    -- Air Cargo Carriers
    ('FedEx Express', 'air', 'FEDEX', NULL, 'FX'),
    ('UPS Airlines', 'air', 'UPS', NULL, '5X'),
    ('DHL Aviation', 'air', 'DHL', NULL, 'D0'),
    ('Qatar Airways Cargo', 'air', 'QATAR', NULL, 'QR'),
    ('Emirates SkyCargo', 'air', 'EMIRATES', NULL, 'EK'),
    ('Cathay Pacific Cargo', 'air', 'CATHAY', NULL, 'CX'),
    ('Lufthansa Cargo', 'air', 'LUFTHANSA', NULL, 'LH'),
    ('Korean Air Cargo', 'air', 'KOREANAIR', NULL, 'KE'),
    ('Singapore Airlines Cargo', 'air', 'SINGAPORE', NULL, 'SQ'),
    ('Cargolux', 'air', 'CARGOLUX', NULL, 'CV'),
    
    -- Trucking Companies
    ('UPS', 'trucking', 'UPS', 'UPSS', NULL),
    ('FedEx', 'trucking', 'FEDEX', 'FDEG', NULL),
    ('XPO Logistics', 'trucking', 'XPO', 'XPOL', NULL),
    ('J.B. Hunt Transport Services', 'trucking', 'JBHUNT', 'JBHT', NULL),
    ('Knight-Swift Transportation', 'trucking', 'KNIGHTSWIFT', 'SWFT', NULL),
    ('Schneider National', 'trucking', 'SCHNEIDER', 'SNDR', NULL),
    ('Werner Enterprises', 'trucking', 'WERNER', 'WERN', NULL),
    ('U.S. Xpress Enterprises', 'trucking', 'USXPRESS', 'UACX', NULL),
    ('Old Dominion Freight Line', 'trucking', 'ODFL', 'ODFL', NULL),
    ('YRC Worldwide', 'trucking', 'YRC', 'YRCW', NULL)
) AS c(carrier_name, carrier_type, carrier_code, scac, iata)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers 
  WHERE carriers.carrier_name = c.carrier_name 
  AND carriers.tenant_id = t.id
);-- Drop the existing check constraint first
ALTER TABLE public.carriers DROP CONSTRAINT IF EXISTS carriers_carrier_type_check;

-- Now update all carriers to new types without constraint blocking
UPDATE public.carriers 
SET carrier_type = 'air_cargo'
WHERE carrier_type = 'air';

UPDATE public.carriers 
SET carrier_type = 'courier' 
WHERE carrier_name IN ('UPS', 'FedEx')
AND carrier_name NOT IN ('FedEx Express', 'UPS Airlines');

UPDATE public.carriers 
SET carrier_type = 'movers_and_packers' 
WHERE carrier_name IN (
  'Allied Van Lines',
  'North American Van Lines',
  'Atlas Van Lines',
  'United Van Lines',
  'Mayflower Transit'
);

-- Add new check constraint AFTER all updates are done
ALTER TABLE public.carriers 
ADD CONSTRAINT carriers_carrier_type_check 
CHECK (carrier_type IN ('ocean', 'air_cargo', 'trucking', 'courier', 'movers_and_packers', 'rail'));-- Step 1: Add service_type_id column to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id);

-- Step 2: Update quotes with matching service types
UPDATE public.quotes q
SET service_type_id = st.id
FROM public.service_types st
WHERE st.name = q.service_type;

-- Step 3: Drop service_type text column from quotes
ALTER TABLE public.quotes
DROP COLUMN IF EXISTS service_type;

-- Step 4: Check if quote_items table has mode or service_type column
DO $$
BEGIN
  -- Add service_type_id column to quote_items if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quote_items') THEN
    -- Add the new column
    ALTER TABLE public.quote_items
    ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id);
    
    -- Update quote_items with service_type_id from quotes
    UPDATE public.quote_items qi
    SET service_type_id = q.service_type_id
    FROM public.quotes q
    WHERE qi.quote_id = q.id;
    
    -- Drop old columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_items' AND column_name = 'mode') THEN
      ALTER TABLE public.quote_items DROP COLUMN mode;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_items' AND column_name = 'service_type') THEN
      ALTER TABLE public.quote_items DROP COLUMN service_type;
    END IF;
  END IF;
END $$;-- Add service_type_id column to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id);

-- Migrate existing data: map service_type text to service_type_id
-- For now, we'll need to manually map or set to null since we don't have direct mapping
UPDATE public.services 
SET service_type_id = (
  SELECT id FROM public.service_types 
  WHERE LOWER(name) = LOWER(services.service_type) 
  LIMIT 1
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_services_service_type_id ON public.services(service_type_id);

-- Add comment
COMMENT ON COLUMN public.services.service_type_id IS 'Foreign key reference to service_types table';-- Add code field to service_types table
ALTER TABLE public.service_types 
ADD COLUMN IF NOT EXISTS code text;

-- Create unique index on code field
CREATE UNIQUE INDEX IF NOT EXISTS service_types_code_unique 
ON public.service_types (code);

-- Populate code field with existing name values (lowercase)
UPDATE public.service_types 
SET code = LOWER(name) 
WHERE code IS NULL;

-- Make code field NOT NULL after populating
ALTER TABLE public.service_types 
ALTER COLUMN code SET NOT NULL;

-- Add comment
COMMENT ON COLUMN public.service_types.code IS 'Unique code identifier for service type (e.g., ocean, air, trucking)';-- Add code field to service_types table
ALTER TABLE service_types ADD COLUMN IF NOT EXISTS code TEXT;

-- Create unique index on code
CREATE UNIQUE INDEX IF NOT EXISTS service_types_code_unique 
ON service_types(code) 
WHERE code IS NOT NULL;

-- Populate code field based on name (convert to lowercase with underscores)
UPDATE service_types 
SET code = LOWER(REPLACE(name, ' ', '_'))
WHERE code IS NULL;-- Consolidated safe migration replacing disabled migrations for quotes and quote_items

DO $do$
BEGIN
  -- Ensure quotes.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- If legacy quotes.mode exists, migrate values using dynamic SQL to avoid parse errors
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'mode'
  ) THEN
    -- Populate service_type_id from quotes."mode" via subquery to avoid aggregate MODE() confusion
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = (quotes."mode")::text
        LIMIT 1
      )
      WHERE quotes."mode" IS NOT NULL
        AND service_type_id IS NULL';

    -- Drop legacy column
    EXECUTE 'ALTER TABLE public.quotes DROP COLUMN "mode"';
  END IF;

  -- Optional: if a text column quotes.service_type exists, migrate from that too
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type'
  ) THEN
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = quotes.service_type::text
        LIMIT 1
      )
      WHERE quotes.service_type IS NOT NULL
        AND service_type_id IS NULL';
    -- Do not drop quotes.service_type automatically; it may be used elsewhere
  END IF;

  -- Ensure quote_items.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- Populate quote_items.service_type_id from parent quotes.service_type_id when missing
  UPDATE public.quote_items qi
  SET service_type_id = q.service_type_id
  FROM public.quotes q
  WHERE qi.quote_id = q.id
    AND qi.service_type_id IS NULL;

  -- If legacy quote_items.mode exists, drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'mode'
  ) THEN
    EXECUTE 'ALTER TABLE public.quote_items DROP COLUMN mode';
  END IF;
END
$do$ LANGUAGE plpgsql;-- Consolidated safe migration replacing disabled migrations for quotes and quote_items

DO $do$
BEGIN
  -- Ensure quotes.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- If legacy quotes.mode exists, migrate values using dynamic SQL to avoid parse errors
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'mode'
  ) THEN
    -- Populate service_type_id from quotes."mode" via subquery to avoid aggregate MODE() confusion
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = (quotes."mode")::text
        LIMIT 1
      )
      WHERE quotes."mode" IS NOT NULL
        AND service_type_id IS NULL';

    -- Drop legacy column
    EXECUTE 'ALTER TABLE public.quotes DROP COLUMN "mode"';
  END IF;

  -- Optional: if a text column quotes.service_type exists, migrate from that too
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type'
  ) THEN
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = quotes.service_type::text
        LIMIT 1
      )
      WHERE quotes.service_type IS NOT NULL
        AND service_type_id IS NULL';
    -- Do not drop quotes.service_type automatically; it may be used elsewhere
  END IF;

  -- Ensure quote_items.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- Populate quote_items.service_type_id from parent quotes.service_type_id when missing
  UPDATE public.quote_items qi
  SET service_type_id = q.service_type_id
  FROM public.quotes q
  WHERE qi.quote_id = q.id
    AND qi.service_type_id IS NULL;

  -- If legacy quote_items.mode exists, drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'mode'
  ) THEN
    EXECUTE 'ALTER TABLE public.quote_items DROP COLUMN mode';
  END IF;
END
$do$ LANGUAGE plpgsql;-- Consolidated safe migration replacing disabled migrations for quotes and quote_items

DO $do$
BEGIN
  -- Ensure quotes.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- If legacy quotes.mode exists, migrate values using dynamic SQL to avoid parse errors
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'mode'
  ) THEN
    -- Populate service_type_id from quotes."mode" via subquery to avoid aggregate MODE() confusion
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = (quotes."mode")::text
        LIMIT 1
      )
      WHERE quotes."mode" IS NOT NULL
        AND service_type_id IS NULL';

    -- Drop legacy column
    EXECUTE 'ALTER TABLE public.quotes DROP COLUMN "mode"';
  END IF;

  -- Optional: if a text column quotes.service_type exists, migrate from that too
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type'
  ) THEN
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = quotes.service_type::text
        LIMIT 1
      )
      WHERE quotes.service_type IS NOT NULL
        AND service_type_id IS NULL';
    -- Do not drop quotes.service_type automatically; it may be used elsewhere
  END IF;

  -- Ensure quote_items.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- Populate quote_items.service_type_id from parent quotes.service_type_id when missing
  UPDATE public.quote_items qi
  SET service_type_id = q.service_type_id
  FROM public.quotes q
  WHERE qi.quote_id = q.id
    AND qi.service_type_id IS NULL;

  -- If legacy quote_items.mode exists, drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'mode'
  ) THEN
    EXECUTE 'ALTER TABLE public.quote_items DROP COLUMN mode';
  END IF;
END
$do$ LANGUAGE plpgsql;-- Consolidated safe migration replacing disabled migrations for quotes and quote_items

DO $do$
BEGIN
  -- Ensure quotes.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- If legacy quotes.mode exists, migrate values using dynamic SQL to avoid parse errors
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'mode'
  ) THEN
    -- Populate service_type_id from quotes."mode" via subquery to avoid aggregate MODE() confusion
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = (quotes."mode")::text
        LIMIT 1
      )
      WHERE quotes."mode" IS NOT NULL
        AND service_type_id IS NULL';

    -- Drop legacy column
    EXECUTE 'ALTER TABLE public.quotes DROP COLUMN "mode"';
  END IF;

  -- Optional: if a text column quotes.service_type exists, migrate from that too
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type'
  ) THEN
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = quotes.service_type::text
        LIMIT 1
      )
      WHERE quotes.service_type IS NOT NULL
        AND service_type_id IS NULL';
    -- Do not drop quotes.service_type automatically; it may be used elsewhere
  END IF;

  -- Ensure quote_items.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- Populate quote_items.service_type_id from parent quotes.service_type_id when missing
  UPDATE public.quote_items qi
  SET service_type_id = q.service_type_id
  FROM public.quotes q
  WHERE qi.quote_id = q.id
    AND qi.service_type_id IS NULL;

  -- If legacy quote_items.mode exists, drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'mode'
  ) THEN
    EXECUTE 'ALTER TABLE public.quote_items DROP COLUMN mode';
  END IF;
END
$do$ LANGUAGE plpgsql;-- Consolidated safe migration replacing disabled migrations for quotes and quote_items

DO $do$
BEGIN
  -- Ensure quotes.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- If legacy quotes.mode exists, migrate values using dynamic SQL to avoid parse errors
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'mode'
  ) THEN
    -- Populate service_type_id from quotes."mode" via subquery to avoid aggregate MODE() confusion
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = (quotes."mode")::text
        LIMIT 1
      )
      WHERE quotes."mode" IS NOT NULL
        AND service_type_id IS NULL';

    -- Drop legacy column
    EXECUTE 'ALTER TABLE public.quotes DROP COLUMN "mode"';
  END IF;

  -- Optional: if a text column quotes.service_type exists, migrate from that too
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type'
  ) THEN
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = quotes.service_type::text
        LIMIT 1
      )
      WHERE quotes.service_type IS NOT NULL
        AND service_type_id IS NULL';
    -- Do not drop quotes.service_type automatically; it may be used elsewhere
  END IF;

  -- Ensure quote_items.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- Populate quote_items.service_type_id from parent quotes.service_type_id when missing
  UPDATE public.quote_items qi
  SET service_type_id = q.service_type_id
  FROM public.quotes q
  WHERE qi.quote_id = q.id
    AND qi.service_type_id IS NULL;

  -- If legacy quote_items.mode exists, drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'mode'
  ) THEN
    EXECUTE 'ALTER TABLE public.quote_items DROP COLUMN mode';
  END IF;
END
$do$ LANGUAGE plpgsql;-- Drop and recreate get_database_tables function with correct signature
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
$$;-- Ensure quote numbering tables can be recreated safely
DROP TABLE IF EXISTS public.quote_number_sequences CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_franchise CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_tenant CASCADE;
DROP TYPE IF EXISTS quote_reset_policy CASCADE;

-- Create enum for reset policies
DO $$ BEGIN
    CREATE TYPE quote_reset_policy AS ENUM ('none', 'daily', 'monthly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tenant-level quote numbering configuration
CREATE TABLE IF NOT EXISTS public.quote_number_config_tenant (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Franchise-level quote numbering configuration
CREATE TABLE IF NOT EXISTS public.quote_number_config_franchise (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (tenant_id, franchise_id)
);

-- Quote number sequences table
CREATE TABLE IF NOT EXISTS public.quote_number_sequences (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create partial unique indexes for sequences
CREATE UNIQUE INDEX IF NOT EXISTS unique_tenant_period_idx ON public.quote_number_sequences (tenant_id, period_key) 
  WHERE franchise_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_franchise_period_idx ON public.quote_number_sequences (tenant_id, franchise_id, period_key) 
  WHERE franchise_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.quote_number_config_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_franchise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their tenant quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Users can view their tenant quote config" ON public.quote_number_config_tenant FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Tenant admins can manage quote config" ON public.quote_number_config_tenant FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin'));

DROP POLICY IF EXISTS "Users can view their franchise quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Users can view their franchise quote config" ON public.quote_number_config_franchise FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can manage their quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Franchise admins can manage their quote config" ON public.quote_number_config_franchise FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    franchise_id = public.get_user_franchise_id(auth.uid()) AND
    public.has_role(auth.uid(), 'franchise_admin')
  );

DROP POLICY IF EXISTS "Users can view sequences for their context" ON public.quote_number_sequences;
CREATE POLICY "Users can view sequences for their context" ON public.quote_number_sequences FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (franchise_id IS NULL OR franchise_id = public.get_user_franchise_id(auth.uid()))
  );

DROP POLICY IF EXISTS "System can manage sequences" ON public.quote_number_sequences;
CREATE POLICY "System can manage sequences" ON public.quote_number_sequences FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));-- Ensure quote numbering tables can be recreated safely
DROP TABLE IF EXISTS public.quote_number_sequences CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_franchise CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_tenant CASCADE;
DROP TYPE IF EXISTS quote_reset_policy CASCADE;

-- Create enum for reset policies
DO $$ BEGIN
    CREATE TYPE quote_reset_policy AS ENUM ('none', 'daily', 'monthly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tenant-level quote numbering configuration
CREATE TABLE IF NOT EXISTS public.quote_number_config_tenant (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Franchise-level quote numbering configuration
CREATE TABLE IF NOT EXISTS public.quote_number_config_franchise (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (tenant_id, franchise_id)
);

-- Quote number sequences table
CREATE TABLE IF NOT EXISTS public.quote_number_sequences (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create partial unique indexes for sequences
CREATE UNIQUE INDEX IF NOT EXISTS unique_tenant_period_idx ON public.quote_number_sequences (tenant_id, period_key) 
  WHERE franchise_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_franchise_period_idx ON public.quote_number_sequences (tenant_id, franchise_id, period_key) 
  WHERE franchise_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.quote_number_config_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_franchise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their tenant quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Users can view their tenant quote config" ON public.quote_number_config_tenant FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Tenant admins can manage quote config" ON public.quote_number_config_tenant FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin'));

DROP POLICY IF EXISTS "Users can view their franchise quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Users can view their franchise quote config" ON public.quote_number_config_franchise FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can manage their quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Franchise admins can manage their quote config" ON public.quote_number_config_franchise FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    franchise_id = public.get_user_franchise_id(auth.uid()) AND
    public.has_role(auth.uid(), 'franchise_admin')
  );

DROP POLICY IF EXISTS "Users can view sequences for their context" ON public.quote_number_sequences;
CREATE POLICY "Users can view sequences for their context" ON public.quote_number_sequences FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (franchise_id IS NULL OR franchise_id = public.get_user_franchise_id(auth.uid()))
  );

DROP POLICY IF EXISTS "System can manage sequences" ON public.quote_number_sequences;
CREATE POLICY "System can manage sequences" ON public.quote_number_sequences FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));-- Ensure quote numbering tables can be recreated safely
DROP TABLE IF EXISTS public.quote_number_sequences CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_franchise CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_tenant CASCADE;
DROP TYPE IF EXISTS quote_reset_policy CASCADE;

-- Create enum for reset policies
DO $$ BEGIN
    CREATE TYPE quote_reset_policy AS ENUM ('none', 'daily', 'monthly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tenant-level quote numbering configuration
CREATE TABLE IF NOT EXISTS public.quote_number_config_tenant (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Franchise-level quote numbering configuration
CREATE TABLE IF NOT EXISTS public.quote_number_config_franchise (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (tenant_id, franchise_id)
);

-- Quote number sequences table
CREATE TABLE IF NOT EXISTS public.quote_number_sequences (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create partial unique indexes for sequences
CREATE UNIQUE INDEX IF NOT EXISTS unique_tenant_period_idx ON public.quote_number_sequences (tenant_id, period_key) 
  WHERE franchise_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_franchise_period_idx ON public.quote_number_sequences (tenant_id, franchise_id, period_key) 
  WHERE franchise_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.quote_number_config_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_franchise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their tenant quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Users can view their tenant quote config" ON public.quote_number_config_tenant FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Tenant admins can manage quote config" ON public.quote_number_config_tenant FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin'));

DROP POLICY IF EXISTS "Users can view their franchise quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Users can view their franchise quote config" ON public.quote_number_config_franchise FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can manage their quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Franchise admins can manage their quote config" ON public.quote_number_config_franchise FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    franchise_id = public.get_user_franchise_id(auth.uid()) AND
    public.has_role(auth.uid(), 'franchise_admin')
  );

DROP POLICY IF EXISTS "Users can view sequences for their context" ON public.quote_number_sequences;
CREATE POLICY "Users can view sequences for their context" ON public.quote_number_sequences FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (franchise_id IS NULL OR franchise_id = public.get_user_franchise_id(auth.uid()))
  );

DROP POLICY IF EXISTS "System can manage sequences" ON public.quote_number_sequences;
CREATE POLICY "System can manage sequences" ON public.quote_number_sequences FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));-- Cleanup to resolve 'already exists' errors before reapplying migrations
DROP TABLE IF EXISTS public.quote_number_sequences CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_franchise CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_tenant CASCADE;
DROP TYPE IF EXISTS quote_reset_policy CASCADE;-- Create storage bucket for database backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('db-backups', 'db-backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for db-backups bucket
-- Allow authenticated users to upload their own backups
DROP POLICY IF EXISTS "Users can upload their own backups" ON storage.objects;
CREATE POLICY "Users can upload their own backups" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'db-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view their own backups
DROP POLICY IF EXISTS "Users can view their own backups" ON storage.objects;
CREATE POLICY "Users can view their own backups" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'db-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own backups
DROP POLICY IF EXISTS "Users can update their own backups" ON storage.objects;
CREATE POLICY "Users can update their own backups" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'db-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own backups
DROP POLICY IF EXISTS "Users can delete their own backups" ON storage.objects;
CREATE POLICY "Users can delete their own backups" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'db-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Platform admins can access all backups
DROP POLICY IF EXISTS "Platform admins can access all backups" ON storage.objects;
CREATE POLICY "Platform admins can access all backups" ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'db-backups' AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);-- Create function to list database functions/procedures with full definitions
DROP FUNCTION IF EXISTS public.get_database_functions_with_body();
CREATE OR REPLACE FUNCTION public.get_database_functions_with_body()
RETURNS TABLE(
  name text,
  schema text,
  kind text,
  return_type text,
  argument_types text,
  language text,
  volatility text,
  security_definer boolean,
  description text,
  function_definition text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.proname::text AS name,
    n.nspname::text AS schema,
    CASE p.prokind 
      WHEN 'f' THEN 'function' 
      WHEN 'p' THEN 'procedure' 
      WHEN 'a' THEN 'aggregate' 
      WHEN 'w' THEN 'window' 
      ELSE p.prokind::text 
    END AS kind,
    pg_catalog.format_type(p.prorettype, NULL)::text AS return_type,
    pg_catalog.pg_get_function_identity_arguments(p.oid)::text AS argument_types,
    l.lanname::text AS language,
    CASE p.provolatile 
      WHEN 'i' THEN 'immutable' 
      WHEN 's' THEN 'stable' 
      WHEN 'v' THEN 'volatile' 
      ELSE p.provolatile::text 
    END AS volatility,
    p.prosecdef AS security_definer,
    pg_catalog.obj_description(p.oid, 'pg_proc')::text AS description,
    pg_catalog.pg_get_functiondef(p.oid)::text AS function_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
  ORDER BY n.nspname, p.proname;
$$;-- Add new values to lead_status enum if they don't exist
DO $$ 
BEGIN
  -- Add 'contacted' if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'contacted' AND enumtypid = 'lead_status'::regtype) THEN
    ALTER TYPE lead_status ADD VALUE 'contacted';
  END IF;
  
  -- Add 'qualified' if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'qualified' AND enumtypid = 'lead_status'::regtype) THEN
    ALTER TYPE lead_status ADD VALUE 'qualified';
  END IF;
  
  -- Add 'proposal' if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'proposal' AND enumtypid = 'lead_status'::regtype) THEN
    ALTER TYPE lead_status ADD VALUE 'proposal';
  END IF;
  
  -- Add 'converted' if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'converted' AND enumtypid = 'lead_status'::regtype) THEN
    ALTER TYPE lead_status ADD VALUE 'converted';
  END IF;
  