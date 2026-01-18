


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."account_status" AS ENUM (
    'active',
    'inactive',
    'pending'
);


ALTER TYPE "public"."account_status" OWNER TO "postgres";


CREATE TYPE "public"."account_type" AS ENUM (
    'prospect',
    'customer',
    'partner',
    'vendor'
);


ALTER TYPE "public"."account_type" OWNER TO "postgres";


CREATE TYPE "public"."activity_status" AS ENUM (
    'planned',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."activity_status" OWNER TO "postgres";


CREATE TYPE "public"."activity_type" AS ENUM (
    'call',
    'email',
    'meeting',
    'task',
    'note'
);


ALTER TYPE "public"."activity_type" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'platform_admin',
    'tenant_admin',
    'franchise_admin',
    'user',
    'sales_manager',
    'viewer'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."billing_period" AS ENUM (
    'monthly',
    'annual'
);


ALTER TYPE "public"."billing_period" OWNER TO "postgres";


CREATE TYPE "public"."compliance_status" AS ENUM (
    'pass',
    'warn',
    'fail'
);


ALTER TYPE "public"."compliance_status" OWNER TO "postgres";


CREATE TYPE "public"."container_type" AS ENUM (
    '20ft_standard',
    '40ft_standard',
    '40ft_high_cube',
    '45ft_high_cube',
    'reefer',
    'open_top',
    'flat_rack',
    'tank'
);


ALTER TYPE "public"."container_type" OWNER TO "postgres";


CREATE TYPE "public"."contract_type" AS ENUM (
    'spot',
    'contracted'
);


ALTER TYPE "public"."contract_type" OWNER TO "postgres";


CREATE TYPE "public"."document_type" AS ENUM (
    'commercial_invoice',
    'bill_of_lading',
    'air_waybill',
    'packing_list',
    'customs_form',
    'quote_pdf',
    'proof_of_delivery'
);


ALTER TYPE "public"."document_type" OWNER TO "postgres";


CREATE TYPE "public"."lead_source" AS ENUM (
    'website',
    'referral',
    'email',
    'phone',
    'social',
    'event',
    'other'
);


ALTER TYPE "public"."lead_source" OWNER TO "postgres";


CREATE TYPE "public"."lead_status" AS ENUM (
    'new',
    'contacted',
    'qualified',
    'proposal',
    'negotiation',
    'won',
    'lost',
    'converted'
);


ALTER TYPE "public"."lead_status" OWNER TO "postgres";


CREATE TYPE "public"."opportunity_stage" AS ENUM (
    'prospecting',
    'qualification',
    'needs_analysis',
    'value_proposition',
    'proposal',
    'negotiation',
    'closed_won',
    'closed_lost'
);


ALTER TYPE "public"."opportunity_stage" OWNER TO "postgres";


CREATE TYPE "public"."plan_type" AS ENUM (
    'crm_base',
    'service_addon',
    'bundle'
);


ALTER TYPE "public"."plan_type" OWNER TO "postgres";


CREATE TYPE "public"."priority_level" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE "public"."priority_level" OWNER TO "postgres";


CREATE TYPE "public"."quote_reset_policy" AS ENUM (
    'none',
    'daily',
    'monthly',
    'yearly'
);


ALTER TYPE "public"."quote_reset_policy" OWNER TO "postgres";


CREATE TYPE "public"."quote_status" AS ENUM (
    'draft',
    'sent',
    'accepted',
    'expired',
    'cancelled'
);


ALTER TYPE "public"."quote_status" OWNER TO "postgres";


CREATE TYPE "public"."shipment_status" AS ENUM (
    'draft',
    'confirmed',
    'in_transit',
    'customs',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'on_hold',
    'returned'
);


ALTER TYPE "public"."shipment_status" OWNER TO "postgres";


CREATE TYPE "public"."shipment_type" AS ENUM (
    'ocean_freight',
    'air_freight',
    'inland_trucking',
    'railway_transport',
    'courier',
    'movers_packers'
);


ALTER TYPE "public"."shipment_type" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'active',
    'trial',
    'past_due',
    'canceled',
    'expired'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_tier" AS ENUM (
    'free',
    'basic',
    'starter',
    'business',
    'professional',
    'enterprise'
);


ALTER TYPE "public"."subscription_tier" OWNER TO "postgres";


CREATE TYPE "public"."tracking_event_type" AS ENUM (
    'created',
    'confirmed',
    'picked_up',
    'in_transit',
    'customs_clearance',
    'customs_released',
    'arrived_at_hub',
    'out_for_delivery',
    'delivered',
    'delayed',
    'exception',
    'returned'
);


ALTER TYPE "public"."tracking_event_type" OWNER TO "postgres";


CREATE TYPE "public"."transfer_entity_type" AS ENUM (
    'lead',
    'opportunity',
    'quote',
    'shipment',
    'account',
    'contact',
    'activity'
);


ALTER TYPE "public"."transfer_entity_type" OWNER TO "postgres";


CREATE TYPE "public"."transfer_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'completed',
    'failed'
);


ALTER TYPE "public"."transfer_status" OWNER TO "postgres";


CREATE TYPE "public"."transfer_type" AS ENUM (
    'tenant_to_tenant',
    'tenant_to_franchise',
    'franchise_to_franchise'
);


ALTER TYPE "public"."transfer_type" OWNER TO "postgres";


CREATE TYPE "public"."transport_mode" AS ENUM (
    'ocean',
    'air',
    'inland_trucking',
    'courier',
    'movers_packers'
);


ALTER TYPE "public"."transport_mode" OWNER TO "postgres";


CREATE TYPE "public"."vehicle_status" AS ENUM (
    'available',
    'in_use',
    'maintenance',
    'out_of_service'
);


ALTER TYPE "public"."vehicle_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_current_reset_bucket"("p_policy" "text") RETURNS "text"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."_current_reset_bucket"("p_policy" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_quote_by_token"("p_token" "text", "p_decision" "text", "p_name" "text", "p_email" "text", "p_ip" "text", "p_user_agent" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_token_record RECORD;
  v_quote_record RECORD;
  v_recent RECORD;
BEGIN
  SELECT * INTO v_token_record
  FROM public.portal_tokens
  WHERE token = p_token
    AND expires_at > NOW();

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired token');
  END IF;

  SELECT * INTO v_recent
  FROM public.quote_acceptances
  WHERE token_id = v_token_record.id
    AND decided_at > NOW() - INTERVAL '60 seconds'
  LIMIT 1;

  IF v_recent IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Please wait before submitting again');
  END IF;

  SELECT * INTO v_quote_record
  FROM public.quotes
  WHERE id = v_token_record.quote_id;

  INSERT INTO public.quote_acceptances(
    quote_id, token_id, decision, name, email, ip_address, user_agent
  ) VALUES (
    v_token_record.quote_id, v_token_record.id, p_decision, p_name, p_email, p_ip, p_user_agent
  );

  UPDATE public.portal_tokens
  SET accessed_at = NOW(),
      access_count = COALESCE(access_count, 0) + 1,
      last_ip = p_ip,
      last_user_agent = p_user_agent
  WHERE id = v_token_record.id;

  IF p_decision = 'accepted' THEN
    UPDATE public.quotes
    SET status = 'accepted'
    WHERE id = v_token_record.quote_id
      AND status <> 'accepted';
  END IF;

  RETURN jsonb_build_object('success', true, 'quote_id', v_token_record.quote_id, 'decision', p_decision);
END;
$$;


ALTER FUNCTION "public"."accept_quote_by_token"("p_token" "text", "p_decision" "text", "p_name" "text", "p_email" "text", "p_ip" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_franchisee_account_contact"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_account_data" "jsonb", "p_contact_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_account_id UUID;
  v_contact_id UUID;
  v_tenant_exists BOOLEAN;
  v_franchise_exists BOOLEAN;
  v_account_name TEXT;
  v_contact_email TEXT;
  v_contact_first_name TEXT;
  v_contact_last_name TEXT;
  v_actor UUID;
BEGIN
  v_actor := auth.uid();

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Authorization: platform admin OR member of the tenant
  IF NOT (
    public.is_platform_admin(v_actor)
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.tenant_id = p_tenant_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for tenant %', p_tenant_id;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) INTO v_tenant_exists;
  IF NOT v_tenant_exists THEN
    RAISE EXCEPTION 'Tenant with ID % does not exist', p_tenant_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.franchises
    WHERE id = p_franchise_id AND tenant_id = p_tenant_id
  ) INTO v_franchise_exists;
  IF NOT v_franchise_exists THEN
    RAISE EXCEPTION 'Franchise with ID % does not exist or does not belong to Tenant %', p_franchise_id, p_tenant_id;
  END IF;

  v_account_name := p_account_data->>'name';
  IF v_account_name IS NULL OR v_account_name = '' THEN
    RAISE EXCEPTION 'Account name is required';
  END IF;

  IF NULLIF(p_account_data->>'id','') IS NOT NULL THEN
    v_account_id := (p_account_data->>'id')::UUID;

    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = v_account_id AND tenant_id = p_tenant_id) THEN
      RAISE EXCEPTION 'Account ID % not found in Tenant %', v_account_id, p_tenant_id;
    END IF;

    UPDATE public.accounts
    SET franchise_id = p_franchise_id,
        updated_at = now()
    WHERE id = v_account_id;
  ELSE
    SELECT id INTO v_account_id
    FROM public.accounts
    WHERE tenant_id = p_tenant_id AND name = v_account_name
    LIMIT 1;

    IF v_account_id IS NOT NULL THEN
      UPDATE public.accounts
      SET franchise_id = p_franchise_id, updated_at = now()
      WHERE id = v_account_id;
    ELSE
      INSERT INTO public.accounts (
        tenant_id, franchise_id, name,
        industry, website, phone, email,
        billing_address, shipping_address,
        created_by
      ) VALUES (
        p_tenant_id,
        p_franchise_id,
        v_account_name,
        p_account_data->>'industry',
        p_account_data->>'website',
        p_account_data->>'phone',
        p_account_data->>'email',
        p_account_data->'billing_address',
        p_account_data->'shipping_address',
        COALESCE(NULLIF(p_account_data->>'created_by','')::UUID, v_actor)
      ) RETURNING id INTO v_account_id;
    END IF;
  END IF;

  v_contact_email := p_contact_data->>'email';
  v_contact_first_name := p_contact_data->>'first_name';
  v_contact_last_name := p_contact_data->>'last_name';

  IF v_contact_first_name IS NULL OR v_contact_last_name IS NULL THEN
    RAISE EXCEPTION 'Contact first_name and last_name are required';
  END IF;

  IF NULLIF(p_contact_data->>'id','') IS NOT NULL THEN
    v_contact_id := (p_contact_data->>'id')::UUID;

    IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = v_contact_id AND tenant_id = p_tenant_id) THEN
      RAISE EXCEPTION 'Contact ID % not found in Tenant %', v_contact_id, p_tenant_id;
    END IF;

    UPDATE public.contacts
    SET franchise_id = p_franchise_id,
        account_id = v_account_id,
        updated_at = now()
    WHERE id = v_contact_id;
  ELSE
    IF v_contact_email IS NOT NULL AND v_contact_email <> '' THEN
      SELECT id INTO v_contact_id
      FROM public.contacts
      WHERE tenant_id = p_tenant_id AND email = v_contact_email
      LIMIT 1;
    END IF;

    IF v_contact_id IS NOT NULL THEN
      UPDATE public.contacts
      SET franchise_id = p_franchise_id,
          account_id = v_account_id,
          updated_at = now()
      WHERE id = v_contact_id;
    ELSE
      INSERT INTO public.contacts (
        tenant_id, franchise_id, account_id,
        first_name, last_name, email, phone, mobile, title,
        created_by
      ) VALUES (
        p_tenant_id,
        p_franchise_id,
        v_account_id,
        v_contact_first_name,
        v_contact_last_name,
        v_contact_email,
        p_contact_data->>'phone',
        p_contact_data->>'mobile',
        p_contact_data->>'title',
        COALESCE(NULLIF(p_contact_data->>'created_by','')::UUID, v_actor)
      ) RETURNING id INTO v_contact_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'franchise_id', p_franchise_id,
    'account_id', v_account_id,
    'contact_id', v_contact_id,
    'message', 'Successfully assigned Account and Contact to Franchisee'
  );
END;
$$;


ALTER FUNCTION "public"."assign_franchisee_account_contact"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_account_data" "jsonb", "p_contact_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_lead_with_transaction"("p_lead_id" "uuid", "p_assigned_to" "uuid", "p_assignment_method" "text", "p_rule_id" "uuid", "p_tenant_id" "uuid", "p_franchise_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Start transaction
  begin
    -- Update lead owner
    update leads
    set owner_id = p_assigned_to
    where id = p_lead_id;

    -- Record assignment history
    insert into lead_assignment_history (
      lead_id,
      assigned_to,
      assignment_method,
      rule_id,
      tenant_id,
      franchise_id,
      assigned_by
    ) values (
      p_lead_id,
      p_assigned_to,
      p_assignment_method,
      p_rule_id,
      p_tenant_id,
      p_franchise_id,
      null -- automated assignment
    );

    -- Update user capacity
    update user_capacity
    set 
      current_leads = current_leads + 1,
      last_assigned_at = now()
    where user_id = p_assigned_to
    and tenant_id = p_tenant_id;

    -- Commit transaction
    commit;
  exception
    when others then
      -- Rollback transaction on error
      rollback;
      raise;
  end;
end;
$$;


