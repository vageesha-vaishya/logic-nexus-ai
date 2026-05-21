-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515084746; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Fix: service_role had INSERT on platform.llm_usage but couldn't access the
-- bigserial sequence backing the id column, so usage rows failed to write.
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA platform TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO service_role;