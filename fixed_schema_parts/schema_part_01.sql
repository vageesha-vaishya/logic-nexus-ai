

DO $$ BEGIN
    CREATE TYPE "public"."account_status" AS ENUM (
    'active',
    'inactive',
    'pending'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."account_type" AS ENUM (
    'prospect',
    'customer',
    'partner',
    'vendor'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."activity_status" AS ENUM (
    'planned',
    'in_progress',
    'completed',
    'cancelled'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."activity_type" AS ENUM (
    'call',
    'email',
    'meeting',
    'task',
    'note'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."app_role" AS ENUM (
    'platform_admin',
    'tenant_admin',
    'franchise_admin',
    'user',
    'sales_manager',
    'viewer'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."billing_period" AS ENUM (
    'monthly',
    'annual'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."compliance_status" AS ENUM (
    'pass',
    'warn',
    'fail'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."contract_type" AS ENUM (
    'spot',
    'contracted'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."document_type" AS ENUM (
    'commercial_invoice',
    'bill_of_lading',
    'air_waybill',
    'packing_list',
    'customs_form',
    'quote_pdf',
    'proof_of_delivery'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."lead_source" AS ENUM (
    'website',
    'referral',
    'email',
    'phone',
    'social',
    'event',
    'other'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."plan_type" AS ENUM (
    'crm_base',
    'service_addon',
    'bundle'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."priority_level" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."quote_reset_policy" AS ENUM (
    'none',
    'daily',
    'monthly',
    'yearly'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."quote_status" AS ENUM (
    'draft',
    'sent',
    'accepted',
    'expired',
    'cancelled'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."shipment_type" AS ENUM (
    'ocean_freight',
    'air_freight',
    'inland_trucking',
    'railway_transport',
    'courier',
    'movers_packers'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."subscription_status" AS ENUM (
    'active',
    'trial',
    'past_due',
    'canceled',
    'expired'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."subscription_tier" AS ENUM (
    'free',
    'basic',
    'starter',
    'business',
    'professional',
    'enterprise'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."transfer_entity_type" AS ENUM (
    'lead',
    'opportunity',
    'quote',
    'shipment',
    'account',
    'contact',
    'activity'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."transfer_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'completed',
    'failed'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."transfer_type" AS ENUM (
    'tenant_to_tenant',
    'tenant_to_franchise',
    'franchise_to_franchise'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."transport_mode" AS ENUM (
    'ocean',
    'air',
    'inland_trucking',
    'courier',
    'movers_packers'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."vehicle_status" AS ENUM (
    'available',
    'in_use',
    'maintenance',
    'out_of_service'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DROP FUNCTION IF EXISTS "public"."_current_reset_bucket"("p_policy" "text");
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

DROP FUNCTION IF EXISTS "public"."accept_quote_by_token"("p_token" "text", "p_decision" "text", "p_name" "text", "p_email" "text", "p_ip" "text", "p_user_agent" "text");
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

DROP FUNCTION IF EXISTS "public"."assign_franchisee_account_contact"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_account_data" "jsonb", "p_contact_data" "jsonb");
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

DROP FUNCTION IF EXISTS "public"."assign_lead_with_transaction"("p_lead_id" "uuid", "p_assigned_to" "uuid", "p_assignment_method" "text", "p_rule_id" "uuid", "p_tenant_id" "uuid", "p_franchise_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."auto_assign_version_number"();
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

DROP FUNCTION IF EXISTS "public"."auto_generate_quote_number"();
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

DROP FUNCTION IF EXISTS "public"."calculate_dimensional_weight"("p_length_cm" numeric, "p_width_cm" numeric, "p_height_cm" numeric, "p_divisor" numeric);
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

DROP FUNCTION IF EXISTS "public"."calculate_lead_score"("lead_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."calculate_next_version_number"("p_quote_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."calculate_option_margins"("p_option_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."calculate_option_totals"("p_option_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."check_usage_limit"("_tenant_id" "uuid", "_feature_key" "text");
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

DROP FUNCTION IF EXISTS "public"."cleanup_old_logs"("days_to_keep" integer);
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

DROP FUNCTION IF EXISTS "public"."compare_versions"("p_version_id_1" "uuid", "p_version_id_2" "uuid");
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

DROP FUNCTION IF EXISTS "public"."create_quote_share"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_expires_in_days" integer);
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

DROP FUNCTION IF EXISTS "public"."decrement_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."ensure_single_primary_quote"();
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

DROP FUNCTION IF EXISTS "public"."evaluate_provider_rate_rules"("p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_quote_data" "jsonb");
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

DROP FUNCTION IF EXISTS "public"."execute_sql_query"("query_text" "text");
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

DROP FUNCTION IF EXISTS "public"."execute_transfer"("p_transfer_id" "uuid", "p_approver_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."generate_next_option_name"("p_version_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."generate_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."generate_share_token"();
CREATE OR REPLACE FUNCTION "public"."generate_share_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ BEGIN RETURN encode(gen_random_bytes(32), 'base64'); END; $$;

DROP FUNCTION IF EXISTS "public"."get_applicable_provider_surcharges"("p_carrier_id" "uuid", "p_service_type" "text", "p_weight_kg" numeric, "p_country_code" "text", "p_is_hazmat" boolean, "p_is_temperature_controlled" boolean);
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

DROP FUNCTION IF EXISTS "public"."get_chargeable_weight"("p_actual_weight_kg" numeric, "p_volumetric_weight_kg" numeric);
CREATE OR REPLACE FUNCTION "public"."get_chargeable_weight"("p_actual_weight_kg" numeric, "p_volumetric_weight_kg" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  SELECT GREATEST(
    COALESCE(p_actual_weight_kg, 0),
    COALESCE(p_volumetric_weight_kg, 0)
  );
$$;

DROP FUNCTION IF EXISTS "public"."get_database_enums"();
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

DROP FUNCTION IF EXISTS "public"."get_database_functions"();
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

DROP FUNCTION IF EXISTS "public"."get_database_functions_with_body"();
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

DROP FUNCTION IF EXISTS "public"."get_database_schema"();
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

DROP FUNCTION IF EXISTS "public"."get_database_tables"();
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

DROP FUNCTION IF EXISTS "public"."get_franchise_user_ids"("_franchise_id" "uuid");
CREATE OR REPLACE FUNCTION "public"."get_franchise_user_ids"("_franchise_id" "uuid") RETURNS TABLE("user_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.franchise_id = _franchise_id;
$$;

DROP FUNCTION IF EXISTS "public"."get_platform_admins"();
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

DROP FUNCTION IF EXISTS "public"."get_quote_by_token"("p_token" "text");
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

DROP FUNCTION IF EXISTS "public"."get_rls_policies"();
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

DROP FUNCTION IF EXISTS "public"."get_rls_status"();
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

DROP FUNCTION IF EXISTS "public"."get_sales_manager_team_user_ids"("_manager_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."get_table_constraints"();
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

DROP FUNCTION IF EXISTS "public"."get_table_indexes"();
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

DROP FUNCTION IF EXISTS "public"."get_tenant_plan_tier"("_tenant_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."get_tier_rate"("p_tier_config_id" "uuid", "p_value" numeric);
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

DROP FUNCTION IF EXISTS "public"."get_user_custom_permissions"("check_user_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."get_user_franchise_id"("check_user_id" "uuid");
CREATE OR REPLACE FUNCTION "public"."get_user_franchise_id"("check_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT franchise_id FROM public.user_roles
  WHERE user_id = check_user_id
    AND role IN ('franchise_admin', 'user')
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS "public"."get_user_tenant_id"("check_user_id" "uuid");
CREATE OR REPLACE FUNCTION "public"."get_user_tenant_id"("check_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT tenant_id FROM public.user_roles
  WHERE user_id = check_user_id
    AND role IN ('tenant_admin', 'franchise_admin', 'user')
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS "public"."get_weight_break_rate"("p_tenant_id" "uuid", "p_carrier_id" "uuid", "p_service_type_id" "uuid", "p_weight_kg" numeric, "p_effective_date" "date");
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

DROP FUNCTION IF EXISTS "public"."handle_new_user"();
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

DROP FUNCTION IF EXISTS "public"."has_role"("check_user_id" "uuid", "check_role" "public"."app_role");
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

DROP FUNCTION IF EXISTS "public"."increment_feature_usage"("_tenant_id" "uuid", "_feature_key" "text", "_increment" integer);
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

DROP FUNCTION IF EXISTS "public"."increment_user_lead_count"("p_user_id" "uuid", "p_tenant_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."is_current_user_platform_admin"();
CREATE OR REPLACE FUNCTION "public"."is_current_user_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_platform_admin(auth.uid());
$$;

DROP FUNCTION IF EXISTS "public"."is_franchise_admin"("_user_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."is_platform_admin"("check_user_id" "uuid");
CREATE OR REPLACE FUNCTION "public"."is_platform_admin"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.has_role(check_user_id, 'platform_admin'::public.app_role);
$$;

DROP FUNCTION IF EXISTS "public"."is_sales_manager"("_user_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."is_super_admin"("_user_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."is_tenant_admin"("_user_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."is_viewer"("_user_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."log_email_audit"();
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

DROP FUNCTION IF EXISTS "public"."log_opportunity_probability_changes"();
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

DROP FUNCTION IF EXISTS "public"."log_option_changes"();
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

DROP FUNCTION IF EXISTS "public"."log_version_changes"();
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

DROP FUNCTION IF EXISTS "public"."populate_option_from_rate"();
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

DROP FUNCTION IF EXISTS "public"."preview_next_quote_number"("p_tenant_id" "uuid", "p_franchise_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."recalc_carrier_rate_on_rate_update"();
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

DROP FUNCTION IF EXISTS "public"."recalc_carrier_rate_total_trigger"();
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

DROP FUNCTION IF EXISTS "public"."recalculate_and_sync_quote_trigger"();
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

DROP FUNCTION IF EXISTS "public"."recalculate_quote_total_trigger"();
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

DROP FUNCTION IF EXISTS "public"."record_customer_selection"("p_tenant_id" "uuid", "p_quote_id" "uuid", "p_version_id" "uuid", "p_option_id" "uuid", "p_reason" "text", "p_user_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."reload_postgrest_schema"();
CREATE OR REPLACE FUNCTION "public"."reload_postgrest_schema"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
  NOTIFY pgrst, 'reload config';
END;
$$;

DROP FUNCTION IF EXISTS "public"."set_admin_override"("p_enabled" boolean, "p_tenant_id" "uuid", "p_franchise_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."set_current_version"("p_version_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."set_updated_at"();
CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS "public"."set_user_scope_preference"("p_tenant_id" "uuid", "p_franchise_id" "uuid", "p_admin_override" boolean);
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

DROP FUNCTION IF EXISTS "public"."sync_opportunity_from_primary_quote"();
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

DROP FUNCTION IF EXISTS "public"."sync_opportunity_items_from_quote"("p_quote_id" "uuid");
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

DROP FUNCTION IF EXISTS "public"."sync_quote_items_from_opportunity_trigger"();
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

DROP FUNCTION IF EXISTS "public"."tenant_has_feature"("_tenant_id" "uuid", "_feature_key" "text");
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

DROP FUNCTION IF EXISTS "public"."trg_set_quote_number_before_insert"();
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

DROP FUNCTION IF EXISTS "public"."update_lead_last_activity"();
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

DROP FUNCTION IF EXISTS "public"."update_lead_score"();
CREATE OR REPLACE FUNCTION "public"."update_lead_score"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.lead_score := public.calculate_lead_score(NEW.id);
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS "public"."update_option_margins_on_charge_change"();
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

DROP FUNCTION IF EXISTS "public"."update_option_totals"();
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

DROP FUNCTION IF EXISTS "public"."update_scheduled_email_timestamp"();
CREATE OR REPLACE FUNCTION "public"."update_scheduled_email_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS "public"."update_updated_at_column"();
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS "public"."validate_leg_sort_order"();
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

DROP FUNCTION IF EXISTS "public"."validate_service_leg_requirements"();
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

DROP FUNCTION IF EXISTS "public"."validate_single_selection_per_version"();
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

DROP FUNCTION IF EXISTS "public"."validate_version_status_transition"();
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

DROP FUNCTION IF EXISTS "public"."validate_version_uniqueness"();
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

CREATE TABLE IF NOT EXISTS "public"."auth_permissions" (
    "id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."auth_role_hierarchy" (
    "manager_role_id" "text" NOT NULL,
    "target_role_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."auth_role_permissions" (
    "role_id" "text" NOT NULL,
    "permission_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

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

CREATE TABLE IF NOT EXISTS "public"."carrier_rate_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "carrier_rate_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

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

CREATE TABLE IF NOT EXISTS "public"."charge_types" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);

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

CREATE TABLE IF NOT EXISTS "public"."continents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code_international" "text",
    "code_national" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);

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

CREATE TABLE IF NOT EXISTS "public"."custom_role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "permission_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "access_type" "text" DEFAULT 'grant'::"text" NOT NULL,
    CONSTRAINT "custom_role_permissions_access_type_check" CHECK (("access_type" = ANY (ARRAY['grant'::"text", 'deny'::"text"])))
);

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

CREATE TABLE IF NOT EXISTS "public"."history_filter_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."import_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_id" "uuid" NOT NULL,
    "row_number" integer,
    "field" "text",
    "error_message" "text",
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS "public"."lead_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);

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

CREATE TABLE IF NOT EXISTS "public"."lead_score_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "weights_json" "jsonb" DEFAULT '{"decay": {"weekly_percentage": 10}, "logistics": {"urgent_shipment": 15, "high_value_cargo": 20}, "behavioral": {"page_view": 2, "email_opened": 5, "link_clicked": 10, "form_submission": 20}, "demographic": {"title_vp": 15, "title_cxo": 20, "title_manager": 10}}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."lead_score_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "old_score" integer,
    "new_score" integer,
    "change_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

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

CREATE TABLE IF NOT EXISTS "public"."margin_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "margin_methods_code_check" CHECK (("code" = ANY (ARRAY['fixed'::"text", 'percent'::"text"])))
);

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

CREATE TABLE IF NOT EXISTS "public"."provider_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."queue_members" (
    "queue_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

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

CREATE TABLE IF NOT EXISTS "public"."quote_access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_share_id" "uuid",
    "quote_id" "uuid" NOT NULL,
    "accessed_at" timestamp with time zone DEFAULT "now"(),
    "visitor_email" "text",
    "action_type" "text"
);

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

