-- encrypt_email_body_trigger() is SECURITY DEFINER with no search_path
-- pinned at all, so it silently depends on whatever schema search path
-- the calling role happens to have. pgcrypto (and its pgp_sym_encrypt
-- function) is installed in the `extensions` schema, not `public`, and
-- is missing from the search path the sync-emails-v2 write path uses --
-- discovered live today while testing Gmail sync end-to-end: every
-- single INSERT into public.emails from any provider (Gmail, IMAP)
-- fails with "function pgp_sym_encrypt(text, text) does not exist"
-- (Postgres error 42883), because this BEFORE INSERT/UPDATE trigger
-- fires on every row and can't resolve the function.
--
-- Fix: pin an explicit search_path, the same pattern used by every
-- other SECURITY DEFINER function touched earlier today
-- (core.enforce_secrets_vault_parity, core.enforce_vault_secret_not_referenced,
-- etc.) -- this both fixes the immediate bug and closes the
-- unpinned-search_path security gap SECURITY DEFINER functions should
-- never have. Body is otherwise byte-for-byte unchanged from the live
-- definition (confirmed via pg_get_functiondef before writing this).

CREATE OR REPLACE FUNCTION public.encrypt_email_body_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $function$
declare
    v_encryption_key text;
    v_content_to_encrypt text;
begin
    -- Get encryption key (Fallback to a default if not set in app settings)
    -- In production, this should be rotated and managed via Vault or strict env vars.
    v_encryption_key := current_setting('app.encryption_key', true);
    if v_encryption_key is null then
        v_encryption_key := 'PHASE1_DEV_MASTER_KEY_2026'; -- Secure fallback for Phase 1
    end if;

    -- Determine content to encrypt (prefer HTML, fallback to Text)
    v_content_to_encrypt := coalesce(new.body_html, new.body_text);

    -- Only encrypt if we have content and it's not already encrypted
    if v_content_to_encrypt is not null and new.body_encrypted is null then
        new.body_encrypted := pgp_sym_encrypt(v_content_to_encrypt, v_encryption_key);

        -- Optional: Clear raw fields if we want strict security (Dual-write for now per plan)
        -- new.body_html := null;
        -- new.body_text := null;

        -- Mark which key was used (for future rotation)
        -- new.encryption_key_id := ... (Skipped for Phase 1 single key)
    end if;

    return new;
end;
$function$;
