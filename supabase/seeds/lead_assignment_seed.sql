-- Lead Assignment Module Seed Data
-- This script populates the database with comprehensive test data for the Lead Assignment system.
-- It handles:
-- 1. Leads (New, Assigned, High Priority, Edge Cases)
-- 2. Assignment Rules (Round Robin, Territory, Weighted)
-- 3. User Capacity & Availability
-- 4. Territories & Geography Mappings
-- 5. Territory Assignments (Agents to Territories)
-- 6. Historical Data

DO $$
DECLARE
  v_tenant_id UUID;
  v_admin_id UUID;
  v_agent1_id UUID;
  v_agent2_id UUID;
  v_agent3_id UUID;
  v_territory_na UUID;
  v_territory_eu UUID;
  v_territory_apac UUID;
  v_geo_na_id UUID;
  v_geo_eu_id UUID;
  v_geo_us_id UUID;
  v_geo_uk_id UUID;
  v_lead_new_id UUID;
  v_lead_assigned_id UUID;
  b_leads_has_name BOOLEAN;
  b_leads_has_first BOOLEAN;
  b_leads_has_last BOOLEAN;
  v_status_contacted TEXT := 'contacted';
  v_status_new TEXT := 'new';
  v_status_proposal TEXT := 'proposal';
  b_status_contacted_valid BOOLEAN;
  b_status_new_valid BOOLEAN;
  b_status_proposal_valid BOOLEAN;
  b_hist_has_assigned_by BOOLEAN;
  b_hist_has_assigned_at BOOLEAN;
  b_hist_has_assignment_rule_id BOOLEAN;
  b_hist_has_assigned_from BOOLEAN;
  b_hist_has_assignment_method BOOLEAN;
