-- ai_quote_cache RLS was permissive enough to leak across tenants independently
-- of ai-advisor: a {public}-role SELECT policy qualified only on expiry, plus an
-- authenticated SELECT policy qualified `true`, on a table where anon holds the
-- SELECT grant. Also drops the permissive INSERT policies -- only the edge
-- function (service_role) legitimately writes this cache.
--
-- Depends on tenant_id, added in 20260905120000.

BEGIN;

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.ai_quote_cache;
DROP POLICY IF EXISTS "Authenticated users can read cache"       ON public.ai_quote_cache;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.ai_quote_cache;
DROP POLICY IF EXISTS "Authenticated users can insert cache"       ON public.ai_quote_cache;

-- Reads: own tenant only, and only unexpired entries.
CREATE POLICY "Tenant members read own cache"
  ON public.ai_quote_cache
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND expires_at > now()
  );

-- Writes stay service-role only, via the pre-existing
-- "Service role can manage cache" policy, which is left untouched.

COMMIT;
