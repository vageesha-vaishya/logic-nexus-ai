-- Migration: Secure Key Management (Remove Hardcoded Keys)
-- Phase: 1 (Foundation & Zero-Trust Security)

-- Ensure Vault extension is enabled
create extension if not exists supabase_vault with schema vault;

-- 1. Update Encryption Trigger to use Vault
create or replace function public.encrypt_email_body_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    v_encryption_key text;
    v_content_to_encrypt text;
begin
    -- Get encryption key from Vault
    select decrypted_secret into v_encryption_key
    from vault.decrypted_secrets
    where name = 'app_encryption_key';

    -- Fallback to app setting (for local dev if vault not populated), but NO hardcoded string
    if v_encryption_key is null then
        v_encryption_key := current_setting('app.encryption_key', true);
    end if;

    if v_encryption_key is null then
        raise exception 'Encryption configuration error: app_encryption_key not found in Vault or settings.';
    end if;

    -- Determine content to encrypt (prefer HTML, fallback to Text)
    v_content_to_encrypt := coalesce(new.body_html, new.body_text);

    -- Only encrypt if we have content and it's not already encrypted
    if v_content_to_encrypt is not null and new.body_encrypted is null then
        new.body_encrypted := pgp_sym_encrypt(v_content_to_encrypt, v_encryption_key);
        
        -- Optional: Clear raw fields if we want strict security (Dual-write for now per plan)
        -- new.body_html := null;
        -- new.body_text := null;
    end if;

    return new;
end;
$$;

-- 2. Update Decryption RPC to use Vault
create or replace function public.get_decrypted_email_body(p_email_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    v_body_encrypted bytea;
    v_user_id uuid;
    v_has_access boolean;
    v_encryption_key text;
begin
    -- Get current user
    v_user_id := auth.uid();

    -- Check if user has access to this email (Reuse logic from Phase 1 migration)
    -- Allow Service Role (or postgres superuser) to bypass checks
    if current_setting('request.jwt.claim.role', true) = 'service_role' or current_user = 'postgres' then
        v_has_access := true;
    else
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
                    -- Phase 1.1: Check MFA if required
                    and (
                        ead.requires_mfa = false 
                        or (
                            -- Enforce strict AAL check via auth.jwt() -> 'aal' claim
                            (auth.jwt() ->> 'aal') = 'aal2'
                        )
                    )
                )
            )
        ) into v_has_access;
    end if;

    if not v_has_access then
        raise exception 'Access denied to email %. Role: %. User: %', p_email_id, coalesce(current_setting('request.jwt.claim.role', true), 'NULL'), current_user;
    end if;

    -- Fetch encrypted body
    select body_encrypted into v_body_encrypted
    from public.emails
    where id = p_email_id;

    if v_body_encrypted is null then
        -- Fallback to clear text if encryption not present (migration period)
        return (select coalesce(body_html, body_text) from public.emails where id = p_email_id);
    end if;

    -- Get encryption key from Vault
    select decrypted_secret into v_encryption_key
    from vault.decrypted_secrets
    where name = 'app_encryption_key';

    if v_encryption_key is null then
        v_encryption_key := current_setting('app.encryption_key', true);
    end if;

    if v_encryption_key is null then
        raise exception 'Encryption configuration error: app_encryption_key not found in Vault or settings.';
    end if;

    -- Decrypt
    begin
        return pgp_sym_decrypt(v_body_encrypted, v_encryption_key);
    exception when others then
        return '[Decryption Failed]: ' || SQLERRM;
    end;
end;
$$;