BEGIN
  -- 1. SETUP CONTEXT
  -- Get the first available tenant or create one
  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, domain)
    VALUES ('Demo Tenant', 'demo', 'demo.com')
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Get real users from auth.users (limit 3) to act as agents
  -- Note: In a real Supabase local env, you might need to create these users via Auth API first.
  -- Here we select existing ones to ensure FK constraints work.
  SELECT id INTO v_admin_id FROM auth.users LIMIT 1;
  
  -- If no users exist, we cannot proceed with user-linked data effectively.
  -- We'll raise a notice but continue with non-user data.
  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'No users found in auth.users. User-dependent seed data will be skipped.';
  ELSE
    -- Try to get 3 distinct users
    -- We select them individually to avoid CTE scope issues in PL/pgSQL
    SELECT id INTO v_agent1_id FROM auth.users ORDER BY created_at ASC LIMIT 1 OFFSET 0;
    
    SELECT id INTO v_agent2_id FROM auth.users ORDER BY created_at ASC LIMIT 1 OFFSET 1;
    IF v_agent2_id IS NULL THEN v_agent2_id := v_agent1_id; END IF;
    
    SELECT id INTO v_agent3_id FROM auth.users ORDER BY created_at ASC LIMIT 1 OFFSET 2;
    IF v_agent3_id IS NULL THEN v_agent3_id := v_agent1_id; END IF;
  END IF;

  -- 2. GEOGRAPHY MASTER DATA (Ensure basic geographies exist)
  -- North America (Continent)
  SELECT id INTO v_geo_na_id FROM public.continents WHERE name = 'North America';
  IF v_geo_na_id IS NULL THEN
    INSERT INTO public.continents (name)
    VALUES ('North America')
    RETURNING id INTO v_geo_na_id;
  END IF;

  -- United States (Country)
  SELECT id INTO v_geo_us_id FROM public.countries WHERE name = 'United States';
  IF v_geo_us_id IS NULL THEN
    INSERT INTO public.countries (name, continent_id)
    VALUES ('United States', v_geo_na_id)
    RETURNING id INTO v_geo_us_id;
  END IF;

  -- United Kingdom (Country) - For Europe Territory
  SELECT id INTO v_geo_uk_id FROM public.countries WHERE name = 'United Kingdom';
  IF v_geo_uk_id IS NULL THEN
    -- Ensure Europe continent exists and fetch its id
    SELECT id INTO v_geo_eu_id FROM public.continents WHERE name = 'Europe';
    IF v_geo_eu_id IS NULL THEN
      INSERT INTO public.continents (name)
      VALUES ('Europe')
      RETURNING id INTO v_geo_eu_id;
    END IF;
    INSERT INTO public.countries (name, continent_id)
    VALUES ('United Kingdom', v_geo_eu_id)
    RETURNING id INTO v_geo_uk_id;
  END IF;

  -- 3. TERRITORIES
  -- North America Territory
  INSERT INTO public.territories (tenant_id, name, description, is_active)
  VALUES (v_tenant_id, 'North America Sales', 'Covers all NA region', true)
  RETURNING id INTO v_territory_na;

  -- Europe Territory
  INSERT INTO public.territories (tenant_id, name, description, is_active)
  VALUES (v_tenant_id, 'Europe Sales', 'Covers UK and EU', true)
  RETURNING id INTO v_territory_eu;

  -- APAC Territory (Inactive example)
  INSERT INTO public.territories (tenant_id, name, description, is_active)
  VALUES (v_tenant_id, 'APAC Future Expansion', 'Not yet active', false)
  RETURNING id INTO v_territory_apac;

  -- 4. TERRITORY GEOGRAPHIES
  -- Map NA Continent to NA Territory
  INSERT INTO public.territory_geographies (territory_id, continent_id)
  VALUES (v_territory_na, v_geo_na_id);

  -- Map UK Country to Europe Territory
  INSERT INTO public.territory_geographies (territory_id, country_id)
  VALUES (v_territory_eu, v_geo_uk_id);

  -- 5. ASSIGNMENT RULES
  -- Rule 1: High Priority Round Robin
  INSERT INTO public.assignment_rules (tenant_id, rule_name, conditions, assignment_method, priority, is_active)
  VALUES (
    v_tenant_id, 
    'High Priority Express', 
    '{"priority": "high"}', 
    'round_robin', 
    10, 
    true
  );

  -- Rule 2: Territory Based (US Leads)
  INSERT INTO public.assignment_rules (tenant_id, rule_name, conditions, assignment_method, priority, is_active)
  VALUES (
    v_tenant_id, 
    'US Territory Assignment', 
    '{"country": "United States"}', 
    'territory', 
    5, 
    true
  );

  -- Rule 3: Catch-all Weighted
  INSERT INTO public.assignment_rules (tenant_id, rule_name, conditions, assignment_method, priority, is_active)
  VALUES (
    v_tenant_id, 
    'General Weighted Distribution', 
    '{}', 
    'weighted', 
    1, 
    true
  );

  -- 6. USER CAPACITY & TERRITORY ASSIGNMENTS
  IF v_agent1_id IS NOT NULL THEN
    -- Agent 1: High Capacity, NA Territory
    INSERT INTO public.user_capacity (user_id, tenant_id, max_leads, current_leads, is_available)
    VALUES (v_agent1_id, v_tenant_id, 100, 5, true)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET max_leads = 100, is_available = true;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'territory_assignments' AND column_name = 'territory_id'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.territory_assignments WHERE territory_id = v_territory_na AND user_id = v_agent1_id
      ) THEN
        INSERT INTO public.territory_assignments (territory_id, user_id, is_primary)
        VALUES (v_territory_na, v_agent1_id, true);
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.territory_assignments WHERE user_id = v_agent1_id AND tenant_id = v_tenant_id
      ) THEN
        INSERT INTO public.territory_assignments (user_id, tenant_id, territory_data, is_active)
        VALUES (v_agent1_id, v_tenant_id, jsonb_build_object('territory_id', v_territory_na, 'is_primary', true), true);
      END IF;
    END IF;
  END IF;

  IF v_agent2_id IS NOT NULL AND v_agent2_id != v_agent1_id THEN
    -- Agent 2: Low Capacity, Europe Territory
    INSERT INTO public.user_capacity (user_id, tenant_id, max_leads, current_leads, is_available)
    VALUES (v_agent2_id, v_tenant_id, 20, 15, true)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET max_leads = 20;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'territory_assignments' AND column_name = 'territory_id'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.territory_assignments WHERE territory_id = v_territory_eu AND user_id = v_agent2_id
      ) THEN
        INSERT INTO public.territory_assignments (territory_id, user_id, is_primary)
        VALUES (v_territory_eu, v_agent2_id, true);
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.territory_assignments WHERE user_id = v_agent2_id AND tenant_id = v_tenant_id
      ) THEN
        INSERT INTO public.territory_assignments (user_id, tenant_id, territory_data, is_active)
        VALUES (v_agent2_id, v_tenant_id, jsonb_build_object('territory_id', v_territory_eu, 'is_primary', true), true);
      END IF;
    END IF;
  END IF;

  IF v_agent3_id IS NOT NULL AND v_agent3_id != v_agent1_id THEN
    -- Agent 3: Unavailable (Vacation)
    INSERT INTO public.user_capacity (user_id, tenant_id, max_leads, current_leads, is_available)
    VALUES (v_agent3_id, v_tenant_id, 50, 0, false)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET is_available = false;
  END IF;

  -- 7. LEADS DATA
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'name'
  ) INTO b_leads_has_name;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'first_name'
  ) INTO b_leads_has_first;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'last_name'
  ) INTO b_leads_has_last;

  -- Validate available lead_status enum values to choose safe statuses
  SELECT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumtypid = 'lead_status'::regtype AND enumlabel = v_status_contacted
  ) INTO b_status_contacted_valid;
  SELECT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumtypid = 'lead_status'::regtype AND enumlabel = v_status_new
  ) INTO b_status_new_valid;
  SELECT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumtypid = 'lead_status'::regtype AND enumlabel = v_status_proposal
  ) INTO b_status_proposal_valid;

  BEGIN
    IF b_leads_has_first AND b_leads_has_last THEN
      INSERT INTO public.leads (tenant_id, first_name, last_name, email, phone, source, status, created_at)
      VALUES (v_tenant_id, 'Alice', 'Highvalue', 'alice.h@example.com', '555-0101', 'other', CASE WHEN b_status_new_valid THEN v_status_new ELSE 'new' END, NOW())
      RETURNING id INTO v_lead_new_id;
    ELSIF b_leads_has_name THEN
      INSERT INTO public.leads (tenant_id, name, email, phone, source, status, created_at)
      VALUES (v_tenant_id, 'Alice Highvalue', 'alice.h@example.com', '555-0101', 'other', CASE WHEN b_status_new_valid THEN v_status_new ELSE 'new' END, NOW())
      RETURNING id INTO v_lead_new_id;
    ELSE
      RAISE NOTICE 'Leads table schema missing required name columns';
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Leads insert (Alice) failed: %', SQLERRM;
  END;

  BEGIN
    IF b_leads_has_first AND b_leads_has_last THEN
      INSERT INTO public.leads (tenant_id, first_name, last_name, email, phone, source, status, created_at)
      VALUES (v_tenant_id, 'Bob', 'American', 'bob.usa@example.com', '555-0102', 'referral', CASE WHEN b_status_new_valid THEN v_status_new ELSE 'new' END, NOW());
    ELSIF b_leads_has_name THEN
      INSERT INTO public.leads (tenant_id, name, email, phone, source, status, created_at)
      VALUES (v_tenant_id, 'Bob American', 'bob.usa@example.com', '555-0102', 'referral', CASE WHEN b_status_new_valid THEN v_status_new ELSE 'new' END, NOW());
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Leads insert (Bob) failed: %', SQLERRM;
  END;

  BEGIN
    IF b_leads_has_first AND b_leads_has_last THEN
      INSERT INTO public.leads (tenant_id, first_name, last_name, email, source, status, created_at)
      VALUES (v_tenant_id, 'Charlie', 'Closed', 'charlie@example.com', 'event', CASE WHEN b_status_contacted_valid THEN v_status_contacted WHEN b_status_proposal_valid THEN v_status_proposal ELSE 'new' END, NOW() - INTERVAL '2 days')
      RETURNING id INTO v_lead_assigned_id;
    ELSIF b_leads_has_name THEN
      INSERT INTO public.leads (tenant_id, name, email, source, status, created_at)
      VALUES (v_tenant_id, 'Charlie Closed', 'charlie@example.com', 'event', CASE WHEN b_status_contacted_valid THEN v_status_contacted WHEN b_status_proposal_valid THEN v_status_proposal ELSE 'new' END, NOW() - INTERVAL '2 days')
      RETURNING id INTO v_lead_assigned_id;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Leads insert (Charlie) failed: %', SQLERRM;
  END;

  IF b_leads_has_first AND b_leads_has_last THEN
    INSERT INTO public.leads (tenant_id, first_name, last_name, email, source, status, created_at)
    VALUES (v_tenant_id, 'Dave', 'Drift', 'dave@example.com', 'other', 'new', NOW() - INTERVAL '30 days');
  ELSIF b_leads_has_name THEN
    INSERT INTO public.leads (tenant_id, name, email, source, status, created_at)
    VALUES (v_tenant_id, 'Dave Drift', 'dave@example.com', 'other', 'new', NOW() - INTERVAL '30 days');
  END IF;

  IF b_leads_has_first AND b_leads_has_last THEN
    INSERT INTO public.leads (tenant_id, first_name, last_name, source, status)
    VALUES (v_tenant_id, 'Unknown', 'Prospect', 'other', 'new');
  ELSIF b_leads_has_name THEN
    INSERT INTO public.leads (tenant_id, name, source, status)
    VALUES (v_tenant_id, 'Unknown Prospect', 'other', 'new');
  END IF;

  -- 8. ASSIGNMENT QUEUE & HISTORY
  -- Add New Lead to Queue
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'lead_assignment_queue' AND column_name = 'priority'
    ) THEN
      INSERT INTO public.lead_assignment_queue (lead_id, tenant_id, priority, status)
      VALUES (v_lead_new_id, v_tenant_id, 1, 'pending');
    ELSE
      INSERT INTO public.lead_assignment_queue (lead_id, tenant_id, status)
      VALUES (v_lead_new_id, v_tenant_id, 'pending');
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Queue insert failed: %', SQLERRM;
  END;

  -- Add History for Assigned Lead
  IF v_agent1_id IS NOT NULL THEN
    -- Detect available columns on lead_assignment_history
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'lead_assignment_history' AND column_name = 'assigned_by'
    ) INTO b_hist_has_assigned_by;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'lead_assignment_history' AND column_name = 'assigned_at'
    ) INTO b_hist_has_assigned_at;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'lead_assignment_history' AND column_name = 'assignment_rule_id'
    ) INTO b_hist_has_assignment_rule_id;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'lead_assignment_history' AND column_name = 'assigned_from'
    ) INTO b_hist_has_assigned_from;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'lead_assignment_history' AND column_name = 'assignment_method'
    ) INTO b_hist_has_assignment_method;

    BEGIN
      IF b_hist_has_assigned_by THEN
        IF b_hist_has_assigned_at AND b_hist_has_assignment_rule_id THEN
          INSERT INTO public.lead_assignment_history (lead_id, assigned_to, assigned_by, assigned_at, assignment_rule_id, tenant_id)
          VALUES (v_lead_assigned_id, v_agent1_id, v_admin_id, NOW() - INTERVAL '1 day', NULL, v_tenant_id);
        ELSE
          INSERT INTO public.lead_assignment_history (lead_id, assigned_to, assigned_by, tenant_id)
          VALUES (v_lead_assigned_id, v_agent1_id, v_admin_id, v_tenant_id);
        END IF;
      ELSE
        -- Legacy schema: use assigned_from/assignment_method/created_at
        INSERT INTO public.lead_assignment_history (tenant_id, lead_id, assigned_from, assigned_to, assignment_method, reason, created_at)
        VALUES (
          v_tenant_id,
          v_lead_assigned_id,
          v_admin_id,
          v_agent1_id,
          CASE WHEN b_hist_has_assignment_method THEN 'manual' ELSE 'manual' END,
          NULL,
          NOW() - INTERVAL '1 day'
        );
      END IF;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'History insert failed: %', SQLERRM;
    END;
  END IF;

END $$;
