-- Fix backend schema drift: add missing import_errors + transfer system + required RPCs

-- 1) Import reporting
ALTER TABLE public.import_history
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.import_history(id) ON DELETE CASCADE,
  row_number INTEGER,
  field TEXT,
  error_message TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

-- Clean up potentially older/unsafe policies (idempotent)
DROP POLICY IF EXISTS "Users can view import errors" ON public.import_errors;
DROP POLICY IF EXISTS "Users can insert import errors" ON public.import_errors;
DROP POLICY IF EXISTS "Platform admins can manage all import errors" ON public.import_errors;

-- Scoped policies (platform admin OR same-tenant via import_history)
CREATE POLICY "Import errors: select" ON public.import_errors
FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.import_history ih
    WHERE ih.id = import_errors.import_id
      AND ih.tenant_id IN (
        SELECT ur.tenant_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id IS NOT NULL
      )
  )
);

CREATE POLICY "Import errors: insert" ON public.import_errors
FOR INSERT
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.import_history ih
    WHERE ih.id = import_errors.import_id
      AND ih.tenant_id IN (
        SELECT ur.tenant_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id IS NOT NULL
      )
  )
);

CREATE POLICY "Import errors: update (platform admin)" ON public.import_errors
FOR UPDATE
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Import errors: delete (platform admin)" ON public.import_errors
FOR DELETE
USING (public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_import_errors_import_id
  ON public.import_errors(import_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_errors TO authenticated;


-- 2) Transfer system (missing tables/types/functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'transfer_status'
  ) THEN
    CREATE TYPE public.transfer_status AS ENUM ('pending', 'approved', 'rejected', 'completed', 'failed');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'transfer_type'
  ) THEN
    CREATE TYPE public.transfer_type AS ENUM ('tenant_to_tenant', 'tenant_to_franchise', 'franchise_to_franchise');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'transfer_entity_type'
  ) THEN
    CREATE TYPE public.transfer_entity_type AS ENUM ('lead', 'opportunity', 'quote', 'shipment', 'account', 'contact', 'activity');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.entity_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  source_franchise_id UUID REFERENCES public.franchises(id),
  target_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  target_franchise_id UUID REFERENCES public.franchises(id),
  transfer_type public.transfer_type NOT NULL,
  status public.transfer_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL,
  approved_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add the exact FK names the frontend expects for PostgREST joins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='entity_transfers' AND c.conname='entity_transfers_requested_by_fkey_profiles'
  ) THEN
    ALTER TABLE public.entity_transfers
      ADD CONSTRAINT entity_transfers_requested_by_fkey_profiles
      FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='entity_transfers' AND c.conname='entity_transfers_approved_by_fkey_profiles'
  ) THEN
    ALTER TABLE public.entity_transfers
      ADD CONSTRAINT entity_transfers_approved_by_fkey_profiles
      FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.entity_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.entity_transfers(id) ON DELETE CASCADE,
  entity_type public.transfer_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  status public.transfer_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_transfer_items ENABLE ROW LEVEL SECURITY;

-- Updated-at triggers (safe if function exists)
DROP TRIGGER IF EXISTS update_entity_transfers_updated_at ON public.entity_transfers;
CREATE TRIGGER update_entity_transfers_updated_at
BEFORE UPDATE ON public.entity_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_entity_transfer_items_updated_at ON public.entity_transfer_items;
CREATE TRIGGER update_entity_transfer_items_updated_at
BEFORE UPDATE ON public.entity_transfer_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Policies (drop old names if they exist)
DROP POLICY IF EXISTS "Users can view transfers for their tenant" ON public.entity_transfers;
DROP POLICY IF EXISTS "Users can create transfers from their tenant" ON public.entity_transfers;
DROP POLICY IF EXISTS "Target admins can update status" ON public.entity_transfers;

CREATE POLICY "Entity transfers: select" ON public.entity_transfers
FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR source_tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
  )
  OR target_tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
  )
);

CREATE POLICY "Entity transfers: insert" ON public.entity_transfers
FOR INSERT
WITH CHECK (
  (public.is_platform_admin(auth.uid()) OR source_tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
  ))
  AND requested_by = auth.uid()
);

CREATE POLICY "Entity transfers: update" ON public.entity_transfers
FOR UPDATE
USING (
  public.is_platform_admin(auth.uid())
  OR target_tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
  )
);

CREATE POLICY "Entity transfers: delete (platform admin)" ON public.entity_transfers
FOR DELETE
USING (public.is_platform_admin(auth.uid()));

-- Items
DROP POLICY IF EXISTS "View transfer items" ON public.entity_transfer_items;
DROP POLICY IF EXISTS "Create transfer items" ON public.entity_transfer_items;

CREATE POLICY "Entity transfer items: select" ON public.entity_transfer_items
FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.entity_transfers et
    WHERE et.id = entity_transfer_items.transfer_id
      AND (
        et.source_tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL)
        OR et.target_tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL)
      )
  )
);

CREATE POLICY "Entity transfer items: insert" ON public.entity_transfer_items
FOR INSERT
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.entity_transfers et
    WHERE et.id = entity_transfer_items.transfer_id
      AND et.source_tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
      )
  )
);

CREATE POLICY "Entity transfer items: update (platform admin)" ON public.entity_transfer_items
FOR UPDATE
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Entity transfer items: delete (platform admin)" ON public.entity_transfer_items
FOR DELETE
USING (public.is_platform_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_transfer_items TO authenticated;


-- 3) RPCs expected by the frontend
CREATE OR REPLACE FUNCTION public.execute_transfer(p_transfer_id UUID, p_approver_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.execute_transfer(UUID, UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.assign_franchisee_account_contact(
  p_tenant_id UUID,
  p_franchise_id UUID,
  p_account_data JSONB,
  p_contact_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.assign_franchisee_account_contact(UUID, UUID, JSONB, JSONB) TO authenticated;