ALTER FUNCTION "public"."assign_lead_with_transaction"("p_lead_id" "uuid", "p_assigned_to" "uuid", "p_assignment_method" "text", "p_rule_id" "uuid", "p_tenant_id" "uuid", "p_franchise_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_assign_version_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    NEW.version_number := calculate_next_version_number(NEW.quote_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_assign_version_number"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_assign_version_number"() IS 'Automatically assigns version numbers to new quotation versions';



CREATE OR REPLACE FUNCTION "public"."auto_generate_quote_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only generate if quote_number is not already set
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := public.generate_quote_number(NEW.tenant_id, NEW.franchise_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_generate_quote_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_dimensional_weight"("p_length_cm" numeric, "p_width_cm" numeric, "p_height_cm" numeric, "p_divisor" numeric DEFAULT 6000) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE 
    WHEN p_length_cm IS NULL OR p_width_cm IS NULL OR p_height_cm IS NULL OR p_divisor <= 0 
    THEN NULL
    ELSE (p_length_cm * p_width_cm * p_height_cm) / p_divisor
  END;
$$;


ALTER FUNCTION "public"."calculate_dimensional_weight"("p_length_cm" numeric, "p_width_cm" numeric, "p_height_cm" numeric, "p_divisor" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_dimensional_weight"("p_length_cm" numeric, "p_width_cm" numeric, "p_height_cm" numeric, "p_divisor" numeric) IS 'Calculates volumetric weight: (L×W×H)/divisor';



CREATE OR REPLACE FUNCTION "public"."calculate_lead_score"("lead_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  total_score INTEGER := 0;
  lead_rec RECORD;
BEGIN
  SELECT * INTO lead_rec FROM public.leads WHERE id = lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Score based on status
  total_score := total_score + CASE lead_rec.status
    WHEN 'qualified' THEN 30
    WHEN 'contacted' THEN 20
    WHEN 'proposal' THEN 40
    WHEN 'negotiation' THEN 50
    WHEN 'new' THEN 10
    ELSE 0
  END;

  -- Score based on estimated value
  IF lead_rec.estimated_value IS NOT NULL THEN
    total_score := total_score + CASE
      WHEN lead_rec.estimated_value >= 100000 THEN 30
      WHEN lead_rec.estimated_value >= 50000 THEN 20
      WHEN lead_rec.estimated_value >= 10000 THEN 10
      ELSE 5
    END;
  END IF;

  -- Score based on recent activity
  IF lead_rec.last_activity_date IS NOT NULL THEN
    IF lead_rec.last_activity_date > (NOW() - INTERVAL '7 days') THEN
      total_score := total_score + 15;
    ELSIF lead_rec.last_activity_date > (NOW() - INTERVAL '30 days') THEN
      total_score := total_score + 10;
    END IF;
  END IF;

  -- Score based on source
  total_score := total_score + CASE lead_rec.source
    WHEN 'referral' THEN 15
    WHEN 'website' THEN 10
    WHEN 'event' THEN 12
    ELSE 5
  END;

  RETURN total_score;
END;
$$;


ALTER FUNCTION "public"."calculate_lead_score"("lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_next_version_number"("p_quote_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_max_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO v_max_version
  FROM quotation_versions
  WHERE quote_id = p_quote_id;
  
  RETURN v_max_version + 1;
END;
$$;


ALTER FUNCTION "public"."calculate_next_version_number"("p_quote_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_next_version_number"("p_quote_id" "uuid") IS 'Calculates the next version number for a quote';



CREATE OR REPLACE FUNCTION "public"."calculate_option_margins"("p_option_id" "uuid") RETURNS TABLE("total_buy" numeric, "total_sell" numeric, "margin_amount" numeric, "margin_percentage" numeric, "charge_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total_buy NUMERIC := 0;
  v_total_sell NUMERIC := 0;
  v_margin_amount NUMERIC := 0;
  v_margin_percentage NUMERIC := 0;
  v_charge_count INTEGER := 0;
BEGIN
  -- Calculate totals from charges
  SELECT 
    COALESCE(SUM(CASE WHEN cs.code = 'BUY' THEN qc.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cs.code = 'SELL' THEN qc.amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_total_buy, v_total_sell, v_charge_count
  FROM quote_charges qc
  JOIN quotation_version_option_legs qvol ON qvol.id = qc.leg_id
  JOIN charge_sides cs ON cs.id = qc.charge_side_id
  WHERE qvol.quotation_version_option_id = p_option_id;
  
  -- Calculate margin
  v_margin_amount := v_total_sell - v_total_buy;
  
  -- Calculate margin percentage (avoid division by zero)
  IF v_total_buy > 0 THEN
    v_margin_percentage := (v_margin_amount / v_total_buy) * 100;
  ELSIF v_total_sell > 0 THEN
    v_margin_percentage := 100; -- 100% margin if no cost
  ELSE
    v_margin_percentage := 0;
  END IF;
  
  RETURN QUERY SELECT v_total_buy, v_total_sell, v_margin_amount, v_margin_percentage, v_charge_count;
END;
$$;


ALTER FUNCTION "public"."calculate_option_margins"("p_option_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_option_margins"("p_option_id" "uuid") IS 'Calculates buy/sell totals and margins for a quotation option';



CREATE OR REPLACE FUNCTION "public"."calculate_option_totals"("p_option_id" "uuid") RETURNS TABLE("leg_count" integer, "charge_count" integer, "total_buy" numeric, "total_sell" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."calculate_option_totals"("p_option_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_usage_limit"("_tenant_id" "uuid", "_feature_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_usage INTEGER;
  usage_limit INTEGER;
BEGIN
  -- Get current usage for the current period
  SELECT usage_count, limit_count
  INTO current_usage, usage_limit
  FROM public.usage_records
  WHERE tenant_id = _tenant_id
    AND feature_key = _feature_key
    AND period_start <= now()
    AND period_end >= now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no usage record exists, assume allowed
  IF current_usage IS NULL THEN
    RETURN true;
  END IF;
  
  -- If no limit set, assume unlimited
  IF usage_limit IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if under limit
  RETURN current_usage < usage_limit;
END;
$$;


ALTER FUNCTION "public"."check_usage_limit"("_tenant_id" "uuid", "_feature_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_logs"("days_to_keep" integer DEFAULT 90) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Delete logs older than the specified retention period
  DELETE FROM audit_logs
  WHERE created_at < now() - (days_to_keep || ' days')::interval;
  
  -- Log the cleanup action (optional, into a separate system log if needed, or just console output if run manually)
  RAISE NOTICE 'Deleted audit logs older than % days', days_to_keep;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_logs"("days_to_keep" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compare_versions"("p_version_id_1" "uuid", "p_version_id_2" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_comparison JSONB;
  v_version_1 RECORD;
  v_version_2 RECORD;
BEGIN
  -- Get version details
  SELECT * INTO v_version_1 FROM quotation_versions WHERE id = p_version_id_1;
  SELECT * INTO v_version_2 FROM quotation_versions WHERE id = p_version_id_2;
  
  v_comparison := jsonb_build_object(
    'version_1', row_to_json(v_version_1),
    'version_2', row_to_json(v_version_2),
    'differences', jsonb_build_object(
      'status_changed', v_version_1.status != v_version_2.status,
      'created_at_diff', EXTRACT(EPOCH FROM (v_version_2.created_at - v_version_1.created_at))
    )
  );
  
  RETURN v_comparison;
END;
$$;


ALTER FUNCTION "public"."compare_versions"("p_version_id_1" "uuid", "p_version_id_2" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."compare_versions"("p_version_id_1" "uuid", "p_version_id_2" "uuid") IS 'Compares two versions and returns differences';



CREATE OR REPLACE FUNCTION "public"."create_quote_share"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_expires_in_days" integer DEFAULT 30) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO quote_shares (tenant_id, quote_id, share_token, expires_at)
  VALUES (p_tenant_id, p_quote_id, generate_share_token(), now() + (COALESCE(p_expires_in_days, 30) || ' days')::INTERVAL)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;


ALTER FUNCTION "public"."create_quote_share"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_expires_in_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.user_capacity
  SET current_leads = GREATEST(0, current_leads - 1)
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
END;
$$;


ALTER FUNCTION "public"."decrement_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_primary_quote"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_primary IS TRUE AND NEW.opportunity_id IS NOT NULL THEN
    -- Demote other primary quotes for this opportunity
    UPDATE public.quotes q
      SET is_primary = FALSE
    WHERE q.opportunity_id = NEW.opportunity_id
      AND q.id <> NEW.id
      AND q.is_primary IS TRUE;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_primary_quote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evaluate_provider_rate_rules"("p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_quote_data" "jsonb") RETURNS TABLE("rule_id" "uuid", "rule_name" "text", "rule_type" "text", "actions" "jsonb", "validation_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    prr.id,
    prr.rule_name,
    prr.rule_type,
    prr.actions,
    prr.validation_message
  FROM provider_rate_rules prr
  WHERE 
    prr.carrier_id = p_carrier_id
    AND (prr.service_type_id IS NULL OR prr.service_type_id = p_service_type_id)
    AND prr.is_active = true
    -- Note: Actual condition evaluation would be done in application logic
  ORDER BY prr.priority ASC;
END;
$$;


ALTER FUNCTION "public"."evaluate_provider_rate_rules"("p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_quote_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."execute_sql_query"("query_text" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result_data jsonb;
BEGIN
  -- Only allow SELECT queries
  IF NOT (query_text ~* '^\s*SELECT') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block any mutations
  IF query_text ~* '(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Execute the query and return as JSON
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result_data;
  
  RETURN COALESCE(result_data, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."execute_sql_query"("query_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."execute_transfer"("p_transfer_id" "uuid", "p_approver_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_success_count INT := 0;
  v_fail_count INT := 0;
  v_error_msg TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF auth.uid() <> p_approver_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Approver mismatch');
  END IF;

  SELECT * INTO v_transfer FROM public.entity_transfers WHERE id = p_transfer_id;

  IF v_transfer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transfer not found');
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transfer is not pending');
  END IF;

  -- Authorization: platform admin OR member of target tenant
  IF NOT (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = v_transfer.target_tenant_id
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized to approve this transfer');
  END IF;

  -- Mark approved (then completed after processing)
  UPDATE public.entity_transfers
  SET approved_by = p_approver_id,
      status = 'approved',
      updated_at = now()
  WHERE id = p_transfer_id;

  FOR v_item IN SELECT * FROM public.entity_transfer_items WHERE transfer_id = p_transfer_id LOOP
    BEGIN
      CASE v_item.entity_type
        WHEN 'lead' THEN
          UPDATE public.leads
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'opportunity' THEN
          UPDATE public.opportunities
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'quote' THEN
          UPDATE public.quotes
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'shipment' THEN
          UPDATE public.shipments
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'account' THEN
          UPDATE public.accounts
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'contact' THEN
          UPDATE public.contacts
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'activity' THEN
          UPDATE public.activities
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        ELSE
          RAISE EXCEPTION 'Unknown entity type: %', v_item.entity_type;
      END CASE;

      UPDATE public.entity_transfer_items
      SET status = 'completed', updated_at = now(), error_message = NULL
      WHERE id = v_item.id;

      v_success_count := v_success_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_fail_count := v_fail_count + 1;
      v_error_msg := SQLERRM;

      UPDATE public.entity_transfer_items
      SET status = 'failed', error_message = v_error_msg, updated_at = now()
      WHERE id = v_item.id;
    END;
  END LOOP;

  UPDATE public.entity_transfers
  SET status = 'completed', updated_at = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_success_count + v_fail_count,
    'succeeded', v_success_count,
    'failed', v_fail_count
  );
END;
$$;


ALTER FUNCTION "public"."execute_transfer"("p_transfer_id" "uuid", "p_approver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_next_option_name"("p_version_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
  v_next_letter CHAR(1);
BEGIN
  -- Count existing options for this version
  SELECT COUNT(*) INTO v_count
  FROM quotation_version_options
  WHERE quotation_version_id = p_version_id;
  
  -- Generate letter: A=65 in ASCII, so A is 0, B is 1, etc.
  v_next_letter := CHR(65 + v_count);
  
  RETURN 'Option ' || v_next_letter;
END;
$$;


ALTER FUNCTION "public"."generate_next_option_name"("p_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."generate_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid") IS 'Generates quote_number as <PREFIX(3)><YY><MM><DD><SEQ(8)>, with franchise override and atomic per-tenant/franchise sequence.';



CREATE OR REPLACE FUNCTION "public"."generate_share_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ BEGIN RETURN encode(gen_random_bytes(32), 'base64'); END; $$;


ALTER FUNCTION "public"."generate_share_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_applicable_provider_surcharges"("p_carrier_id" "uuid", "p_service_type" "text", "p_weight_kg" numeric, "p_country_code" "text" DEFAULT NULL::"text", "p_is_hazmat" boolean DEFAULT false, "p_is_temperature_controlled" boolean DEFAULT false) RETURNS TABLE("surcharge_id" "uuid", "surcharge_code" "text", "surcharge_name" "text", "calculation_type" "text", "rate" numeric, "currency_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.surcharge_code,
    ps.surcharge_name,
    ps.calculation_type,
    ps.rate,
    c.code as currency_code
  FROM provider_surcharges ps
  LEFT JOIN currencies c ON c.id = ps.currency_id
  WHERE 
    ps.carrier_id = p_carrier_id
    AND ps.is_active = true
    AND now() BETWEEN ps.effective_from AND COALESCE(ps.effective_until, 'infinity'::timestamp)
    AND (
      ps.applies_to_service_types IS NULL 
      OR p_service_type = ANY(ps.applies_to_service_types)
    )
    AND (
      ps.applies_to_weight_range IS NULL
      OR (
        p_weight_kg >= COALESCE((ps.applies_to_weight_range->>'min')::numeric, 0)
        AND p_weight_kg <= COALESCE((ps.applies_to_weight_range->>'max')::numeric, 999999)
      )
    )
    AND (
      ps.applies_to_countries IS NULL
      OR p_country_code = ANY(ps.applies_to_countries)
    )
    AND (
      NOT ps.requires_hazmat OR p_is_hazmat
    )
    AND (
      NOT ps.requires_temperature_control OR p_is_temperature_controlled
    )
  ORDER BY ps.surcharge_code;
END;
$$;


ALTER FUNCTION "public"."get_applicable_provider_surcharges"("p_carrier_id" "uuid", "p_service_type" "text", "p_weight_kg" numeric, "p_country_code" "text", "p_is_hazmat" boolean, "p_is_temperature_controlled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chargeable_weight"("p_actual_weight_kg" numeric, "p_volumetric_weight_kg" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  SELECT GREATEST(
    COALESCE(p_actual_weight_kg, 0),
    COALESCE(p_volumetric_weight_kg, 0)
  );
$$;


ALTER FUNCTION "public"."get_chargeable_weight"("p_actual_weight_kg" numeric, "p_volumetric_weight_kg" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_chargeable_weight"("p_actual_weight_kg" numeric, "p_volumetric_weight_kg" numeric) IS 'Returns the greater of actual weight or volumetric weight';



CREATE OR REPLACE FUNCTION "public"."get_database_enums"() RETURNS TABLE("enum_type" "text", "labels" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    t.typname::text AS enum_type,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)::text AS labels
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.typname
  ORDER BY t.typname;
$$;


ALTER FUNCTION "public"."get_database_enums"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_database_functions"() RETURNS TABLE("name" "text", "schema" "text", "kind" "text", "return_type" "text", "argument_types" "text", "language" "text", "volatility" "text", "security_definer" boolean, "description" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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
$$;


ALTER FUNCTION "public"."get_database_functions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_database_functions_with_body"() RETURNS TABLE("name" "text", "schema" "text", "kind" "text", "return_type" "text", "argument_types" "text", "language" "text", "volatility" "text", "security_definer" boolean, "description" "text", "function_definition" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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
$$;


ALTER FUNCTION "public"."get_database_functions_with_body"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_database_schema"() RETURNS TABLE("table_name" "text", "column_name" "text", "data_type" "text", "is_nullable" boolean, "column_default" "text", "is_primary_key" boolean, "is_foreign_key" boolean, "references_table" "text", "references_column" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_database_schema"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_database_tables"() RETURNS TABLE("table_name" "text", "table_type" "text", "rls_enabled" boolean, "policy_count" bigint, "column_count" bigint, "index_count" bigint, "row_estimate" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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
$$;


ALTER FUNCTION "public"."get_database_tables"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_franchise_user_ids"("_franchise_id" "uuid") RETURNS TABLE("user_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.franchise_id = _franchise_id;
$$;


ALTER FUNCTION "public"."get_franchise_user_ids"("_franchise_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_admins"() RETURNS TABLE("user_id" "uuid", "email" "text", "first_name" "text", "last_name" "text", "is_active" boolean, "assigned_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_platform_admins"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_platform_admins"() IS 'Get list of all active platform administrators';



CREATE OR REPLACE FUNCTION "public"."get_quote_by_token"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_token_record RECORD;
  v_quote_record RECORD;
BEGIN
  SELECT * INTO v_token_record
  FROM public.portal_tokens
  WHERE token = p_token
    AND expires_at > NOW();

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired token');
  END IF;

  IF v_token_record.accessed_at IS NOT NULL AND (NOW() - v_token_record.accessed_at) < INTERVAL '5 seconds' THEN
    RETURN jsonb_build_object('error', 'Rate limit exceeded, please wait a moment');
  END IF;

  UPDATE public.portal_tokens
  SET accessed_at = NOW()
  WHERE id = v_token_record.id;

  UPDATE public.portal_tokens
  SET access_count = COALESCE(access_count, 0) + 1
  WHERE id = v_token_record.id;

  SELECT * INTO v_quote_record
  FROM public.quotes
  WHERE id = v_token_record.quote_id;

  IF v_token_record.tenant_id IS NULL AND v_quote_record IS NOT NULL THEN
    UPDATE public.portal_tokens SET tenant_id = v_quote_record.tenant_id WHERE id = v_token_record.id;
  END IF;

  IF (SELECT access_count FROM public.portal_tokens WHERE id = v_token_record.id) > 50 THEN
    UPDATE public.portal_tokens SET flagged = true WHERE id = v_token_record.id;
  END IF;

  RETURN jsonb_build_object(
    'quote', row_to_json(v_quote_record),
    'token_id', v_token_record.id
  );
END;
$$;


ALTER FUNCTION "public"."get_quote_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rls_policies"() RETURNS TABLE("table_name" "text", "policy_name" "text", "command" "text", "roles" "text", "using_expression" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    tablename::text AS table_name,
    policyname::text AS policy_name,
    cmd::text AS command,
    roles::text,
    COALESCE(qual, with_check)::text AS using_expression
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
$$;


ALTER FUNCTION "public"."get_rls_policies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rls_status"() RETURNS TABLE("table_name" "text", "rls_enabled" boolean, "policy_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_rls_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sales_manager_team_user_ids"("_manager_id" "uuid") RETURNS TABLE("user_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.franchise_id IN (
    SELECT ur2.franchise_id 
    FROM public.user_roles ur2 
    WHERE ur2.user_id = _manager_id 
    AND ur2.role = 'sales_manager'
    AND ur2.franchise_id IS NOT NULL
  )
  AND ur.role IN ('user', 'sales_manager', 'viewer')
  UNION
  SELECT _manager_id;
$$;


ALTER FUNCTION "public"."get_sales_manager_team_user_ids"("_manager_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_table_constraints"() RETURNS TABLE("table_name" "text", "constraint_name" "text", "constraint_type" "text", "constraint_details" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    tc.table_name::text,
    tc.constraint_name::text,
    tc.constraint_type::text,
    COALESCE(
      string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position),
      cc.check_clause
    )::text AS constraint_details
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    AND tc.table_name = kcu.table_name
  LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
  WHERE tc.table_schema = 'public'
  GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type, cc.check_clause
  ORDER BY tc.table_name, tc.constraint_name;
$$;


ALTER FUNCTION "public"."get_table_constraints"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_table_indexes"() RETURNS TABLE("table_name" "text", "index_name" "text", "is_unique" boolean, "index_columns" "text", "index_definition" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    t.relname::text AS table_name,
    i.relname::text AS index_name,
    ix.indisunique AS is_unique,
    string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey, a.attnum))::text AS index_columns,
    pg_get_indexdef(ix.indexrelid)::text AS index_definition
  FROM pg_index ix
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  WHERE n.nspname = 'public'
    AND t.relkind = 'r'
  GROUP BY t.relname, i.relname, ix.indisunique, ix.indexrelid
  ORDER BY t.relname, i.relname;
$$;


ALTER FUNCTION "public"."get_table_indexes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_plan_tier"("_tenant_id" "uuid") RETURNS "public"."subscription_tier"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT sp.tier
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON ts.plan_id = sp.id
  WHERE ts.tenant_id = _tenant_id
    AND ts.status = 'active'
    AND sp.plan_type = 'crm_base'
  ORDER BY ts.current_period_end DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_tenant_plan_tier"("_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tier_rate"("p_tier_config_id" "uuid", "p_value" numeric) RETURNS TABLE("range_id" "uuid", "rate" numeric, "currency_id" "uuid", "min_value" numeric, "max_value" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_tier_rate"("p_tier_config_id" "uuid", "p_value" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_tier_rate"("p_tier_config_id" "uuid", "p_value" numeric) IS 'Returns the applicable tier rate for a given value';



CREATE OR REPLACE FUNCTION "public"."get_user_custom_permissions"("check_user_id" "uuid") RETURNS TABLE("permission_key" "text", "access_type" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT crp.permission_key, crp.access_type
  FROM public.user_custom_roles ucr
  JOIN public.custom_role_permissions crp ON ucr.role_id = crp.role_id
  JOIN public.custom_roles cr ON crp.role_id = cr.id
  WHERE ucr.user_id = check_user_id
    AND cr.is_active = true
  ORDER BY crp.permission_key;
$$;


ALTER FUNCTION "public"."get_user_custom_permissions"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_franchise_id"("check_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT franchise_id FROM public.user_roles
  WHERE user_id = check_user_id
    AND role IN ('franchise_admin', 'user')
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_franchise_id"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tenant_id"("check_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT tenant_id FROM public.user_roles
  WHERE user_id = check_user_id
    AND role IN ('tenant_admin', 'franchise_admin', 'user')
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_tenant_id"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_weight_break_rate"("p_tenant_id" "uuid", "p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_weight_kg" numeric, "p_effective_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("id" "uuid", "rate_per_kg" numeric, "currency_id" "uuid", "min_weight_kg" numeric, "max_weight_kg" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    id,
    rate_per_kg,
    currency_id,
    min_weight_kg,
    max_weight_kg
  FROM charge_weight_breaks
  WHERE tenant_id = p_tenant_id
    AND (carrier_id = p_carrier_id OR carrier_id IS NULL)
    AND (service_type_id = p_service_type_id OR service_type_id IS NULL)
    AND min_weight_kg <= p_weight_kg
    AND (max_weight_kg IS NULL OR max_weight_kg >= p_weight_kg)
    AND effective_from <= p_effective_date
    AND (effective_until IS NULL OR effective_until >= p_effective_date)
    AND is_active = true
  ORDER BY 
    CASE WHEN carrier_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN service_type_id IS NOT NULL THEN 1 ELSE 2 END,
    min_weight_kg DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_weight_break_rate"("p_tenant_id" "uuid", "p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_weight_kg" numeric, "p_effective_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_weight_break_rate"("p_tenant_id" "uuid", "p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_weight_kg" numeric, "p_effective_date" "date") IS 'Finds the applicable weight break rate for given parameters';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("check_user_id" "uuid", "check_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = check_role
  );
$$;


ALTER FUNCTION "public"."has_role"("check_user_id" "uuid", "check_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_feature_usage"("_tenant_id" "uuid", "_feature_key" "text", "_increment" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.usage_records (
    tenant_id,
    feature_key,
    usage_count,
    period_start,
    period_end
  )
  VALUES (
    _tenant_id,
    _feature_key,
    _increment,
    date_trunc('month', now()),
    date_trunc('month', now()) + INTERVAL '1 month'
  )
  ON CONFLICT (tenant_id, feature_key, period_start)
  DO UPDATE SET
    usage_count = usage_records.usage_count + _increment,
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."increment_feature_usage"("_tenant_id" "uuid", "_feature_key" "text", "_increment" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Insert or update user capacity
  INSERT INTO public.user_capacity (user_id, tenant_id, current_leads, last_assigned_at)
  VALUES (p_user_id, p_tenant_id, 1, NOW())
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET
    current_leads = user_capacity.current_leads + 1,
    last_assigned_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_platform_admin(auth.uid());
$$;


ALTER FUNCTION "public"."is_current_user_platform_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_current_user_platform_admin"() IS 'Check if the current authenticated user is a platform admin';



CREATE OR REPLACE FUNCTION "public"."is_franchise_admin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'franchise_admin'
  );
$$;


ALTER FUNCTION "public"."is_franchise_admin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.has_role(check_user_id, 'platform_admin'::public.app_role);
$$;


ALTER FUNCTION "public"."is_platform_admin"("check_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_platform_admin"("check_user_id" "uuid") IS 'Check if a specific user has platform admin role and is active. Returns false if user_id is NULL or user is inactive.';



CREATE OR REPLACE FUNCTION "public"."is_sales_manager"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'sales_manager'
  );
$$;


ALTER FUNCTION "public"."is_sales_manager"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'platform_admin'
  );
$$;


ALTER FUNCTION "public"."is_super_admin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tenant_admin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'tenant_admin'
  );
$$;


ALTER FUNCTION "public"."is_tenant_admin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_viewer"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'viewer'
  );
$$;


ALTER FUNCTION "public"."is_viewer"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_email_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."log_email_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_opportunity_probability_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (OLD.probability IS DISTINCT FROM NEW.probability)
     OR (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.opportunity_probability_history (
      opportunity_id,
      old_probability,
      new_probability,
      old_stage,
      new_stage,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.probability,
      NEW.probability,
      OLD.stage,
      NEW.stage,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_opportunity_probability_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_option_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_action TEXT;
  v_changes JSONB;
BEGIN
  v_action := TG_OP;
  
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := row_to_json(OLD)::JSONB;
  END IF;
  
  INSERT INTO quotation_audit_log (
    tenant_id,
    quotation_version_id,
    quotation_version_option_id,
    entity_type,
    entity_id,
    action,
    changes,
    user_id
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.quotation_version_id, OLD.quotation_version_id),
    COALESCE(NEW.id, OLD.id),
    'quotation_version_option',
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_changes,
    auth.uid()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_option_changes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_option_changes"() IS 'Logs all changes to quotation options for audit trail';



CREATE OR REPLACE FUNCTION "public"."log_version_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_action TEXT;
  v_changes JSONB;
BEGIN
  v_action := TG_OP;
  
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := row_to_json(OLD)::JSONB;
  END IF;
  
  -- Only log after the row is committed (AFTER trigger ensures this)
  -- Use a conditional insert that won't fail if quotation_version doesn't exist yet
  BEGIN
    INSERT INTO quotation_audit_log (
      tenant_id,
      quote_id,
      quotation_version_id,
      entity_type,
      entity_id,
      action,
      changes,
      user_id
    ) VALUES (
      COALESCE(NEW.tenant_id, OLD.tenant_id),
      COALESCE(NEW.quote_id, OLD.quote_id),
      COALESCE(NEW.id, OLD.id),
      'quotation_version',
      COALESCE(NEW.id, OLD.id),
      v_action,
      v_changes,
      auth.uid()
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      -- Silently ignore FK violations during insert (row not yet committed)
      NULL;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_version_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_option_from_rate"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."populate_option_from_rate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_next_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."preview_next_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_carrier_rate_on_rate_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."recalc_carrier_rate_on_rate_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_carrier_rate_total_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."recalc_carrier_rate_total_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_and_sync_quote_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_quote_id UUID;
  v_total NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_quote_id := OLD.quote_id;
  ELSE
    v_quote_id := NEW.quote_id;
  END IF;

  -- Recalculate quote total (supports both schemas of quote_items)
  SELECT COALESCE(SUM(COALESCE(qi.line_total, qi.total, 0)), 0)
    INTO v_total
  FROM public.quote_items qi
  WHERE qi.quote_id = v_quote_id;

  -- Always update total_amount
  UPDATE public.quotes q
    SET total_amount = v_total,
        updated_at = now()
  WHERE q.id = v_quote_id;

  -- Conditionally update total if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'total'
  ) THEN
    UPDATE public.quotes q
      SET total = v_total,
          updated_at = now()
    WHERE q.id = v_quote_id;
  END IF;

  -- Sync opportunity items from the quote
  PERFORM public.sync_opportunity_items_from_quote(v_quote_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."recalculate_and_sync_quote_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_quote_total_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total NUMERIC;
  v_quote_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_quote_id := OLD.quote_id;
  ELSE
    v_quote_id := NEW.quote_id;
  END IF;

  -- Supports both schemas of quote_items
  SELECT COALESCE(SUM(COALESCE(qi.line_total, qi.total, 0)), 0)
    INTO v_total
  FROM public.quote_items qi
  WHERE qi.quote_id = v_quote_id;

  -- Always update total_amount
  UPDATE public.quotes q
    SET total_amount = v_total,
        updated_at = now()
  WHERE q.id = v_quote_id;

  -- Conditionally update total if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'total'
  ) THEN
    UPDATE public.quotes q
      SET total = v_total,
          updated_at = now()
    WHERE q.id = v_quote_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."recalculate_quote_total_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_customer_selection"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_version_id" "uuid", "p_option_id" "uuid", "p_reason" "text", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."record_customer_selection"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_version_id" "uuid", "p_option_id" "uuid", "p_reason" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reload_postgrest_schema"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
  NOTIFY pgrst, 'reload config';
END;
$$;


ALTER FUNCTION "public"."reload_postgrest_schema"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_admin_override"("p_enabled" boolean, "p_tenant_id" "uuid" DEFAULT NULL::"uuid", "p_franchise_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.user_preferences (user_id, admin_override_enabled, tenant_id, franchise_id)
    VALUES (auth.uid(), p_enabled, p_tenant_id, p_franchise_id)
    ON CONFLICT (user_id)
    DO UPDATE SET
        admin_override_enabled = EXCLUDED.admin_override_enabled,
        tenant_id = COALESCE(p_tenant_id, user_preferences.tenant_id),
        franchise_id = COALESCE(p_franchise_id, user_preferences.franchise_id),
        updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."set_admin_override"("p_enabled" boolean, "p_tenant_id" "uuid", "p_franchise_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_current_version"("p_version_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_quote_id UUID;
BEGIN
  -- Get the quote_id
  SELECT quote_id INTO v_quote_id
  FROM quotation_versions
  WHERE id = p_version_id;
  
  -- Unmark all other versions
  UPDATE quotation_versions
  SET is_current = FALSE
  WHERE quote_id = v_quote_id AND id != p_version_id;
  
  -- Mark this version as current
  UPDATE quotation_versions
  SET is_current = TRUE
  WHERE id = p_version_id;
  
  -- Update the quote's current_version_id
  UPDATE quotes
  SET current_version_id = p_version_id
  WHERE id = v_quote_id;
END;
$$;


ALTER FUNCTION "public"."set_current_version"("p_version_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_current_version"("p_version_id" "uuid") IS 'Marks a version as current and updates the parent quote';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_scope_preference"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_admin_override" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled)
    VALUES (auth.uid(), p_tenant_id, p_franchise_id, p_admin_override)
    ON CONFLICT (user_id)
    DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        franchise_id = EXCLUDED.franchise_id,
        admin_override_enabled = EXCLUDED.admin_override_enabled,
        updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."set_user_scope_preference"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_admin_override" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_opportunity_from_primary_quote"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total NUMERIC;
  v_other_primary UUID;
BEGIN

  IF NEW.opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- If deleting a primary quote, clear or switch primary on the opportunity
    IF OLD.is_primary IS TRUE THEN
      SELECT q.id INTO v_other_primary
      FROM public.quotes q
      WHERE q.opportunity_id = OLD.opportunity_id
        AND q.is_primary IS TRUE
      ORDER BY q.updated_at DESC
      LIMIT 1;

      UPDATE public.opportunities o
        SET primary_quote_id = v_other_primary,
            amount = COALESCE((SELECT q.total_amount FROM public.quotes q WHERE q.id = v_other_primary), 0),
            updated_at = now()
      WHERE o.id = OLD.opportunity_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Determine total from quotes table to avoid referencing absent columns
  SELECT COALESCE(q.total_amount, 0)
    INTO v_total
  FROM public.quotes q
  WHERE q.id = NEW.id;

  -- INSERT/UPDATE path
  IF NEW.is_primary IS TRUE THEN
    UPDATE public.opportunities o
      SET primary_quote_id = NEW.id,
          amount = COALESCE(v_total, 0),
          updated_at = now()
    WHERE o.id = NEW.opportunity_id;
  ELSIF NEW.is_primary IS FALSE THEN
    -- If this quote was primary and is now demoted, select another primary or clear
    IF OLD IS NOT NULL AND OLD.is_primary IS TRUE THEN
      SELECT q.id INTO v_other_primary
      FROM public.quotes q
      WHERE q.opportunity_id = NEW.opportunity_id
        AND q.is_primary IS TRUE
      ORDER BY q.updated_at DESC
      LIMIT 1;

      UPDATE public.opportunities o
        SET primary_quote_id = v_other_primary,
            amount = COALESCE((SELECT q.total_amount FROM public.quotes q WHERE q.id = v_other_primary), 0),
            updated_at = now()
      WHERE o.id = NEW.opportunity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_opportunity_from_primary_quote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_opportunity_items_from_quote"("p_quote_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_opportunity UUID;
  v_is_primary BOOLEAN;
BEGIN
  SELECT q.opportunity_id, q.is_primary INTO v_opportunity, v_is_primary
  FROM public.quotes q
  WHERE q.id = p_quote_id;

  IF v_opportunity IS NULL OR v_is_primary IS NOT TRUE THEN
    RETURN;
  END IF;

  -- Replace all items for the opportunity with the quote's items
  DELETE FROM public.opportunity_items oi WHERE oi.opportunity_id = v_opportunity;

  INSERT INTO public.opportunity_items (
    opportunity_id, line_number, product_name, description, quantity,
    unit_price, discount_percent, discount_amount, tax_amount, line_total
  )
  SELECT v_opportunity, qi.line_number, qi.product_name, qi.description, qi.quantity,
         qi.unit_price, qi.discount_percent, qi.discount_amount, qi.tax_amount, 
         COALESCE(qi.line_total, qi.quantity * qi.unit_price * (1 - COALESCE(qi.discount_percent,0)/100))
  FROM public.quote_items qi
  WHERE qi.quote_id = p_quote_id
  ORDER BY qi.line_number;
END;
$$;


ALTER FUNCTION "public"."sync_opportunity_items_from_quote"("p_quote_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_quote_items_from_opportunity_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_opportunity_id UUID;
  v_quote UUID;
  v_total NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_opportunity_id := OLD.opportunity_id;
  ELSE
    v_opportunity_id := NEW.opportunity_id;
  END IF;

  -- Determine primary quote for the opportunity
  SELECT primary_quote_id INTO v_quote
  FROM public.opportunities
  WHERE id = v_opportunity_id;

  IF v_quote IS NULL THEN
    -- Fallback to any quote marked primary
    SELECT q.id INTO v_quote
    FROM public.quotes q
    WHERE q.opportunity_id = v_opportunity_id AND q.is_primary = TRUE
    ORDER BY q.created_at DESC
    LIMIT 1;
  END IF;

  IF v_quote IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Replace quote_items with opportunity_items snapshot
  DELETE FROM public.quote_items qi WHERE qi.quote_id = v_quote;

  INSERT INTO public.quote_items (
    quote_id, line_number, product_name, description, quantity,
    unit_price, discount_percent, discount_amount, tax_amount, line_total
  )
  SELECT v_quote, oi.line_number, oi.product_name, oi.description, oi.quantity,
         oi.unit_price, oi.discount_percent, oi.discount_amount, oi.tax_amount,
         COALESCE(oi.line_total, oi.quantity * oi.unit_price * (1 - COALESCE(oi.discount_percent,0)/100))
  FROM public.opportunity_items oi
  WHERE oi.opportunity_id = v_opportunity_id
  ORDER BY oi.line_number;

  -- Recalculate totals after syncing
  SELECT COALESCE(SUM(COALESCE(qi.line_total, qi.total, 0)), 0)
    INTO v_total
  FROM public.quote_items qi
  WHERE qi.quote_id = v_quote;

  UPDATE public.quotes q
    SET total_amount = v_total,
        updated_at = now()
  WHERE q.id = v_quote;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'total'
  ) THEN
    UPDATE public.quotes q
      SET total = v_total,
          updated_at = now()
    WHERE q.id = v_quote;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."sync_quote_items_from_opportunity_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tenant_has_feature"("_tenant_id" "uuid", "_feature_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."tenant_has_feature"("_tenant_id" "uuid", "_feature_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_quote_number_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trg_set_quote_number_before_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_lead_last_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NEW.lead_id IS NOT NULL THEN
        UPDATE public.leads
        SET last_activity_date = NOW()
        WHERE id = NEW.lead_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_lead_last_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_lead_score"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.lead_score := public.calculate_lead_score(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_lead_score"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_option_margins_on_charge_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_option_id UUID;
  v_margins RECORD;
BEGIN
  -- Get the option_id
  IF TG_OP = 'DELETE' THEN
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = OLD.leg_id;
  ELSE
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = NEW.leg_id;
  END IF;
  
  -- Calculate margins
  SELECT * INTO v_margins FROM calculate_option_margins(v_option_id);
  
  -- Update the option
  UPDATE quotation_version_options
  SET 
    total_buy = v_margins.total_buy,
    total_sell = v_margins.total_sell,
    total_amount = v_margins.total_sell,
    margin_amount = v_margins.margin_amount,
    margin_percentage = v_margins.margin_percentage,
    charge_count = v_margins.charge_count,
    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_option_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_option_margins_on_charge_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_option_margins_on_charge_change"() IS 'Auto-updates option margins when charges are modified';



CREATE OR REPLACE FUNCTION "public"."update_option_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_option_id UUID;
  v_totals RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = OLD.leg_id;
  ELSE
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = NEW.leg_id;
  END IF;
  
  SELECT * INTO v_totals FROM calculate_option_totals(v_option_id);
  
  UPDATE quotation_version_options
  SET 
    leg_count = v_totals.leg_count,
    charge_count = v_totals.charge_count,
    total_buy = v_totals.total_buy,
    total_sell = v_totals.total_sell,
    margin_amount = v_totals.total_sell - v_totals.total_buy,
    total_amount = v_totals.total_sell,
    last_calculated_at = now()
  WHERE id = v_option_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_option_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scheduled_email_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scheduled_email_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_leg_sort_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.sort_order = 1 OR NEW.sort_order IS NULL THEN
    SELECT COALESCE(MAX(sort_order), 0) + 100
    INTO NEW.sort_order
    FROM quotation_version_option_legs
    WHERE quotation_version_option_id = NEW.quotation_version_option_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_leg_sort_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_service_leg_requirements"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If leg_type is 'service', service_only_category must be set
  IF NEW.leg_type = 'service' AND (NEW.service_only_category IS NULL OR NEW.service_only_category = '') THEN
    RAISE EXCEPTION 'service_only_category is required for service-type legs';
  END IF;
  
  -- If leg_type is 'transport', origin and destination should be set
  -- (We'll make this a soft validation since existing data might not comply)
  IF NEW.leg_type = 'transport' AND NEW.service_only_category IS NOT NULL THEN
    -- Clear service_only_category for transport legs
    NEW.service_only_category := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_service_leg_requirements"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_single_selection_per_version"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  -- Check if there's already a selection for this version
  SELECT COUNT(*) INTO v_existing_count
  FROM customer_selections
  WHERE quotation_version_id = NEW.quotation_version_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
  
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'A customer selection already exists for this quotation version';
  END IF;
  
  -- Validate that the option belongs to the version
  IF NOT EXISTS (
    SELECT 1 FROM quotation_version_options
    WHERE id = NEW.quotation_version_option_id
      AND quotation_version_id = NEW.quotation_version_id
  ) THEN
    RAISE EXCEPTION 'The selected option does not belong to this quotation version';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_single_selection_per_version"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_single_selection_per_version"() IS 'Ensures only one customer selection per version';



CREATE OR REPLACE FUNCTION "public"."validate_version_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  -- Get old status if updating
  IF TG_OP = 'UPDATE' THEN
    v_old_status := OLD.status;
    
    -- Define allowed transitions
    -- draft -> sent, internal_review, cancelled
    -- sent -> accepted, rejected, expired, cancelled
    -- internal_review -> draft, sent, cancelled
    -- accepted -> fulfilled (future state)
    -- rejected, expired, cancelled are terminal states
    
    IF v_old_status = 'draft' AND NEW.status NOT IN ('draft', 'sent', 'internal_review', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from draft to %', NEW.status;
    ELSIF v_old_status = 'sent' AND NEW.status NOT IN ('sent', 'accepted', 'rejected', 'expired', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from sent to %', NEW.status;
    ELSIF v_old_status = 'internal_review' AND NEW.status NOT IN ('internal_review', 'draft', 'sent', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from internal_review to %', NEW.status;
    ELSIF v_old_status IN ('accepted', 'rejected', 'expired', 'cancelled') AND NEW.status != v_old_status THEN
      RAISE EXCEPTION 'Cannot change status from terminal state %', v_old_status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_version_status_transition"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_version_status_transition"() IS 'Enforces valid status transitions for quotation versions';



CREATE OR REPLACE FUNCTION "public"."validate_version_uniqueness"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE quotation_versions
    SET is_current = false
    WHERE quote_id = NEW.quote_id 
    AND id != NEW.id
    AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_version_uniqueness"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "name" "text" NOT NULL,
    "account_type" "public"."account_type" DEFAULT 'prospect'::"public"."account_type",
    "status" "public"."account_status" DEFAULT 'active'::"public"."account_status",
    "industry" "text",
    "website" "text",
    "phone" "text",
    "email" "text",
    "billing_address" "jsonb" DEFAULT '{}'::"jsonb",
    "shipping_address" "jsonb" DEFAULT '{}'::"jsonb",
    "annual_revenue" numeric(15,2),
    "employee_count" integer,
    "description" "text",
    "owner_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "parent_account_id" "uuid",
    "account_number" "text",
    "account_site" "text",
    "fax" "text",
    "ticker_symbol" "text",
    "ownership" "text",
    "rating" "text",
    "sic_code" "text",
    "duns_number" "text",
    "naics_code" "text",
    "billing_street" "text",
    "billing_city" "text",
    "billing_state" "text",
    "billing_postal_code" "text",
    "billing_country" "text",
    "shipping_street" "text",
    "shipping_city" "text",
    "shipping_state" "text",
    "shipping_postal_code" "text",
    "shipping_country" "text",
    "number_of_locations" integer,
    "active" boolean,
    "sla" "text",
    "sla_expiration_date" "date",
    "customer_priority" "text",
    "support_tier" "text",
    "upsell_opportunity" "text",
    CONSTRAINT "chk_not_self_parent" CHECK (("id" <> "parent_account_id"))
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "activity_type" "public"."activity_type" NOT NULL,
    "status" "public"."activity_status" DEFAULT 'planned'::"public"."activity_status",
    "priority" "public"."priority_level" DEFAULT 'medium'::"public"."priority_level",
    "subject" "text" NOT NULL,
    "description" "text",
    "due_date" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "account_id" "uuid",
    "contact_id" "uuid",
    "lead_id" "uuid",
    "assigned_to" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "opportunity_id" "uuid"
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aes_hts_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hts_code" character varying(15) NOT NULL,
    "schedule_b" character varying(15),
    "category" character varying(100) NOT NULL,
    "sub_category" character varying(100),
    "sub_sub_category" character varying(100),
    "description" "text" NOT NULL,
    "unit_of_measure" character varying(50),
    "duty_rate" character varying(50),
    "special_provisions" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hts_code_format_check" CHECK ((("hts_code")::"text" ~ '^[0-9]{4}(\.[0-9]{2}){0,3}$'::"text"))
);


ALTER TABLE "public"."aes_hts_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."aes_hts_codes" IS 'HTS/Schedule B codes master data for AES module.';



COMMENT ON COLUMN "public"."aes_hts_codes"."hts_code" IS 'Primary classification code (unique, validated format).';



COMMENT ON COLUMN "public"."aes_hts_codes"."schedule_b" IS 'US export classification (optional).';



COMMENT ON COLUMN "public"."aes_hts_codes"."category" IS 'High-level category (required).';



COMMENT ON COLUMN "public"."aes_hts_codes"."description" IS 'Detailed description (required).';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_permissions" (
    "id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auth_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_role_hierarchy" (
    "manager_role_id" "text" NOT NULL,
    "target_role_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auth_role_hierarchy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_role_permissions" (
    "role_id" "text" NOT NULL,
    "permission_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auth_role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_roles" (
    "id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "level" integer DEFAULT 99 NOT NULL,
    "can_manage_scopes" "text"[] DEFAULT '{}'::"text"[],
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auth_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cargo_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "service_type" "text" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "cargo_type_id" "uuid",
    "commodity_description" "text",
    "hs_code" "text",
    "package_count" integer DEFAULT 0,
    "total_weight_kg" numeric(12,3),
    "total_volume_cbm" numeric(12,3),
    "dimensions" "jsonb" DEFAULT '{}'::"jsonb",
    "hazmat" boolean DEFAULT false,
    "hazmat_class" "text",
    "temperature_controlled" boolean DEFAULT false,
    "requires_special_handling" boolean DEFAULT false,
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "actual_weight_kg" numeric,
    "volumetric_weight_kg" numeric,
    "chargeable_weight_kg" numeric,
    CONSTRAINT "cargo_details_actual_weight_kg_check" CHECK ((("actual_weight_kg" IS NULL) OR ("actual_weight_kg" >= (0)::numeric))),
    CONSTRAINT "cargo_details_chargeable_weight_kg_check" CHECK ((("chargeable_weight_kg" IS NULL) OR ("chargeable_weight_kg" >= (0)::numeric))),
    CONSTRAINT "cargo_details_service_type_check" CHECK (("service_type" = ANY (ARRAY['ocean'::"text", 'air'::"text", 'trucking'::"text", 'courier'::"text", 'moving'::"text", 'railway_transport'::"text"]))),
    CONSTRAINT "cargo_details_volumetric_weight_kg_check" CHECK ((("volumetric_weight_kg" IS NULL) OR ("volumetric_weight_kg" >= (0)::numeric)))
);


ALTER TABLE "public"."cargo_details" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cargo_details"."actual_weight_kg" IS 'Physical weight of the cargo';



COMMENT ON COLUMN "public"."cargo_details"."volumetric_weight_kg" IS 'Calculated volumetric/dimensional weight';



COMMENT ON COLUMN "public"."cargo_details"."chargeable_weight_kg" IS 'Weight used for pricing (greater of actual or volumetric)';



CREATE TABLE IF NOT EXISTS "public"."cargo_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "cargo_type_name" "text" NOT NULL,
    "cargo_code" "text",
    "requires_special_handling" boolean DEFAULT false,
    "hazmat_class" "text",
    "temperature_controlled" boolean DEFAULT false,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cargo_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carrier_rate_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "carrier_rate_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."carrier_rate_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carrier_rate_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "carrier_rate_id" "uuid" NOT NULL,
    "charge_type" "text" NOT NULL,
    "basis" "text",
    "quantity" numeric DEFAULT 1,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."carrier_rate_charges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carrier_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "carrier_name" "text" NOT NULL,
    "rate_type" "text" NOT NULL,
    "origin_location" "text",
    "destination_location" "text",
    "base_rate" numeric NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text",
    "valid_from" "date" NOT NULL,
    "valid_until" "date",
    "weight_break_min" numeric,
    "weight_break_max" numeric,
    "surcharges" "jsonb" DEFAULT '[]'::"jsonb",
    "accessorial_fees" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "carrier_id" "uuid",
    "origin_port_id" "uuid",
    "destination_port_id" "uuid",
    "mode" "text",
    "rate_reference_id" "text",
    "status" "text" DEFAULT 'active'::"text",
    "container_category_id" "uuid",
    "container_size_id" "uuid",
    "service_name" "text",
    "scac_code" "text",
    "vessel_flight_no" "text",
    "exchange_rate" numeric,
    "markup_amount" numeric DEFAULT 0,
    "charges_subtotal" numeric DEFAULT 0,
    "total_amount" numeric DEFAULT 0,
    "etd" "date",
    "eta" "date",
    "sailing_frequency" "text",
    "cut_off_date" "date",
    "payment_terms" "text",
    "free_time_days" integer,
    "demurrage_rate" numeric,
    "detention_rate" numeric,
    "removed_reason" "text",
    "created_by" "uuid",
    CONSTRAINT "carrier_rates_rate_type_check" CHECK (("rate_type" = ANY (ARRAY['spot'::"text", 'contract'::"text"])))
);


ALTER TABLE "public"."carrier_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carrier_service_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "service_type" "text" NOT NULL,
    "code_type" "text",
    "code_value" "text",
    "is_primary" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "carrier_service_types_type_check" CHECK (("service_type" = ANY (ARRAY['ocean'::"text", 'air'::"text", 'trucking'::"text", 'courier'::"text", 'moving'::"text", 'railway_transport'::"text"])))
);


ALTER TABLE "public"."carrier_service_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carriers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "mode" "public"."transport_mode" NOT NULL,
    "name" "text" NOT NULL,
    "scac" "text",
    "iata" "text",
    "mc_dot" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "carrier_name" "text",
    "carrier_code" "text",
    "carrier_type" "text",
    "is_active" boolean DEFAULT true,
    CONSTRAINT "carriers_carrier_type_check" CHECK (("carrier_type" = ANY (ARRAY['ocean'::"text", 'air_cargo'::"text", 'trucking'::"text", 'courier'::"text", 'movers_and_packers'::"text", 'rail'::"text"])))
);


ALTER TABLE "public"."carriers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."charge_bases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."charge_bases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."charge_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."charge_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."charge_sides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."charge_sides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."charge_tier_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "basis_id" "uuid",
    "category_id" "uuid",
    "service_type_id" "uuid",
    "carrier_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."charge_tier_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."charge_tier_config" IS 'Defines tiered pricing configurations for weight, volume, or other measurable units';



COMMENT ON COLUMN "public"."charge_tier_config"."basis_id" IS 'Links to charge_bases (Per KG, Per CBM, etc.)';



CREATE TABLE IF NOT EXISTS "public"."charge_tier_ranges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tier_config_id" "uuid" NOT NULL,
    "min_value" numeric NOT NULL,
    "max_value" numeric,
    "rate" numeric NOT NULL,
    "currency_id" "uuid",
    "sort_order" integer DEFAULT 1000,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "charge_tier_ranges_check" CHECK ((("max_value" IS NULL) OR ("max_value" > "min_value"))),
    CONSTRAINT "charge_tier_ranges_min_value_check" CHECK (("min_value" >= (0)::numeric)),
    CONSTRAINT "charge_tier_ranges_rate_check" CHECK (("rate" >= (0)::numeric))
);


ALTER TABLE "public"."charge_tier_ranges" OWNER TO "postgres";


COMMENT ON TABLE "public"."charge_tier_ranges" IS 'Individual tier ranges with rates for each configuration';



COMMENT ON COLUMN "public"."charge_tier_ranges"."max_value" IS 'NULL indicates unlimited (infinity)';



CREATE TABLE IF NOT EXISTS "public"."charge_types" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."charge_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."charge_weight_breaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "carrier_id" "uuid",
    "service_type_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "min_weight_kg" numeric NOT NULL,
    "max_weight_kg" numeric,
    "rate_per_kg" numeric NOT NULL,
    "currency_id" "uuid",
    "effective_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_until" "date",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "charge_weight_breaks_check" CHECK ((("max_weight_kg" IS NULL) OR ("max_weight_kg" > "min_weight_kg"))),
    CONSTRAINT "charge_weight_breaks_min_weight_kg_check" CHECK (("min_weight_kg" >= (0)::numeric)),
    CONSTRAINT "charge_weight_breaks_rate_per_kg_check" CHECK (("rate_per_kg" >= (0)::numeric)),
    CONSTRAINT "valid_effective_dates" CHECK ((("effective_until" IS NULL) OR ("effective_until" >= "effective_from")))
);


ALTER TABLE "public"."charge_weight_breaks" OWNER TO "postgres";


COMMENT ON TABLE "public"."charge_weight_breaks" IS 'Weight-based tiered pricing for carriers (e.g., air freight 0-45kg, 45-100kg, 100+)';



CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_id" "uuid",
    "state_id" "uuid",
    "name" "text" NOT NULL,
    "code_national" "text",
    "latitude" numeric,
    "longitude" numeric,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "rule_id" "uuid",
    "check_status" "text" NOT NULL,
    "check_details" "jsonb",
    "checked_at" timestamp with time zone DEFAULT "now"(),
    "checked_by" "uuid",
    CONSTRAINT "compliance_checks_check_status_check" CHECK (("check_status" = ANY (ARRAY['passed'::"text", 'failed'::"text", 'warning'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."compliance_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "rule_name" "text" NOT NULL,
    "service_type" "text",
    "regulation_agency" "text",
    "rule_description" "text",
    "validation_criteria" "jsonb" NOT NULL,
    "required_documents" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "compliance_rules_service_type_check" CHECK (("service_type" = ANY (ARRAY['ocean'::"text", 'air'::"text", 'trucking'::"text", 'courier'::"text", 'moving'::"text", 'all'::"text"])))
);


ALTER TABLE "public"."compliance_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consignees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_person" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "address" "jsonb" DEFAULT '{}'::"jsonb",
    "tax_id" "text",
    "customs_id" "text",
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."consignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "account_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "title" "text",
    "email" "text",
    "phone" "text",
    "mobile" "text",
    "linkedin_url" "text",
    "address" "jsonb" DEFAULT '{}'::"jsonb",
    "is_primary" boolean DEFAULT false,
    "notes" "text",
    "owner_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."container_sizes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "code" "text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "has_ventilation" boolean DEFAULT false,
    "has_temperature_control" boolean DEFAULT false,
    "is_open_top" boolean DEFAULT false,
    "is_flat_rack" boolean DEFAULT false
);


ALTER TABLE "public"."container_sizes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."container_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "code" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ownership_type" "text",
    "is_special" boolean DEFAULT false,
    "special_type" "text",
    CONSTRAINT "container_types_ownership_type_check" CHECK (("ownership_type" = ANY (ARRAY['COC'::"text", 'SOC'::"text", 'BOTH'::"text", NULL::"text"])))
);


ALTER TABLE "public"."container_types" OWNER TO "postgres";


COMMENT ON COLUMN "public"."container_types"."ownership_type" IS 'COC (Carrier Owned), SOC (Shipper Owned), or BOTH';



COMMENT ON COLUMN "public"."container_types"."is_special" IS 'Whether this is a special container type (Open Top, Flat Rack, etc.)';



COMMENT ON COLUMN "public"."container_types"."special_type" IS 'Type of special container: open_top, flat_rack, tank, refrigerated, etc.';



CREATE TABLE IF NOT EXISTS "public"."continents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code_international" "text",
    "code_national" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."continents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "continent_id" "uuid",
    "name" "text" NOT NULL,
    "code_iso2" "text",
    "code_iso3" "text",
    "code_national" "text",
    "phone_code" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."currencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "symbol" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."currencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "permission_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "access_type" "text" DEFAULT 'grant'::"text" NOT NULL,
    CONSTRAINT "custom_role_permissions_access_type_check" CHECK (("access_type" = ANY (ARRAY['grant'::"text", 'deny'::"text"])))
);


ALTER TABLE "public"."custom_role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "is_system_role" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_selections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "quotation_version_id" "uuid" NOT NULL,
    "quotation_version_option_id" "uuid" NOT NULL,
    "reason" "text",
    "selected_by" "uuid",
    "selected_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_selections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customs_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "document_number" "text",
    "issue_date" "date",
    "expiry_date" "date",
    "issuing_authority" "text",
    "document_url" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customs_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "widgets" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "layout" "jsonb",
    "theme_overrides" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dashboard_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "template_name" "text" NOT NULL,
    "document_type" "text" NOT NULL,
    "service_type" "text",
    "template_content" "text" NOT NULL,
    "required_fields" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "version" "text" NOT NULL,
    "content" "text" NOT NULL,
    "diff_summary" "jsonb",
    "change_type" "text",
    "change_notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "document_versions_change_type_check" CHECK (("change_type" = ANY (ARRAY['major'::"text", 'minor'::"text", 'patch'::"text"])))
);


ALTER TABLE "public"."document_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid",
    "type" "public"."document_type" NOT NULL,
    "status" "text" DEFAULT 'generated'::"text",
    "storage_path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "path" "text",
    "current_version" "text" DEFAULT '1.0.0'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_account_delegations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "delegate_user_id" "uuid" NOT NULL,
    "permissions" "jsonb" DEFAULT '["read"]'::"jsonb" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_account_delegations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "provider" "text" NOT NULL,
    "email_address" "text" NOT NULL,
    "display_name" "text",
    "is_primary" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "smtp_host" "text",
    "smtp_port" integer,
    "smtp_username" "text",
    "smtp_password" "text",
    "smtp_use_tls" boolean DEFAULT true,
    "imap_host" "text",
    "imap_port" integer,
    "imap_username" "text",
    "imap_password" "text",
    "imap_use_ssl" boolean DEFAULT true,
    "last_sync_at" timestamp with time zone,
    "sync_frequency" integer DEFAULT 5,
    "auto_sync_enabled" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_accounts_provider_check" CHECK (("provider" = ANY (ARRAY['office365'::"text", 'gmail'::"text", 'smtp_imap'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."email_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "email_id" "uuid",
    "scheduled_email_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb",
    "user_id" "uuid",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_audit_log_event_type_check" CHECK (("event_type" = ANY (ARRAY['sent'::"text", 'delivered'::"text", 'opened'::"text", 'clicked'::"text", 'bounced'::"text", 'failed'::"text", 'scheduled'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."email_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_filters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "account_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "conditions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_filters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "subject" "text" NOT NULL,
    "body_html" "text",
    "body_text" "text",
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "category" "text",
    "is_shared" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "account_id" "uuid" NOT NULL,
    "message_id" "text" NOT NULL,
    "thread_id" "text",
    "subject" "text" NOT NULL,
    "from_email" "text" NOT NULL,
    "from_name" "text",
    "to_emails" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cc_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "bcc_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "reply_to" "text",
    "body_text" "text",
    "body_html" "text",
    "snippet" "text",
    "has_attachments" boolean DEFAULT false,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "direction" "text" NOT NULL,
    "status" "text" DEFAULT 'received'::"text",
    "is_read" boolean DEFAULT false,
    "is_starred" boolean DEFAULT false,
    "is_archived" boolean DEFAULT false,
    "is_spam" boolean DEFAULT false,
    "is_deleted" boolean DEFAULT false,
    "folder" "text" DEFAULT 'inbox'::"text",
    "labels" "jsonb" DEFAULT '[]'::"jsonb",
    "category" "text",
    "lead_id" "uuid",
    "contact_id" "uuid",
    "account_id_crm" "uuid",
    "opportunity_id" "uuid",
    "sent_at" timestamp with time zone,
    "received_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "priority" "text" DEFAULT 'normal'::"text",
    "importance" "text" DEFAULT 'normal'::"text",
    "in_reply_to" "text",
    "email_references" "text"[],
    "size_bytes" integer,
    "raw_headers" "jsonb" DEFAULT '{}'::"jsonb",
    "conversation_id" "text",
    "internet_message_id" "text",
    "has_inline_images" boolean DEFAULT false,
    "sync_error" "text",
    "last_sync_attempt" timestamp with time zone,
    "user_id" "uuid",
    "ai_category" "text",
    "ai_sentiment" "text",
    "ai_urgency" "text",
    CONSTRAINT "emails_ai_sentiment_check" CHECK (("ai_sentiment" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text"]))),
    CONSTRAINT "emails_ai_urgency_check" CHECK (("ai_urgency" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "emails_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"]))),
    CONSTRAINT "emails_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sending'::"text", 'sent'::"text", 'received'::"text", 'failed'::"text", 'bounced'::"text"])))
);


ALTER TABLE "public"."emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_transfer_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transfer_id" "uuid" NOT NULL,
    "entity_type" "public"."transfer_entity_type" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "status" "public"."transfer_status" DEFAULT 'pending'::"public"."transfer_status" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_transfer_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_tenant_id" "uuid" NOT NULL,
    "source_franchise_id" "uuid",
    "target_tenant_id" "uuid" NOT NULL,
    "target_franchise_id" "uuid",
    "transfer_type" "public"."transfer_type" NOT NULL,
    "status" "public"."transfer_status" DEFAULT 'pending'::"public"."transfer_status" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "approved_by" "uuid",
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."franchises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "address" "jsonb" DEFAULT '{}'::"jsonb",
    "manager_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."franchises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fx_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "from_currency_id" "uuid" NOT NULL,
    "to_currency_id" "uuid" NOT NULL,
    "rate" numeric NOT NULL,
    "effective_date" "date" NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fx_rates_rate_check" CHECK (("rate" > (0)::numeric))
);


ALTER TABLE "public"."fx_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."history_filter_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."history_filter_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_id" "uuid" NOT NULL,
    "row_number" integer,
    "field" "text",
    "error_message" "text",
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "entity_name" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "imported_by" "uuid",
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'partial'::"text" NOT NULL,
    "summary" "jsonb" DEFAULT '{}'::"jsonb",
    "reverted_at" timestamp with time zone,
    "reverted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "import_history_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'partial'::"text", 'failed'::"text", 'reverted'::"text"])))
);


ALTER TABLE "public"."import_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_history_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_id" "uuid" NOT NULL,
    "record_id" "text" NOT NULL,
    "operation_type" "text" NOT NULL,
    "previous_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_history_details_operation_type_check" CHECK (("operation_type" = ANY (ARRAY['insert'::"text", 'update'::"text"])))
);


ALTER TABLE "public"."import_history_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incoterms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "incoterm_code" "text" NOT NULL,
    "incoterm_name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."incoterms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "invited_by" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."lead_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_assignment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "assigned_from" "uuid",
    "assigned_to" "uuid" NOT NULL,
    "assignment_method" "text" NOT NULL,
    "rule_id" "uuid",
    "reason" "text",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assigned_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid"
);


ALTER TABLE "public"."lead_assignment_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_assignment_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "priority" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "retry_count" integer DEFAULT 0,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."lead_assignment_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_assignment_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "rule_name" "text" NOT NULL,
    "priority" integer DEFAULT 0,
    "criteria" "jsonb" NOT NULL,
    "assigned_to" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "assignment_type" "text" DEFAULT 'round_robin'::"text",
    "territory_id" "uuid",
    "max_leads_per_user" integer,
    "assigned_queue_id" "uuid"
);


ALTER TABLE "public"."lead_assignment_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_score_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "weights_json" "jsonb" DEFAULT '{"decay": {"weekly_percentage": 10}, "logistics": {"urgent_shipment": 15, "high_value_cargo": 20}, "behavioral": {"page_view": 2, "email_opened": 5, "link_clicked": 10, "form_submission": 20}, "demographic": {"title_vp": 15, "title_cxo": 20, "title_manager": 10}}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lead_score_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_score_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "old_score" integer,
    "new_score" integer,
    "change_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lead_score_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_scoring_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "criteria_type" "text" NOT NULL,
    "criteria_value" "text" NOT NULL,
    "score_points" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lead_scoring_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "company" "text",
    "title" "text",
    "email" "text",
    "phone" "text",
    "status" "public"."lead_status" DEFAULT 'new'::"public"."lead_status",
    "source" "public"."lead_source" DEFAULT 'other'::"public"."lead_source",
    "estimated_value" numeric(15,2),
    "expected_close_date" "date",
    "description" "text",
    "notes" "text",
    "owner_id" "uuid",
    "converted_account_id" "uuid",
    "converted_contact_id" "uuid",
    "converted_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "lead_score" integer DEFAULT 0,
    "qualification_status" "text" DEFAULT 'unqualified'::"text",
    "last_activity_date" timestamp with time zone,
    "conversion_probability" integer,
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "owner_queue_id" "uuid",
    "name" "text"
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."margin_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "margin_methods_code_check" CHECK (("code" = ANY (ARRAY['fixed'::"text", 'percent'::"text"])))
);


ALTER TABLE "public"."margin_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."margin_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "default_method_id" "uuid" NOT NULL,
    "default_value" numeric NOT NULL,
    "rounding_rule" "text",
    "min_margin" numeric,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."margin_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "provider" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "client_secret" "text" NOT NULL,
    "tenant_id_provider" "text",
    "redirect_uri" "text" NOT NULL,
    "scopes" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "oauth_configurations_provider_check" CHECK (("provider" = ANY (ARRAY['office365'::"text", 'gmail'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."oauth_configurations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opportunities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "stage" "public"."opportunity_stage" DEFAULT 'prospecting'::"public"."opportunity_stage" NOT NULL,
    "amount" numeric(15,2),
    "probability" integer,
    "close_date" "date",
    "account_id" "uuid",
    "contact_id" "uuid",
    "lead_id" "uuid",
    "owner_id" "uuid",
    "lead_source" "public"."lead_source",
    "next_step" "text",
    "competitors" "text",
    "campaign_id" "uuid",
    "type" "text",
    "forecast_category" "text",
    "expected_revenue" numeric(15,2),
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "closed_at" timestamp with time zone,
    "salesforce_opportunity_id" "text",
    "salesforce_sync_status" "text",
    "salesforce_last_synced" timestamp with time zone,
    "salesforce_error" "text",
    "primary_quote_id" "uuid",
    CONSTRAINT "opportunities_probability_check" CHECK ((("probability" >= 0) AND ("probability" <= 100))),
    CONSTRAINT "opportunities_salesforce_sync_status_check" CHECK (("salesforce_sync_status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'error'::"text"]))),
    CONSTRAINT "valid_close_date" CHECK ((("close_date" >= CURRENT_DATE) OR ("stage" = ANY (ARRAY['closed_won'::"public"."opportunity_stage", 'closed_lost'::"public"."opportunity_stage"]))))
);


ALTER TABLE "public"."opportunities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opportunity_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "line_number" integer NOT NULL,
    "product_name" "text" NOT NULL,
    "description" "text",
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(15,2) DEFAULT 0 NOT NULL,
    "discount_percent" numeric(5,2) DEFAULT 0,
    "discount_amount" numeric(15,2) DEFAULT 0,
    "tax_amount" numeric(15,2) DEFAULT 0,
    "line_total" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."opportunity_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opportunity_probability_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "old_probability" integer,
    "new_probability" integer,
    "old_stage" "public"."opportunity_stage",
    "new_stage" "public"."opportunity_stage",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."opportunity_probability_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "category_name" "text" NOT NULL,
    "category_code" "text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."package_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_sizes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "size_name" "text" NOT NULL,
    "size_code" "text",
    "length_ft" numeric,
    "width_ft" numeric,
    "height_ft" numeric,
    "max_weight_kg" numeric,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."package_sizes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accessed_at" timestamp with time zone,
    "access_count" integer DEFAULT 0,
    "tenant_id" "uuid",
    "last_ip" "text",
    "last_user_agent" "text",
    "flagged" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."portal_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ports_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "location_name" "text" NOT NULL,
    "location_code" "text",
    "location_type" "text",
    "country" "text",
    "city" "text",
    "state_province" "text",
    "postal_code" "text",
    "coordinates" "jsonb" DEFAULT '{}'::"jsonb",
    "facilities" "jsonb" DEFAULT '[]'::"jsonb",
    "operating_hours" "text",
    "customs_available" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ports_locations_location_type_check" CHECK (("location_type" = ANY (ARRAY['seaport'::"text", 'airport'::"text", 'inland_port'::"text", 'warehouse'::"text", 'terminal'::"text"])))
);


ALTER TABLE "public"."ports_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "avatar_url" "text",
    "is_active" boolean DEFAULT true,
    "must_change_password" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_api_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "api_provider" "text" NOT NULL,
    "api_version" "text",
    "base_url" "text" NOT NULL,
    "rate_endpoint" "text",
    "tracking_endpoint" "text",
    "label_endpoint" "text",
    "auth_type" "text" NOT NULL,
    "auth_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rate_limit_per_minute" integer DEFAULT 60,
    "rate_limit_per_day" integer,
    "supports_rate_shopping" boolean DEFAULT false,
    "supports_tracking" boolean DEFAULT false,
    "supports_label_generation" boolean DEFAULT false,
    "supports_document_upload" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "last_health_check" timestamp with time zone,
    "health_status" "text",
    "timeout_seconds" integer DEFAULT 30,
    "retry_attempts" integer DEFAULT 3,
    "custom_headers" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."provider_api_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_charge_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "charge_category_id" "uuid",
    "charge_basis_id" "uuid",
    "provider_charge_code" "text" NOT NULL,
    "provider_charge_name" "text" NOT NULL,
    "provider_charge_description" "text",
    "calculation_method" "text",
    "default_rate" numeric,
    "currency_id" "uuid",
    "applies_to_service_types" "text"[],
    "min_shipment_value" numeric,
    "max_shipment_value" numeric,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."provider_charge_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_rate_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "service_type_id" "uuid",
    "rule_name" "text" NOT NULL,
    "rule_type" "text" NOT NULL,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "priority" integer DEFAULT 100,
    "validation_message" "text",
    "is_blocking" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."provider_rate_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_rate_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "service_type_id" "uuid",
    "template_name" "text" NOT NULL,
    "template_type" "text" NOT NULL,
    "rate_structure" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "min_chargeable_weight" numeric,
    "max_chargeable_weight" numeric,
    "requires_dimensional_weight" boolean DEFAULT false,
    "requires_origin_destination" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."provider_rate_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_surcharges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "surcharge_code" "text" NOT NULL,
    "surcharge_name" "text" NOT NULL,
    "surcharge_description" "text",
    "calculation_type" "text" NOT NULL,
    "rate" numeric,
    "currency_id" "uuid",
    "applies_to_service_types" "text"[],
    "applies_to_weight_range" "jsonb",
    "applies_to_zones" "text"[],
    "applies_to_countries" "text"[],
    "requires_special_handling" boolean DEFAULT false,
    "requires_hazmat" boolean DEFAULT false,
    "requires_temperature_control" boolean DEFAULT false,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_until" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."provider_surcharges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."provider_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."queue_members" (
    "queue_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."queue_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."queues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "email" "text",
    "is_active" boolean DEFAULT true,
    "type" "text" DEFAULT 'holding'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "queues_type_check" CHECK (("type" = ANY (ARRAY['holding'::"text", 'round_robin'::"text"])))
);


ALTER TABLE "public"."queues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid",
    "quotation_version_id" "uuid",
    "quotation_version_option_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "user_id" "uuid",
    "changes" "jsonb",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quotation_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotation_audit_log" IS 'Tracks all changes to quotes, versions, and options for audit trail';



CREATE TABLE IF NOT EXISTS "public"."quotation_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "package_type" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "length_cm" numeric,
    "width_cm" numeric,
    "height_cm" numeric,
    "weight_kg" numeric,
    "volume_cbm" numeric,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quotation_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_selection_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "quotation_version_id" "uuid" NOT NULL,
    "selected_option_id" "uuid" NOT NULL,
    "reason" "text",
    "selected_by" "uuid",
    "selected_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quotation_selection_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_version_option_legs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quotation_version_option_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 1 NOT NULL,
    "mode_id" "uuid",
    "service_id" "uuid",
    "origin_location" "text",
    "destination_location" "text",
    "provider_id" "uuid",
    "planned_departure" timestamp with time zone,
    "planned_arrival" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_type_id" "uuid",
    "mode" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "franchise_id" "uuid",
    "leg_type" "text" DEFAULT 'transport'::"text",
    "service_only_category" "text",
    CONSTRAINT "quotation_version_option_legs_leg_type_check" CHECK (("leg_type" = ANY (ARRAY['transport'::"text", 'service'::"text"])))
);


ALTER TABLE "public"."quotation_version_option_legs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quotation_version_option_legs"."leg_type" IS 'Type of leg: transport (origin to destination movement) or service (stationary service like warehousing, customs, packing)';



COMMENT ON COLUMN "public"."quotation_version_option_legs"."service_only_category" IS 'Category for service-only legs: warehousing, customs, packing, inspection, etc. Only used when leg_type = service';



CREATE TABLE IF NOT EXISTS "public"."quotation_version_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quotation_version_id" "uuid" NOT NULL,
    "carrier_rate_id" "uuid",
    "recommended" boolean DEFAULT false,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "trade_direction_id" "uuid",
    "provider_type_id" "uuid",
    "quote_currency_id" "uuid",
    "margin_method_id" "uuid",
    "margin_value" numeric,
    "auto_margin_enabled" boolean DEFAULT false NOT NULL,
    "min_margin" numeric,
    "rounding_rule" "text",
    "buy_subtotal" numeric DEFAULT 0 NOT NULL,
    "sell_subtotal" numeric DEFAULT 0 NOT NULL,
    "margin_amount" numeric DEFAULT 0 NOT NULL,
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "option_name" "text",
    "locked" boolean DEFAULT false,
    "total_buy" numeric DEFAULT 0,
    "total_sell" numeric DEFAULT 0,
    "leg_count" integer DEFAULT 0,
    "charge_count" integer DEFAULT 0,
    "last_calculated_at" timestamp with time zone,
    "franchise_id" "uuid",
    "margin_percentage" numeric
);


ALTER TABLE "public"."quotation_version_options" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quotation_version_options"."option_name" IS 'Human-readable name for the option (e.g., Option A, Option B)';



COMMENT ON COLUMN "public"."quotation_version_options"."locked" IS 'Prevents further edits to this option';



COMMENT ON COLUMN "public"."quotation_version_options"."total_buy" IS 'Auto-calculated sum of all BUY side charges';



COMMENT ON COLUMN "public"."quotation_version_options"."total_sell" IS 'Auto-calculated sum of all SELL side charges';



COMMENT ON COLUMN "public"."quotation_version_options"."margin_percentage" IS 'Calculated margin as a percentage of buy cost';



CREATE TABLE IF NOT EXISTS "public"."quotation_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "major" integer DEFAULT 1 NOT NULL,
    "minor" integer DEFAULT 0 NOT NULL,
    "change_reason" "text",
    "valid_until" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version_number" integer NOT NULL,
    "kind" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "is_active" boolean DEFAULT false,
    "is_current" boolean DEFAULT false,
    "locked_at" timestamp with time zone,
    "locked_by" "uuid",
    "franchise_id" "uuid",
    CONSTRAINT "quotation_versions_kind_check" CHECK (("kind" = ANY (ARRAY['minor'::"text", 'major'::"text"])))
);


ALTER TABLE "public"."quotation_versions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quotation_versions"."is_current" IS 'Indicates if this is the current active version for the quote';



COMMENT ON COLUMN "public"."quotation_versions"."locked_at" IS 'When this version was locked (prevents further edits)';



CREATE TABLE IF NOT EXISTS "public"."quote_acceptances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "token_id" "uuid" NOT NULL,
    "decision" "text" NOT NULL,
    "decided_at" timestamp with time zone DEFAULT "now"(),
    "name" "text",
    "email" "text",
    "ip_address" "text",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "quote_acceptances_decision_check" CHECK (("decision" = ANY (ARRAY['accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."quote_acceptances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_share_id" "uuid",
    "quote_id" "uuid" NOT NULL,
    "accessed_at" timestamp with time zone DEFAULT "now"(),
    "visitor_email" "text",
    "action_type" "text"
);


ALTER TABLE "public"."quote_access_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_option_id" "uuid" NOT NULL,
    "charge_side_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "basis_id" "uuid" NOT NULL,
    "quantity" numeric DEFAULT 1 NOT NULL,
    "unit" "text",
    "rate" numeric DEFAULT 0 NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "currency_id" "uuid",
    "min_amount" numeric,
    "max_amount" numeric,
    "note" "text",
    "sort_order" integer DEFAULT 1000 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "leg_id" "uuid" NOT NULL,
    "franchise_id" "uuid"
);


ALTER TABLE "public"."quote_charges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "comment_text" "text" NOT NULL,
    "author_type" "text" NOT NULL,
    "author_user_id" "uuid",
    "is_internal" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "document_name" "text" NOT NULL,
    "file_url" "text",
    "is_public" boolean DEFAULT false,
    "generated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_email_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "email_type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "to_emails" "text"[] NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "delivery_status" "text" DEFAULT 'sent'::"text"
);


ALTER TABLE "public"."quote_email_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "line_number" integer NOT NULL,
    "product_name" "text" NOT NULL,
    "description" "text",
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(15,2) DEFAULT 0 NOT NULL,
    "discount_percent" numeric(5,2) DEFAULT 0,
    "discount_amount" numeric(15,2) DEFAULT 0,
    "tax_percent" numeric(5,2) DEFAULT 0,
    "tax_amount" numeric(15,2) DEFAULT 0,
    "line_total" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "package_category_id" "uuid",
    "package_size_id" "uuid",
    "cargo_type_id" "uuid",
    "weight_kg" numeric,
    "volume_cbm" numeric,
    "special_instructions" "text",
    "service_type_id" "uuid"
);


ALTER TABLE "public"."quote_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_legs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_option_id" "uuid" NOT NULL,
    "leg_number" integer DEFAULT 1 NOT NULL,
    "mode" "text",
    "service_type_id" "uuid",
    "origin_location" "text",
    "destination_location" "text",
    "carrier_id" "uuid",
    "transit_days" integer,
    "departure_date" timestamp with time zone,
    "arrival_date" timestamp with time zone,
    "notes" "text",
    "sort_order" integer DEFAULT 1000,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_legs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_number_config_franchise" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid" NOT NULL,
    "prefix" "text" DEFAULT 'QUO'::"text" NOT NULL,
    "reset_policy" "public"."quote_reset_policy" DEFAULT 'none'::"public"."quote_reset_policy" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_number_config_franchise" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_number_config_tenant" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "prefix" "text" DEFAULT 'QUO'::"text" NOT NULL,
    "reset_policy" "public"."quote_reset_policy" DEFAULT 'none'::"public"."quote_reset_policy" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_number_config_tenant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_number_sequences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "period_key" "text" NOT NULL,
    "last_sequence" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_number_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_option_legs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_option_id" "uuid" NOT NULL,
    "leg_order" integer DEFAULT 1 NOT NULL,
    "mode_id" "uuid",
    "service_id" "uuid",
    "origin_location" "text",
    "destination_location" "text",
    "provider_id" "uuid",
    "planned_departure" timestamp with time zone,
    "planned_arrival" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_type_id" "uuid",
    "container_type_id" "uuid",
    "container_size_id" "uuid",
    "trade_direction_id" "uuid",
    "leg_currency_id" "uuid"
);


ALTER TABLE "public"."quote_option_legs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_version_id" "uuid" NOT NULL,
    "provider_id" "uuid",
    "service_type_id" "uuid",
    "service_id" "uuid",
    "container_type_id" "uuid",
    "container_size_id" "uuid",
    "package_category_id" "uuid",
    "package_size_id" "uuid",
    "origin_port_id" "uuid",
    "destination_port_id" "uuid",
    "transit_time_days" integer,
    "free_time_days" integer,
    "validity_date" timestamp with time zone,
    "currency_id" "uuid",
    "buy_subtotal" numeric DEFAULT 0 NOT NULL,
    "sell_subtotal" numeric DEFAULT 0 NOT NULL,
    "margin_amount" numeric DEFAULT 0 NOT NULL,
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trade_direction_id" "uuid",
    "provider_type_id" "uuid",
    "quote_currency_id" "uuid",
    "margin_method_id" "uuid",
    "margin_value" numeric,
    "auto_margin_enabled" boolean DEFAULT false NOT NULL,
    "min_margin" numeric,
    "rounding_rule" "text"
);


ALTER TABLE "public"."quote_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_presentation_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "template_name" "text" NOT NULL,
    "template_type" "text" NOT NULL,
    "logo_url" "text",
    "primary_color" "text",
    "secondary_color" "text",
    "font_family" "text" DEFAULT 'Arial'::"text",
    "layout_config" "jsonb" DEFAULT '{}'::"jsonb",
    "header_template" "text",
    "footer_template" "text",
    "terms_conditions_template" "text",
    "show_carrier_details" boolean DEFAULT true,
    "show_transit_times" boolean DEFAULT true,
    "show_buy_prices" boolean DEFAULT false,
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_presentation_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_selection" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "version_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "selected_by" "uuid",
    "reason" "text",
    "selected_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quote_selection" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_sequences_franchise" (
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid" NOT NULL,
    "seq_value" bigint DEFAULT 0 NOT NULL,
    "last_reset_bucket" "text"
);


ALTER TABLE "public"."quote_sequences_franchise" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_sequences_tenant" (
    "tenant_id" "uuid" NOT NULL,
    "seq_value" bigint DEFAULT 0 NOT NULL,
    "last_reset_bucket" "text"
);


ALTER TABLE "public"."quote_sequences_tenant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "share_token" "text" NOT NULL,
    "access_type" "text" DEFAULT 'view_only'::"text",
    "max_views" integer,
    "current_views" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_by" "uuid",
    "last_accessed_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "version" integer DEFAULT 1,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "total" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "quote_number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "opportunity_id" "uuid",
    "account_id" "uuid",
    "contact_id" "uuid",
    "owner_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "valid_until" "date",
    "subtotal" numeric(15,2) DEFAULT 0,
    "discount_amount" numeric(15,2) DEFAULT 0,
    "discount_percent" numeric(5,2) DEFAULT 0,
    "tax_amount" numeric(15,2) DEFAULT 0,
    "tax_percent" numeric(5,2) DEFAULT 0,
    "shipping_amount" numeric(15,2) DEFAULT 0,
    "total_amount" numeric(15,2) DEFAULT 0,
    "currency" "text" DEFAULT 'USD'::"text",
    "terms_conditions" "text",
    "notes" "text",
    "billing_address" "jsonb" DEFAULT '{}'::"jsonb",
    "shipping_address" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "incoterms" "text",
    "origin_location" "jsonb" DEFAULT '{}'::"jsonb",
    "destination_location" "jsonb" DEFAULT '{}'::"jsonb",
    "cargo_details" "jsonb" DEFAULT '{}'::"jsonb",
    "special_handling" "jsonb" DEFAULT '[]'::"jsonb",
    "regulatory_data" "jsonb" DEFAULT '{}'::"jsonb",
    "compliance_status" "text" DEFAULT 'pending'::"text",
    "carrier_id" "uuid",
    "service_id" "uuid",
    "is_primary" boolean DEFAULT false,
    "consignee_id" "uuid",
    "origin_port_id" "uuid",
    "destination_port_id" "uuid",
    "cost_price" numeric,
    "sell_price" numeric,
    "margin_amount" numeric,
    "margin_percentage" numeric,
    "additional_costs" "jsonb" DEFAULT '[]'::"jsonb",
    "incoterm_id" "uuid",
    "payment_terms" "text",
    "service_type_id" "uuid",
    "current_version_id" "uuid",
    CONSTRAINT "quotes_compliance_status_check" CHECK (("compliance_status" = ANY (ARRAY['pending'::"text", 'validated'::"text", 'requires_review'::"text", 'non_compliant'::"text"])))
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quotes"."current_version_id" IS 'Reference to the currently active version';



CREATE TABLE IF NOT EXISTS "public"."rate_calculations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "carrier_rate_id" "uuid",
    "calculation_breakdown" "jsonb" NOT NULL,
    "applied_surcharges" "jsonb" DEFAULT '[]'::"jsonb",
    "applied_discounts" "jsonb" DEFAULT '[]'::"jsonb",
    "final_rate" numeric NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"(),
    "calculated_by" "uuid"
);


ALTER TABLE "public"."rate_calculations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_components" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "rate_id" "uuid" NOT NULL,
    "component_type" "text" NOT NULL,
    "calc_method" "text" NOT NULL,
    "value" numeric NOT NULL,
    "min_amount" numeric,
    "max_amount" numeric,
    "notes" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rate_components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "mode" "public"."transport_mode" NOT NULL,
    "carrier_id" "uuid",
    "origin" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "validity_start" "date",
    "validity_end" "date",
    "contract_type" "public"."contract_type" NOT NULL,
    "base_price" numeric,
    "currency" "text" DEFAULT 'USD'::"text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "route_name" "text" NOT NULL,
    "route_code" "text" NOT NULL,
    "origin_warehouse_id" "uuid",
    "destination_warehouse_id" "uuid",
    "waypoints" "jsonb" DEFAULT '[]'::"jsonb",
    "distance_km" numeric,
    "estimated_duration_hours" numeric,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."routes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "user_id" "uuid",
    "account_id" "uuid",
    "to_emails" "jsonb" NOT NULL,
    "cc_emails" "jsonb",
    "bcc_emails" "jsonb",
    "subject" "text",
    "body_html" "text",
    "body_text" "text",
    "template_id" "uuid",
    "template_variables" "jsonb",
    "scheduled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "priority" "text" DEFAULT 'normal'::"text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scheduled_emails_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "scheduled_emails_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."scheduled_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schema_migration_progress" (
    "version" "text" NOT NULL,
    "next_index" integer DEFAULT 0 NOT NULL,
    "total_statements" integer,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schema_migration_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "version" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "execution_time_ms" integer,
    "success" boolean DEFAULT true,
    "error_message" "text"
);


ALTER TABLE "public"."schema_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "attributes" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_leg_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon_name" "text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 1000,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_leg_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_leg_categories" IS 'Predefined categories for service-only legs (warehousing, customs, etc.)';



CREATE TABLE IF NOT EXISTS "public"."service_modes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_modes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_type_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid",
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "tenant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "service_type_id" "uuid" NOT NULL
);


ALTER TABLE "public"."service_type_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "code" "text" NOT NULL,
    "mode_id" "uuid",
    "use_dimensional_weight" boolean DEFAULT false,
    "dim_divisor" numeric DEFAULT 6000,
    CONSTRAINT "service_types_dim_divisor_check" CHECK (("dim_divisor" > (0)::numeric))
);


ALTER TABLE "public"."service_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_types" IS 'Unbounded service types table - accepts any service type without restrictions';



COMMENT ON COLUMN "public"."service_types"."code" IS 'Unique code identifier for service type (e.g., ocean, air, trucking)';



COMMENT ON COLUMN "public"."service_types"."use_dimensional_weight" IS 'Whether to calculate chargeable weight using dimensional (volumetric) weight';



COMMENT ON COLUMN "public"."service_types"."dim_divisor" IS 'Divisor for dimensional weight calculation (L×W×H)/divisor. Default 6000 for air freight';



CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "service_code" "text" NOT NULL,
    "service_name" "text" NOT NULL,
    "service_type" "text" NOT NULL,
    "description" "text",
    "base_price" numeric,
    "pricing_unit" "text",
    "transit_time_days" integer,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "shipment_type" "public"."shipment_type" NOT NULL,
    "service_type_id" "uuid"
);


ALTER TABLE "public"."services" OWNER TO "postgres";


COMMENT ON COLUMN "public"."services"."service_type_id" IS 'Foreign key reference to service_types table';



CREATE TABLE IF NOT EXISTS "public"."shipment_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "path" "text" NOT NULL,
    "size" bigint,
    "content_type" "text",
    "public_url" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "document_type" "public"."document_type"
);


ALTER TABLE "public"."shipment_attachments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shipment_attachments"."document_type" IS 'Document type (e.g., proof_of_delivery) for this attachment';



CREATE TABLE IF NOT EXISTS "public"."shipment_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_id" "uuid" NOT NULL,
    "item_number" integer NOT NULL,
    "description" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "weight_kg" numeric,
    "volume_cbm" numeric,
    "dimensions" "jsonb",
    "package_type" "text",
    "hs_code" "text",
    "value" numeric,
    "currency" "text" DEFAULT 'USD'::"text",
    "is_hazardous" boolean DEFAULT false,
    "hazard_class" "text",
    "special_handling" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shipment_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shipments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "shipment_number" "text" NOT NULL,
    "shipment_type" "public"."shipment_type" NOT NULL,
    "status" "public"."shipment_status" DEFAULT 'draft'::"public"."shipment_status",
    "account_id" "uuid",
    "contact_id" "uuid",
    "origin_address" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "destination_address" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "origin_warehouse_id" "uuid",
    "destination_warehouse_id" "uuid",
    "pickup_date" timestamp with time zone,
    "estimated_delivery_date" timestamp with time zone,
    "actual_delivery_date" timestamp with time zone,
    "total_weight_kg" numeric,
    "total_volume_cbm" numeric,
    "total_packages" integer DEFAULT 0,
    "container_type" "public"."container_type",
    "container_number" "text",
    "declared_value" numeric,
    "freight_charges" numeric,
    "insurance_charges" numeric,
    "customs_charges" numeric,
    "other_charges" numeric,
    "total_charges" numeric,
    "currency" "text" DEFAULT 'USD'::"text",
    "current_location" "jsonb",
    "current_status_description" "text",
    "service_level" "text",
    "priority_level" "text" DEFAULT 'normal'::"text",
    "special_instructions" "text",
    "customs_required" boolean DEFAULT false,
    "insurance_required" boolean DEFAULT false,
    "reference_number" "text",
    "purchase_order_number" "text",
    "invoice_number" "text",
    "assigned_to" "uuid",
    "vehicle_id" "uuid",
    "driver_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pod_received" boolean DEFAULT false NOT NULL,
    "pod_received_at" timestamp with time zone,
    "pod_status" "text" DEFAULT 'pending'::"text",
    "pod_received_by" "text",
    "pod_signature_url" "text",
    "pod_notes" "text",
    "pod_documents" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "shipments_pod_status_check" CHECK (("pod_status" = ANY (ARRAY['pending'::"text", 'received'::"text", 'rejected'::"text", 'disputed'::"text"])))
);


ALTER TABLE "public"."shipments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shipments"."pod_received" IS 'True once POD (proof of delivery) has been received';



COMMENT ON COLUMN "public"."shipments"."pod_received_at" IS 'Timestamp when POD was received';



COMMENT ON COLUMN "public"."shipments"."pod_status" IS 'Status of proof of delivery: pending, received, rejected, disputed';



COMMENT ON COLUMN "public"."shipments"."pod_received_by" IS 'Name of person who received the shipment';



COMMENT ON COLUMN "public"."shipments"."pod_signature_url" IS 'URL to signature image or document';



COMMENT ON COLUMN "public"."shipments"."pod_notes" IS 'Additional notes about the delivery';



COMMENT ON COLUMN "public"."shipments"."pod_documents" IS 'Array of POD document URLs and metadata';



CREATE TABLE IF NOT EXISTS "public"."shipping_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "shipment_type" "public"."shipment_type" NOT NULL,
    "service_level" "text",
    "origin_country" "text",
    "destination_country" "text",
    "origin_zone" "text",
    "destination_zone" "text",
    "min_weight_kg" numeric,
    "max_weight_kg" numeric,
    "rate_per_kg" numeric,
    "base_rate" numeric,
    "currency" "text" DEFAULT 'USD'::"text",
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shipping_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_id" "uuid",
    "name" "text" NOT NULL,
    "code_iso" "text",
    "code_national" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature_key" "text" NOT NULL,
    "feature_name" "text" NOT NULL,
    "feature_category" "text" NOT NULL,
    "description" "text",
    "is_usage_based" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "stripe_invoice_id" "text",
    "invoice_number" "text",
    "amount_due" numeric(10,2) NOT NULL,
    "amount_paid" numeric(10,2) DEFAULT 0,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "due_date" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "invoice_pdf_url" "text",
    "billing_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "plan_type" "public"."plan_type" DEFAULT 'crm_base'::"public"."plan_type" NOT NULL,
    "tier" "public"."subscription_tier",
    "billing_period" "public"."billing_period" DEFAULT 'monthly'::"public"."billing_period" NOT NULL,
    "price_monthly" numeric(10,2) NOT NULL,
    "price_annual" numeric(10,2),
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "limits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stripe_price_id" "text",
    "stripe_product_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'trial'::"public"."subscription_status" NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_customer_id" "text",
    "current_period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "trial_end" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "auto_renew" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "logo_url" "text",
    "domain" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stripe_customer_id" "text",
    "billing_email" "text",
    "payment_method" "jsonb" DEFAULT '{}'::"jsonb",
    "billing_address" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "tenants_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'basic'::"text", 'professional'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenants" IS 'Tenant organizations in the system';



CREATE TABLE IF NOT EXISTS "public"."territories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "criteria" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."territories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."territory_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "territory_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."territory_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."territory_geographies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "territory_id" "uuid" NOT NULL,
    "continent_id" "uuid",
    "country_id" "uuid",
    "state_id" "uuid",
    "city_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "territory_geography_type_check" CHECK ((((((("continent_id" IS NOT NULL))::integer + (("country_id" IS NOT NULL))::integer) + (("state_id" IS NOT NULL))::integer) + (("city_id" IS NOT NULL))::integer) = 1))
);


ALTER TABLE "public"."territory_geographies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."themes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "colors" "jsonb" DEFAULT '{}'::"jsonb",
    "typography" "jsonb" DEFAULT '{}'::"jsonb",
    "spacing" "jsonb" DEFAULT '{}'::"jsonb",
    "borders" "jsonb" DEFAULT '{}'::"jsonb",
    "shadows" "jsonb" DEFAULT '{}'::"jsonb",
    "custom_css" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."themes" OWNER TO "postgres";


COMMENT ON TABLE "public"."themes" IS 'Stores theme configurations for tenants';



COMMENT ON COLUMN "public"."themes"."is_default" IS 'Whether this is the default theme for the tenant';



COMMENT ON COLUMN "public"."themes"."colors" IS 'Color palette configuration';



COMMENT ON COLUMN "public"."themes"."typography" IS 'Typography settings';



COMMENT ON COLUMN "public"."themes"."spacing" IS 'Spacing scale';



COMMENT ON COLUMN "public"."themes"."borders" IS 'Border configurations';



COMMENT ON COLUMN "public"."themes"."shadows" IS 'Shadow configurations';



COMMENT ON COLUMN "public"."themes"."custom_css" IS 'Additional custom CSS';



CREATE TABLE IF NOT EXISTS "public"."tracking_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_id" "uuid" NOT NULL,
    "event_type" "public"."tracking_event_type" NOT NULL,
    "event_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location" "jsonb",
    "location_name" "text",
    "description" "text",
    "notes" "text",
    "is_milestone" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tracking_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trade_directions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trade_directions_code_check" CHECK (("code" = ANY (ARRAY['import'::"text", 'export'::"text", 'inland'::"text"])))
);


ALTER TABLE "public"."trade_directions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transport_modes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "icon_name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "display_order" integer DEFAULT 1000 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transport_modes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ui_themes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "tokens" "jsonb" NOT NULL,
    "scope" "text" NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "user_id" "uuid",
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ui_themes_scope_check" CHECK (("scope" = ANY (ARRAY['platform'::"text", 'tenant'::"text", 'franchise'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."ui_themes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "feature_key" "text" NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "limit_count" integer,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."usage_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_capacity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "max_leads" integer DEFAULT 50,
    "current_leads" integer DEFAULT 0,
    "is_available" boolean DEFAULT true,
    "last_assigned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_capacity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_custom_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_custom_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "admin_override_enabled" boolean DEFAULT false NOT NULL,
    "theme" character varying(20) DEFAULT 'system'::character varying,
    "language" character varying(10) DEFAULT 'en'::character varying,
    "notifications_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "vehicle_number" "text" NOT NULL,
    "vehicle_type" "text" NOT NULL,
    "make" "text",
    "model" "text",
    "year" integer,
    "capacity_kg" numeric,
    "capacity_cbm" numeric,
    "status" "public"."vehicle_status" DEFAULT 'available'::"public"."vehicle_status",
    "current_location" "jsonb",
    "last_maintenance_date" "date",
    "next_maintenance_date" "date",
    "insurance_expiry" "date",
    "registration_expiry" "date",
    "driver_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warehouse_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "shipment_id" "uuid",
    "item_description" "text" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "weight_kg" numeric,
    "volume_cbm" numeric,
    "location_in_warehouse" "text",
    "received_date" timestamp with time zone DEFAULT "now"(),
    "expected_dispatch_date" timestamp with time zone,
    "status" "text" DEFAULT 'stored'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."warehouse_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warehouses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "warehouse_type" "text",
    "address" "jsonb" DEFAULT '{}'::"jsonb",
    "contact_person" "text",
    "contact_phone" "text",
    "contact_email" "text",
    "capacity_sqft" numeric,
    "current_utilization" numeric DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "operating_hours" "jsonb" DEFAULT '{}'::"jsonb",
    "facilities" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."warehouses" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aes_hts_codes"
    ADD CONSTRAINT "aes_hts_codes_hts_code_unique" UNIQUE ("hts_code");



ALTER TABLE ONLY "public"."aes_hts_codes"
    ADD CONSTRAINT "aes_hts_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_permissions"
    ADD CONSTRAINT "auth_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_role_hierarchy"
    ADD CONSTRAINT "auth_role_hierarchy_pkey" PRIMARY KEY ("manager_role_id", "target_role_id");



ALTER TABLE ONLY "public"."auth_role_permissions"
    ADD CONSTRAINT "auth_role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "public"."auth_roles"
    ADD CONSTRAINT "auth_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cargo_details"
    ADD CONSTRAINT "cargo_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cargo_types"
    ADD CONSTRAINT "cargo_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carrier_rate_attachments"
    ADD CONSTRAINT "carrier_rate_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carrier_rate_charges"
    ADD CONSTRAINT "carrier_rate_charges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carrier_rates"
    ADD CONSTRAINT "carrier_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carrier_service_types"
    ADD CONSTRAINT "carrier_service_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carrier_service_types"
    ADD CONSTRAINT "carrier_service_types_unique_pair" UNIQUE ("tenant_id", "carrier_id", "service_type");



ALTER TABLE ONLY "public"."carriers"
    ADD CONSTRAINT "carriers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carriers"
    ADD CONSTRAINT "carriers_unique_name_per_tenant" UNIQUE ("tenant_id", "carrier_name");



ALTER TABLE ONLY "public"."charge_bases"
    ADD CONSTRAINT "charge_bases_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."charge_bases"
    ADD CONSTRAINT "charge_bases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."charge_categories"
    ADD CONSTRAINT "charge_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."charge_categories"
    ADD CONSTRAINT "charge_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."charge_sides"
    ADD CONSTRAINT "charge_sides_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."charge_sides"
    ADD CONSTRAINT "charge_sides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."charge_tier_config"
    ADD CONSTRAINT "charge_tier_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."charge_tier_ranges"
    ADD CONSTRAINT "charge_tier_ranges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."charge_types"
    ADD CONSTRAINT "charge_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."charge_weight_breaks"
    ADD CONSTRAINT "charge_weight_breaks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_country_state_name_key" UNIQUE ("country_id", "state_id", "name");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_checks"
    ADD CONSTRAINT "compliance_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_rules"
    ADD CONSTRAINT "compliance_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consignees"
    ADD CONSTRAINT "consignees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."container_sizes"
    ADD CONSTRAINT "container_sizes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."container_sizes"
    ADD CONSTRAINT "container_sizes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."container_types"
    ADD CONSTRAINT "container_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."container_types"
    ADD CONSTRAINT "container_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."continents"
    ADD CONSTRAINT "continents_code_international_key" UNIQUE ("code_international");



ALTER TABLE ONLY "public"."continents"
    ADD CONSTRAINT "continents_code_national_key" UNIQUE ("code_national");



ALTER TABLE ONLY "public"."continents"
    ADD CONSTRAINT "continents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_code_iso2_key" UNIQUE ("code_iso2");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_code_iso3_key" UNIQUE ("code_iso3");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."currencies"
    ADD CONSTRAINT "currencies_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."currencies"
    ADD CONSTRAINT "currencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_role_permissions"
    ADD CONSTRAINT "custom_role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_role_permissions"
    ADD CONSTRAINT "custom_role_permissions_role_id_permission_key_key" UNIQUE ("role_id", "permission_key");



ALTER TABLE ONLY "public"."custom_roles"
    ADD CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_roles"
    ADD CONSTRAINT "custom_roles_tenant_id_name_key" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."customer_selections"
    ADD CONSTRAINT "customer_selections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customs_documents"
    ADD CONSTRAINT "customs_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_preferences"
    ADD CONSTRAINT "dashboard_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_preferences"
    ADD CONSTRAINT "dashboard_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_document_id_version_key" UNIQUE ("document_id", "version");



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_account_delegations"
    ADD CONSTRAINT "email_account_delegations_account_id_delegate_user_id_key" UNIQUE ("account_id", "delegate_user_id");



ALTER TABLE ONLY "public"."email_account_delegations"
    ADD CONSTRAINT "email_account_delegations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_accounts"
    ADD CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_accounts"
    ADD CONSTRAINT "email_accounts_user_id_email_address_key" UNIQUE ("user_id", "email_address");



ALTER TABLE ONLY "public"."email_audit_log"
    ADD CONSTRAINT "email_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_filters"
    ADD CONSTRAINT "email_filters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_account_id_message_id_key" UNIQUE ("account_id", "message_id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_transfer_items"
    ADD CONSTRAINT "entity_transfer_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_transfers"
    ADD CONSTRAINT "entity_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."franchises"
    ADD CONSTRAINT "franchises_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."franchises"
    ADD CONSTRAINT "franchises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fx_rates"
    ADD CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."history_filter_presets"
    ADD CONSTRAINT "history_filter_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."history_filter_presets"
    ADD CONSTRAINT "history_filter_presets_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."import_errors"
    ADD CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_history_details"
    ADD CONSTRAINT "import_history_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_history"
    ADD CONSTRAINT "import_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incoterms"
    ADD CONSTRAINT "incoterms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_assignment_history"
    ADD CONSTRAINT "lead_assignment_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_assignment_queue"
    ADD CONSTRAINT "lead_assignment_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_assignment_rules"
    ADD CONSTRAINT "lead_assignment_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_score_config"
    ADD CONSTRAINT "lead_score_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_score_config"
    ADD CONSTRAINT "lead_score_config_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."lead_score_logs"
    ADD CONSTRAINT "lead_score_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_scoring_rules"
    ADD CONSTRAINT "lead_scoring_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."margin_methods"
    ADD CONSTRAINT "margin_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."margin_profiles"
    ADD CONSTRAINT "margin_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_configurations"
    ADD CONSTRAINT "oauth_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_configurations"
    ADD CONSTRAINT "oauth_configurations_user_id_provider_key" UNIQUE ("user_id", "provider");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opportunity_items"
    ADD CONSTRAINT "opportunity_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opportunity_probability_history"
    ADD CONSTRAINT "opportunity_probability_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_categories"
    ADD CONSTRAINT "package_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_sizes"
    ADD CONSTRAINT "package_sizes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."ports_locations"
    ADD CONSTRAINT "ports_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_api_configs"
    ADD CONSTRAINT "provider_api_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_api_configs"
    ADD CONSTRAINT "provider_api_configs_unique" UNIQUE ("tenant_id", "carrier_id");



ALTER TABLE ONLY "public"."provider_charge_mappings"
    ADD CONSTRAINT "provider_charge_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_charge_mappings"
    ADD CONSTRAINT "provider_charge_mappings_unique" UNIQUE ("carrier_id", "provider_charge_code");



ALTER TABLE ONLY "public"."provider_rate_rules"
    ADD CONSTRAINT "provider_rate_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_rate_templates"
    ADD CONSTRAINT "provider_rate_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_rate_templates"
    ADD CONSTRAINT "provider_rate_templates_unique" UNIQUE ("carrier_id", "service_type_id", "template_name");



ALTER TABLE ONLY "public"."provider_surcharges"
    ADD CONSTRAINT "provider_surcharges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_surcharges"
    ADD CONSTRAINT "provider_surcharges_unique" UNIQUE ("carrier_id", "surcharge_code");



ALTER TABLE ONLY "public"."provider_types"
    ADD CONSTRAINT "provider_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."queue_members"
    ADD CONSTRAINT "queue_members_pkey" PRIMARY KEY ("queue_id", "user_id");



ALTER TABLE ONLY "public"."queues"
    ADD CONSTRAINT "queues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_audit_log"
    ADD CONSTRAINT "quotation_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_packages"
    ADD CONSTRAINT "quotation_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_selection_events"
    ADD CONSTRAINT "quotation_selection_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_version_option_legs"
    ADD CONSTRAINT "quotation_version_option_legs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_version_options"
    ADD CONSTRAINT "quotation_version_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_versions"
    ADD CONSTRAINT "quotation_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_acceptances"
    ADD CONSTRAINT "quote_acceptances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_access_logs"
    ADD CONSTRAINT "quote_access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_charges"
    ADD CONSTRAINT "quote_charges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_comments"
    ADD CONSTRAINT "quote_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_documents"
    ADD CONSTRAINT "quote_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_email_history"
    ADD CONSTRAINT "quote_email_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_events"
    ADD CONSTRAINT "quote_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_legs"
    ADD CONSTRAINT "quote_legs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_number_config_franchise"
    ADD CONSTRAINT "quote_number_config_franchise_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_number_config_franchise"
    ADD CONSTRAINT "quote_number_config_franchise_tenant_id_franchise_id_key" UNIQUE ("tenant_id", "franchise_id");



ALTER TABLE ONLY "public"."quote_number_config_tenant"
    ADD CONSTRAINT "quote_number_config_tenant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_number_config_tenant"
    ADD CONSTRAINT "quote_number_config_tenant_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."quote_number_sequences"
    ADD CONSTRAINT "quote_number_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_option_legs"
    ADD CONSTRAINT "quote_option_legs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_presentation_templates"
    ADD CONSTRAINT "quote_presentation_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_selection"
    ADD CONSTRAINT "quote_selection_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_selection"
    ADD CONSTRAINT "quote_selection_quote_id_key" UNIQUE ("quote_id");



ALTER TABLE ONLY "public"."quote_sequences_franchise"
    ADD CONSTRAINT "quote_sequences_franchise_pk" PRIMARY KEY ("tenant_id", "franchise_id");



ALTER TABLE ONLY "public"."quote_sequences_tenant"
    ADD CONSTRAINT "quote_sequences_tenant_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."quote_shares"
    ADD CONSTRAINT "quote_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_shares"
    ADD CONSTRAINT "quote_shares_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."quote_templates"
    ADD CONSTRAINT "quote_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_versions"
    ADD CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_calculations"
    ADD CONSTRAINT "rate_calculations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_components"
    ADD CONSTRAINT "rate_components_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rates"
    ADD CONSTRAINT "rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_tenant_id_route_code_key" UNIQUE ("tenant_id", "route_code");



ALTER TABLE ONLY "public"."scheduled_emails"
    ADD CONSTRAINT "scheduled_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schema_migration_progress"
    ADD CONSTRAINT "schema_migration_progress_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "public"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "public"."service_details"
    ADD CONSTRAINT "service_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_leg_categories"
    ADD CONSTRAINT "service_leg_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."service_leg_categories"
    ADD CONSTRAINT "service_leg_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_modes"
    ADD CONSTRAINT "service_modes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_type_mappings"
    ADD CONSTRAINT "service_type_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_tenant_id_service_code_key" UNIQUE ("tenant_id", "service_code");



ALTER TABLE ONLY "public"."shipment_attachments"
    ADD CONSTRAINT "shipment_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipment_items"
    ADD CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_tenant_id_shipment_number_key" UNIQUE ("tenant_id", "shipment_number");



ALTER TABLE ONLY "public"."shipping_rates"
    ADD CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_country_code_key" UNIQUE ("country_id", "code_iso");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_features"
    ADD CONSTRAINT "subscription_features_feature_key_key" UNIQUE ("feature_key");



ALTER TABLE ONLY "public"."subscription_features"
    ADD CONSTRAINT "subscription_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_stripe_invoice_id_key" UNIQUE ("stripe_invoice_id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_tenant_id_plan_id_status_key" UNIQUE ("tenant_id", "plan_id", "status");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."territories"
    ADD CONSTRAINT "territories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."territory_assignments"
    ADD CONSTRAINT "territory_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."territory_assignments"
    ADD CONSTRAINT "territory_assignments_territory_id_user_id_key" UNIQUE ("territory_id", "user_id");



ALTER TABLE ONLY "public"."territory_geographies"
    ADD CONSTRAINT "territory_geographies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."themes"
    ADD CONSTRAINT "themes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tracking_events"
    ADD CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trade_directions"
    ADD CONSTRAINT "trade_directions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transport_modes"
    ADD CONSTRAINT "transport_modes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."transport_modes"
    ADD CONSTRAINT "transport_modes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ui_themes"
    ADD CONSTRAINT "ui_themes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."charge_tier_config"
    ADD CONSTRAINT "unique_tier_config_name" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."quotation_versions"
    ADD CONSTRAINT "uq_quote_major_minor" UNIQUE ("quote_id", "major", "minor");



ALTER TABLE ONLY "public"."quotation_versions"
    ADD CONSTRAINT "uq_quote_version_number" UNIQUE ("quote_id", "version_number");



ALTER TABLE ONLY "public"."usage_records"
    ADD CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_capacity"
    ADD CONSTRAINT "user_capacity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_capacity"
    ADD CONSTRAINT "user_capacity_user_id_tenant_id_key" UNIQUE ("user_id", "tenant_id");



ALTER TABLE ONLY "public"."user_custom_roles"
    ADD CONSTRAINT "user_custom_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_custom_roles"
    ADD CONSTRAINT "user_custom_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_tenant_id_franchise_id_key" UNIQUE ("user_id", "role", "tenant_id", "franchise_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_role_unique" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_tenant_id_vehicle_number_key" UNIQUE ("tenant_id", "vehicle_number");



ALTER TABLE ONLY "public"."warehouse_inventory"
    ADD CONSTRAINT "warehouse_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_tenant_id_code_key" UNIQUE ("tenant_id", "code");



CREATE UNIQUE INDEX "carriers_tenant_code_unique" ON "public"."carriers" USING "btree" ("tenant_id", "carrier_code") WHERE ("carrier_code" IS NOT NULL);



CREATE UNIQUE INDEX "carriers_tenant_name_unique" ON "public"."carriers" USING "btree" ("tenant_id", "lower"("carrier_name"));



CREATE UNIQUE INDEX "cities_country_state_name_unique" ON "public"."cities" USING "btree" ("country_id", "state_id", "name");



CREATE INDEX "fx_rates_idx" ON "public"."fx_rates" USING "btree" ("tenant_id", "from_currency_id", "to_currency_id", "effective_date");



CREATE INDEX "idx_accounts_account_number" ON "public"."accounts" USING "btree" ("account_number");



CREATE INDEX "idx_accounts_duns_number" ON "public"."accounts" USING "btree" ("duns_number");



CREATE INDEX "idx_accounts_franchise_id" ON "public"."accounts" USING "btree" ("franchise_id");



CREATE INDEX "idx_accounts_owner_id" ON "public"."accounts" USING "btree" ("owner_id");



CREATE INDEX "idx_accounts_parent_account_id" ON "public"."accounts" USING "btree" ("parent_account_id");



CREATE INDEX "idx_accounts_parent_id" ON "public"."accounts" USING "btree" ("parent_account_id");



CREATE INDEX "idx_accounts_sic_code" ON "public"."accounts" USING "btree" ("sic_code");



CREATE INDEX "idx_accounts_status" ON "public"."accounts" USING "btree" ("status");



CREATE INDEX "idx_accounts_tenant_id" ON "public"."accounts" USING "btree" ("tenant_id");



CREATE INDEX "idx_accounts_tenant_parent" ON "public"."accounts" USING "btree" ("tenant_id", "parent_account_id");



CREATE UNIQUE INDEX "idx_active_version_per_quote" ON "public"."quotation_versions" USING "btree" ("quote_id") WHERE ("is_active" = true);



CREATE INDEX "idx_activities_account_id" ON "public"."activities" USING "btree" ("account_id");



CREATE INDEX "idx_activities_assigned_to" ON "public"."activities" USING "btree" ("assigned_to");



CREATE INDEX "idx_activities_contact_id" ON "public"."activities" USING "btree" ("contact_id");



CREATE INDEX "idx_activities_custom_fields" ON "public"."activities" USING "gin" ("custom_fields");



CREATE INDEX "idx_activities_due_date" ON "public"."activities" USING "btree" ("due_date");



CREATE INDEX "idx_activities_franchise_id" ON "public"."activities" USING "btree" ("franchise_id");



CREATE INDEX "idx_activities_lead_id" ON "public"."activities" USING "btree" ("lead_id");



CREATE INDEX "idx_activities_opportunity_id" ON "public"."activities" USING "btree" ("opportunity_id");



CREATE INDEX "idx_activities_status" ON "public"."activities" USING "btree" ("status");



CREATE INDEX "idx_activities_tenant_id" ON "public"."activities" USING "btree" ("tenant_id");



CREATE INDEX "idx_aes_hts_codes_category" ON "public"."aes_hts_codes" USING "btree" ("category");



CREATE INDEX "idx_aes_hts_codes_description_tsv" ON "public"."aes_hts_codes" USING "gin" ("to_tsvector"('"english"'::"regconfig", "description"));



CREATE INDEX "idx_aes_hts_codes_hts_code" ON "public"."aes_hts_codes" USING "btree" ("hts_code");



CREATE INDEX "idx_assignment_history_assigned_to" ON "public"."lead_assignment_history" USING "btree" ("assigned_to");



CREATE INDEX "idx_assignment_history_lead" ON "public"."lead_assignment_history" USING "btree" ("lead_id");



CREATE INDEX "idx_assignment_queue_status" ON "public"."lead_assignment_queue" USING "btree" ("status");



CREATE INDEX "idx_audit_created_at" ON "public"."quotation_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_resource_type" ON "public"."audit_logs" USING "btree" ("resource_type");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_audit_quote_id" ON "public"."quotation_audit_log" USING "btree" ("quote_id");



CREATE INDEX "idx_audit_version_id" ON "public"."quotation_audit_log" USING "btree" ("quotation_version_id");



CREATE INDEX "idx_auth_role_permissions_role" ON "public"."auth_role_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_cargo_details_active" ON "public"."cargo_details" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_cargo_details_service" ON "public"."cargo_details" USING "btree" ("service_id");



CREATE INDEX "idx_cargo_details_tenant" ON "public"."cargo_details" USING "btree" ("tenant_id");



CREATE INDEX "idx_cargo_details_type" ON "public"."cargo_details" USING "btree" ("service_type");



CREATE INDEX "idx_carrier_rate_charges_rate" ON "public"."carrier_rate_charges" USING "btree" ("carrier_rate_id");



CREATE INDEX "idx_carrier_rate_charges_rate_id" ON "public"."carrier_rate_charges" USING "btree" ("carrier_rate_id");



CREATE INDEX "idx_carrier_rates_carrier" ON "public"."carrier_rates" USING "btree" ("carrier_id");



CREATE INDEX "idx_carrier_rates_carrier_id" ON "public"."carrier_rates" USING "btree" ("carrier_id");



CREATE INDEX "idx_carrier_rates_dates" ON "public"."carrier_rates" USING "btree" ("valid_from", "valid_until");



CREATE INDEX "idx_carrier_rates_destination_port" ON "public"."carrier_rates" USING "btree" ("destination_port_id");



CREATE INDEX "idx_carrier_rates_origin_port" ON "public"."carrier_rates" USING "btree" ("origin_port_id");



CREATE INDEX "idx_carrier_rates_reference" ON "public"."carrier_rates" USING "btree" ("rate_reference_id");



CREATE INDEX "idx_carrier_rates_route" ON "public"."carrier_rates" USING "btree" ("origin_port_id", "destination_port_id");



CREATE INDEX "idx_carrier_rates_service" ON "public"."carrier_rates" USING "btree" ("service_id");



CREATE INDEX "idx_carrier_rates_tenant" ON "public"."carrier_rates" USING "btree" ("tenant_id");



CREATE INDEX "idx_carriers_tenant" ON "public"."carriers" USING "btree" ("tenant_id");



CREATE INDEX "idx_charge_tier_config_basis" ON "public"."charge_tier_config" USING "btree" ("basis_id");



CREATE INDEX "idx_charge_tier_config_carrier" ON "public"."charge_tier_config" USING "btree" ("carrier_id");



CREATE INDEX "idx_charge_tier_config_category" ON "public"."charge_tier_config" USING "btree" ("category_id");



CREATE INDEX "idx_charge_tier_config_service_type" ON "public"."charge_tier_config" USING "btree" ("service_type_id");



CREATE INDEX "idx_charge_tier_config_tenant" ON "public"."charge_tier_config" USING "btree" ("tenant_id");



CREATE INDEX "idx_charge_tier_ranges_config" ON "public"."charge_tier_ranges" USING "btree" ("tier_config_id");



CREATE INDEX "idx_charge_tier_ranges_values" ON "public"."charge_tier_ranges" USING "btree" ("min_value", "max_value");



CREATE INDEX "idx_charge_weight_breaks_carrier" ON "public"."charge_weight_breaks" USING "btree" ("carrier_id");



CREATE INDEX "idx_charge_weight_breaks_dates" ON "public"."charge_weight_breaks" USING "btree" ("effective_from", "effective_until");



CREATE INDEX "idx_charge_weight_breaks_service_type" ON "public"."charge_weight_breaks" USING "btree" ("service_type_id");



CREATE INDEX "idx_charge_weight_breaks_tenant" ON "public"."charge_weight_breaks" USING "btree" ("tenant_id");



CREATE INDEX "idx_charge_weight_breaks_weight" ON "public"."charge_weight_breaks" USING "btree" ("min_weight_kg", "max_weight_kg");



CREATE INDEX "idx_cities_state_country" ON "public"."cities" USING "btree" ("state_id", "country_id");



CREATE INDEX "idx_compliance_checks_quote" ON "public"."compliance_checks" USING "btree" ("quote_id");



CREATE INDEX "idx_consignees_tenant" ON "public"."consignees" USING "btree" ("tenant_id");



CREATE INDEX "idx_contacts_account_id" ON "public"."contacts" USING "btree" ("account_id");



CREATE INDEX "idx_contacts_franchise_id" ON "public"."contacts" USING "btree" ("franchise_id");



CREATE INDEX "idx_contacts_owner_id" ON "public"."contacts" USING "btree" ("owner_id");



CREATE INDEX "idx_contacts_tenant_id" ON "public"."contacts" USING "btree" ("tenant_id");



CREATE INDEX "idx_countries_continent" ON "public"."countries" USING "btree" ("continent_id");



CREATE INDEX "idx_cst_active" ON "public"."carrier_service_types" USING "btree" ("is_active");



CREATE INDEX "idx_cst_tenant" ON "public"."carrier_service_types" USING "btree" ("tenant_id");



CREATE INDEX "idx_cst_tenant_type" ON "public"."carrier_service_types" USING "btree" ("tenant_id", "service_type");



CREATE INDEX "idx_customer_selections_quote_id" ON "public"."customer_selections" USING "btree" ("quote_id");



CREATE INDEX "idx_dashboard_preferences_user_id" ON "public"."dashboard_preferences" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_documents_path_unique" ON "public"."documents" USING "btree" ("path");



CREATE INDEX "idx_email_accounts_franchise_id" ON "public"."email_accounts" USING "btree" ("franchise_id");



CREATE INDEX "idx_email_accounts_tenant_id" ON "public"."email_accounts" USING "btree" ("tenant_id");



CREATE INDEX "idx_email_accounts_user_id" ON "public"."email_accounts" USING "btree" ("user_id");



CREATE INDEX "idx_email_audit_log_created_at" ON "public"."email_audit_log" USING "btree" ("created_at");



CREATE INDEX "idx_email_audit_log_email_id" ON "public"."email_audit_log" USING "btree" ("email_id");



CREATE INDEX "idx_email_audit_log_event_type" ON "public"."email_audit_log" USING "btree" ("event_type");



CREATE INDEX "idx_email_audit_log_tenant_id" ON "public"."email_audit_log" USING "btree" ("tenant_id");



CREATE INDEX "idx_email_delegations_account_id" ON "public"."email_account_delegations" USING "btree" ("account_id");



CREATE INDEX "idx_email_delegations_delegate_user_id" ON "public"."email_account_delegations" USING "btree" ("delegate_user_id");



CREATE INDEX "idx_email_delegations_is_active" ON "public"."email_account_delegations" USING "btree" ("is_active");



CREATE INDEX "idx_email_filters_account_id" ON "public"."email_filters" USING "btree" ("account_id");



CREATE INDEX "idx_email_filters_priority" ON "public"."email_filters" USING "btree" ("priority" DESC);



CREATE INDEX "idx_email_filters_user_id" ON "public"."email_filters" USING "btree" ("user_id");



CREATE INDEX "idx_email_templates_franchise_id" ON "public"."email_templates" USING "btree" ("franchise_id");



CREATE INDEX "idx_email_templates_tenant_id" ON "public"."email_templates" USING "btree" ("tenant_id");



CREATE INDEX "idx_emails_account_id" ON "public"."emails" USING "btree" ("account_id");



CREATE INDEX "idx_emails_bcc_emails_gin" ON "public"."emails" USING "gin" ("bcc_emails" "jsonb_path_ops");



CREATE INDEX "idx_emails_cc_emails_gin" ON "public"."emails" USING "gin" ("cc_emails" "jsonb_path_ops");



CREATE INDEX "idx_emails_contact_id" ON "public"."emails" USING "btree" ("contact_id");



CREATE INDEX "idx_emails_conversation_id" ON "public"."emails" USING "btree" ("conversation_id");



CREATE INDEX "idx_emails_direction" ON "public"."emails" USING "btree" ("direction");



CREATE INDEX "idx_emails_folder" ON "public"."emails" USING "btree" ("folder");



CREATE INDEX "idx_emails_franchise_id" ON "public"."emails" USING "btree" ("franchise_id");



CREATE INDEX "idx_emails_from_email_lower" ON "public"."emails" USING "btree" ("lower"("from_email"));



CREATE INDEX "idx_emails_in_reply_to" ON "public"."emails" USING "btree" ("in_reply_to");



CREATE INDEX "idx_emails_internet_message_id" ON "public"."emails" USING "btree" ("internet_message_id");



CREATE INDEX "idx_emails_lead_id" ON "public"."emails" USING "btree" ("lead_id");



CREATE INDEX "idx_emails_message_id" ON "public"."emails" USING "btree" ("message_id");



CREATE INDEX "idx_emails_received_at" ON "public"."emails" USING "btree" ("received_at" DESC);



CREATE INDEX "idx_emails_sync_error" ON "public"."emails" USING "btree" ("sync_error") WHERE ("sync_error" IS NOT NULL);



CREATE INDEX "idx_emails_tenant_id" ON "public"."emails" USING "btree" ("tenant_id");



CREATE INDEX "idx_emails_thread_id" ON "public"."emails" USING "btree" ("thread_id");



CREATE INDEX "idx_emails_to_emails_gin" ON "public"."emails" USING "gin" ("to_emails" "jsonb_path_ops");



CREATE INDEX "idx_emails_user_id" ON "public"."emails" USING "btree" ("user_id");



CREATE INDEX "idx_franchises_tenant_id" ON "public"."franchises" USING "btree" ("tenant_id");



CREATE INDEX "idx_history_filter_presets_tenant" ON "public"."history_filter_presets" USING "btree" ("tenant_id");



CREATE INDEX "idx_history_filter_presets_user" ON "public"."history_filter_presets" USING "btree" ("user_id");



CREATE INDEX "idx_import_errors_import_id" ON "public"."import_errors" USING "btree" ("import_id");



CREATE INDEX "idx_import_history_details_import" ON "public"."import_history_details" USING "btree" ("import_id");



CREATE INDEX "idx_import_history_details_import_id" ON "public"."import_history_details" USING "btree" ("import_id");



CREATE INDEX "idx_import_history_table" ON "public"."import_history" USING "btree" ("table_name");



CREATE INDEX "idx_import_history_tenant" ON "public"."import_history" USING "btree" ("tenant_id");



CREATE INDEX "idx_invitations_email" ON "public"."invitations" USING "btree" ("email");



CREATE INDEX "idx_invitations_token" ON "public"."invitations" USING "btree" ("token");



CREATE INDEX "idx_lead_activities_created_at" ON "public"."lead_activities" USING "btree" ("created_at");



CREATE INDEX "idx_lead_activities_lead" ON "public"."lead_activities" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_activities_lead_id" ON "public"."lead_activities" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_score_logs_lead" ON "public"."lead_score_logs" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_score_logs_lead_id" ON "public"."lead_score_logs" USING "btree" ("lead_id");



CREATE INDEX "idx_leads_custom_fields" ON "public"."leads" USING "gin" ("custom_fields");



CREATE INDEX "idx_leads_franchise_id" ON "public"."leads" USING "btree" ("franchise_id");



CREATE INDEX "idx_leads_owner_id" ON "public"."leads" USING "btree" ("owner_id");



CREATE INDEX "idx_leads_status" ON "public"."leads" USING "btree" ("status");



CREATE INDEX "idx_leads_tenant_id" ON "public"."leads" USING "btree" ("tenant_id");



CREATE INDEX "idx_oauth_configurations_user_provider" ON "public"."oauth_configurations" USING "btree" ("user_id", "provider");



CREATE INDEX "idx_opportunities_account" ON "public"."opportunities" USING "btree" ("account_id");



CREATE INDEX "idx_opportunities_close_date" ON "public"."opportunities" USING "btree" ("close_date");



CREATE INDEX "idx_opportunities_contact" ON "public"."opportunities" USING "btree" ("contact_id");



CREATE INDEX "idx_opportunities_franchise" ON "public"."opportunities" USING "btree" ("franchise_id");



CREATE INDEX "idx_opportunities_owner" ON "public"."opportunities" USING "btree" ("owner_id");



CREATE INDEX "idx_opportunities_salesforce_id" ON "public"."opportunities" USING "btree" ("salesforce_opportunity_id");



CREATE INDEX "idx_opportunities_stage" ON "public"."opportunities" USING "btree" ("stage");



CREATE INDEX "idx_opportunities_tenant" ON "public"."opportunities" USING "btree" ("tenant_id");



CREATE INDEX "idx_opportunity_items_opportunity_id" ON "public"."opportunity_items" USING "btree" ("opportunity_id");



CREATE INDEX "idx_opportunity_probability_history_opportunity_id" ON "public"."opportunity_probability_history" USING "btree" ("opportunity_id");



CREATE INDEX "idx_portal_tokens_quote" ON "public"."portal_tokens" USING "btree" ("quote_id");



CREATE INDEX "idx_portal_tokens_token" ON "public"."portal_tokens" USING "btree" ("token");



CREATE INDEX "idx_ports_tenant" ON "public"."ports_locations" USING "btree" ("tenant_id");



CREATE INDEX "idx_provider_api_configs_active" ON "public"."provider_api_configs" USING "btree" ("is_active");



CREATE INDEX "idx_provider_api_configs_carrier" ON "public"."provider_api_configs" USING "btree" ("carrier_id");



CREATE INDEX "idx_provider_charge_mappings_active" ON "public"."provider_charge_mappings" USING "btree" ("is_active");



CREATE INDEX "idx_provider_charge_mappings_carrier" ON "public"."provider_charge_mappings" USING "btree" ("carrier_id");



CREATE INDEX "idx_provider_charge_mappings_category" ON "public"."provider_charge_mappings" USING "btree" ("charge_category_id");



CREATE INDEX "idx_provider_rate_rules_active" ON "public"."provider_rate_rules" USING "btree" ("is_active");



CREATE INDEX "idx_provider_rate_rules_carrier" ON "public"."provider_rate_rules" USING "btree" ("carrier_id");



CREATE INDEX "idx_provider_rate_rules_priority" ON "public"."provider_rate_rules" USING "btree" ("priority");



CREATE INDEX "idx_provider_rate_rules_service_type" ON "public"."provider_rate_rules" USING "btree" ("service_type_id");



CREATE INDEX "idx_provider_rate_templates_active" ON "public"."provider_rate_templates" USING "btree" ("is_active");



CREATE INDEX "idx_provider_rate_templates_carrier" ON "public"."provider_rate_templates" USING "btree" ("carrier_id");



CREATE INDEX "idx_provider_rate_templates_service_type" ON "public"."provider_rate_templates" USING "btree" ("service_type_id");



CREATE INDEX "idx_provider_surcharges_active" ON "public"."provider_surcharges" USING "btree" ("is_active");



CREATE INDEX "idx_provider_surcharges_carrier" ON "public"."provider_surcharges" USING "btree" ("carrier_id");



CREATE INDEX "idx_qc_q" ON "public"."quote_comments" USING "btree" ("quote_id");



CREATE INDEX "idx_qd_q" ON "public"."quote_documents" USING "btree" ("quote_id");



CREATE INDEX "idx_qpt_t" ON "public"."quote_presentation_templates" USING "btree" ("tenant_id");



CREATE INDEX "idx_qs_q" ON "public"."quote_shares" USING "btree" ("quote_id");



CREATE INDEX "idx_queue_members_queue_id" ON "public"."queue_members" USING "btree" ("queue_id");



CREATE INDEX "idx_queue_members_user_id" ON "public"."queue_members" USING "btree" ("user_id");



CREATE INDEX "idx_queues_tenant_id" ON "public"."queues" USING "btree" ("tenant_id");



CREATE INDEX "idx_quotation_packages_quote_id" ON "public"."quotation_packages" USING "btree" ("quote_id");



CREATE INDEX "idx_quotation_packages_tenant_id" ON "public"."quotation_packages" USING "btree" ("tenant_id");



CREATE INDEX "idx_quotation_version_option_legs_franchise" ON "public"."quotation_version_option_legs" USING "btree" ("franchise_id");



CREATE INDEX "idx_quotation_version_option_legs_leg_type" ON "public"."quotation_version_option_legs" USING "btree" ("leg_type");



CREATE INDEX "idx_quotation_version_option_legs_option_id" ON "public"."quotation_version_option_legs" USING "btree" ("quotation_version_option_id");



CREATE INDEX "idx_quotation_version_options_franchise" ON "public"."quotation_version_options" USING "btree" ("franchise_id");



CREATE INDEX "idx_quotation_version_options_version_id" ON "public"."quotation_version_options" USING "btree" ("quotation_version_id");



CREATE INDEX "idx_quotation_versions_current" ON "public"."quotation_versions" USING "btree" ("quote_id", "is_current") WHERE ("is_current" = true);



CREATE INDEX "idx_quotation_versions_franchise" ON "public"."quotation_versions" USING "btree" ("franchise_id");



CREATE INDEX "idx_quotation_versions_quote_id" ON "public"."quotation_versions" USING "btree" ("quote_id");



CREATE INDEX "idx_quotation_versions_version_number" ON "public"."quotation_versions" USING "btree" ("quote_id", "version_number" DESC);



CREATE INDEX "idx_quote_acceptances_quote" ON "public"."quote_acceptances" USING "btree" ("quote_id");



CREATE INDEX "idx_quote_acceptances_token" ON "public"."quote_acceptances" USING "btree" ("token_id");



CREATE INDEX "idx_quote_charges_franchise" ON "public"."quote_charges" USING "btree" ("franchise_id");



CREATE INDEX "idx_quote_charges_leg_id" ON "public"."quote_charges" USING "btree" ("leg_id");



CREATE INDEX "idx_quote_charges_quote_option_id" ON "public"."quote_charges" USING "btree" ("quote_option_id");



CREATE INDEX "idx_quote_items_quote_id" ON "public"."quote_items" USING "btree" ("quote_id");



CREATE INDEX "idx_quote_legs_option" ON "public"."quote_legs" USING "btree" ("quote_option_id");



CREATE INDEX "idx_quote_legs_service_type" ON "public"."quote_legs" USING "btree" ("service_type_id");



CREATE INDEX "idx_quote_legs_tenant" ON "public"."quote_legs" USING "btree" ("tenant_id");



CREATE INDEX "idx_quote_templates_category" ON "public"."quote_templates" USING "btree" ("category");



CREATE INDEX "idx_quote_templates_is_active" ON "public"."quote_templates" USING "btree" ("is_active");



CREATE INDEX "idx_quote_templates_tenant" ON "public"."quote_templates" USING "btree" ("tenant_id");



CREATE INDEX "idx_quote_templates_tenant_id" ON "public"."quote_templates" USING "btree" ("tenant_id");



CREATE INDEX "idx_quotes_account_id" ON "public"."quotes" USING "btree" ("account_id");



CREATE INDEX "idx_quotes_carrier" ON "public"."quotes" USING "btree" ("carrier_id");



CREATE INDEX "idx_quotes_consignee" ON "public"."quotes" USING "btree" ("consignee_id");



CREATE INDEX "idx_quotes_current_version" ON "public"."quotes" USING "btree" ("current_version_id") WHERE ("current_version_id" IS NOT NULL);



CREATE INDEX "idx_quotes_destination_port" ON "public"."quotes" USING "btree" ("destination_port_id");



CREATE INDEX "idx_quotes_franchise_id" ON "public"."quotes" USING "btree" ("franchise_id");



CREATE INDEX "idx_quotes_opportunity_id" ON "public"."quotes" USING "btree" ("opportunity_id");



CREATE INDEX "idx_quotes_origin_port" ON "public"."quotes" USING "btree" ("origin_port_id");



CREATE INDEX "idx_quotes_quote_number" ON "public"."quotes" USING "btree" ("quote_number");



CREATE INDEX "idx_quotes_tenant_id" ON "public"."quotes" USING "btree" ("tenant_id");



CREATE INDEX "idx_qvo_version" ON "public"."quotation_version_options" USING "btree" ("quotation_version_id");



CREATE INDEX "idx_rate_calculations_quote" ON "public"."rate_calculations" USING "btree" ("quote_id");



CREATE INDEX "idx_scheduled_emails_scheduled_at" ON "public"."scheduled_emails" USING "btree" ("scheduled_at");



CREATE INDEX "idx_scheduled_emails_status" ON "public"."scheduled_emails" USING "btree" ("status");



CREATE INDEX "idx_scheduled_emails_tenant_id" ON "public"."scheduled_emails" USING "btree" ("tenant_id");



CREATE INDEX "idx_scheduled_emails_user_id" ON "public"."scheduled_emails" USING "btree" ("user_id");



CREATE INDEX "idx_service_type_mappings_service_id" ON "public"."service_type_mappings" USING "btree" ("service_id");



CREATE INDEX "idx_service_type_mappings_tenant_id" ON "public"."service_type_mappings" USING "btree" ("tenant_id");



CREATE INDEX "idx_service_types_active" ON "public"."service_types" USING "btree" ("is_active");



CREATE INDEX "idx_service_types_mode_id" ON "public"."service_types" USING "btree" ("mode_id");



CREATE INDEX "idx_service_types_name" ON "public"."service_types" USING "btree" ("name");



CREATE INDEX "idx_services_service_type_id" ON "public"."services" USING "btree" ("service_type_id");



CREATE INDEX "idx_services_tenant" ON "public"."services" USING "btree" ("tenant_id");



CREATE INDEX "idx_services_type" ON "public"."services" USING "btree" ("service_type");



CREATE INDEX "idx_shipment_attachments_shipment" ON "public"."shipment_attachments" USING "btree" ("shipment_id");



CREATE INDEX "idx_shipment_attachments_shipment_id" ON "public"."shipment_attachments" USING "btree" ("shipment_id");



CREATE INDEX "idx_shipment_attachments_shipment_id_document_type" ON "public"."shipment_attachments" USING "btree" ("shipment_id", "document_type");



CREATE INDEX "idx_shipment_attachments_uploaded_at" ON "public"."shipment_attachments" USING "btree" ("uploaded_at" DESC);



CREATE INDEX "idx_shipments_account" ON "public"."shipments" USING "btree" ("account_id");



CREATE INDEX "idx_shipments_franchise" ON "public"."shipments" USING "btree" ("franchise_id");



CREATE INDEX "idx_shipments_pod_received_at" ON "public"."shipments" USING "btree" ("pod_received_at");



CREATE INDEX "idx_shipments_pod_status" ON "public"."shipments" USING "btree" ("pod_status");



CREATE INDEX "idx_shipments_shipment_number" ON "public"."shipments" USING "btree" ("shipment_number");



CREATE INDEX "idx_shipments_status" ON "public"."shipments" USING "btree" ("status");



CREATE INDEX "idx_shipments_tenant" ON "public"."shipments" USING "btree" ("tenant_id");



CREATE INDEX "idx_states_country" ON "public"."states" USING "btree" ("country_id");



CREATE INDEX "idx_stm_active" ON "public"."service_type_mappings" USING "btree" ("is_active");



CREATE INDEX "idx_stm_tenant" ON "public"."service_type_mappings" USING "btree" ("tenant_id");



CREATE INDEX "idx_subscription_invoices_stripe" ON "public"."subscription_invoices" USING "btree" ("stripe_invoice_id");



CREATE INDEX "idx_subscription_invoices_tenant" ON "public"."subscription_invoices" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_subscriptions_status" ON "public"."tenant_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_tenant_subscriptions_stripe" ON "public"."tenant_subscriptions" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_tenant_subscriptions_tenant" ON "public"."tenant_subscriptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_territories_tenant" ON "public"."territories" USING "btree" ("tenant_id");



CREATE INDEX "idx_territory_geographies_city_id" ON "public"."territory_geographies" USING "btree" ("city_id");



CREATE INDEX "idx_territory_geographies_continent" ON "public"."territory_geographies" USING "btree" ("continent_id");



CREATE INDEX "idx_territory_geographies_continent_id" ON "public"."territory_geographies" USING "btree" ("continent_id");



CREATE INDEX "idx_territory_geographies_country" ON "public"."territory_geographies" USING "btree" ("country_id");



CREATE INDEX "idx_territory_geographies_country_id" ON "public"."territory_geographies" USING "btree" ("country_id");



CREATE INDEX "idx_territory_geographies_state" ON "public"."territory_geographies" USING "btree" ("state_id");



CREATE INDEX "idx_territory_geographies_state_id" ON "public"."territory_geographies" USING "btree" ("state_id");



CREATE INDEX "idx_territory_geographies_territory" ON "public"."territory_geographies" USING "btree" ("territory_id");



CREATE INDEX "idx_territory_geographies_territory_id" ON "public"."territory_geographies" USING "btree" ("territory_id");



CREATE INDEX "idx_themes_is_active" ON "public"."themes" USING "btree" ("is_active");



CREATE INDEX "idx_themes_is_default" ON "public"."themes" USING "btree" ("is_default");



CREATE INDEX "idx_themes_tenant_id" ON "public"."themes" USING "btree" ("tenant_id");



CREATE INDEX "idx_tracking_events_date" ON "public"."tracking_events" USING "btree" ("event_date");



CREATE INDEX "idx_tracking_events_shipment" ON "public"."tracking_events" USING "btree" ("shipment_id");



CREATE INDEX "idx_usage_records_period" ON "public"."usage_records" USING "btree" ("period_start", "period_end");



CREATE INDEX "idx_usage_records_tenant_feature" ON "public"."usage_records" USING "btree" ("tenant_id", "feature_key");



CREATE INDEX "idx_user_capacity_user" ON "public"."user_capacity" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_franchise_id" ON "public"."user_roles" USING "btree" ("franchise_id");



CREATE INDEX "idx_user_roles_tenant_id" ON "public"."user_roles" USING "btree" ("tenant_id");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_vehicles_tenant" ON "public"."vehicles" USING "btree" ("tenant_id");



CREATE INDEX "idx_warehouses_tenant" ON "public"."warehouses" USING "btree" ("tenant_id");



CREATE INDEX "quotation_version_option_legs_option_order_idx" ON "public"."quotation_version_option_legs" USING "btree" ("quotation_version_option_id", "sort_order");



CREATE INDEX "quotation_version_option_legs_service_type_idx" ON "public"."quotation_version_option_legs" USING "btree" ("service_type_id");



CREATE INDEX "quote_charges_option_idx" ON "public"."quote_charges" USING "btree" ("quote_option_id");



CREATE INDEX "quote_events_quote_idx" ON "public"."quote_events" USING "btree" ("quote_id");



CREATE INDEX "quote_items_quote_idx" ON "public"."quote_items" USING "btree" ("quote_id");



CREATE UNIQUE INDEX "quote_number_sequences_franchise_unique" ON "public"."quote_number_sequences" USING "btree" ("tenant_id", "franchise_id", "period_key") WHERE ("franchise_id" IS NOT NULL);



CREATE UNIQUE INDEX "quote_number_sequences_tenant_unique" ON "public"."quote_number_sequences" USING "btree" ("tenant_id", "period_key") WHERE ("franchise_id" IS NULL);



CREATE INDEX "quote_option_legs_container_idx" ON "public"."quote_option_legs" USING "btree" ("container_type_id", "container_size_id");



CREATE INDEX "quote_option_legs_option_order_idx" ON "public"."quote_option_legs" USING "btree" ("quote_option_id", "leg_order");



CREATE INDEX "quote_option_legs_service_type_idx" ON "public"."quote_option_legs" USING "btree" ("service_type_id");



CREATE INDEX "quote_option_legs_trade_dir_idx" ON "public"."quote_option_legs" USING "btree" ("trade_direction_id");



CREATE INDEX "quote_options_version_idx" ON "public"."quote_options" USING "btree" ("quote_version_id");



CREATE UNIQUE INDEX "quote_versions_unique" ON "public"."quote_versions" USING "btree" ("quote_id", "version_number");



CREATE INDEX "rates_lane_idx" ON "public"."rates" USING "btree" ("mode", "origin", "destination");



CREATE INDEX "rates_validity_idx" ON "public"."rates" USING "btree" ("validity_start", "validity_end");



CREATE INDEX "service_type_mappings_service_type_id_idx" ON "public"."service_type_mappings" USING "btree" ("service_type_id");



CREATE UNIQUE INDEX "service_type_mappings_unique_fk" ON "public"."service_type_mappings" USING "btree" ("tenant_id", "service_type_id", "service_id");



CREATE UNIQUE INDEX "service_types_code_unique" ON "public"."service_types" USING "btree" ("code");



CREATE UNIQUE INDEX "states_country_iso_unique" ON "public"."states" USING "btree" ("country_id", "code_iso") WHERE ("code_iso" IS NOT NULL);



CREATE UNIQUE INDEX "states_country_name_unique" ON "public"."states" USING "btree" ("country_id", "name");



CREATE UNIQUE INDEX "ui_themes_scope_name_unique" ON "public"."ui_themes" USING "btree" ("scope", COALESCE("tenant_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("franchise_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("user_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "lower"("name"));



CREATE UNIQUE INDEX "uniq_service_types_norm_name" ON "public"."service_types" USING "btree" ("lower"(TRIM(BOTH FROM "name")));



CREATE UNIQUE INDEX "uq_quote_version" ON "public"."quotation_versions" USING "btree" ("quote_id", "major", "minor");



CREATE UNIQUE INDEX "uq_quotes_primary_per_opportunity" ON "public"."quotes" USING "btree" ("opportunity_id") WHERE ("is_primary" IS TRUE);



CREATE OR REPLACE TRIGGER "log_opportunity_probability_changes_trigger" AFTER UPDATE ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."log_opportunity_probability_changes"();



CREATE OR REPLACE TRIGGER "log_option_changes_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotation_version_options" FOR EACH ROW EXECUTE FUNCTION "public"."log_option_changes"();



CREATE OR REPLACE TRIGGER "log_version_changes_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotation_versions" FOR EACH ROW EXECUTE FUNCTION "public"."log_version_changes"();



CREATE OR REPLACE TRIGGER "set_quote_legs_updated_at" BEFORE UPDATE ON "public"."quote_legs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_dashboard_preferences_updated" BEFORE UPDATE ON "public"."dashboard_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_scheduled_email_timestamp"();



CREATE OR REPLACE TRIGGER "trg_email_audit" AFTER INSERT OR UPDATE ON "public"."emails" FOR EACH ROW EXECUTE FUNCTION "public"."log_email_audit"();



CREATE OR REPLACE TRIGGER "trg_email_delegations_updated" BEFORE UPDATE ON "public"."email_account_delegations" FOR EACH ROW EXECUTE FUNCTION "public"."update_scheduled_email_timestamp"();



CREATE OR REPLACE TRIGGER "trg_opp_items_sync_del" AFTER DELETE ON "public"."opportunity_items" FOR EACH ROW EXECUTE FUNCTION "public"."sync_quote_items_from_opportunity_trigger"();



CREATE OR REPLACE TRIGGER "trg_opp_items_sync_ins" AFTER INSERT ON "public"."opportunity_items" FOR EACH ROW EXECUTE FUNCTION "public"."sync_quote_items_from_opportunity_trigger"();



CREATE OR REPLACE TRIGGER "trg_opp_items_sync_upd" AFTER UPDATE ON "public"."opportunity_items" FOR EACH ROW EXECUTE FUNCTION "public"."sync_quote_items_from_opportunity_trigger"();



CREATE OR REPLACE TRIGGER "trg_quote_items_recalc_total_del" AFTER DELETE ON "public"."quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_and_sync_quote_trigger"();



CREATE OR REPLACE TRIGGER "trg_quote_items_recalc_total_ins" AFTER INSERT ON "public"."quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_and_sync_quote_trigger"();



CREATE OR REPLACE TRIGGER "trg_quote_items_recalc_total_upd" AFTER UPDATE ON "public"."quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_and_sync_quote_trigger"();



CREATE OR REPLACE TRIGGER "trg_quotes_ensure_single_primary" BEFORE INSERT OR UPDATE OF "is_primary", "opportunity_id" ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_primary_quote"();



CREATE OR REPLACE TRIGGER "trg_quotes_sync_opportunity" AFTER INSERT OR UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_opportunity_from_primary_quote"();



CREATE OR REPLACE TRIGGER "trg_qvo_populate" BEFORE INSERT ON "public"."quotation_version_options" FOR EACH ROW EXECUTE FUNCTION "public"."populate_option_from_rate"();



CREATE OR REPLACE TRIGGER "trg_recalc_total_on_charge_del" AFTER DELETE ON "public"."carrier_rate_charges" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_carrier_rate_total_trigger"();



CREATE OR REPLACE TRIGGER "trg_recalc_total_on_charge_ins" AFTER INSERT ON "public"."carrier_rate_charges" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_carrier_rate_total_trigger"();



CREATE OR REPLACE TRIGGER "trg_recalc_total_on_charge_upd" AFTER UPDATE ON "public"."carrier_rate_charges" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_carrier_rate_total_trigger"();



CREATE OR REPLACE TRIGGER "trg_recalc_total_on_rate_upd" BEFORE UPDATE ON "public"."carrier_rates" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_carrier_rate_on_rate_update"();



CREATE OR REPLACE TRIGGER "trg_scheduled_emails_updated" BEFORE UPDATE ON "public"."scheduled_emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_scheduled_email_timestamp"();



CREATE OR REPLACE TRIGGER "trg_set_quote_number_before_insert" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_quote_number_before_insert"();



CREATE OR REPLACE TRIGGER "trg_update_option_totals_on_charge_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."quote_charges" FOR EACH ROW EXECUTE FUNCTION "public"."update_option_totals"();



CREATE OR REPLACE TRIGGER "trg_validate_current_version" BEFORE INSERT OR UPDATE OF "is_current" ON "public"."quotation_versions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_version_uniqueness"();



CREATE OR REPLACE TRIGGER "trg_validate_leg_sort_order" BEFORE INSERT ON "public"."quotation_version_option_legs" FOR EACH ROW EXECUTE FUNCTION "public"."validate_leg_sort_order"();



CREATE OR REPLACE TRIGGER "trigger_auto_assign_version_number" BEFORE INSERT ON "public"."quotation_versions" FOR EACH ROW EXECUTE FUNCTION "public"."auto_assign_version_number"();



CREATE OR REPLACE TRIGGER "trigger_auto_generate_quote_number" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."auto_generate_quote_number"();



CREATE OR REPLACE TRIGGER "trigger_log_option_changes" BEFORE INSERT OR DELETE OR UPDATE ON "public"."quotation_version_options" FOR EACH ROW EXECUTE FUNCTION "public"."log_option_changes"();



CREATE OR REPLACE TRIGGER "trigger_update_lead_last_activity" AFTER INSERT OR UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_lead_last_activity"();



CREATE OR REPLACE TRIGGER "trigger_update_lead_score" BEFORE INSERT OR UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_lead_score"();



CREATE OR REPLACE TRIGGER "trigger_update_option_margins" AFTER INSERT OR DELETE OR UPDATE ON "public"."quote_charges" FOR EACH ROW EXECUTE FUNCTION "public"."update_option_margins_on_charge_change"();



CREATE OR REPLACE TRIGGER "trigger_validate_customer_selection" BEFORE INSERT OR UPDATE ON "public"."customer_selections" FOR EACH ROW EXECUTE FUNCTION "public"."validate_single_selection_per_version"();



CREATE OR REPLACE TRIGGER "trigger_validate_version_status" BEFORE INSERT OR UPDATE ON "public"."quotation_versions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_version_status_transition"();



CREATE OR REPLACE TRIGGER "upd_qc" BEFORE UPDATE ON "public"."quote_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "upd_qpt" BEFORE UPDATE ON "public"."quote_presentation_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_accounts_updated_at" BEFORE UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activities_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_auth_roles_updated_at" BEFORE UPDATE ON "public"."auth_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cargo_details_updated_at" BEFORE UPDATE ON "public"."cargo_details" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cargo_types_updated_at" BEFORE UPDATE ON "public"."cargo_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_carrier_rates_updated_at" BEFORE UPDATE ON "public"."carrier_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_carrier_service_types_updated_at" BEFORE UPDATE ON "public"."carrier_service_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_charge_bases_updated_at" BEFORE UPDATE ON "public"."charge_bases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_charge_categories_updated_at" BEFORE UPDATE ON "public"."charge_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_charge_sides_updated_at" BEFORE UPDATE ON "public"."charge_sides" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_charge_tier_config_updated_at" BEFORE UPDATE ON "public"."charge_tier_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_charge_tier_ranges_updated_at" BEFORE UPDATE ON "public"."charge_tier_ranges" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_charge_weight_breaks_updated_at" BEFORE UPDATE ON "public"."charge_weight_breaks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_compliance_rules_updated_at" BEFORE UPDATE ON "public"."compliance_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_currencies_updated_at" BEFORE UPDATE ON "public"."currencies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_custom_roles_updated_at" BEFORE UPDATE ON "public"."custom_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customs_documents_updated_at" BEFORE UPDATE ON "public"."customs_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_document_templates_updated_at" BEFORE UPDATE ON "public"."document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_accounts_updated_at" BEFORE UPDATE ON "public"."email_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_filters_updated_at" BEFORE UPDATE ON "public"."email_filters" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_templates_updated_at" BEFORE UPDATE ON "public"."email_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_emails_updated_at" BEFORE UPDATE ON "public"."emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_entity_transfer_items_updated_at" BEFORE UPDATE ON "public"."entity_transfer_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_entity_transfers_updated_at" BEFORE UPDATE ON "public"."entity_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_franchises_updated_at" BEFORE UPDATE ON "public"."franchises" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_history_filter_presets_updated_at" BEFORE UPDATE ON "public"."history_filter_presets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_incoterms_updated_at" BEFORE UPDATE ON "public"."incoterms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_lead_score_config_updated_at" BEFORE UPDATE ON "public"."lead_score_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_oauth_configurations_updated_at" BEFORE UPDATE ON "public"."oauth_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_opportunities_updated_at" BEFORE UPDATE ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_package_categories_updated_at" BEFORE UPDATE ON "public"."package_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_package_sizes_updated_at" BEFORE UPDATE ON "public"."package_sizes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_provider_api_configs_updated_at" BEFORE UPDATE ON "public"."provider_api_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_provider_charge_mappings_updated_at" BEFORE UPDATE ON "public"."provider_charge_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_provider_rate_rules_updated_at" BEFORE UPDATE ON "public"."provider_rate_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_provider_rate_templates_updated_at" BEFORE UPDATE ON "public"."provider_rate_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_provider_surcharges_updated_at" BEFORE UPDATE ON "public"."provider_surcharges" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quotation_packages_updated_at" BEFORE UPDATE ON "public"."quotation_packages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quotation_version_option_legs_updated_at" BEFORE UPDATE ON "public"."quotation_version_option_legs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quote_items_updated_at" BEFORE UPDATE ON "public"."quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quote_number_config_franchise_updated_at" BEFORE UPDATE ON "public"."quote_number_config_franchise" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quote_number_config_tenant_updated_at" BEFORE UPDATE ON "public"."quote_number_config_tenant" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quote_number_sequences_updated_at" BEFORE UPDATE ON "public"."quote_number_sequences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quote_templates_updated_at" BEFORE UPDATE ON "public"."quote_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quotes_updated_at" BEFORE UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_routes_updated_at" BEFORE UPDATE ON "public"."routes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_service_leg_categories_updated_at" BEFORE UPDATE ON "public"."service_leg_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_service_type_mappings_updated_at" BEFORE UPDATE ON "public"."service_type_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_service_types_updated_at" BEFORE UPDATE ON "public"."service_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_services_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_shipment_items_updated_at" BEFORE UPDATE ON "public"."shipment_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_shipments_updated_at" BEFORE UPDATE ON "public"."shipments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_shipping_rates_updated_at" BEFORE UPDATE ON "public"."shipping_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_features_updated_at" BEFORE UPDATE ON "public"."subscription_features" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_invoices_updated_at" BEFORE UPDATE ON "public"."subscription_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_plans_updated_at" BEFORE UPDATE ON "public"."subscription_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenant_subscriptions_updated_at" BEFORE UPDATE ON "public"."tenant_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenants_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_territories_updated_at" BEFORE UPDATE ON "public"."territories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_themes_updated_at" BEFORE UPDATE ON "public"."themes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_transport_modes_updated_at" BEFORE UPDATE ON "public"."transport_modes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_usage_records_updated_at" BEFORE UPDATE ON "public"."usage_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_capacity_updated_at" BEFORE UPDATE ON "public"."user_capacity" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_preferences_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vehicles_updated_at" BEFORE UPDATE ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_warehouse_inventory_updated_at" BEFORE UPDATE ON "public"."warehouse_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_warehouses_updated_at" BEFORE UPDATE ON "public"."warehouses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_service_leg_before_insert_update" BEFORE INSERT OR UPDATE ON "public"."quotation_version_option_legs" FOR EACH ROW EXECUTE FUNCTION "public"."validate_service_leg_requirements"();



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."auth_role_hierarchy"
    ADD CONSTRAINT "auth_role_hierarchy_manager_role_id_fkey" FOREIGN KEY ("manager_role_id") REFERENCES "public"."auth_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_role_hierarchy"
    ADD CONSTRAINT "auth_role_hierarchy_target_role_id_fkey" FOREIGN KEY ("target_role_id") REFERENCES "public"."auth_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_role_permissions"
    ADD CONSTRAINT "auth_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."auth_permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_role_permissions"
    ADD CONSTRAINT "auth_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."auth_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cargo_details"
    ADD CONSTRAINT "cargo_details_cargo_type_id_fkey" FOREIGN KEY ("cargo_type_id") REFERENCES "public"."cargo_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cargo_details"
    ADD CONSTRAINT "cargo_details_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cargo_details"
    ADD CONSTRAINT "cargo_details_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_rate_attachments"
    ADD CONSTRAINT "carrier_rate_attachments_carrier_rate_id_fkey" FOREIGN KEY ("carrier_rate_id") REFERENCES "public"."carrier_rates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_rate_charges"
    ADD CONSTRAINT "carrier_rate_charges_carrier_rate_id_fkey" FOREIGN KEY ("carrier_rate_id") REFERENCES "public"."carrier_rates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_rates"
    ADD CONSTRAINT "carrier_rates_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_rates"
    ADD CONSTRAINT "carrier_rates_container_category_id_fkey" FOREIGN KEY ("container_category_id") REFERENCES "public"."package_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carrier_rates"
    ADD CONSTRAINT "carrier_rates_container_size_id_fkey" FOREIGN KEY ("container_size_id") REFERENCES "public"."package_sizes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carrier_rates"
    ADD CONSTRAINT "carrier_rates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_rates"
    ADD CONSTRAINT "carrier_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_service_types"
    ADD CONSTRAINT "carrier_service_types_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."charge_tier_config"
    ADD CONSTRAINT "charge_tier_config_basis_id_fkey" FOREIGN KEY ("basis_id") REFERENCES "public"."charge_bases"("id");



ALTER TABLE ONLY "public"."charge_tier_config"
    ADD CONSTRAINT "charge_tier_config_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id");



ALTER TABLE ONLY "public"."charge_tier_config"
    ADD CONSTRAINT "charge_tier_config_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."charge_categories"("id");



ALTER TABLE ONLY "public"."charge_tier_config"
    ADD CONSTRAINT "charge_tier_config_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."charge_tier_config"
    ADD CONSTRAINT "charge_tier_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."charge_tier_ranges"
    ADD CONSTRAINT "charge_tier_ranges_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."charge_tier_ranges"
    ADD CONSTRAINT "charge_tier_ranges_tier_config_id_fkey" FOREIGN KEY ("tier_config_id") REFERENCES "public"."charge_tier_config"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."charge_weight_breaks"
    ADD CONSTRAINT "charge_weight_breaks_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."charge_weight_breaks"
    ADD CONSTRAINT "charge_weight_breaks_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."charge_weight_breaks"
    ADD CONSTRAINT "charge_weight_breaks_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."charge_weight_breaks"
    ADD CONSTRAINT "charge_weight_breaks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."compliance_checks"
    ADD CONSTRAINT "compliance_checks_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."compliance_checks"
    ADD CONSTRAINT "compliance_checks_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_checks"
    ADD CONSTRAINT "compliance_checks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."compliance_rules"("id");



ALTER TABLE ONLY "public"."compliance_rules"
    ADD CONSTRAINT "compliance_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_continent_id_fkey" FOREIGN KEY ("continent_id") REFERENCES "public"."continents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_role_permissions"
    ADD CONSTRAINT "custom_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_roles"
    ADD CONSTRAINT "custom_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customer_selections"
    ADD CONSTRAINT "customer_selections_quotation_version_id_fkey" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_selections"
    ADD CONSTRAINT "customer_selections_quotation_version_option_id_fkey" FOREIGN KEY ("quotation_version_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_selections"
    ADD CONSTRAINT "customer_selections_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customs_documents"
    ADD CONSTRAINT "customs_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customs_documents"
    ADD CONSTRAINT "customs_documents_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_preferences"
    ADD CONSTRAINT "dashboard_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."dashboard_preferences"
    ADD CONSTRAINT "dashboard_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_account_delegations"
    ADD CONSTRAINT "email_account_delegations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_account_delegations"
    ADD CONSTRAINT "email_account_delegations_delegate_user_id_fkey" FOREIGN KEY ("delegate_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_account_delegations"
    ADD CONSTRAINT "email_account_delegations_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_audit_log"
    ADD CONSTRAINT "email_audit_log_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_audit_log"
    ADD CONSTRAINT "email_audit_log_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");



ALTER TABLE ONLY "public"."email_audit_log"
    ADD CONSTRAINT "email_audit_log_scheduled_email_id_fkey" FOREIGN KEY ("scheduled_email_id") REFERENCES "public"."scheduled_emails"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_audit_log"
    ADD CONSTRAINT "email_audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."email_audit_log"
    ADD CONSTRAINT "email_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_filters"
    ADD CONSTRAINT "email_filters_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_account_id_crm_fkey" FOREIGN KEY ("account_id_crm") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."entity_transfer_items"
    ADD CONSTRAINT "entity_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "public"."entity_transfers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_transfers"
    ADD CONSTRAINT "entity_transfers_approved_by_fkey_profiles" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_transfers"
    ADD CONSTRAINT "entity_transfers_requested_by_fkey_profiles" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_transfers"
    ADD CONSTRAINT "entity_transfers_source_franchise_id_fkey" FOREIGN KEY ("source_franchise_id") REFERENCES "public"."franchises"("id");



ALTER TABLE ONLY "public"."entity_transfers"
    ADD CONSTRAINT "entity_transfers_source_tenant_id_fkey" FOREIGN KEY ("source_tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."entity_transfers"
    ADD CONSTRAINT "entity_transfers_target_franchise_id_fkey" FOREIGN KEY ("target_franchise_id") REFERENCES "public"."franchises"("id");



ALTER TABLE ONLY "public"."entity_transfers"
    ADD CONSTRAINT "entity_transfers_target_tenant_id_fkey" FOREIGN KEY ("target_tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "fk_parent_account" FOREIGN KEY ("parent_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quote_legs"
    ADD CONSTRAINT "fk_quote_legs_option" FOREIGN KEY ("quote_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_legs"
    ADD CONSTRAINT "fk_quote_legs_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."franchises"
    ADD CONSTRAINT "franchises_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."franchises"
    ADD CONSTRAINT "franchises_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fx_rates"
    ADD CONSTRAINT "fx_rates_from_currency_id_fkey" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."fx_rates"
    ADD CONSTRAINT "fx_rates_to_currency_id_fkey" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."history_filter_presets"
    ADD CONSTRAINT "history_filter_presets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."history_filter_presets"
    ADD CONSTRAINT "history_filter_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_errors"
    ADD CONSTRAINT "import_errors_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."import_history"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_history_details"
    ADD CONSTRAINT "import_history_details_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."import_history"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_history"
    ADD CONSTRAINT "import_history_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."import_history"
    ADD CONSTRAINT "import_history_reverted_by_fkey" FOREIGN KEY ("reverted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."import_history"
    ADD CONSTRAINT "import_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."lead_assignment_history"
    ADD CONSTRAINT "lead_assignment_history_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."lead_assignment_history"
    ADD CONSTRAINT "lead_assignment_history_assigned_from_fkey" FOREIGN KEY ("assigned_from") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."lead_assignment_history"
    ADD CONSTRAINT "lead_assignment_history_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."lead_assignment_history"
    ADD CONSTRAINT "lead_assignment_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_assignment_history"
    ADD CONSTRAINT "lead_assignment_history_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."lead_assignment_rules"("id");



ALTER TABLE ONLY "public"."lead_assignment_queue"
    ADD CONSTRAINT "lead_assignment_queue_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_assignment_rules"
    ADD CONSTRAINT "lead_assignment_rules_assigned_queue_id_fkey" FOREIGN KEY ("assigned_queue_id") REFERENCES "public"."queues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_assignment_rules"
    ADD CONSTRAINT "lead_assignment_rules_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id");



ALTER TABLE ONLY "public"."lead_score_config"
    ADD CONSTRAINT "lead_score_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_score_logs"
    ADD CONSTRAINT "lead_score_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_converted_account_id_fkey" FOREIGN KEY ("converted_account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_converted_contact_id_fkey" FOREIGN KEY ("converted_contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_owner_queue_id_fkey" FOREIGN KEY ("owner_queue_id") REFERENCES "public"."queues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."margin_profiles"
    ADD CONSTRAINT "margin_profiles_default_method_id_fkey" FOREIGN KEY ("default_method_id") REFERENCES "public"."margin_methods"("id");



ALTER TABLE ONLY "public"."oauth_configurations"
    ADD CONSTRAINT "oauth_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_configurations"
    ADD CONSTRAINT "oauth_configurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_primary_quote_id_fkey" FOREIGN KEY ("primary_quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."opportunity_items"
    ADD CONSTRAINT "opportunity_items_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opportunity_probability_history"
    ADD CONSTRAINT "opportunity_probability_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."opportunity_probability_history"
    ADD CONSTRAINT "opportunity_probability_history_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_api_configs"
    ADD CONSTRAINT "provider_api_configs_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_api_configs"
    ADD CONSTRAINT "provider_api_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_charge_mappings"
    ADD CONSTRAINT "provider_charge_mappings_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_charge_mappings"
    ADD CONSTRAINT "provider_charge_mappings_charge_basis_id_fkey" FOREIGN KEY ("charge_basis_id") REFERENCES "public"."charge_bases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_charge_mappings"
    ADD CONSTRAINT "provider_charge_mappings_charge_category_id_fkey" FOREIGN KEY ("charge_category_id") REFERENCES "public"."charge_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_charge_mappings"
    ADD CONSTRAINT "provider_charge_mappings_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_charge_mappings"
    ADD CONSTRAINT "provider_charge_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_rate_rules"
    ADD CONSTRAINT "provider_rate_rules_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_rate_rules"
    ADD CONSTRAINT "provider_rate_rules_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_rate_rules"
    ADD CONSTRAINT "provider_rate_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_rate_templates"
    ADD CONSTRAINT "provider_rate_templates_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_rate_templates"
    ADD CONSTRAINT "provider_rate_templates_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_rate_templates"
    ADD CONSTRAINT "provider_rate_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_surcharges"
    ADD CONSTRAINT "provider_surcharges_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_surcharges"
    ADD CONSTRAINT "provider_surcharges_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_surcharges"
    ADD CONSTRAINT "provider_surcharges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."queue_members"
    ADD CONSTRAINT "queue_members_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."queue_members"
    ADD CONSTRAINT "queue_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."queues"
    ADD CONSTRAINT "queues_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."queues"
    ADD CONSTRAINT "queues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_audit_log"
    ADD CONSTRAINT "quotation_audit_log_quotation_version_id_fkey" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_audit_log"
    ADD CONSTRAINT "quotation_audit_log_quotation_version_option_id_fkey" FOREIGN KEY ("quotation_version_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_audit_log"
    ADD CONSTRAINT "quotation_audit_log_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_audit_log"
    ADD CONSTRAINT "quotation_audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_audit_log"
    ADD CONSTRAINT "quotation_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_selection_events"
    ADD CONSTRAINT "quotation_selection_events_quotation_version_id_fkey" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_selection_events"
    ADD CONSTRAINT "quotation_selection_events_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_selection_events"
    ADD CONSTRAINT "quotation_selection_events_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotation_version_option_legs"
    ADD CONSTRAINT "quotation_version_option_legs_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");



ALTER TABLE ONLY "public"."quotation_version_option_legs"
    ADD CONSTRAINT "quotation_version_option_legs_mode_id_fkey" FOREIGN KEY ("mode_id") REFERENCES "public"."service_modes"("id");



ALTER TABLE ONLY "public"."quotation_version_option_legs"
    ADD CONSTRAINT "quotation_version_option_legs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."carriers"("id");



ALTER TABLE ONLY "public"."quotation_version_option_legs"
    ADD CONSTRAINT "quotation_version_option_legs_quotation_version_option_id_fkey" FOREIGN KEY ("quotation_version_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_version_option_legs"
    ADD CONSTRAINT "quotation_version_option_legs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."quotation_version_option_legs"
    ADD CONSTRAINT "quotation_version_option_legs_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."quotation_version_options"
    ADD CONSTRAINT "quotation_version_options_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."quotation_version_options"
    ADD CONSTRAINT "quotation_version_options_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");



ALTER TABLE ONLY "public"."quotation_version_options"
    ADD CONSTRAINT "quotation_version_options_margin_method_id_fkey" FOREIGN KEY ("margin_method_id") REFERENCES "public"."margin_methods"("id");



ALTER TABLE ONLY "public"."quotation_version_options"
    ADD CONSTRAINT "quotation_version_options_provider_type_id_fkey" FOREIGN KEY ("provider_type_id") REFERENCES "public"."provider_types"("id");



ALTER TABLE ONLY "public"."quotation_version_options"
    ADD CONSTRAINT "quotation_version_options_quotation_version_id_fkey" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_version_options"
    ADD CONSTRAINT "quotation_version_options_quote_currency_id_fkey" FOREIGN KEY ("quote_currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."quotation_version_options"
    ADD CONSTRAINT "quotation_version_options_trade_direction_id_fkey" FOREIGN KEY ("trade_direction_id") REFERENCES "public"."trade_directions"("id");



ALTER TABLE ONLY "public"."quotation_versions"
    ADD CONSTRAINT "quotation_versions_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");



ALTER TABLE ONLY "public"."quotation_versions"
    ADD CONSTRAINT "quotation_versions_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_versions"
    ADD CONSTRAINT "quotation_versions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_acceptances"
    ADD CONSTRAINT "quote_acceptances_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_acceptances"
    ADD CONSTRAINT "quote_acceptances_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public"."portal_tokens"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_access_logs"
    ADD CONSTRAINT "quote_access_logs_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_access_logs"
    ADD CONSTRAINT "quote_access_logs_quote_share_id_fkey" FOREIGN KEY ("quote_share_id") REFERENCES "public"."quote_shares"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_charges"
    ADD CONSTRAINT "quote_charges_basis_id_fkey" FOREIGN KEY ("basis_id") REFERENCES "public"."charge_bases"("id");



ALTER TABLE ONLY "public"."quote_charges"
    ADD CONSTRAINT "quote_charges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."charge_categories"("id");



ALTER TABLE ONLY "public"."quote_charges"
    ADD CONSTRAINT "quote_charges_charge_side_id_fkey" FOREIGN KEY ("charge_side_id") REFERENCES "public"."charge_sides"("id");



ALTER TABLE ONLY "public"."quote_charges"
    ADD CONSTRAINT "quote_charges_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."quote_charges"
    ADD CONSTRAINT "quote_charges_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");



ALTER TABLE ONLY "public"."quote_charges"
    ADD CONSTRAINT "quote_charges_leg_id_fkey" FOREIGN KEY ("leg_id") REFERENCES "public"."quote_option_legs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quote_charges"
    ADD CONSTRAINT "quote_charges_quote_option_id_fkey" FOREIGN KEY ("quote_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_comments"
    ADD CONSTRAINT "quote_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."quote_comments"
    ADD CONSTRAINT "quote_comments_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_comments"
    ADD CONSTRAINT "quote_comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_documents"
    ADD CONSTRAINT "quote_documents_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_documents"
    ADD CONSTRAINT "quote_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_email_history"
    ADD CONSTRAINT "quote_email_history_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_email_history"
    ADD CONSTRAINT "quote_email_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_events"
    ADD CONSTRAINT "quote_events_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."quote_number_config_franchise"
    ADD CONSTRAINT "quote_number_config_franchise_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_number_config_franchise"
    ADD CONSTRAINT "quote_number_config_franchise_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_number_config_tenant"
    ADD CONSTRAINT "quote_number_config_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_number_sequences"
    ADD CONSTRAINT "quote_number_sequences_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_number_sequences"
    ADD CONSTRAINT "quote_number_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_option_legs"
    ADD CONSTRAINT "quote_option_legs_container_size_id_fkey" FOREIGN KEY ("container_size_id") REFERENCES "public"."container_sizes"("id");



ALTER TABLE ONLY "public"."quote_option_legs"
    ADD CONSTRAINT "quote_option_legs_container_type_id_fkey" FOREIGN KEY ("container_type_id") REFERENCES "public"."container_types"("id");



ALTER TABLE ONLY "public"."quote_option_legs"
    ADD CONSTRAINT "quote_option_legs_leg_currency_id_fkey" FOREIGN KEY ("leg_currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."quote_option_legs"
    ADD CONSTRAINT "quote_option_legs_mode_id_fkey" FOREIGN KEY ("mode_id") REFERENCES "public"."service_modes"("id");



ALTER TABLE ONLY "public"."quote_option_legs"
    ADD CONSTRAINT "quote_option_legs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."carriers"("id");



ALTER TABLE ONLY "public"."quote_option_legs"
    ADD CONSTRAINT "quote_option_legs_quote_option_id_fkey" FOREIGN KEY ("quote_option_id") REFERENCES "public"."quote_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_option_legs"
    ADD CONSTRAINT "quote_option_legs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."quote_option_legs"
    ADD CONSTRAINT "quote_option_legs_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."quote_option_legs"
    ADD CONSTRAINT "quote_option_legs_trade_direction_id_fkey" FOREIGN KEY ("trade_direction_id") REFERENCES "public"."trade_directions"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_container_size_id_fkey" FOREIGN KEY ("container_size_id") REFERENCES "public"."container_sizes"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_container_type_id_fkey" FOREIGN KEY ("container_type_id") REFERENCES "public"."container_types"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_destination_port_id_fkey" FOREIGN KEY ("destination_port_id") REFERENCES "public"."ports_locations"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_margin_method_id_fkey" FOREIGN KEY ("margin_method_id") REFERENCES "public"."margin_methods"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_origin_port_id_fkey" FOREIGN KEY ("origin_port_id") REFERENCES "public"."ports_locations"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_package_category_id_fkey" FOREIGN KEY ("package_category_id") REFERENCES "public"."package_categories"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_package_size_id_fkey" FOREIGN KEY ("package_size_id") REFERENCES "public"."package_sizes"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."carriers"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_provider_type_id_fkey" FOREIGN KEY ("provider_type_id") REFERENCES "public"."provider_types"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_quote_currency_id_fkey" FOREIGN KEY ("quote_currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."quote_options"
    ADD CONSTRAINT "quote_options_trade_direction_id_fkey" FOREIGN KEY ("trade_direction_id") REFERENCES "public"."trade_directions"("id");



ALTER TABLE ONLY "public"."quote_presentation_templates"
    ADD CONSTRAINT "quote_presentation_templates_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_presentation_templates"
    ADD CONSTRAINT "quote_presentation_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_selection"
    ADD CONSTRAINT "quote_selection_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."quote_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_selection"
    ADD CONSTRAINT "quote_selection_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_selection"
    ADD CONSTRAINT "quote_selection_selected_by_fkey" FOREIGN KEY ("selected_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."quote_selection"
    ADD CONSTRAINT "quote_selection_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_shares"
    ADD CONSTRAINT "quote_shares_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."quote_shares"
    ADD CONSTRAINT "quote_shares_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_shares"
    ADD CONSTRAINT "quote_shares_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_templates"
    ADD CONSTRAINT "quote_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."quote_templates"
    ADD CONSTRAINT "quote_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."quote_templates"
    ADD CONSTRAINT "quote_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."quote_versions"
    ADD CONSTRAINT "quote_versions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_consignee_id_fkey" FOREIGN KEY ("consignee_id") REFERENCES "public"."consignees"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_destination_port_id_fkey" FOREIGN KEY ("destination_port_id") REFERENCES "public"."ports_locations"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_origin_port_id_fkey" FOREIGN KEY ("origin_port_id") REFERENCES "public"."ports_locations"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."rate_calculations"
    ADD CONSTRAINT "rate_calculations_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rate_calculations"
    ADD CONSTRAINT "rate_calculations_carrier_rate_id_fkey" FOREIGN KEY ("carrier_rate_id") REFERENCES "public"."carrier_rates"("id");



ALTER TABLE ONLY "public"."rate_calculations"
    ADD CONSTRAINT "rate_calculations_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_calculations"
    ADD CONSTRAINT "rate_calculations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."rate_components"
    ADD CONSTRAINT "rate_components_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "public"."rates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rates"
    ADD CONSTRAINT "rates_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_origin_warehouse_id_fkey" FOREIGN KEY ("origin_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_emails"
    ADD CONSTRAINT "scheduled_emails_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id");



ALTER TABLE ONLY "public"."scheduled_emails"
    ADD CONSTRAINT "scheduled_emails_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");



ALTER TABLE ONLY "public"."scheduled_emails"
    ADD CONSTRAINT "scheduled_emails_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id");



ALTER TABLE ONLY "public"."scheduled_emails"
    ADD CONSTRAINT "scheduled_emails_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."scheduled_emails"
    ADD CONSTRAINT "scheduled_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_details"
    ADD CONSTRAINT "service_details_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_type_mappings"
    ADD CONSTRAINT "service_type_mappings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_mode_id_fkey" FOREIGN KEY ("mode_id") REFERENCES "public"."transport_modes"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipment_attachments"
    ADD CONSTRAINT "shipment_attachments_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipment_items"
    ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_origin_warehouse_id_fkey" FOREIGN KEY ("origin_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipping_rates"
    ADD CONSTRAINT "shipping_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."tenant_subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."territory_assignments"
    ADD CONSTRAINT "territory_assignments_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."territory_assignments"
    ADD CONSTRAINT "territory_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."territory_geographies"
    ADD CONSTRAINT "territory_geographies_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."territory_geographies"
    ADD CONSTRAINT "territory_geographies_continent_id_fkey" FOREIGN KEY ("continent_id") REFERENCES "public"."continents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."territory_geographies"
    ADD CONSTRAINT "territory_geographies_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."territory_geographies"
    ADD CONSTRAINT "territory_geographies_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."territory_geographies"
    ADD CONSTRAINT "territory_geographies_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."themes"
    ADD CONSTRAINT "themes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."themes"
    ADD CONSTRAINT "themes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracking_events"
    ADD CONSTRAINT "tracking_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tracking_events"
    ADD CONSTRAINT "tracking_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ui_themes"
    ADD CONSTRAINT "ui_themes_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ui_themes"
    ADD CONSTRAINT "ui_themes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ui_themes"
    ADD CONSTRAINT "ui_themes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_records"
    ADD CONSTRAINT "usage_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."tenant_subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usage_records"
    ADD CONSTRAINT "usage_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_capacity"
    ADD CONSTRAINT "user_capacity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_custom_roles"
    ADD CONSTRAINT "user_custom_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_custom_roles"
    ADD CONSTRAINT "user_custom_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_custom_roles"
    ADD CONSTRAINT "user_custom_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."warehouse_inventory"
    ADD CONSTRAINT "warehouse_inventory_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."warehouse_inventory"
    ADD CONSTRAINT "warehouse_inventory_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage queue members" ON "public"."queue_members" USING ("public"."has_role"("auth"."uid"(), 'platform_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'platform_admin'::"public"."app_role"));



CREATE POLICY "Admins can manage queues" ON "public"."queues" USING ("public"."has_role"("auth"."uid"(), 'platform_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'platform_admin'::"public"."app_role"));



CREATE POLICY "Admins can manage score config" ON "public"."lead_score_config" USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['tenant_admin'::"public"."app_role", 'platform_admin'::"public"."app_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Admins can update their tenant score config" ON "public"."lead_score_config" FOR UPDATE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role")));



CREATE POLICY "All authenticated can read auth_permissions" ON "public"."auth_permissions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated can read auth_role_permissions" ON "public"."auth_role_permissions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated can read auth_roles" ON "public"."auth_roles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users can view service types" ON "public"."service_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow insert/update access to authenticated users" ON "public"."document_versions" TO "authenticated" USING (true);



CREATE POLICY "Allow insert/update access to authenticated users" ON "public"."documents" TO "authenticated" USING (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."document_versions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view active service leg categories" ON "public"."service_leg_categories" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active subscription plans" ON "public"."subscription_plans" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active transport modes" ON "public"."transport_modes" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view service types" ON "public"."service_types" FOR SELECT USING (true);



CREATE POLICY "Anyone can view subscription features" ON "public"."subscription_features" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can insert audit logs for their actions" ON "public"."email_audit_log" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Delegates can view their delegations" ON "public"."email_account_delegations" FOR SELECT USING (("delegate_user_id" = "auth"."uid"()));



CREATE POLICY "Delegation owners can manage" ON "public"."email_account_delegations" USING (("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"())))) WITH CHECK (("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"()))));



CREATE POLICY "Email accounts scope matrix - DELETE" ON "public"."email_accounts" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_platform_admin"("auth"."uid"())));



CREATE POLICY "Email accounts scope matrix - INSERT" ON "public"."email_accounts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_platform_admin"("auth"."uid"())));



CREATE POLICY "Email accounts scope matrix - SELECT" ON "public"."email_accounts" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_platform_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))) OR ("id" IN ( SELECT "email_account_delegations"."account_id"
   FROM "public"."email_account_delegations"
  WHERE (("email_account_delegations"."delegate_user_id" = "auth"."uid"()) AND ("email_account_delegations"."is_active" = true) AND (("email_account_delegations"."expires_at" IS NULL) OR ("email_account_delegations"."expires_at" > "now"())))))));



CREATE POLICY "Email accounts scope matrix - UPDATE" ON "public"."email_accounts" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_platform_admin"("auth"."uid"())));



CREATE POLICY "Email scope matrix - DELETE" ON "public"."emails" FOR DELETE TO "authenticated" USING (((NOT "public"."is_viewer"("auth"."uid"())) AND (("user_id" = "auth"."uid"()) OR ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"()))) OR "public"."is_platform_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Email scope matrix - INSERT" ON "public"."emails" FOR INSERT TO "authenticated" WITH CHECK (((NOT "public"."is_viewer"("auth"."uid"())) AND (("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"()))) OR "public"."is_platform_admin"("auth"."uid"()) OR ("account_id" IN ( SELECT "email_account_delegations"."account_id"
   FROM "public"."email_account_delegations"
  WHERE (("email_account_delegations"."delegate_user_id" = "auth"."uid"()) AND ("email_account_delegations"."is_active" = true) AND ("email_account_delegations"."permissions" ? 'send'::"text") AND (("email_account_delegations"."expires_at" IS NULL) OR ("email_account_delegations"."expires_at" > "now"()))))))));



CREATE POLICY "Email scope matrix - SELECT" ON "public"."emails" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"("auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))) OR ("public"."is_sales_manager"("auth"."uid"()) AND (("user_id" = "auth"."uid"()) OR ("user_id" IN ( SELECT "public"."get_sales_manager_team_user_ids"("auth"."uid"()) AS "get_sales_manager_team_user_ids")) OR ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" IN ( SELECT "public"."get_sales_manager_team_user_ids"("auth"."uid"()) AS "get_sales_manager_team_user_ids")))))) OR (("user_id" = "auth"."uid"()) OR ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"())))) OR ("account_id" IN ( SELECT "email_account_delegations"."account_id"
   FROM "public"."email_account_delegations"
  WHERE (("email_account_delegations"."delegate_user_id" = "auth"."uid"()) AND ("email_account_delegations"."is_active" = true) AND (("email_account_delegations"."expires_at" IS NULL) OR ("email_account_delegations"."expires_at" > "now"())))))));



CREATE POLICY "Email scope matrix - UPDATE" ON "public"."emails" FOR UPDATE TO "authenticated" USING (((NOT "public"."is_viewer"("auth"."uid"())) AND (("user_id" = "auth"."uid"()) OR ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"()))) OR "public"."is_platform_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))))));



CREATE POLICY "Entity transfer items: delete (platform admin)" ON "public"."entity_transfer_items" FOR DELETE USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Entity transfer items: insert" ON "public"."entity_transfer_items" FOR INSERT WITH CHECK (("public"."is_platform_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."entity_transfers" "et"
  WHERE (("et"."id" = "entity_transfer_items"."transfer_id") AND ("et"."source_tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))))))));



CREATE POLICY "Entity transfer items: select" ON "public"."entity_transfer_items" FOR SELECT USING (("public"."is_platform_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."entity_transfers" "et"
  WHERE (("et"."id" = "entity_transfer_items"."transfer_id") AND (("et"."source_tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))) OR ("et"."target_tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))))))));



CREATE POLICY "Entity transfer items: update (platform admin)" ON "public"."entity_transfer_items" FOR UPDATE USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Entity transfers: delete (platform admin)" ON "public"."entity_transfers" FOR DELETE USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Entity transfers: insert" ON "public"."entity_transfers" FOR INSERT WITH CHECK ((("public"."is_platform_admin"("auth"."uid"()) OR ("source_tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))) AND ("requested_by" = "auth"."uid"())));



CREATE POLICY "Entity transfers: select" ON "public"."entity_transfers" FOR SELECT USING (("public"."is_platform_admin"("auth"."uid"()) OR ("source_tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))) OR ("target_tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))));



CREATE POLICY "Entity transfers: update" ON "public"."entity_transfers" FOR UPDATE USING (("public"."is_platform_admin"("auth"."uid"()) OR ("target_tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))));



CREATE POLICY "Everyone can view hierarchy" ON "public"."auth_role_hierarchy" FOR SELECT USING (true);



CREATE POLICY "Everyone can view permissions" ON "public"."auth_permissions" FOR SELECT USING (true);



CREATE POLICY "Everyone can view role permissions" ON "public"."auth_role_permissions" FOR SELECT USING (true);



CREATE POLICY "Everyone can view roles" ON "public"."auth_roles" FOR SELECT USING (true);



CREATE POLICY "Franchise admins can manage franchise accounts" ON "public"."accounts" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can manage franchise activities" ON "public"."activities" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can manage franchise contacts" ON "public"."contacts" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can manage franchise invitations" ON "public"."invitations" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can manage franchise leads" ON "public"."leads" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can manage franchise opportunities" ON "public"."opportunities" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can manage franchise quote config" ON "public"."quote_number_config_franchise" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can manage franchise quotes" ON "public"."quotes" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can manage franchise shipments" ON "public"."shipments" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can manage franchise user custom roles" ON "public"."user_custom_roles" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can update franchise user roles" ON "public"."user_roles" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can update own franchise" ON "public"."franchises" FOR UPDATE USING (("id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Franchise admins can view franchise assignment history" ON "public"."lead_assignment_history" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can view franchise audit logs" ON "public"."email_audit_log" FOR SELECT TO "authenticated" USING (("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can view franchise delegations" ON "public"."email_account_delegations" FOR SELECT USING (("public"."is_franchise_admin"("auth"."uid"()) AND ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE (("email_accounts"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) AND ("email_accounts"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))));



CREATE POLICY "Franchise admins can view franchise profiles" ON "public"."profiles" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("id" IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))))));



CREATE POLICY "Franchise admins can view franchise roles" ON "public"."user_roles" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Franchise admins can view own franchise" ON "public"."franchises" FOR SELECT USING (("id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Franchise admins manage franchise option legs" ON "public"."quotation_version_option_legs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL))));



CREATE POLICY "Franchise admins manage franchise quotation options" ON "public"."quotation_version_options" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL))));



CREATE POLICY "Franchise admins manage franchise quotation versions" ON "public"."quotation_versions" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL))));



