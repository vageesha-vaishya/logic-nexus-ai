-- Smoke: LLM Gateway P2.4 — gateway.tenant_pii_policy table + CHECK constraints.
BEGIN;

-- A1: table exists + RLS enabled
DO $$
DECLARE rls boolean;
BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='gateway' AND table_name='tenant_pii_policy';
  IF NOT FOUND THEN RAISE EXCEPTION 'gateway.tenant_pii_policy missing'; END IF;
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='gateway' AND c.relname='tenant_pii_policy';
  IF NOT rls THEN RAISE EXCEPTION 'gateway.tenant_pii_policy missing RLS'; END IF;
  RAISE NOTICE 'A1 OK';
END $$;

-- A2: defaults — strict, all 6 built-in kinds in redact_kinds, preserve_mapping=true
DO $$
DECLARE v_tenant uuid := gen_random_uuid(); v_kind text; v_redact text[]; v_pm boolean;
BEGIN
  INSERT INTO gateway.tenant_pii_policy (tenant_id) VALUES (v_tenant);
  SELECT policy_kind, redact_kinds, preserve_mapping INTO v_kind, v_redact, v_pm
    FROM gateway.tenant_pii_policy WHERE tenant_id = v_tenant;
  IF v_kind <> 'strict' THEN RAISE EXCEPTION 'default policy_kind expected=strict got=%', v_kind; END IF;
  IF array_length(v_redact, 1) <> 6 THEN RAISE EXCEPTION 'default redact_kinds expected 6 entries, got %', array_length(v_redact, 1); END IF;
  IF NOT v_pm THEN RAISE EXCEPTION 'preserve_mapping default expected true'; END IF;
  RAISE NOTICE 'A2 OK';
END $$;

-- A3: policy_kind CHECK rejects unknown
DO $$
DECLARE v_tenant uuid := gen_random_uuid();
BEGIN
  BEGIN
    INSERT INTO gateway.tenant_pii_policy (tenant_id, policy_kind) VALUES (v_tenant, 'rogue');
    RAISE EXCEPTION 'expected CHECK on policy_kind to reject "rogue"';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A3 OK';
  END;
END $$;

-- A4: pass_through_requires_consent — INSERT without consent rejected
DO $$
DECLARE v_tenant uuid := gen_random_uuid();
BEGIN
  BEGIN
    INSERT INTO gateway.tenant_pii_policy (tenant_id, policy_kind, pii_pass_through_consented_at)
      VALUES (v_tenant, 'pass_through', NULL);
    RAISE EXCEPTION 'expected pass_through_requires_consent CHECK to block missing consent';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A4 OK';
  END;
END $$;

-- A5: pass_through WITH consent accepted
DO $$
DECLARE v_tenant uuid := gen_random_uuid();
BEGIN
  INSERT INTO gateway.tenant_pii_policy (tenant_id, policy_kind, pii_pass_through_consented_at)
    VALUES (v_tenant, 'pass_through', now());
  IF NOT FOUND THEN RAISE EXCEPTION 'pass_through with consent should insert'; END IF;
  RAISE NOTICE 'A5 OK';
END $$;

ROLLBACK;
SELECT 'gateway_tenant_pii_policy OK' AS smoke_result;
