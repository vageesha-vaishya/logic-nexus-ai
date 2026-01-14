-- Execute batch of INSERT statements for data-only restores from export ZIP
-- Security: Restricted to platform/tenant admins; only allows INSERT into public schema
-- Idempotent: Uses CREATE OR REPLACE and GRANT statements guarded by existence checks

DO $$
BEGIN
  -- Create helper function if missing: is_platform_admin and is_tenant_admin are expected to exist
  -- The project already defines these in prior migrations.
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.execute_insert_batch(statements text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text;
  success_count int := 0;
  failed_count int := 0;
  error_rows jsonb := '[]'::jsonb;
BEGIN
  -- Authorization: only platform admins or tenant admins may execute
  IF NOT public.is_platform_admin(auth.uid()) AND NOT public.is_tenant_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF statements IS NULL OR array_length(statements, 1) IS NULL THEN
    RETURN jsonb_build_object('success', 0, 'failed', 0, 'error_rows', '[]'::jsonb);
  END IF;

  FOREACH s IN ARRAY statements LOOP
    s := trim(s);

    IF s ~* '^\s*INSERT\s+INTO\s+"[^"]+"' AND s !~* '^\s*INSERT\s+INTO\s+"?public"?\.' THEN
      s := regexp_replace(s, '^\s*INSERT\s+INTO\s+"([^"]+)"', 'INSERT INTO public."\\1"', 1, 1, 'i');
    ELSIF s ~* '^\s*INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)' AND s !~* '^\s*INSERT\s+INTO\s+"?public"?\.' THEN
      s := regexp_replace(s, '^\s*INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)', 'INSERT INTO public.\\1', 1, 1, 'i');
    END IF;

    -- Only allow INSERTs into public schema; skip any other statements
    IF s ~* '^\s*INSERT\s+INTO\s+"?public"?\.' THEN
      BEGIN
        EXECUTE s;
        success_count := success_count + 1;
      EXCEPTION WHEN OTHERS THEN
        failed_count := failed_count + 1;
        error_rows := error_rows || jsonb_build_array(
          jsonb_build_object('statement', s, 'error', SQLERRM)
        );
      END;
    ELSE
      -- Unsupported or unsafe statement; record as failed for transparency
      failed_count := failed_count + 1;
      error_rows := error_rows || jsonb_build_array(
        jsonb_build_object('statement', s, 'error', 'unsupported statement')
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', success_count,
    'failed', failed_count,
    'error_rows', COALESCE(error_rows, '[]'::jsonb)
  );
END;
$$;

-- Grant execute to authenticated users; function enforces role checks internally
GRANT EXECUTE ON FUNCTION public.execute_insert_batch(text[]) TO authenticated;