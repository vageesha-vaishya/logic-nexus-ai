-- ai_quote_cache was keyed only on request_hash (a hash of route/commodity/weight),
-- with no tenant dimension — so two tenants requesting the same lane shared cached
-- quote responses, including analysis derived from the other tenant's rates.
--
-- Safe to purge before adding NOT NULL: at time of writing all 76 rows were already
-- past expires_at, and the read path filters on expires_at > now(), so no reachable
-- data is lost.

BEGIN;

DELETE FROM public.ai_quote_cache;

ALTER TABLE public.ai_quote_cache
  ADD COLUMN tenant_id uuid NOT NULL;

ALTER TABLE public.ai_quote_cache
  ADD CONSTRAINT ai_quote_cache_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX idx_ai_quote_cache_tenant_hash
  ON public.ai_quote_cache USING btree (tenant_id, request_hash);

COMMIT;