CREATE POLICY "Franchise admins manage franchise quote charges" ON "public"."quote_charges" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL))));



CREATE POLICY "Franchise users can view franchise vehicles" ON "public"."vehicles" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Franchise users can view franchise warehouses" ON "public"."warehouses" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Import details: insert" ON "public"."import_history_details" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("import_id" IN ( SELECT "ih"."id"
   FROM "public"."import_history" "ih"
  WHERE ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))))));



CREATE POLICY "Import details: select" ON "public"."import_history_details" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("import_id" IN ( SELECT "ih"."id"
   FROM "public"."import_history" "ih"
  WHERE ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))))));



CREATE POLICY "Import details: update" ON "public"."import_history_details" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("import_id" IN ( SELECT "ih"."id"
   FROM "public"."import_history" "ih"
  WHERE ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("import_id" IN ( SELECT "ih"."id"
   FROM "public"."import_history" "ih"
  WHERE ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))))));



CREATE POLICY "Import errors: delete (platform admin)" ON "public"."import_errors" FOR DELETE USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Import errors: insert" ON "public"."import_errors" FOR INSERT WITH CHECK (("public"."is_platform_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."import_history" "ih"
  WHERE (("ih"."id" = "import_errors"."import_id") AND ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))))))));



CREATE POLICY "Import errors: select" ON "public"."import_errors" FOR SELECT USING (("public"."is_platform_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."import_history" "ih"
  WHERE (("ih"."id" = "import_errors"."import_id") AND ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))))))));



