-- =====================================================
-- DATABASE FUNCTIONS
-- Lovable Cloud Database Backup
-- Generated: 2026-01-13
-- =====================================================

-- Note: Functions are listed in alphabetical order
-- All functions use SET search_path TO 'public' for security

-- =====================================================
-- assign_email_to_queue
-- =====================================================
CREATE OR REPLACE FUNCTION public.assign_email_to_queue(p_email_id uuid, p_queue_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_has_access BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    SELECT ur.tenant_id INTO v_tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
    LIMIT 1;

    SELECT EXISTS (
        SELECT 1 FROM public.queues q
        JOIN public.queue_members qm ON q.id = qm.queue_id
        WHERE q.name = p_queue_name
        AND q.tenant_id = v_tenant_id
        AND qm.user_id = v_user_id
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = v_user_id
            AND ur.role = 'tenant_admin'
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Access denied: User does not have access to queue %', p_queue_name;
    END IF;

    UPDATE public.emails
    SET queue = p_queue_name,
        updated_at = now()
    WHERE id = p_email_id
    AND tenant_id = v_tenant_id;

    INSERT INTO public.email_audit_log (
        email_id,
        event_type,
        event_data,
        user_id,
        tenant_id
    ) VALUES (
        p_email_id,
        'queue_assignment',
        jsonb_build_object('queue', p_queue_name, 'assigned_by', v_user_id),
        v_user_id,
        v_tenant_id
    );

    RETURN true;
END;
$function$;

-- =====================================================
-- auto_assign_version_number
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_assign_version_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.version_number IS NULL THEN
    NEW.version_number := calculate_next_version_number(NEW.quote_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- =====================================================
-- auto_generate_quote_number
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_generate_quote_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := public.generate_quote_number(NEW.tenant_id, NEW.franchise_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- =====================================================
-- calculate_dimensional_weight
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_dimensional_weight(p_length_cm numeric, p_width_cm numeric, p_height_cm numeric, p_divisor numeric DEFAULT 6000)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN p_length_cm IS NULL OR p_width_cm IS NULL OR p_height_cm IS NULL OR p_divisor <= 0 
    THEN NULL
    ELSE (p_length_cm * p_width_cm * p_height_cm) / p_divisor
  END;
$function$;

-- =====================================================
-- calculate_lead_score
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_lead_score(lead_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_score INTEGER := 0;
  lead_rec RECORD;
BEGIN
  SELECT * INTO lead_rec FROM public.leads WHERE id = lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  total_score := total_score + CASE lead_rec.status
    WHEN 'qualified' THEN 30
    WHEN 'contacted' THEN 20
    WHEN 'proposal' THEN 40
    WHEN 'negotiation' THEN 50
    WHEN 'new' THEN 10
    ELSE 0
  END;

  IF lead_rec.estimated_value IS NOT NULL THEN
    total_score := total_score + CASE
      WHEN lead_rec.estimated_value >= 100000 THEN 30
      WHEN lead_rec.estimated_value >= 50000 THEN 20
      WHEN lead_rec.estimated_value >= 10000 THEN 10
      ELSE 5
    END;
  END IF;

  IF lead_rec.last_activity_date IS NOT NULL THEN
    IF lead_rec.last_activity_date > (NOW() - INTERVAL '7 days') THEN
      total_score := total_score + 15;
    ELSIF lead_rec.last_activity_date > (NOW() - INTERVAL '30 days') THEN
      total_score := total_score + 10;
    END IF;
  END IF;

  total_score := total_score + CASE lead_rec.source
    WHEN 'referral' THEN 15
    WHEN 'website' THEN 10
    WHEN 'event' THEN 12
    ELSE 5
  END;

  RETURN total_score;
END;
$function$;

-- =====================================================
-- calculate_next_version_number
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_next_version_number(p_quote_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_max_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO v_max_version
  FROM quotation_versions
  WHERE quote_id = p_quote_id;
  
  RETURN v_max_version + 1;
END;
$function$;

-- =====================================================
-- calculate_option_margins
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_option_margins(p_option_id uuid)
 RETURNS TABLE(total_buy numeric, total_sell numeric, margin_amount numeric, margin_percentage numeric, charge_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_buy NUMERIC := 0;
  v_total_sell NUMERIC := 0;
  v_margin_amount NUMERIC := 0;
  v_margin_percentage NUMERIC := 0;
  v_charge_count INTEGER := 0;
BEGIN
  SELECT 
    COALESCE(SUM(CASE WHEN cs.code = 'BUY' THEN qc.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cs.code = 'SELL' THEN qc.amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_total_buy, v_total_sell, v_charge_count
  FROM quote_charges qc
  JOIN quotation_version_option_legs qvol ON qvol.id = qc.leg_id
  JOIN charge_sides cs ON cs.id = qc.charge_side_id
  WHERE qvol.quotation_version_option_id = p_option_id;
  
  v_margin_amount := v_total_sell - v_total_buy;
  
  IF v_total_buy > 0 THEN
    v_margin_percentage := (v_margin_amount / v_total_buy) * 100;
  ELSIF v_total_sell > 0 THEN
    v_margin_percentage := 100;
  ELSE
    v_margin_percentage := 0;
  END IF;
  
  RETURN QUERY SELECT v_total_buy, v_total_sell, v_margin_amount, v_margin_percentage, v_charge_count;
END;
$function$;

-- =====================================================
-- calculate_option_totals
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_option_totals(p_option_id uuid)
 RETURNS TABLE(leg_count integer, charge_count integer, total_buy numeric, total_sell numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT ql.id)::INTEGER as leg_count,
    COUNT(qc.id)::INTEGER as charge_count,
    COALESCE(SUM(CASE WHEN cs.code = 'BUY' THEN qc.amount ELSE 0 END), 0) as total_buy,
    COALESCE(SUM(CASE WHEN cs.code = 'SELL' THEN qc.amount ELSE 0 END), 0) as total_sell
  FROM quotation_version_options qvo
  LEFT JOIN quotation_version_option_legs ql ON ql.quotation_version_option_id = qvo.id
  LEFT JOIN quote_charges qc ON qc.leg_id = ql.id
  LEFT JOIN charge_sides cs ON cs.id = qc.charge_side_id
  WHERE qvo.id = p_option_id
  GROUP BY qvo.id;
END;
$function$;

-- =====================================================
-- check_usage_limit
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_usage_limit(_tenant_id uuid, _feature_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_usage INTEGER;
  usage_limit INTEGER;
BEGIN
  SELECT usage_count, limit_count
  INTO current_usage, usage_limit
  FROM public.usage_records
  WHERE tenant_id = _tenant_id
    AND feature_key = _feature_key
    AND period_start <= now()
    AND period_end >= now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF current_usage IS NULL THEN
    RETURN true;
  END IF;
  
  IF usage_limit IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN current_usage < usage_limit;
END;
$function$;

-- =====================================================
-- decrement_user_lead_count
-- =====================================================
CREATE OR REPLACE FUNCTION public.decrement_user_lead_count(p_user_id uuid, p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_capacity
  SET current_leads = GREATEST(0, current_leads - 1)
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
END;
$function$;

-- =====================================================
-- execute_sql_query
-- =====================================================
CREATE OR REPLACE FUNCTION public.execute_sql_query(query_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result_data jsonb;
BEGIN
  IF NOT (query_text ~* '^\s*SELECT') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  IF query_text ~* '(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result_data;
  
  RETURN COALESCE(result_data, '[]'::jsonb);
END;
$function$;

-- =====================================================
-- generate_next_option_name
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_next_option_name(p_version_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
  v_next_letter CHAR(1);
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM quotation_version_options
  WHERE quotation_version_id = p_version_id;
  
  v_next_letter := CHR(65 + v_count);
  
  RETURN 'Option ' || v_next_letter;
END;
$function$;

-- =====================================================
-- generate_quote_number
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix TEXT;
  v_reset_policy quote_reset_policy;
  v_period_key TEXT;
  v_next_seq INTEGER;
  v_quote_number TEXT;
BEGIN
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;
  
  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;
  
  v_prefix := COALESCE(v_prefix, 'QUO');
  v_reset_policy := COALESCE(v_reset_policy, 'none'::quote_reset_policy);
  
  v_period_key := CASE v_reset_policy
    WHEN 'daily' THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')
    WHEN 'monthly' THEN to_char(CURRENT_DATE, 'YYYY-MM')
    WHEN 'yearly' THEN to_char(CURRENT_DATE, 'YYYY')
    ELSE 'none'
  END;
  
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO quote_number_sequences (
      tenant_id, franchise_id, period_key, last_sequence, created_at, updated_at
    )
    VALUES (p_tenant_id, p_franchise_id, v_period_key, 1, NOW(), NOW())
    ON CONFLICT (tenant_id, franchise_id, period_key)
    WHERE franchise_id IS NOT NULL
    DO UPDATE SET
      last_sequence = quote_number_sequences.last_sequence + 1,
      updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  ELSE
    INSERT INTO quote_number_sequences (
      tenant_id, franchise_id, period_key, last_sequence, created_at, updated_at
    )
    VALUES (p_tenant_id, NULL, v_period_key, 1, NOW(), NOW())
    ON CONFLICT (tenant_id, period_key)
    WHERE franchise_id IS NULL
    DO UPDATE SET
      last_sequence = quote_number_sequences.last_sequence + 1,
      updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  END IF;
  
  v_quote_number := CASE v_reset_policy
    WHEN 'daily' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'monthly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'yearly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    ELSE v_prefix || '-' || lpad(v_next_seq::TEXT, 6, '0')
  END;
  
  RETURN v_quote_number;
END;
$function$;

-- =====================================================
-- generate_share_token
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_share_token()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ 
BEGIN 
  RETURN encode(gen_random_bytes(32), 'base64'); 
END; 
$function$;

-- =====================================================
-- get_chargeable_weight
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_chargeable_weight(p_actual_weight_kg numeric, p_volumetric_weight_kg numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
  SELECT GREATEST(
    COALESCE(p_actual_weight_kg, 0),
    COALESCE(p_volumetric_weight_kg, 0)
  );
$function$;

-- =====================================================
-- get_database_enums
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_database_enums()
 RETURNS TABLE(enum_type text, labels text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    t.typname::text AS enum_type,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)::text AS labels
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.typname
  ORDER BY t.typname;
$function$;

-- =====================================================
-- get_database_functions
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_database_functions()
 RETURNS TABLE(name text, schema text, kind text, return_type text, argument_types text, language text, volatility text, security_definer boolean, description text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- =====================================================
-- get_database_schema
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_database_schema()
 RETURNS TABLE(table_name text, column_name text, data_type text, is_nullable boolean, column_default text, is_primary_key boolean, is_foreign_key boolean, references_table text, references_column text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as is_nullable,
    c.column_default::text,
    CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key,
    CASE WHEN kcu2.table_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
    kcu2.table_name::text as references_table,
    kcu2.column_name::text as references_column
  FROM information_schema.columns c
  LEFT JOIN information_schema.key_column_usage kcu 
    ON c.table_name = kcu.table_name 
    AND c.column_name = kcu.column_name
    AND c.table_schema = kcu.table_schema
  LEFT JOIN information_schema.table_constraints tc 
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
  LEFT JOIN information_schema.referential_constraints rc 
    ON rc.constraint_name = kcu.constraint_name
    AND rc.constraint_schema = kcu.table_schema
  LEFT JOIN information_schema.key_column_usage kcu2 
    ON rc.unique_constraint_name = kcu2.constraint_name
    AND rc.unique_constraint_schema = kcu2.table_schema
  WHERE c.table_schema = 'public'
    AND c.table_name NOT IN ('spatial_ref_sys')
  ORDER BY c.table_name, c.ordinal_position;
$function$;

-- =====================================================
-- get_database_tables
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_database_tables()
 RETURNS TABLE(table_name text, table_type text, rls_enabled boolean, policy_count bigint, column_count bigint, index_count bigint, row_estimate bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- =====================================================
-- get_delegated_email_account_ids
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_delegated_email_account_ids(_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT account_id FROM public.email_account_delegations
  WHERE delegate_user_id = _user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
$function$;

-- =====================================================
-- get_franchise_user_ids
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_franchise_user_ids(_franchise_id uuid)
 RETURNS TABLE(user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.franchise_id = _franchise_id;
$function$;

-- =====================================================
-- get_platform_admins
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_platform_admins()
 RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, is_active boolean, assigned_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.is_active,
    ur.assigned_at
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'platform_admin'
    AND p.is_active = true
  ORDER BY ur.assigned_at DESC;
$function$;

-- =====================================================
-- get_queue_counts
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_queue_counts()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_tenant_id UUID;
    v_result JSON;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_tenant_id IS NULL THEN
        RETURN '{}'::json;
    END IF;

    SELECT json_object_agg(name, COALESCE(count, 0)) INTO v_result
    FROM (
        SELECT q.name, count(e.id) as count
        FROM public.queues q
        LEFT JOIN public.emails e ON q.name = e.queue AND e.tenant_id = q.tenant_id
        WHERE q.tenant_id = v_tenant_id
        GROUP BY q.name
    ) t;

    RETURN COALESCE(v_result, '{}'::json);
END;
$function$;

-- =====================================================
-- get_rls_policies
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_rls_policies()
 RETURNS TABLE(table_name text, policy_name text, command text, roles text, using_expression text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    tablename::text AS table_name,
    policyname::text AS policy_name,
    cmd::text AS command,
    roles::text,
    COALESCE(qual, with_check)::text AS using_expression
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
$function$;

-- =====================================================
-- get_rls_status
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_rls_status()
 RETURNS TABLE(table_name text, rls_enabled boolean, policy_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled,
    COUNT(p.policyname) AS policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  GROUP BY c.relname, c.relrowsecurity
  ORDER BY c.relname;
$function$;

-- =====================================================
-- get_tenant_plan_tier
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_tenant_plan_tier(_tenant_id uuid)
 RETURNS subscription_tier
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT sp.tier
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON ts.plan_id = sp.id
  WHERE ts.tenant_id = _tenant_id
    AND ts.status = 'active'
    AND sp.plan_type = 'crm_base'
  ORDER BY ts.current_period_end DESC
  LIMIT 1;
$function$;

-- =====================================================
-- get_tier_rate
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_tier_rate(p_tier_config_id uuid, p_value numeric)
 RETURNS TABLE(range_id uuid, rate numeric, currency_id uuid, min_value numeric, max_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    id,
    rate,
    currency_id,
    min_value,
    max_value
  FROM charge_tier_ranges
  WHERE tier_config_id = p_tier_config_id
    AND min_value <= p_value
    AND (max_value IS NULL OR max_value >= p_value)
  ORDER BY sort_order, min_value
  LIMIT 1;
$function$;

-- =====================================================
-- get_user_custom_permissions
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_custom_permissions(check_user_id uuid)
 RETURNS TABLE(permission_key text, access_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT crp.permission_key, crp.access_type
  FROM public.user_custom_roles ucr
  JOIN public.custom_role_permissions crp ON ucr.role_id = crp.role_id
  JOIN public.custom_roles cr ON crp.role_id = cr.id
  WHERE ucr.user_id = check_user_id
    AND cr.is_active = true
  ORDER BY crp.permission_key;
$function$;

-- =====================================================
-- get_user_franchise_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_franchise_id(check_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT franchise_id FROM public.user_roles
  WHERE user_id = check_user_id
    AND franchise_id IS NOT NULL
  LIMIT 1;
$function$;

-- =====================================================
-- get_user_tenant_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(check_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tenant_id FROM public.user_roles
  WHERE user_id = check_user_id
    AND role IN ('tenant_admin', 'franchise_admin', 'user')
  LIMIT 1;
$function$;

-- =====================================================
-- handle_new_user
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$function$;

-- =====================================================
-- has_role
-- =====================================================
CREATE OR REPLACE FUNCTION public.has_role(check_user_id uuid, check_role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = check_role
  );
$function$;

-- =====================================================
-- increment_feature_usage
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_feature_usage(_tenant_id uuid, _feature_key text, _increment integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.usage_records (
    tenant_id, feature_key, usage_count, period_start, period_end
  )
  VALUES (
    _tenant_id, _feature_key, _increment,
    date_trunc('month', now()),
    date_trunc('month', now()) + INTERVAL '1 month'
  )
  ON CONFLICT (tenant_id, feature_key, period_start)
  DO UPDATE SET
    usage_count = usage_records.usage_count + _increment,
    updated_at = now();
END;
$function$;

-- =====================================================
-- increment_user_lead_count
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_user_lead_count(p_user_id uuid, p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_capacity (user_id, tenant_id, current_leads, last_assigned_at)
  VALUES (p_user_id, p_tenant_id, 1, NOW())
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET
    current_leads = user_capacity.current_leads + 1,
    last_assigned_at = NOW();
END;
$function$;

-- =====================================================
-- is_current_user_platform_admin
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_current_user_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_platform_admin(auth.uid());
$function$;

-- =====================================================
-- is_franchise_admin
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_franchise_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'franchise_admin'
  );
$function$;

-- =====================================================
-- is_platform_admin
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = check_user_id
      AND ur.role = 'platform_admin'
      AND p.is_active = true
  );
END;
$function$;

-- =====================================================
-- is_sales_manager
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_sales_manager(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'sales_manager'
  );
$function$;

-- =====================================================
-- is_super_admin
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'platform_admin'
  );
$function$;

-- =====================================================
-- is_tenant_admin
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'tenant_admin'
  );
$function$;

-- =====================================================
-- is_viewer
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_viewer(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'viewer'
  );
$function$;

-- =====================================================
-- log_email_audit
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_email_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.email_audit_log (
      tenant_id, franchise_id, email_id, event_type, event_data, user_id
    ) VALUES (
      NEW.tenant_id, NEW.franchise_id, NEW.id, 
      CASE NEW.direction WHEN 'outbound' THEN 'sent' ELSE 'delivered' END,
      jsonb_build_object('subject', NEW.subject, 'to', NEW.to_emails),
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO public.email_audit_log (
      tenant_id, franchise_id, email_id, event_type, event_data, user_id
    ) VALUES (
      NEW.tenant_id, NEW.franchise_id, NEW.id, 
      CASE 
        WHEN NEW.status = 'failed' THEN 'failed'
        WHEN NEW.is_read AND NOT OLD.is_read THEN 'opened'
        ELSE 'delivered'
      END,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- =====================================================
-- tenant_has_feature
-- =====================================================
CREATE OR REPLACE FUNCTION public.tenant_has_feature(_tenant_id uuid, _feature_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_subscriptions ts
    JOIN public.subscription_plans sp ON ts.plan_id = sp.id
    WHERE ts.tenant_id = _tenant_id
      AND ts.status = 'active'
      AND ts.current_period_end > now()
      AND (
        sp.features @> jsonb_build_array(jsonb_build_object('key', _feature_key))
        OR sp.features @> jsonb_build_array(_feature_key)
      )
  );
$function$;

-- =====================================================
-- update_lead_score
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_lead_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.lead_score := public.calculate_lead_score(NEW.id);
  RETURN NEW;
END;
$function$;

-- =====================================================
-- update_scheduled_email_timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_scheduled_email_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Note: Additional functions exist in the database.
-- Run this query to get all functions:
-- SELECT proname, pg_get_functiondef(oid) FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
