-- Migration: Email Infrastructure Phase 1 (Foundation & Zero-Trust Security)
-- Date: 2026-02-08
-- Description: Adds tenant_domains table, MFA flag to delegations, and encryption columns to emails.

-- Enable pgcrypto extension for encryption primitives
create extension if not exists pgcrypto;

-- 1. Create tenant_domains table
create table if not exists public.tenant_domains (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) not null,
    domain_name text not null,
    
    -- Verification Status
    is_verified boolean default false,
    spf_record text,
    spf_verified boolean default false,
    dkim_record text,
    dkim_verified boolean default false,
    dmarc_record text,
    dmarc_verified boolean default false,
    
    -- Provider Info (e.g. AWS SES)
    provider_metadata jsonb,
    
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    
    unique(tenant_id, domain_name)
);

-- Enable RLS
alter table public.tenant_domains enable row level security;

-- RLS Policies for tenant_domains

-- Ensure idempotency: drop existing policies if they already exist
drop policy if exists "Platform admins can manage all domains" on public.tenant_domains;
drop policy if exists "Tenant admins can view own domains" on public.tenant_domains;
drop policy if exists "Tenant admins can manage own domains" on public.tenant_domains;
drop policy if exists "Tenant admins can update own domains" on public.tenant_domains;
drop policy if exists "Tenant admins can delete own domains" on public.tenant_domains;

-- Policy: Platform admins can do everything
create policy "Platform admins can manage all domains"
    on public.tenant_domains for all
    to authenticated
    using (public.is_platform_admin(auth.uid()))
    with check (public.is_platform_admin(auth.uid()));

-- Policy: Tenant admins can view their own domains
create policy "Tenant admins can view own domains"
    on public.tenant_domains for select
    to authenticated
    using (
        public.is_tenant_admin(auth.uid()) 
        and tenant_id = public.get_user_tenant_id(auth.uid())
    );

-- Policy: Tenant admins can insert/update their own domains
create policy "Tenant admins can manage own domains"
    on public.tenant_domains for insert
    to authenticated
    with check (
        public.is_tenant_admin(auth.uid()) 
        and tenant_id = public.get_user_tenant_id(auth.uid())
    );

create policy "Tenant admins can update own domains"
    on public.tenant_domains for update
    to authenticated
    using (
        public.is_tenant_admin(auth.uid()) 
        and tenant_id = public.get_user_tenant_id(auth.uid())
    )
    with check (
        public.is_tenant_admin(auth.uid()) 
        and tenant_id = public.get_user_tenant_id(auth.uid())
    );

create policy "Tenant admins can delete own domains"
    on public.tenant_domains for delete
    to authenticated
    using (
        public.is_tenant_admin(auth.uid()) 
        and tenant_id = public.get_user_tenant_id(auth.uid())
    );

-- 2. Update email_account_delegations
alter table public.email_account_delegations 
add column if not exists requires_mfa boolean default false;

-- 3. Update emails table
alter table public.emails
add column if not exists body_encrypted bytea,
add column if not exists encryption_key_id uuid;

-- 4. Create RPC for secure body retrieval
-- Note: This function assumes the encryption key is available via a secure configuration or vault.
-- For Phase 1, we establish the signature. Actual decryption logic will be enabled when Key Management is live.
create or replace function public.get_decrypted_email_body(p_email_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_body_encrypted bytea;
    v_user_id uuid;
    v_has_access boolean;
begin
    -- Get current user
    v_user_id := auth.uid();

    -- Check if user has access to this email (Manual RLS check for Security Definer)
    -- Reuse logic from "Email scope matrix - SELECT" policy
    select exists (
        select 1 from public.emails e
        where e.id = p_email_id
        and (
            e.user_id = v_user_id
            or exists (
                select 1 from public.email_accounts ea
                where ea.id = e.account_id and ea.user_id = v_user_id
            )
            or public.is_platform_admin(v_user_id)
            or (
                public.is_tenant_admin(v_user_id) 
                and exists (
                    select 1 from public.email_accounts ea
                    where ea.id = e.account_id 
                    and ea.tenant_id = public.get_user_tenant_id(v_user_id)
                )
            )
            or exists (
                select 1 from public.email_account_delegations ead
                where ead.account_id = e.account_id
                and ead.delegate_user_id = v_user_id
                and ead.is_active = true
                and (ead.expires_at is null or ead.expires_at > now())
            )
        )
    ) into v_has_access;

    if not v_has_access then
        raise exception 'Access denied to email %', p_email_id;
    end if;

    -- Fetch encrypted body
    select body_encrypted into v_body_encrypted
    from public.emails
    where id = p_email_id;

    if v_body_encrypted is null then
        return null;
    end if;

    -- Decryption placeholder
    -- In a real implementation: return pgp_sym_decrypt(v_body_encrypted, current_setting('app.secret_key')::text);
    return '[Encrypted Content - Key Management Pending]';
end;
$$;