CREATE POLICY "Import errors: update (platform admin)" ON "public"."import_errors" FOR UPDATE USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Import history: insert" ON "public"."import_history" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))));



CREATE POLICY "Import history: select" ON "public"."import_history" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))));



CREATE POLICY "Import history: update" ON "public"."import_history" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))));



CREATE POLICY "Internal users manage tokens" ON "public"."portal_tokens" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Manage attachments by tenant admins" ON "public"."carrier_rate_attachments" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Manage charges by tenant admins" ON "public"."carrier_rate_charges" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Platform admins can insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all OAuth configs" ON "public"."oauth_configurations" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all accounts" ON "public"."accounts" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all activities" ON "public"."activities" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all assignment history" ON "public"."lead_assignment_history" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all assignment queue" ON "public"."lead_assignment_queue" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all assignment rules" ON "public"."lead_assignment_rules" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all cargo details" ON "public"."cargo_details" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all cargo types" ON "public"."cargo_types" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all carrier rate charges" ON "public"."carrier_rate_charges" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all carrier type mappings" ON "public"."carrier_service_types" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all carriers" ON "public"."carriers" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all charge bases" ON "public"."charge_bases" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all charge categories" ON "public"."charge_categories" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all charge sides" ON "public"."charge_sides" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all compliance rules" ON "public"."compliance_rules" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all consignees" ON "public"."consignees" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all contacts" ON "public"."contacts" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all container sizes" ON "public"."container_sizes" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all container types" ON "public"."container_types" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all currencies" ON "public"."currencies" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all custom role permissions" ON "public"."custom_role_permissions" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all custom roles" ON "public"."custom_roles" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all customs documents" ON "public"."customs_documents" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all delegations" ON "public"."email_account_delegations" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all email filters" ON "public"."email_filters" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all franchise quote configs" ON "public"."quote_number_config_franchise" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all incoterms" ON "public"."incoterms" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all invoices" ON "public"."subscription_invoices" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all leads" ON "public"."leads" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all mappings" ON "public"."service_type_mappings" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all opportunities" ON "public"."opportunities" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all package categories" ON "public"."package_categories" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all package sizes" ON "public"."package_sizes" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all ports" ON "public"."ports_locations" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all presets" ON "public"."history_filter_presets" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all queue members" ON "public"."queue_members" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all queues" ON "public"."queues" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all quotation packages" ON "public"."quotation_packages" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all quotation version options" ON "public"."quotation_version_options" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all quote items" ON "public"."quote_items" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all quote legs" ON "public"."quote_legs" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all quote sequences" ON "public"."quote_number_sequences" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all quotes" ON "public"."quotes" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all rates" ON "public"."carrier_rates" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all routes" ON "public"."routes" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all scoring rules" ON "public"."lead_scoring_rules" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all service type mappings" ON "public"."service_type_mappings" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all service types" ON "public"."service_types" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all services" ON "public"."services" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all shipment items" ON "public"."shipment_items" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all shipments" ON "public"."shipments" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all shipping rates" ON "public"."shipping_rates" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all subscriptions" ON "public"."tenant_subscriptions" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all templates" ON "public"."document_templates" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all templates" ON "public"."email_templates" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all tenant quote configs" ON "public"."quote_number_config_tenant" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all territories" ON "public"."territories" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all territory assignments" ON "public"."territory_assignments" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all territory geographies" ON "public"."territory_geographies" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all tier configs" ON "public"."charge_tier_config" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all tier ranges" ON "public"."charge_tier_ranges" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all tracking events" ON "public"."tracking_events" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all usage records" ON "public"."usage_records" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all user capacity" ON "public"."user_capacity" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all user custom roles" ON "public"."user_custom_roles" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all vehicles" ON "public"."vehicles" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all warehouse inventory" ON "public"."warehouse_inventory" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all warehouses" ON "public"."warehouses" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage all weight breaks" ON "public"."charge_weight_breaks" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage auth_permissions" ON "public"."auth_permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role")))));



CREATE POLICY "Platform admins can manage auth_role_permissions" ON "public"."auth_role_permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role")))));



CREATE POLICY "Platform admins can manage auth_roles" ON "public"."auth_roles" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role")))));



CREATE POLICY "Platform admins can manage service leg categories" ON "public"."service_leg_categories" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage subscription features" ON "public"."subscription_features" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage subscription plans" ON "public"."subscription_plans" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can manage transport modes" ON "public"."transport_modes" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can update all profiles" ON "public"."profiles" FOR UPDATE USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can update user roles" ON "public"."user_roles" FOR UPDATE USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can view all audit logs" ON "public"."audit_logs" FOR SELECT USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can view all audit logs" ON "public"."quotation_audit_log" FOR SELECT USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to customer selections" ON "public"."customer_selections" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to franchises" ON "public"."franchises" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to invitations" ON "public"."invitations" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to option legs" ON "public"."quotation_version_option_legs" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to provider api configs" ON "public"."provider_api_configs" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to provider charge mappings" ON "public"."provider_charge_mappings" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to provider rate rules" ON "public"."provider_rate_rules" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to provider rate templates" ON "public"."provider_rate_templates" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to provider surcharges" ON "public"."provider_surcharges" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to quotation options" ON "public"."quotation_version_options" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to quotation versions" ON "public"."quotation_versions" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to quote charges" ON "public"."quote_charges" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to quote versions" ON "public"."quotation_versions" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to roles" ON "public"."user_roles" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to tenants" ON "public"."tenants" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins full access to version options" ON "public"."quotation_version_options" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins manage all cargo details" ON "public"."cargo_details" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins manage all carrier rates" ON "public"."carrier_rates" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins manage all opportunity items" ON "public"."opportunity_items" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Platform admins view all logs" ON "public"."audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))));



CREATE POLICY "Scheduled emails scope matrix" ON "public"."scheduled_emails" TO "authenticated" USING (("public"."is_platform_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))) OR ("public"."is_sales_manager"("auth"."uid"()) AND ("user_id" IN ( SELECT "public"."get_sales_manager_team_user_ids"("auth"."uid"()) AS "get_sales_manager_team_user_ids"))) OR ("user_id" = "auth"."uid"()))) WITH CHECK (((NOT "public"."is_viewer"("auth"."uid"())) AND ("public"."is_platform_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))) OR ("user_id" = "auth"."uid"()))));



CREATE POLICY "Super admins can view all audit logs" ON "public"."email_audit_log" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "System can manage quote sequences" ON "public"."quote_number_sequences" USING (true);



CREATE POLICY "Tenant admins can create own subscriptions" ON "public"."tenant_subscriptions" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage cargo details" ON "public"."cargo_details" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage cargo types" ON "public"."cargo_types" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage carrier rate charges" ON "public"."carrier_rate_charges" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage carriers" ON "public"."carriers" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage compliance rules" ON "public"."compliance_rules" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage consignees" ON "public"."consignees" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage container sizes" ON "public"."container_sizes" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage container types" ON "public"."container_types" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage franchise quote configs" ON "public"."quote_number_config_franchise" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage incoterms" ON "public"."incoterms" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage members of their tenant queues" ON "public"."queue_members" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."queues" "q"
  WHERE (("q"."id" = "queue_members"."queue_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."queues" "q"
  WHERE (("q"."id" = "queue_members"."queue_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))));



CREATE POLICY "Tenant admins can manage own carrier type mappings" ON "public"."carrier_service_types" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage own service type mappings" ON "public"."service_type_mappings" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage package categories" ON "public"."package_categories" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage package sizes" ON "public"."package_sizes" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage ports" ON "public"."ports_locations" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage queue members" ON "public"."queue_members" USING ((EXISTS ( SELECT 1
   FROM "public"."queues" "q"
  WHERE (("q"."id" = "queue_members"."queue_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."queues" "q"
  WHERE (("q"."id" = "queue_members"."queue_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role")))));



CREATE POLICY "Tenant admins can manage queues" ON "public"."queues" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage rates" ON "public"."carrier_rates" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage services" ON "public"."services" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage templates" ON "public"."document_templates" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant accounts" ON "public"."accounts" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant activities" ON "public"."activities" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant assignment rules" ON "public"."lead_assignment_rules" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant contacts" ON "public"."contacts" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant custom role permissions" ON "public"."custom_role_permissions" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("role_id" IN ( SELECT "custom_roles"."id"
   FROM "public"."custom_roles"
  WHERE ("custom_roles"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Tenant admins can manage tenant custom roles" ON "public"."custom_roles" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant franchises" ON "public"."franchises" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Tenant admins can manage tenant invitations" ON "public"."invitations" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant leads" ON "public"."leads" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant mappings" ON "public"."service_type_mappings" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant opportunities" ON "public"."opportunities" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant queues" ON "public"."queues" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant quotation packages" ON "public"."quotation_packages" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant quote config" ON "public"."quote_number_config_tenant" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant quote legs" ON "public"."quote_legs" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant quotes" ON "public"."quotes" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant roles" ON "public"."user_roles" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant routes" ON "public"."routes" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant scoring rules" ON "public"."lead_scoring_rules" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant shipments" ON "public"."shipments" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant shipping rates" ON "public"."shipping_rates" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant territories" ON "public"."territories" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant user capacity" ON "public"."user_capacity" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant user custom roles" ON "public"."user_custom_roles" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant vehicles" ON "public"."vehicles" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tenant warehouse inventory" ON "public"."warehouse_inventory" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("warehouse_id" IN ( SELECT "warehouses"."id"
   FROM "public"."warehouses"
  WHERE ("warehouses"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Tenant admins can manage tenant warehouses" ON "public"."warehouses" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage territory assignments" ON "public"."territory_assignments" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("territory_id" IN ( SELECT "territories"."id"
   FROM "public"."territories"
  WHERE ("territories"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Tenant admins can manage their territory geographies" ON "public"."territory_geographies" USING ((EXISTS ( SELECT 1
   FROM "public"."territories" "t"
  WHERE (("t"."id" = "territory_geographies"."territory_id") AND ("t"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Tenant admins can manage themes" ON "public"."themes" USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['tenant_admin'::"public"."app_role", 'platform_admin'::"public"."app_role"]))))) OR "public"."is_platform_admin"("auth"."uid"())));



CREATE POLICY "Tenant admins can manage tier configs" ON "public"."charge_tier_config" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can manage tier ranges" ON "public"."charge_tier_ranges" USING (("tier_config_id" IN ( SELECT "charge_tier_config"."id"
   FROM "public"."charge_tier_config"
  WHERE ("charge_tier_config"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))));



CREATE POLICY "Tenant admins can manage weight breaks" ON "public"."charge_weight_breaks" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can update own subscriptions" ON "public"."tenant_subscriptions" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can update own tenant" ON "public"."tenants" FOR UPDATE USING (("id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Tenant admins can update tenant user roles" ON "public"."user_roles" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can view all audit logs" ON "public"."quotation_audit_log" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can view delegations" ON "public"."email_account_delegations" FOR SELECT USING (("public"."is_tenant_admin"("auth"."uid"()) AND ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Tenant admins can view own invoices" ON "public"."subscription_invoices" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can view own subscriptions" ON "public"."tenant_subscriptions" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can view own tenant" ON "public"."tenants" FOR SELECT USING (("id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Tenant admins can view own usage records" ON "public"."usage_records" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can view tenant assignment history" ON "public"."lead_assignment_history" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can view tenant assignment queue" ON "public"."lead_assignment_queue" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can view tenant audit logs" ON "public"."audit_logs" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("user_id" IN ( SELECT "ur"."user_id"
   FROM "public"."user_roles" "ur"
  WHERE ("ur"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Tenant admins can view tenant audit logs" ON "public"."email_audit_log" FOR SELECT TO "authenticated" USING (("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins can view tenant profiles" ON "public"."profiles" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("id" IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Tenant admins manage own cargo details" ON "public"."cargo_details" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage provider api configs" ON "public"."provider_api_configs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage provider charge mappings" ON "public"."provider_charge_mappings" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage provider rate rules" ON "public"."provider_rate_rules" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage provider rate templates" ON "public"."provider_rate_templates" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage provider surcharges" ON "public"."provider_surcharges" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage quotation versions" ON "public"."quotation_versions" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage selection events" ON "public"."quotation_selection_events" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage tenant carrier rates" ON "public"."carrier_rates" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage tenant option legs" ON "public"."quotation_version_option_legs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage tenant quotation options" ON "public"."quotation_version_options" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage tenant quotation versions" ON "public"."quotation_versions" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage tenant quote charges" ON "public"."quote_charges" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant admins manage version options" ON "public"."quotation_version_options" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Tenant members can view own subscription invoices" ON "public"."subscription_invoices" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Tenant members can view own subscriptions" ON "public"."tenant_subscriptions" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Tenant members can view own usage records" ON "public"."usage_records" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Tenant users can view compliance rules" ON "public"."compliance_rules" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Tenant users can view container sizes" ON "public"."container_sizes" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("tenant_id" IS NULL)));



CREATE POLICY "Tenant users can view container types" ON "public"."container_types" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("tenant_id" IS NULL)));



CREATE POLICY "Tenant users can view rates" ON "public"."carrier_rates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Tenant users can view services" ON "public"."services" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Tenant users can view templates" ON "public"."document_templates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Territory geographies deletable" ON "public"."territory_geographies" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."territories" "t" ON (("t"."id" = "territory_geographies"."territory_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = 'platform_admin'::"public"."app_role") OR ("ur"."tenant_id" = "t"."tenant_id"))))));



CREATE POLICY "Territory geographies insertable" ON "public"."territory_geographies" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."territories" "t" ON (("t"."id" = "territory_geographies"."territory_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = 'platform_admin'::"public"."app_role") OR ("ur"."tenant_id" = "t"."tenant_id"))))));



CREATE POLICY "Territory geographies readable" ON "public"."territory_geographies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."territories" "t" ON (("t"."id" = "territory_geographies"."territory_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = 'platform_admin'::"public"."app_role") OR ("ur"."tenant_id" = "t"."tenant_id"))))));



CREATE POLICY "Territory geographies updatable" ON "public"."territory_geographies" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."territories" "t" ON (("t"."id" = "territory_geographies"."territory_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = 'platform_admin'::"public"."app_role") OR ("ur"."tenant_id" = "t"."tenant_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."territories" "t" ON (("t"."id" = "territory_geographies"."territory_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = 'platform_admin'::"public"."app_role") OR ("ur"."tenant_id" = "t"."tenant_id"))))));



CREATE POLICY "Users can create activities" ON "public"."activities" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can create calculations" ON "public"."rate_calculations" FOR INSERT WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can create cargo details" ON "public"."cargo_details" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can create compliance checks" ON "public"."compliance_checks" FOR INSERT WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can create customer selections" ON "public"."customer_selections" FOR INSERT WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can create franchise accounts" ON "public"."accounts" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can create franchise contacts" ON "public"."contacts" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can create franchise leads" ON "public"."leads" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can create franchise opportunities" ON "public"."opportunities" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can create franchise quote legs" ON "public"."quote_legs" FOR INSERT WITH CHECK (("quote_option_id" IN ( SELECT "qvo"."id"
   FROM (("public"."quotation_version_options" "qvo"
     JOIN "public"."quotation_versions" "qv" ON (("qvo"."quotation_version_id" = "qv"."id")))
     JOIN "public"."quotes" "q" ON (("qv"."quote_id" = "q"."id")))
  WHERE ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can create franchise quotes" ON "public"."quotes" FOR INSERT TO "authenticated" WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can create franchise shipments" ON "public"."shipments" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can create quotation packages" ON "public"."quotation_packages" FOR INSERT TO "authenticated" WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can create quote versions" ON "public"."quotation_versions" FOR INSERT WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can create templates" ON "public"."email_templates" FOR INSERT WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Users can create templates for their tenant" ON "public"."quote_templates" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can create tracking events for accessible shipments" ON "public"."tracking_events" FOR INSERT WITH CHECK (("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE (("shipments"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("shipments"."assigned_to" = "auth"."uid"())))));



CREATE POLICY "Users can create version options" ON "public"."quotation_version_options" FOR INSERT WITH CHECK (("quotation_version_id" IN ( SELECT "qv"."id"
   FROM ("public"."quotation_versions" "qv"
     JOIN "public"."quotes" "q" ON (("qv"."quote_id" = "q"."id")))
  WHERE ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can delete own dashboard preferences" ON "public"."dashboard_preferences" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own templates" ON "public"."email_templates" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can delete templates from their tenant" ON "public"."quote_templates" FOR DELETE USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can delete their own preferences" ON "public"."user_preferences" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert activities" ON "public"."lead_activities" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert import details" ON "public"."import_history_details" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can insert import history" ON "public"."import_history" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can insert logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own dashboard preferences" ON "public"."dashboard_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own preferences" ON "public"."user_preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage customs documents for accessible shipments" ON "public"."customs_documents" USING (("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE (("shipments"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("shipments"."assigned_to" = "auth"."uid"())))));



CREATE POLICY "Users can manage items for accessible quotes" ON "public"."quote_items" TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage items for accessible shipments" ON "public"."shipment_items" USING (("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE (("shipments"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("shipments"."assigned_to" = "auth"."uid"())))));



CREATE POLICY "Users can manage options for accessible versions" ON "public"."quotation_version_options" USING (("quotation_version_id" IN ( SELECT "qv"."id"
   FROM ("public"."quotation_versions" "qv"
     JOIN "public"."quotes" "q" ON (("qv"."quote_id" = "q"."id")))
  WHERE (("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("q"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage own OAuth configs" ON "public"."oauth_configurations" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own email filters" ON "public"."email_filters" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own presets" ON "public"."history_filter_presets" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their quote tokens" ON "public"."portal_tokens" USING ((("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Users can manage their shipment attachments" ON "public"."shipment_attachments" USING ((("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE ("shipments"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Users can manage their tenant lead activities" ON "public"."lead_activities" USING ((("lead_id" IN ( SELECT "leads"."id"
   FROM "public"."leads"
  WHERE ("leads"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Users can manage their tenant templates" ON "public"."quote_templates" USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Users can manage versions for accessible quotes" ON "public"."quotation_versions" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can update assigned opportunities" ON "public"."opportunities" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can update import history" ON "public"."import_history" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can update own activities" ON "public"."activities" FOR UPDATE USING (("assigned_to" = "auth"."uid"()));



CREATE POLICY "Users can update own dashboard preferences" ON "public"."dashboard_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own templates" ON "public"."email_templates" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can update quotation packages" ON "public"."quotation_packages" FOR UPDATE TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can update templates from their tenant" ON "public"."quote_templates" FOR UPDATE USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can update their own preferences" ON "public"."user_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view activities for their leads" ON "public"."lead_activities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE ("leads"."id" = "lead_activities"."lead_id"))));



CREATE POLICY "Users can view assigned activities" ON "public"."activities" FOR SELECT USING ((("assigned_to" = "auth"."uid"()) OR ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Users can view assigned shipments" ON "public"."shipments" FOR SELECT USING ((("assigned_to" = "auth"."uid"()) OR ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));



CREATE POLICY "Users can view calculations for accessible quotes" ON "public"."rate_calculations" FOR SELECT USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can view charge bases" ON "public"."charge_bases" FOR SELECT USING (true);



CREATE POLICY "Users can view charge categories" ON "public"."charge_categories" FOR SELECT USING (true);



CREATE POLICY "Users can view charge sides" ON "public"."charge_sides" FOR SELECT USING (true);



CREATE POLICY "Users can view compliance checks for accessible quotes" ON "public"."compliance_checks" FOR SELECT USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can view currencies" ON "public"."currencies" FOR SELECT USING (true);



CREATE POLICY "Users can view custom role permissions" ON "public"."custom_role_permissions" FOR SELECT USING (("role_id" IN ( SELECT "custom_roles"."id"
   FROM "public"."custom_roles"
  WHERE ("custom_roles"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))));



CREATE POLICY "Users can view franchise accounts" ON "public"."accounts" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can view franchise audit logs" ON "public"."quotation_audit_log" FOR SELECT USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can view franchise contacts" ON "public"."contacts" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can view franchise customer selections" ON "public"."customer_selections" FOR SELECT USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can view franchise leads" ON "public"."leads" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can view franchise opportunities" ON "public"."opportunities" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can view franchise quotation packages" ON "public"."quotation_packages" FOR SELECT TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can view franchise quote config" ON "public"."quote_number_config_franchise" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can view franchise quote legs" ON "public"."quote_legs" FOR SELECT USING (("quote_option_id" IN ( SELECT "qvo"."id"
   FROM (("public"."quotation_version_options" "qvo"
     JOIN "public"."quotation_versions" "qv" ON (("qvo"."quotation_version_id" = "qv"."id")))
     JOIN "public"."quotes" "q" ON (("qv"."quote_id" = "q"."id")))
  WHERE ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can view franchise quote versions" ON "public"."quotation_versions" FOR SELECT USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can view franchise quotes" ON "public"."quotes" FOR SELECT TO "authenticated" USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can view franchise version options" ON "public"."quotation_version_options" FOR SELECT USING (("quotation_version_id" IN ( SELECT "qv"."id"
   FROM ("public"."quotation_versions" "qv"
     JOIN "public"."quotes" "q" ON (("qv"."quote_id" = "q"."id")))
  WHERE ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can view franchise warehouse inventory" ON "public"."warehouse_inventory" FOR SELECT USING (("warehouse_id" IN ( SELECT "warehouses"."id"
   FROM "public"."warehouses"
  WHERE ("warehouses"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "Users can view global carrier type mappings" ON "public"."carrier_service_types" FOR SELECT USING (("tenant_id" IS NULL));



CREATE POLICY "Users can view global carriers" ON "public"."carriers" FOR SELECT USING (("tenant_id" IS NULL));



CREATE POLICY "Users can view global ports" ON "public"."ports_locations" FOR SELECT USING (("tenant_id" IS NULL));



CREATE POLICY "Users can view history of opportunities they can view" ON "public"."opportunity_probability_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."opportunities" "o"
  WHERE ("o"."id" = "opportunity_probability_history"."opportunity_id"))));



CREATE POLICY "Users can view history within tenant" ON "public"."opportunity_probability_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."opportunities" "o"
  WHERE (("o"."id" = "opportunity_probability_history"."opportunity_id") AND ("o"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Users can view import details" ON "public"."import_history_details" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view import history" ON "public"."import_history" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view own audit logs" ON "public"."email_audit_log" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own capacity" ON "public"."user_capacity" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own custom roles" ON "public"."user_custom_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own dashboard preferences" ON "public"."dashboard_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own franchise" ON "public"."franchises" FOR SELECT USING (("id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users can view own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view queue members in their tenant" ON "public"."queue_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."queues" "q"
  WHERE (("q"."id" = "queue_members"."queue_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Users can view queues in their tenant" ON "public"."queues" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view quotation versions" ON "public"."quotation_versions" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view score logs for their leads" ON "public"."lead_score_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE ("leads"."id" = "lead_score_logs"."lead_id"))));



CREATE POLICY "Users can view selection events" ON "public"."quotation_selection_events" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view team dashboard preferences" ON "public"."dashboard_preferences" FOR SELECT USING (("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view templates from their tenant" ON "public"."quote_templates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant attachments" ON "public"."carrier_rate_attachments" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant cargo details" ON "public"."cargo_details" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant cargo types" ON "public"."cargo_types" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant carrier rate charges" ON "public"."carrier_rate_charges" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant carrier rates" ON "public"."carrier_rates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant carrier type mappings" ON "public"."carrier_service_types" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant carriers" ON "public"."carriers" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant charges" ON "public"."carrier_rate_charges" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant consignees" ON "public"."consignees" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant custom roles" ON "public"."custom_roles" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant incoterms" ON "public"."incoterms" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant mappings" ON "public"."service_type_mappings" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant package categories" ON "public"."package_categories" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant package sizes" ON "public"."package_sizes" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant ports" ON "public"."ports_locations" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant quote config" ON "public"."quote_number_config_tenant" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant routes" ON "public"."routes" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant service type mappings" ON "public"."service_type_mappings" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant shipping rates" ON "public"."shipping_rates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant templates" ON "public"."email_templates" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (("is_shared" = true) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "Users can view tenant tier configs" ON "public"."charge_tier_config" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view tenant tier ranges" ON "public"."charge_tier_ranges" FOR SELECT USING (("tier_config_id" IN ( SELECT "charge_tier_config"."id"
   FROM "public"."charge_tier_config"
  WHERE ("charge_tier_config"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))));



CREATE POLICY "Users can view tenant weight breaks" ON "public"."charge_weight_breaks" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users can view territory geographies" ON "public"."territory_geographies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."territories" "t"
  WHERE (("t"."id" = "territory_geographies"."territory_id") AND (("t"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_platform_admin"("auth"."uid"()))))));



CREATE POLICY "Users can view their own preferences" ON "public"."user_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their quote tokens" ON "public"."portal_tokens" FOR SELECT USING ((("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Users can view their shipment attachments" ON "public"."shipment_attachments" FOR SELECT USING ((("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE ("shipments"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Users can view their tenant lead activities" ON "public"."lead_activities" FOR SELECT USING ((("lead_id" IN ( SELECT "leads"."id"
   FROM "public"."leads"
  WHERE ("leads"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Users can view their tenant score config" ON "public"."lead_score_config" FOR SELECT USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Users can view their tenant score logs" ON "public"."lead_score_logs" FOR SELECT USING ((("lead_id" IN ( SELECT "leads"."id"
   FROM "public"."leads"
  WHERE ("leads"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Users can view their tenant templates" ON "public"."quote_templates" FOR SELECT USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));



CREATE POLICY "Users can view themes in their tenant" ON "public"."themes" FOR SELECT USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) OR "public"."is_platform_admin"("auth"."uid"())));



CREATE POLICY "Users can view tracking for accessible shipments" ON "public"."tracking_events" FOR SELECT USING (("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE (("shipments"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("shipments"."assigned_to" = "auth"."uid"())))));



CREATE POLICY "Users can view version options" ON "public"."quotation_version_options" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users create franchise option legs" ON "public"."quotation_version_option_legs" FOR INSERT TO "authenticated" WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users create franchise quotation options" ON "public"."quotation_version_options" FOR INSERT TO "authenticated" WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users create franchise quotation versions" ON "public"."quotation_versions" FOR INSERT TO "authenticated" WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users create franchise quote charges" ON "public"."quote_charges" FOR INSERT TO "authenticated" WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));



CREATE POLICY "Users view franchise option legs" ON "public"."quotation_version_option_legs" FOR SELECT TO "authenticated" USING ((("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL)));



CREATE POLICY "Users view franchise quotation options" ON "public"."quotation_version_options" FOR SELECT TO "authenticated" USING ((("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL)));



CREATE POLICY "Users view franchise quotation versions" ON "public"."quotation_versions" FOR SELECT TO "authenticated" USING ((("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL)));



CREATE POLICY "Users view franchise quote charges" ON "public"."quote_charges" FOR SELECT TO "authenticated" USING ((("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL)));



CREATE POLICY "Users view own logs" ON "public"."audit_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view tenant provider charge mappings" ON "public"."provider_charge_mappings" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users view tenant provider rate rules" ON "public"."provider_rate_rules" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users view tenant provider rate templates" ON "public"."provider_rate_templates" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users view tenant provider surcharges" ON "public"."provider_surcharges" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_role_hierarchy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cargo_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cargo_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carrier_rate_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carrier_rate_charges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carrier_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carrier_service_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carriers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."charge_bases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "charge_bases_manage" ON "public"."charge_bases" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "charge_bases_read" ON "public"."charge_bases" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."charge_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "charge_categories_manage" ON "public"."charge_categories" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "charge_categories_read" ON "public"."charge_categories" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."charge_sides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "charge_sides_manage" ON "public"."charge_sides" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "charge_sides_read" ON "public"."charge_sides" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."charge_tier_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."charge_tier_ranges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."charge_weight_breaks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cities_manage" ON "public"."cities" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "cities_read" ON "public"."cities" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."compliance_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."container_sizes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "container_sizes_manage" ON "public"."container_sizes" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "container_sizes_read" ON "public"."container_sizes" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."container_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "container_types_manage" ON "public"."container_types" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "container_types_read" ON "public"."container_types" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."continents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "continents_manage" ON "public"."continents" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "continents_read" ON "public"."continents" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "countries_manage" ON "public"."countries" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "countries_read" ON "public"."countries" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."currencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "currencies_manage" ON "public"."currencies" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "currencies_read" ON "public"."currencies" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."custom_role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_selections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customs_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dashboard_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_account_delegations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_filters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_transfer_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."franchises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fx_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fx_rates_tenant_read" ON "public"."fx_rates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "fx_rates_tenant_write" ON "public"."fx_rates" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."history_filter_presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_history_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incoterms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_assignment_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_assignment_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_assignment_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_score_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_score_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_scoring_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."margin_methods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "margin_methods_tenant_read" ON "public"."margin_methods" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "margin_methods_tenant_write" ON "public"."margin_methods" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."margin_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "margin_profiles_tenant_read" ON "public"."margin_profiles" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "margin_profiles_tenant_write" ON "public"."margin_profiles" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."oauth_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opportunities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opportunity_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opportunity_probability_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_sizes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portal_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ports_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_api_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_charge_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_rate_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_rate_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_surcharges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_types_tenant_read" ON "public"."provider_types" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "provider_types_tenant_write" ON "public"."provider_types" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "pt_admin" ON "public"."quote_presentation_templates" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "pt_tenant" ON "public"."quote_presentation_templates" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "pt_view" ON "public"."quote_presentation_templates" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "qal_insert" ON "public"."quote_access_logs" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "qal_view" ON "public"."quote_access_logs" FOR SELECT TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "qc_admin" ON "public"."quote_comments" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "qc_public" ON "public"."quote_comments" FOR INSERT TO "authenticated", "anon" WITH CHECK (("author_type" = 'customer'::"text"));



CREATE POLICY "qc_user" ON "public"."quote_comments" TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "qd_admin" ON "public"."quote_documents" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "qd_public" ON "public"."quote_documents" FOR SELECT TO "authenticated", "anon" USING (("is_public" = true));



CREATE POLICY "qd_user" ON "public"."quote_documents" TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "qeh_insert" ON "public"."quote_email_history" FOR INSERT TO "authenticated" WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "qeh_view" ON "public"."quote_email_history" FOR SELECT TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



CREATE POLICY "qs_admin" ON "public"."quote_shares" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "qs_public" ON "public"."quote_shares" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "qs_user" ON "public"."quote_shares" TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));



ALTER TABLE "public"."queue_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."queues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_selection_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_version_option_legs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotation_version_option_legs_manage_alignment" ON "public"."quotation_version_option_legs" USING ((EXISTS ( SELECT 1
   FROM (("public"."quotation_version_options" "qvo"
     JOIN "public"."quotation_versions" "qv" ON (("qv"."id" = "qvo"."quotation_version_id")))
     JOIN "public"."quotes" "q" ON (("q"."id" = "qv"."quote_id")))
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND (("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR "public"."is_platform_admin"("auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."quotation_version_options" "qvo"
     JOIN "public"."quotation_versions" "qv" ON (("qv"."id" = "qvo"."quotation_version_id")))
     JOIN "public"."quotes" "q" ON (("q"."id" = "qv"."quote_id")))
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND (("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR "public"."is_platform_admin"("auth"."uid"()))))));



CREATE POLICY "quotation_version_option_legs_read" ON "public"."quotation_version_option_legs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quotation_version_options" "qvo"
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND ("qvo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "quotation_version_option_legs_read_alignment" ON "public"."quotation_version_option_legs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."quotation_version_options" "qvo"
     JOIN "public"."quotation_versions" "qv" ON (("qv"."id" = "qvo"."quotation_version_id")))
     JOIN "public"."quotes" "q" ON (("q"."id" = "qv"."quote_id")))
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND (("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR "public"."is_platform_admin"("auth"."uid"()))))));



CREATE POLICY "quotation_version_option_legs_write" ON "public"."quotation_version_option_legs" USING ((EXISTS ( SELECT 1
   FROM "public"."quotation_version_options" "qvo"
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND ("qvo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quotation_version_options" "qvo"
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND ("qvo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



ALTER TABLE "public"."quotation_version_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotation_versions_manage" ON "public"."quotation_versions" USING ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quotation_versions"."quote_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quotation_versions"."quote_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "quotation_versions_read" ON "public"."quotation_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quotation_versions"."quote_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



ALTER TABLE "public"."quote_access_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_charges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_email_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_legs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_number_config_franchise" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_number_config_tenant" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_number_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_option_legs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quote_option_legs_read" ON "public"."quote_option_legs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quote_options" "qo"
  WHERE (("qo"."id" = "quote_option_legs"."quote_option_id") AND ("qo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "quote_option_legs_write" ON "public"."quote_option_legs" USING ((EXISTS ( SELECT 1
   FROM "public"."quote_options" "qo"
  WHERE (("qo"."id" = "quote_option_legs"."quote_option_id") AND ("qo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quote_options" "qo"
  WHERE (("qo"."id" = "quote_option_legs"."quote_option_id") AND ("qo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



ALTER TABLE "public"."quote_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quote_options_manage" ON "public"."quote_options" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "quote_options_read" ON "public"."quote_options" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."quote_presentation_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_selection" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quote_selection_manage" ON "public"."quote_selection" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "quote_selection_read" ON "public"."quote_selection" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."quote_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_calculations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_components" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."routes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_leg_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_modes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_modes_tenant_read" ON "public"."service_modes" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "service_modes_tenant_write" ON "public"."service_modes" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."service_type_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipment_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shipment_attachments_delete_by_creator" ON "public"."shipment_attachments" FOR DELETE TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "shipment_attachments_insert_authenticated" ON "public"."shipment_attachments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "shipment_attachments_read_authenticated" ON "public"."shipment_attachments" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."shipment_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."states" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "states_manage" ON "public"."states" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "states_read" ON "public"."states" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."subscription_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."territories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."territory_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."territory_geographies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."themes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tracking_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trade_directions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trade_directions_tenant_read" ON "public"."trade_directions" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "trade_directions_tenant_write" ON "public"."trade_directions" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."transport_modes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ui_themes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ui_themes_read_authenticated" ON "public"."ui_themes" FOR SELECT TO "authenticated" USING ("is_active");



CREATE POLICY "ui_themes_user_write" ON "public"."ui_themes" TO "authenticated" USING ((("scope" = 'user'::"text") AND ("user_id" = "auth"."uid"()))) WITH CHECK ((("scope" = 'user'::"text") AND ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."usage_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_capacity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_custom_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."warehouse_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."warehouses" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_current_reset_bucket"("p_policy" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_current_reset_bucket"("p_policy" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_current_reset_bucket"("p_policy" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_quote_by_token"("p_token" "text", "p_decision" "text", "p_name" "text", "p_email" "text", "p_ip" "text", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_quote_by_token"("p_token" "text", "p_decision" "text", "p_name" "text", "p_email" "text", "p_ip" "text", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_quote_by_token"("p_token" "text", "p_decision" "text", "p_name" "text", "p_email" "text", "p_ip" "text", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_franchisee_account_contact"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_account_data" "jsonb", "p_contact_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_franchisee_account_contact"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_account_data" "jsonb", "p_contact_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_franchisee_account_contact"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_account_data" "jsonb", "p_contact_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_lead_with_transaction"("p_lead_id" "uuid", "p_assigned_to" "uuid", "p_assignment_method" "text", "p_rule_id" "uuid", "p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_lead_with_transaction"("p_lead_id" "uuid", "p_assigned_to" "uuid", "p_assignment_method" "text", "p_rule_id" "uuid", "p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_lead_with_transaction"("p_lead_id" "uuid", "p_assigned_to" "uuid", "p_assignment_method" "text", "p_rule_id" "uuid", "p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_assign_version_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_assign_version_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_assign_version_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_generate_quote_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_generate_quote_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_generate_quote_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_dimensional_weight"("p_length_cm" numeric, "p_width_cm" numeric, "p_height_cm" numeric, "p_divisor" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_dimensional_weight"("p_length_cm" numeric, "p_width_cm" numeric, "p_height_cm" numeric, "p_divisor" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_dimensional_weight"("p_length_cm" numeric, "p_width_cm" numeric, "p_height_cm" numeric, "p_divisor" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_lead_score"("lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_lead_score"("lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_lead_score"("lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_next_version_number"("p_quote_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_next_version_number"("p_quote_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_next_version_number"("p_quote_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_option_margins"("p_option_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_option_margins"("p_option_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_option_margins"("p_option_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_option_totals"("p_option_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_option_totals"("p_option_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_option_totals"("p_option_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_usage_limit"("_tenant_id" "uuid", "_feature_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_usage_limit"("_tenant_id" "uuid", "_feature_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_usage_limit"("_tenant_id" "uuid", "_feature_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_logs"("days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_logs"("days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_logs"("days_to_keep" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."compare_versions"("p_version_id_1" "uuid", "p_version_id_2" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."compare_versions"("p_version_id_1" "uuid", "p_version_id_2" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compare_versions"("p_version_id_1" "uuid", "p_version_id_2" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_quote_share"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_expires_in_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_quote_share"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_expires_in_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_quote_share"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_expires_in_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_primary_quote"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_primary_quote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_primary_quote"() TO "service_role";



GRANT ALL ON FUNCTION "public"."evaluate_provider_rate_rules"("p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_quote_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."evaluate_provider_rate_rules"("p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_quote_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."evaluate_provider_rate_rules"("p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_quote_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_sql_query"("query_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."execute_sql_query"("query_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_sql_query"("query_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_transfer"("p_transfer_id" "uuid", "p_approver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."execute_transfer"("p_transfer_id" "uuid", "p_approver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_transfer"("p_transfer_id" "uuid", "p_approver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_next_option_name"("p_version_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_next_option_name"("p_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_next_option_name"("p_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_share_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_share_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_share_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_applicable_provider_surcharges"("p_carrier_id" "uuid", "p_service_type" "text", "p_weight_kg" numeric, "p_country_code" "text", "p_is_hazmat" boolean, "p_is_temperature_controlled" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_applicable_provider_surcharges"("p_carrier_id" "uuid", "p_service_type" "text", "p_weight_kg" numeric, "p_country_code" "text", "p_is_hazmat" boolean, "p_is_temperature_controlled" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_applicable_provider_surcharges"("p_carrier_id" "uuid", "p_service_type" "text", "p_weight_kg" numeric, "p_country_code" "text", "p_is_hazmat" boolean, "p_is_temperature_controlled" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chargeable_weight"("p_actual_weight_kg" numeric, "p_volumetric_weight_kg" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_chargeable_weight"("p_actual_weight_kg" numeric, "p_volumetric_weight_kg" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chargeable_weight"("p_actual_weight_kg" numeric, "p_volumetric_weight_kg" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_database_enums"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_database_enums"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_database_enums"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_database_functions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_database_functions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_database_functions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_database_functions_with_body"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_database_functions_with_body"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_database_functions_with_body"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_database_schema"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_database_schema"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_database_schema"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_database_tables"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_database_tables"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_database_tables"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_franchise_user_ids"("_franchise_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_franchise_user_ids"("_franchise_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_franchise_user_ids"("_franchise_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_platform_admins"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_platform_admins"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_platform_admins"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_quote_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_quote_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_quote_by_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rls_policies"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_rls_policies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rls_policies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rls_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_rls_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rls_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sales_manager_team_user_ids"("_manager_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sales_manager_team_user_ids"("_manager_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sales_manager_team_user_ids"("_manager_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_constraints"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_constraints"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_constraints"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_indexes"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_indexes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_indexes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_plan_tier"("_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_plan_tier"("_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_plan_tier"("_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tier_rate"("p_tier_config_id" "uuid", "p_value" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_tier_rate"("p_tier_config_id" "uuid", "p_value" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tier_rate"("p_tier_config_id" "uuid", "p_value" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_custom_permissions"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_custom_permissions"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_custom_permissions"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_franchise_id"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_franchise_id"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_franchise_id"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tenant_id"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tenant_id"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tenant_id"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_weight_break_rate"("p_tenant_id" "uuid", "p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_weight_kg" numeric, "p_effective_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_weight_break_rate"("p_tenant_id" "uuid", "p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_weight_kg" numeric, "p_effective_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_weight_break_rate"("p_tenant_id" "uuid", "p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_weight_kg" numeric, "p_effective_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("check_user_id" "uuid", "check_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("check_user_id" "uuid", "check_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("check_user_id" "uuid", "check_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_feature_usage"("_tenant_id" "uuid", "_feature_key" "text", "_increment" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_feature_usage"("_tenant_id" "uuid", "_feature_key" "text", "_increment" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_feature_usage"("_tenant_id" "uuid", "_feature_key" "text", "_increment" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_franchise_admin"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_franchise_admin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_franchise_admin"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_admin"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_sales_manager"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_sales_manager"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_sales_manager"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_tenant_admin"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tenant_admin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tenant_admin"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_viewer"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_viewer"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_viewer"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_email_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_email_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_email_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_opportunity_probability_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_opportunity_probability_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_opportunity_probability_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_option_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_option_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_option_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_version_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_version_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_version_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_option_from_rate"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_option_from_rate"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_option_from_rate"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preview_next_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."preview_next_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."preview_next_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_carrier_rate_on_rate_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_carrier_rate_on_rate_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_carrier_rate_on_rate_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_carrier_rate_total_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_carrier_rate_total_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_carrier_rate_total_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_and_sync_quote_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_and_sync_quote_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_and_sync_quote_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_quote_total_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_quote_total_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_quote_total_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_customer_selection"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_version_id" "uuid", "p_option_id" "uuid", "p_reason" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_customer_selection"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_version_id" "uuid", "p_option_id" "uuid", "p_reason" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_customer_selection"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_version_id" "uuid", "p_option_id" "uuid", "p_reason" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reload_postgrest_schema"() TO "anon";
GRANT ALL ON FUNCTION "public"."reload_postgrest_schema"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reload_postgrest_schema"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_admin_override"("p_enabled" boolean, "p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_admin_override"("p_enabled" boolean, "p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_admin_override"("p_enabled" boolean, "p_tenant_id" "uuid", "p_franchise_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_current_version"("p_version_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_current_version"("p_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_current_version"("p_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_user_scope_preference"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_admin_override" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_scope_preference"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_admin_override" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_scope_preference"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_admin_override" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_opportunity_from_primary_quote"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_opportunity_from_primary_quote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_opportunity_from_primary_quote"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_opportunity_items_from_quote"("p_quote_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_opportunity_items_from_quote"("p_quote_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_opportunity_items_from_quote"("p_quote_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_quote_items_from_opportunity_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_quote_items_from_opportunity_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_quote_items_from_opportunity_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tenant_has_feature"("_tenant_id" "uuid", "_feature_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."tenant_has_feature"("_tenant_id" "uuid", "_feature_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tenant_has_feature"("_tenant_id" "uuid", "_feature_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_quote_number_before_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_quote_number_before_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_quote_number_before_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_lead_last_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_lead_last_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_lead_last_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_lead_score"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_lead_score"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_lead_score"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_option_margins_on_charge_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_option_margins_on_charge_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_option_margins_on_charge_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_option_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_option_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_option_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scheduled_email_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scheduled_email_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scheduled_email_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_leg_sort_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_leg_sort_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_leg_sort_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_service_leg_requirements"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_service_leg_requirements"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_service_leg_requirements"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_single_selection_per_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_single_selection_per_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_single_selection_per_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_version_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_version_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_version_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_version_uniqueness"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_version_uniqueness"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_version_uniqueness"() TO "service_role";



GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."aes_hts_codes" TO "anon";
GRANT ALL ON TABLE "public"."aes_hts_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."aes_hts_codes" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."auth_permissions" TO "anon";
GRANT ALL ON TABLE "public"."auth_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."auth_role_hierarchy" TO "anon";
GRANT ALL ON TABLE "public"."auth_role_hierarchy" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_role_hierarchy" TO "service_role";



GRANT ALL ON TABLE "public"."auth_role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."auth_role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."auth_roles" TO "anon";
GRANT ALL ON TABLE "public"."auth_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_roles" TO "service_role";



GRANT ALL ON TABLE "public"."cargo_details" TO "anon";
GRANT ALL ON TABLE "public"."cargo_details" TO "authenticated";
GRANT ALL ON TABLE "public"."cargo_details" TO "service_role";



GRANT ALL ON TABLE "public"."cargo_types" TO "anon";
GRANT ALL ON TABLE "public"."cargo_types" TO "authenticated";
GRANT ALL ON TABLE "public"."cargo_types" TO "service_role";



GRANT ALL ON TABLE "public"."carrier_rate_attachments" TO "anon";
GRANT ALL ON TABLE "public"."carrier_rate_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."carrier_rate_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."carrier_rate_charges" TO "anon";
GRANT ALL ON TABLE "public"."carrier_rate_charges" TO "authenticated";
GRANT ALL ON TABLE "public"."carrier_rate_charges" TO "service_role";



GRANT ALL ON TABLE "public"."carrier_rates" TO "anon";
GRANT ALL ON TABLE "public"."carrier_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."carrier_rates" TO "service_role";



GRANT ALL ON TABLE "public"."carrier_service_types" TO "anon";
GRANT ALL ON TABLE "public"."carrier_service_types" TO "authenticated";
GRANT ALL ON TABLE "public"."carrier_service_types" TO "service_role";



GRANT ALL ON TABLE "public"."carriers" TO "anon";
GRANT ALL ON TABLE "public"."carriers" TO "authenticated";
GRANT ALL ON TABLE "public"."carriers" TO "service_role";



GRANT ALL ON TABLE "public"."charge_bases" TO "anon";
GRANT ALL ON TABLE "public"."charge_bases" TO "authenticated";
GRANT ALL ON TABLE "public"."charge_bases" TO "service_role";



GRANT ALL ON TABLE "public"."charge_categories" TO "anon";
GRANT ALL ON TABLE "public"."charge_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."charge_categories" TO "service_role";



GRANT ALL ON TABLE "public"."charge_sides" TO "anon";
GRANT ALL ON TABLE "public"."charge_sides" TO "authenticated";
GRANT ALL ON TABLE "public"."charge_sides" TO "service_role";



GRANT ALL ON TABLE "public"."charge_tier_config" TO "anon";
GRANT ALL ON TABLE "public"."charge_tier_config" TO "authenticated";
GRANT ALL ON TABLE "public"."charge_tier_config" TO "service_role";



GRANT ALL ON TABLE "public"."charge_tier_ranges" TO "anon";
GRANT ALL ON TABLE "public"."charge_tier_ranges" TO "authenticated";
GRANT ALL ON TABLE "public"."charge_tier_ranges" TO "service_role";



GRANT ALL ON TABLE "public"."charge_types" TO "anon";
GRANT ALL ON TABLE "public"."charge_types" TO "authenticated";
GRANT ALL ON TABLE "public"."charge_types" TO "service_role";



GRANT ALL ON TABLE "public"."charge_weight_breaks" TO "anon";
GRANT ALL ON TABLE "public"."charge_weight_breaks" TO "authenticated";
GRANT ALL ON TABLE "public"."charge_weight_breaks" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."compliance_checks" TO "anon";
GRANT ALL ON TABLE "public"."compliance_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_checks" TO "service_role";



GRANT ALL ON TABLE "public"."compliance_rules" TO "anon";
GRANT ALL ON TABLE "public"."compliance_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_rules" TO "service_role";



GRANT ALL ON TABLE "public"."consignees" TO "anon";
GRANT ALL ON TABLE "public"."consignees" TO "authenticated";
GRANT ALL ON TABLE "public"."consignees" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."container_sizes" TO "anon";
GRANT ALL ON TABLE "public"."container_sizes" TO "authenticated";
GRANT ALL ON TABLE "public"."container_sizes" TO "service_role";



GRANT ALL ON TABLE "public"."container_types" TO "anon";
GRANT ALL ON TABLE "public"."container_types" TO "authenticated";
GRANT ALL ON TABLE "public"."container_types" TO "service_role";



GRANT ALL ON TABLE "public"."continents" TO "anon";
GRANT ALL ON TABLE "public"."continents" TO "authenticated";
GRANT ALL ON TABLE "public"."continents" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON TABLE "public"."currencies" TO "anon";
GRANT ALL ON TABLE "public"."currencies" TO "authenticated";
GRANT ALL ON TABLE "public"."currencies" TO "service_role";



GRANT ALL ON TABLE "public"."custom_role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."custom_role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."custom_roles" TO "anon";
GRANT ALL ON TABLE "public"."custom_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_roles" TO "service_role";



GRANT ALL ON TABLE "public"."customer_selections" TO "anon";
GRANT ALL ON TABLE "public"."customer_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_selections" TO "service_role";



GRANT ALL ON TABLE "public"."customs_documents" TO "anon";
GRANT ALL ON TABLE "public"."customs_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."customs_documents" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_preferences" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."document_templates" TO "anon";
GRANT ALL ON TABLE "public"."document_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."document_templates" TO "service_role";



GRANT ALL ON TABLE "public"."document_versions" TO "anon";
GRANT ALL ON TABLE "public"."document_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."document_versions" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."email_account_delegations" TO "anon";
GRANT ALL ON TABLE "public"."email_account_delegations" TO "authenticated";
GRANT ALL ON TABLE "public"."email_account_delegations" TO "service_role";



GRANT ALL ON TABLE "public"."email_accounts" TO "anon";
GRANT ALL ON TABLE "public"."email_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."email_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."email_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."email_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."email_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."email_filters" TO "anon";
GRANT ALL ON TABLE "public"."email_filters" TO "authenticated";
GRANT ALL ON TABLE "public"."email_filters" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."emails" TO "anon";
GRANT ALL ON TABLE "public"."emails" TO "authenticated";
GRANT ALL ON TABLE "public"."emails" TO "service_role";



GRANT ALL ON TABLE "public"."entity_transfer_items" TO "anon";
GRANT ALL ON TABLE "public"."entity_transfer_items" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_transfer_items" TO "service_role";



GRANT ALL ON TABLE "public"."entity_transfers" TO "anon";
GRANT ALL ON TABLE "public"."entity_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."franchises" TO "anon";
GRANT ALL ON TABLE "public"."franchises" TO "authenticated";
GRANT ALL ON TABLE "public"."franchises" TO "service_role";



GRANT ALL ON TABLE "public"."fx_rates" TO "anon";
GRANT ALL ON TABLE "public"."fx_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."fx_rates" TO "service_role";



GRANT ALL ON TABLE "public"."history_filter_presets" TO "anon";
GRANT ALL ON TABLE "public"."history_filter_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."history_filter_presets" TO "service_role";



GRANT ALL ON TABLE "public"."import_errors" TO "anon";
GRANT ALL ON TABLE "public"."import_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."import_errors" TO "service_role";



GRANT ALL ON TABLE "public"."import_history" TO "anon";
GRANT ALL ON TABLE "public"."import_history" TO "authenticated";
GRANT ALL ON TABLE "public"."import_history" TO "service_role";



GRANT ALL ON TABLE "public"."import_history_details" TO "anon";
GRANT ALL ON TABLE "public"."import_history_details" TO "authenticated";
GRANT ALL ON TABLE "public"."import_history_details" TO "service_role";



GRANT ALL ON TABLE "public"."incoterms" TO "anon";
GRANT ALL ON TABLE "public"."incoterms" TO "authenticated";
GRANT ALL ON TABLE "public"."incoterms" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."lead_activities" TO "anon";
GRANT ALL ON TABLE "public"."lead_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_activities" TO "service_role";



GRANT ALL ON TABLE "public"."lead_assignment_history" TO "anon";
GRANT ALL ON TABLE "public"."lead_assignment_history" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_assignment_history" TO "service_role";



GRANT ALL ON TABLE "public"."lead_assignment_queue" TO "anon";
GRANT ALL ON TABLE "public"."lead_assignment_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_assignment_queue" TO "service_role";



GRANT ALL ON TABLE "public"."lead_assignment_rules" TO "anon";
GRANT ALL ON TABLE "public"."lead_assignment_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_assignment_rules" TO "service_role";



GRANT ALL ON TABLE "public"."lead_score_config" TO "anon";
GRANT ALL ON TABLE "public"."lead_score_config" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_score_config" TO "service_role";



GRANT ALL ON TABLE "public"."lead_score_logs" TO "anon";
GRANT ALL ON TABLE "public"."lead_score_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_score_logs" TO "service_role";



GRANT ALL ON TABLE "public"."lead_scoring_rules" TO "anon";
GRANT ALL ON TABLE "public"."lead_scoring_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_scoring_rules" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."margin_methods" TO "anon";
GRANT ALL ON TABLE "public"."margin_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."margin_methods" TO "service_role";



GRANT ALL ON TABLE "public"."margin_profiles" TO "anon";
GRANT ALL ON TABLE "public"."margin_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."margin_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_configurations" TO "anon";
GRANT ALL ON TABLE "public"."oauth_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."opportunities" TO "anon";
GRANT ALL ON TABLE "public"."opportunities" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunities" TO "service_role";



GRANT ALL ON TABLE "public"."opportunity_items" TO "anon";
GRANT ALL ON TABLE "public"."opportunity_items" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunity_items" TO "service_role";



GRANT ALL ON TABLE "public"."opportunity_probability_history" TO "anon";
GRANT ALL ON TABLE "public"."opportunity_probability_history" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunity_probability_history" TO "service_role";



GRANT ALL ON TABLE "public"."package_categories" TO "anon";
GRANT ALL ON TABLE "public"."package_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."package_categories" TO "service_role";



GRANT ALL ON TABLE "public"."package_sizes" TO "anon";
GRANT ALL ON TABLE "public"."package_sizes" TO "authenticated";
GRANT ALL ON TABLE "public"."package_sizes" TO "service_role";



GRANT ALL ON TABLE "public"."portal_tokens" TO "anon";
GRANT ALL ON TABLE "public"."portal_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."ports_locations" TO "anon";
GRANT ALL ON TABLE "public"."ports_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."ports_locations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."provider_api_configs" TO "anon";
GRANT ALL ON TABLE "public"."provider_api_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_api_configs" TO "service_role";



GRANT ALL ON TABLE "public"."provider_charge_mappings" TO "anon";
GRANT ALL ON TABLE "public"."provider_charge_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_charge_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."provider_rate_rules" TO "anon";
GRANT ALL ON TABLE "public"."provider_rate_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_rate_rules" TO "service_role";



GRANT ALL ON TABLE "public"."provider_rate_templates" TO "anon";
GRANT ALL ON TABLE "public"."provider_rate_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_rate_templates" TO "service_role";



GRANT ALL ON TABLE "public"."provider_surcharges" TO "anon";
GRANT ALL ON TABLE "public"."provider_surcharges" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_surcharges" TO "service_role";



GRANT ALL ON TABLE "public"."provider_types" TO "anon";
GRANT ALL ON TABLE "public"."provider_types" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_types" TO "service_role";



GRANT ALL ON TABLE "public"."queue_members" TO "anon";
GRANT ALL ON TABLE "public"."queue_members" TO "authenticated";
GRANT ALL ON TABLE "public"."queue_members" TO "service_role";



GRANT ALL ON TABLE "public"."queues" TO "anon";
GRANT ALL ON TABLE "public"."queues" TO "authenticated";
GRANT ALL ON TABLE "public"."queues" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."quotation_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_packages" TO "anon";
GRANT ALL ON TABLE "public"."quotation_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_packages" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_selection_events" TO "anon";
GRANT ALL ON TABLE "public"."quotation_selection_events" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_selection_events" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_version_option_legs" TO "anon";
GRANT ALL ON TABLE "public"."quotation_version_option_legs" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_version_option_legs" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_version_options" TO "anon";
GRANT ALL ON TABLE "public"."quotation_version_options" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_version_options" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_versions" TO "anon";
GRANT ALL ON TABLE "public"."quotation_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_versions" TO "service_role";



GRANT ALL ON TABLE "public"."quote_acceptances" TO "anon";
GRANT ALL ON TABLE "public"."quote_acceptances" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_acceptances" TO "service_role";



GRANT ALL ON TABLE "public"."quote_access_logs" TO "anon";
GRANT ALL ON TABLE "public"."quote_access_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_access_logs" TO "service_role";



GRANT ALL ON TABLE "public"."quote_charges" TO "anon";
GRANT ALL ON TABLE "public"."quote_charges" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_charges" TO "service_role";



GRANT ALL ON TABLE "public"."quote_comments" TO "anon";
GRANT ALL ON TABLE "public"."quote_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_comments" TO "service_role";



GRANT ALL ON TABLE "public"."quote_documents" TO "anon";
GRANT ALL ON TABLE "public"."quote_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_documents" TO "service_role";



GRANT ALL ON TABLE "public"."quote_email_history" TO "anon";
GRANT ALL ON TABLE "public"."quote_email_history" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_email_history" TO "service_role";



GRANT ALL ON TABLE "public"."quote_events" TO "anon";
GRANT ALL ON TABLE "public"."quote_events" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_events" TO "service_role";



GRANT ALL ON TABLE "public"."quote_items" TO "anon";
GRANT ALL ON TABLE "public"."quote_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_items" TO "service_role";



GRANT ALL ON TABLE "public"."quote_legs" TO "anon";
GRANT ALL ON TABLE "public"."quote_legs" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_legs" TO "service_role";



GRANT ALL ON TABLE "public"."quote_number_config_franchise" TO "anon";
GRANT ALL ON TABLE "public"."quote_number_config_franchise" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_number_config_franchise" TO "service_role";



GRANT ALL ON TABLE "public"."quote_number_config_tenant" TO "anon";
GRANT ALL ON TABLE "public"."quote_number_config_tenant" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_number_config_tenant" TO "service_role";



GRANT ALL ON TABLE "public"."quote_number_sequences" TO "anon";
GRANT ALL ON TABLE "public"."quote_number_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_number_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."quote_option_legs" TO "anon";
GRANT ALL ON TABLE "public"."quote_option_legs" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_option_legs" TO "service_role";



GRANT ALL ON TABLE "public"."quote_options" TO "anon";
GRANT ALL ON TABLE "public"."quote_options" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_options" TO "service_role";



GRANT ALL ON TABLE "public"."quote_presentation_templates" TO "anon";
GRANT ALL ON TABLE "public"."quote_presentation_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_presentation_templates" TO "service_role";



GRANT ALL ON TABLE "public"."quote_selection" TO "anon";
GRANT ALL ON TABLE "public"."quote_selection" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_selection" TO "service_role";



GRANT ALL ON TABLE "public"."quote_sequences_franchise" TO "anon";
GRANT ALL ON TABLE "public"."quote_sequences_franchise" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_sequences_franchise" TO "service_role";



GRANT ALL ON TABLE "public"."quote_sequences_tenant" TO "anon";
GRANT ALL ON TABLE "public"."quote_sequences_tenant" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_sequences_tenant" TO "service_role";



GRANT ALL ON TABLE "public"."quote_shares" TO "anon";
GRANT ALL ON TABLE "public"."quote_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_shares" TO "service_role";



GRANT ALL ON TABLE "public"."quote_templates" TO "anon";
GRANT ALL ON TABLE "public"."quote_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_templates" TO "service_role";



GRANT ALL ON TABLE "public"."quote_versions" TO "anon";
GRANT ALL ON TABLE "public"."quote_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_versions" TO "service_role";



GRANT ALL ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";



GRANT ALL ON TABLE "public"."rate_calculations" TO "anon";
GRANT ALL ON TABLE "public"."rate_calculations" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_calculations" TO "service_role";



GRANT ALL ON TABLE "public"."rate_components" TO "anon";
GRANT ALL ON TABLE "public"."rate_components" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_components" TO "service_role";



GRANT ALL ON TABLE "public"."rates" TO "anon";
GRANT ALL ON TABLE "public"."rates" TO "authenticated";
GRANT ALL ON TABLE "public"."rates" TO "service_role";



GRANT ALL ON TABLE "public"."routes" TO "anon";
GRANT ALL ON TABLE "public"."routes" TO "authenticated";
GRANT ALL ON TABLE "public"."routes" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_emails" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_emails" TO "service_role";



GRANT ALL ON TABLE "public"."schema_migration_progress" TO "anon";
GRANT ALL ON TABLE "public"."schema_migration_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."schema_migration_progress" TO "service_role";



GRANT ALL ON TABLE "public"."schema_migrations" TO "anon";
GRANT ALL ON TABLE "public"."schema_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."schema_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."service_details" TO "anon";
GRANT ALL ON TABLE "public"."service_details" TO "authenticated";
GRANT ALL ON TABLE "public"."service_details" TO "service_role";



GRANT ALL ON TABLE "public"."service_leg_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_leg_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_leg_categories" TO "service_role";



GRANT ALL ON TABLE "public"."service_modes" TO "anon";
GRANT ALL ON TABLE "public"."service_modes" TO "authenticated";
GRANT ALL ON TABLE "public"."service_modes" TO "service_role";



GRANT ALL ON TABLE "public"."service_type_mappings" TO "anon";
GRANT ALL ON TABLE "public"."service_type_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."service_type_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."service_types" TO "anon";
GRANT ALL ON TABLE "public"."service_types" TO "authenticated";
GRANT ALL ON TABLE "public"."service_types" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."shipment_attachments" TO "anon";
GRANT ALL ON TABLE "public"."shipment_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."shipment_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."shipment_items" TO "anon";
GRANT ALL ON TABLE "public"."shipment_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shipment_items" TO "service_role";



GRANT ALL ON TABLE "public"."shipments" TO "anon";
GRANT ALL ON TABLE "public"."shipments" TO "authenticated";
GRANT ALL ON TABLE "public"."shipments" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_rates" TO "anon";
GRANT ALL ON TABLE "public"."shipping_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_rates" TO "service_role";



GRANT ALL ON TABLE "public"."states" TO "anon";
GRANT ALL ON TABLE "public"."states" TO "authenticated";
GRANT ALL ON TABLE "public"."states" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_features" TO "anon";
GRANT ALL ON TABLE "public"."subscription_features" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_features" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_invoices" TO "anon";
GRANT ALL ON TABLE "public"."subscription_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."tenant_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."territories" TO "anon";
GRANT ALL ON TABLE "public"."territories" TO "authenticated";
GRANT ALL ON TABLE "public"."territories" TO "service_role";



GRANT ALL ON TABLE "public"."territory_assignments" TO "anon";
GRANT ALL ON TABLE "public"."territory_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."territory_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."territory_geographies" TO "anon";
GRANT ALL ON TABLE "public"."territory_geographies" TO "authenticated";
GRANT ALL ON TABLE "public"."territory_geographies" TO "service_role";



GRANT ALL ON TABLE "public"."themes" TO "anon";
GRANT ALL ON TABLE "public"."themes" TO "authenticated";
GRANT ALL ON TABLE "public"."themes" TO "service_role";



GRANT ALL ON TABLE "public"."tracking_events" TO "anon";
GRANT ALL ON TABLE "public"."tracking_events" TO "authenticated";
GRANT ALL ON TABLE "public"."tracking_events" TO "service_role";



GRANT ALL ON TABLE "public"."trade_directions" TO "anon";
GRANT ALL ON TABLE "public"."trade_directions" TO "authenticated";
GRANT ALL ON TABLE "public"."trade_directions" TO "service_role";



GRANT ALL ON TABLE "public"."transport_modes" TO "anon";
GRANT ALL ON TABLE "public"."transport_modes" TO "authenticated";
GRANT ALL ON TABLE "public"."transport_modes" TO "service_role";



GRANT ALL ON TABLE "public"."ui_themes" TO "anon";
GRANT ALL ON TABLE "public"."ui_themes" TO "authenticated";
GRANT ALL ON TABLE "public"."ui_themes" TO "service_role";



GRANT ALL ON TABLE "public"."usage_records" TO "anon";
GRANT ALL ON TABLE "public"."usage_records" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_records" TO "service_role";



GRANT ALL ON TABLE "public"."user_capacity" TO "anon";
GRANT ALL ON TABLE "public"."user_capacity" TO "authenticated";
GRANT ALL ON TABLE "public"."user_capacity" TO "service_role";



GRANT ALL ON TABLE "public"."user_custom_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_custom_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_custom_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."warehouse_inventory" TO "anon";
GRANT ALL ON TABLE "public"."warehouse_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouse_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."warehouses" TO "anon";
GRANT ALL ON TABLE "public"."warehouses" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouses" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







