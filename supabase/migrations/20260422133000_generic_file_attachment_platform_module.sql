-- Generic file attachment platform module
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review
-- Extension assessment:
--   Existing attachment implementations are module-specific (shipment_attachments, commodity_documents, vendor_documents)
--   and cannot provide cross-form standardized APIs, versioning, and audit telemetry without a shared canonical model.

BEGIN;

CREATE TABLE IF NOT EXISTS public.file_attachments (
  attachment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid NULL REFERENCES public.franchises(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_type text NULL,
  file_size bigint NULL CHECK (file_size IS NULL OR file_size >= 0),
  file_path text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'app-attachments',
  is_public boolean NOT NULL DEFAULT false,
  public_url text NULL,
  uploaded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_date timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  checksum_sha256 text NULL,
  scan_status text NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending', 'clean', 'infected', 'failed')),
  scan_provider text NULL,
  scan_reference text NULL,
  scan_completed_at timestamptz NULL,
  encryption_status text NOT NULL DEFAULT 'platform_managed'
    CHECK (encryption_status IN ('platform_managed', 'customer_managed', 'none')),
  retention_until timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_file_attachments_path UNIQUE (storage_bucket, file_path)
);

CREATE INDEX IF NOT EXISTS idx_file_attachments_tenant_id
  ON public.file_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_franchise_id
  ON public.file_attachments(franchise_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_date
  ON public.file_attachments(uploaded_date DESC);
CREATE INDEX IF NOT EXISTS idx_file_attachments_is_active
  ON public.file_attachments(is_active);
CREATE INDEX IF NOT EXISTS idx_file_attachments_scan_status
  ON public.file_attachments(scan_status);

COMMENT ON TABLE public.file_attachments IS
  'Canonical cross-form attachment registry for all modules; binary payloads live in Supabase Storage.';
COMMENT ON COLUMN public.file_attachments.public_url IS
  'Public URL for unrestricted files when is_public=true and bucket is public.';

CREATE TABLE IF NOT EXISTS public.attachment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES public.file_attachments(attachment_id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid NULL REFERENCES public.franchises(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text NULL, -- Optional form field target, e.g. "attachments", "pod_files"
  relationship_role text NULL, -- Optional role, e.g. "primary", "supporting", "evidence"
  sort_order integer NOT NULL DEFAULT 0,
  linked_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_attachment_links_unique_active UNIQUE (attachment_id, entity_type, entity_id, field_name, relationship_role)
);

CREATE INDEX IF NOT EXISTS idx_attachment_links_attachment_id
  ON public.attachment_links(attachment_id);
CREATE INDEX IF NOT EXISTS idx_attachment_links_entity
  ON public.attachment_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachment_links_tenant
  ON public.attachment_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attachment_links_field_name
  ON public.attachment_links(field_name);

COMMENT ON TABLE public.attachment_links IS
  'Polymorphic junction table linking canonical attachments to any form/entity record.';

CREATE TABLE IF NOT EXISTS public.attachment_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid NULL REFERENCES public.franchises(id) ON DELETE SET NULL,
  attachment_id uuid NOT NULL REFERENCES public.file_attachments(attachment_id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  previous_attachment_id uuid NULL REFERENCES public.file_attachments(attachment_id) ON DELETE SET NULL,
  changed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_attachment_versions_number UNIQUE (attachment_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_attachment_versions_attachment
  ON public.attachment_versions(attachment_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_attachment_versions_tenant
  ON public.attachment_versions(tenant_id);

COMMENT ON TABLE public.attachment_versions IS
  'Attachment version lineage for replacement and historical retrieval.';

CREATE TABLE IF NOT EXISTS public.attachment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid NULL REFERENCES public.franchises(id) ON DELETE SET NULL,
  attachment_id uuid NOT NULL REFERENCES public.file_attachments(attachment_id) ON DELETE CASCADE,
  link_id uuid NULL REFERENCES public.attachment_links(id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'upload_session_created',
      'upload_completed',
      'upload_failed',
      'scan_completed',
      'linked',
      'unlinked',
      'downloaded',
      'previewed',
      'deleted',
      'restored',
      'version_created',
      'metadata_updated'
    )),
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  event_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachment_events_attachment
  ON public.attachment_events(attachment_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachment_events_tenant
  ON public.attachment_events(tenant_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachment_events_type
  ON public.attachment_events(event_type);

COMMENT ON TABLE public.attachment_events IS
  'Immutable audit/monitoring stream for all attachment lifecycle events.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-attachments', 'app-attachments', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-attachments-public', 'app-attachments-public', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS file_attachments_platform_admin_access ON public.file_attachments;
CREATE POLICY file_attachments_platform_admin_access
  ON public.file_attachments
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS file_attachments_tenant_franchise_scope ON public.file_attachments;
CREATE POLICY file_attachments_tenant_franchise_scope
  ON public.file_attachments
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS attachment_links_platform_admin_access ON public.attachment_links;
CREATE POLICY attachment_links_platform_admin_access
  ON public.attachment_links
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS attachment_links_tenant_franchise_scope ON public.attachment_links;
CREATE POLICY attachment_links_tenant_franchise_scope
  ON public.attachment_links
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS attachment_versions_platform_admin_access ON public.attachment_versions;
CREATE POLICY attachment_versions_platform_admin_access
  ON public.attachment_versions
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS attachment_versions_tenant_franchise_scope ON public.attachment_versions;
CREATE POLICY attachment_versions_tenant_franchise_scope
  ON public.attachment_versions
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS attachment_events_platform_admin_access ON public.attachment_events;
CREATE POLICY attachment_events_platform_admin_access
  ON public.attachment_events
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS attachment_events_tenant_franchise_scope ON public.attachment_events;
CREATE POLICY attachment_events_tenant_franchise_scope
  ON public.attachment_events
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS app_attachments_insert ON storage.objects;
CREATE POLICY app_attachments_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app-attachments'
    AND (
      public.is_platform_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.file_attachments fa
        WHERE fa.storage_bucket = 'app-attachments'
          AND fa.file_path = name
          AND fa.is_public = false
          AND fa.tenant_id = public.get_user_tenant_id(auth.uid())
          AND (
            public.get_user_franchise_id(auth.uid()) IS NULL
            OR fa.franchise_id IS NULL
            OR fa.franchise_id = public.get_user_franchise_id(auth.uid())
          )
      )
    )
  );

DROP POLICY IF EXISTS app_attachments_select ON storage.objects;
CREATE POLICY app_attachments_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'app-attachments'
    AND (
      public.is_platform_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.file_attachments fa
        WHERE fa.storage_bucket = 'app-attachments'
          AND fa.file_path = name
          AND fa.is_public = false
          AND fa.tenant_id = public.get_user_tenant_id(auth.uid())
          AND (
            public.get_user_franchise_id(auth.uid()) IS NULL
            OR fa.franchise_id IS NULL
            OR fa.franchise_id = public.get_user_franchise_id(auth.uid())
          )
      )
    )
  );

DROP POLICY IF EXISTS app_attachments_update ON storage.objects;
CREATE POLICY app_attachments_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app-attachments'
    AND (
      public.is_platform_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.file_attachments fa
        WHERE fa.storage_bucket = 'app-attachments'
          AND fa.file_path = name
          AND fa.is_public = false
          AND fa.tenant_id = public.get_user_tenant_id(auth.uid())
          AND (
            public.get_user_franchise_id(auth.uid()) IS NULL
            OR fa.franchise_id IS NULL
            OR fa.franchise_id = public.get_user_franchise_id(auth.uid())
          )
      )
    )
  );

DROP POLICY IF EXISTS app_attachments_delete ON storage.objects;
CREATE POLICY app_attachments_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app-attachments'
    AND (
      public.is_platform_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.file_attachments fa
        WHERE fa.storage_bucket = 'app-attachments'
          AND fa.file_path = name
          AND fa.is_public = false
          AND fa.tenant_id = public.get_user_tenant_id(auth.uid())
          AND (
            public.get_user_franchise_id(auth.uid()) IS NULL
            OR fa.franchise_id IS NULL
            OR fa.franchise_id = public.get_user_franchise_id(auth.uid())
          )
      )
    )
  );

DROP POLICY IF EXISTS app_attachments_public_insert ON storage.objects;
CREATE POLICY app_attachments_public_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app-attachments-public'
    AND (
      public.is_platform_admin(auth.uid())
      OR (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
    )
  );

DROP POLICY IF EXISTS app_attachments_public_update ON storage.objects;
CREATE POLICY app_attachments_public_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app-attachments-public'
    AND (
      public.is_platform_admin(auth.uid())
      OR (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
    )
  );

DROP POLICY IF EXISTS app_attachments_public_delete ON storage.objects;
CREATE POLICY app_attachments_public_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app-attachments-public'
    AND (
      public.is_platform_admin(auth.uid())
      OR (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
    )
  );

CREATE OR REPLACE FUNCTION public.file_attachment_create_upload_session(
  p_entity_type text,
  p_entity_id uuid,
  p_file_name text,
  p_file_type text DEFAULT NULL,
  p_file_size bigint DEFAULT NULL,
  p_field_name text DEFAULT NULL,
  p_relationship_role text DEFAULT NULL,
  p_franchise_id uuid DEFAULT NULL,
  p_is_public boolean DEFAULT false
)
RETURNS TABLE (
  attachment_id uuid,
  bucket text,
  path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_franchise_id uuid;
  v_safe_file_name text;
  v_bucket text;
BEGIN
  v_tenant_id := public.get_user_tenant_id(auth.uid());
  v_franchise_id := coalesce(p_franchise_id, public.get_user_franchise_id(auth.uid()));

  IF v_tenant_id IS NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Tenant scope is required';
  END IF;

  IF NOT public.is_platform_admin(auth.uid())
     AND p_franchise_id IS NOT NULL
     AND public.get_user_franchise_id(auth.uid()) IS NOT NULL
     AND p_franchise_id <> public.get_user_franchise_id(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized franchise scope';
  END IF;

  IF p_file_name IS NULL OR btrim(p_file_name) = '' THEN
    RAISE EXCEPTION 'File name is required';
  END IF;

  IF p_file_size IS NOT NULL AND p_file_size > 104857600 THEN
    RAISE EXCEPTION 'File size exceeds 100MB platform limit';
  END IF;

  v_safe_file_name := regexp_replace(p_file_name, '[^a-zA-Z0-9._-]+', '_', 'g');
  v_bucket := CASE WHEN p_is_public THEN 'app-attachments-public' ELSE 'app-attachments' END;
  path := format(
    '%s/%s/%s/%s-%s',
    coalesce(v_tenant_id::text, 'platform'),
    lower(p_entity_type),
    p_entity_id::text,
    extract(epoch FROM clock_timestamp())::bigint,
    lower(v_safe_file_name)
  );

  INSERT INTO public.file_attachments (
    tenant_id,
    franchise_id,
    file_name,
    file_type,
    file_size,
    file_path,
    storage_bucket,
    is_public,
    public_url,
    uploaded_by,
    scan_status
  )
  VALUES (
    coalesce(v_tenant_id, (SELECT tenant_id FROM public.tenants LIMIT 1)),
    v_franchise_id,
    p_file_name,
    p_file_type,
    p_file_size,
    path,
    v_bucket,
    p_is_public,
    CASE
      WHEN p_is_public THEN format('/storage/v1/object/public/%s/%s', v_bucket, path)
      ELSE NULL
    END,
    auth.uid(),
    'pending'
  )
  RETURNING file_attachments.attachment_id INTO attachment_id;

  INSERT INTO public.attachment_links (
    attachment_id,
    tenant_id,
    franchise_id,
    entity_type,
    entity_id,
    field_name,
    relationship_role,
    linked_by
  )
  VALUES (
    attachment_id,
    coalesce(v_tenant_id, (SELECT tenant_id FROM public.tenants LIMIT 1)),
    v_franchise_id,
    p_entity_type,
    p_entity_id,
    p_field_name,
    p_relationship_role,
    auth.uid()
  );

  INSERT INTO public.attachment_events (
    tenant_id,
    franchise_id,
    attachment_id,
    event_type,
    event_payload,
    event_by
  )
  VALUES (
    coalesce(v_tenant_id, (SELECT tenant_id FROM public.tenants LIMIT 1)),
    v_franchise_id,
    attachment_id,
    'upload_session_created',
    jsonb_build_object(
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'field_name', p_field_name,
      'relationship_role', p_relationship_role
    ),
    auth.uid()
  );

  bucket := v_bucket;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.file_attachment_finalize_upload(
  p_attachment_id uuid,
  p_success boolean DEFAULT true,
  p_error text DEFAULT NULL,
  p_checksum_sha256 text DEFAULT NULL
)
RETURNS public.file_attachments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attachment public.file_attachments%ROWTYPE;
BEGIN
  SELECT * INTO v_attachment
  FROM public.file_attachments
  WHERE file_attachments.attachment_id = p_attachment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attachment % not found', p_attachment_id;
  END IF;

  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF v_attachment.tenant_id <> public.get_user_tenant_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized tenant scope';
    END IF;
    IF public.get_user_franchise_id(auth.uid()) IS NOT NULL
       AND v_attachment.franchise_id IS NOT NULL
       AND v_attachment.franchise_id <> public.get_user_franchise_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized franchise scope';
    END IF;
  END IF;

  UPDATE public.file_attachments
  SET
    is_active = p_success,
    scan_status = CASE WHEN p_success THEN 'pending' ELSE 'failed' END,
    checksum_sha256 = coalesce(p_checksum_sha256, checksum_sha256),
    updated_at = now()
  WHERE file_attachments.attachment_id = p_attachment_id
  RETURNING * INTO v_attachment;

  INSERT INTO public.attachment_events (
    tenant_id,
    franchise_id,
    attachment_id,
    event_type,
    event_payload,
    event_by
  )
  VALUES (
    v_attachment.tenant_id,
    v_attachment.franchise_id,
    v_attachment.attachment_id,
    CASE WHEN p_success THEN 'upload_completed' ELSE 'upload_failed' END,
    jsonb_build_object('error', p_error),
    auth.uid()
  );

  RETURN v_attachment;
END;
$$;

CREATE OR REPLACE FUNCTION public.file_attachment_list_for_entity(
  p_entity_type text,
  p_entity_id uuid,
  p_include_inactive boolean DEFAULT false
)
RETURNS TABLE (
  attachment_id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  file_path text,
  storage_bucket text,
  is_public boolean,
  public_url text,
  uploaded_by uuid,
  uploaded_date timestamptz,
  is_active boolean,
  scan_status text,
  field_name text,
  relationship_role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fa.attachment_id,
    fa.file_name,
    fa.file_type,
    fa.file_size,
    fa.file_path,
    fa.storage_bucket,
    fa.is_public,
    fa.public_url,
    fa.uploaded_by,
    fa.uploaded_date,
    fa.is_active,
    fa.scan_status,
    al.field_name,
    al.relationship_role
  FROM public.attachment_links al
  JOIN public.file_attachments fa
    ON fa.attachment_id = al.attachment_id
  WHERE
    al.entity_type = p_entity_type
    AND al.entity_id = p_entity_id
    AND (p_include_inactive OR (al.is_active = true AND fa.is_active = true))
    AND (
      public.is_platform_admin(auth.uid())
      OR (
        fa.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.get_user_franchise_id(auth.uid()) IS NULL
          OR fa.franchise_id IS NULL
          OR fa.franchise_id = public.get_user_franchise_id(auth.uid())
        )
      )
    )
  ORDER BY fa.uploaded_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.file_attachment_soft_delete(
  p_attachment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attachment public.file_attachments%ROWTYPE;
BEGIN
  SELECT * INTO v_attachment
  FROM public.file_attachments
  WHERE file_attachments.attachment_id = p_attachment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attachment % not found', p_attachment_id;
  END IF;

  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF v_attachment.tenant_id <> public.get_user_tenant_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized tenant scope';
    END IF;
    IF public.get_user_franchise_id(auth.uid()) IS NOT NULL
       AND v_attachment.franchise_id IS NOT NULL
       AND v_attachment.franchise_id <> public.get_user_franchise_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized franchise scope';
    END IF;
  END IF;

  UPDATE public.file_attachments
  SET
    is_active = false,
    updated_at = now()
  WHERE file_attachments.attachment_id = p_attachment_id;

  UPDATE public.attachment_links
  SET is_active = false
  WHERE attachment_links.attachment_id = p_attachment_id;

  INSERT INTO public.attachment_events (
    tenant_id,
    franchise_id,
    attachment_id,
    event_type,
    event_payload,
    event_by
  )
  VALUES (
    v_attachment.tenant_id,
    v_attachment.franchise_id,
    v_attachment.attachment_id,
    'deleted',
    '{}'::jsonb,
    auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.file_attachment_record_access(
  p_attachment_id uuid,
  p_event_type text DEFAULT 'downloaded'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attachment public.file_attachments%ROWTYPE;
BEGIN
  IF p_event_type NOT IN ('downloaded', 'previewed') THEN
    RAISE EXCEPTION 'Invalid access event type: %', p_event_type;
  END IF;

  SELECT * INTO v_attachment
  FROM public.file_attachments
  WHERE file_attachments.attachment_id = p_attachment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attachment % not found', p_attachment_id;
  END IF;

  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF v_attachment.tenant_id <> public.get_user_tenant_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized tenant scope';
    END IF;
    IF public.get_user_franchise_id(auth.uid()) IS NOT NULL
       AND v_attachment.franchise_id IS NOT NULL
       AND v_attachment.franchise_id <> public.get_user_franchise_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized franchise scope';
    END IF;
  END IF;

  INSERT INTO public.attachment_events (
    tenant_id,
    franchise_id,
    attachment_id,
    event_type,
    event_payload,
    event_by
  )
  VALUES (
    v_attachment.tenant_id,
    v_attachment.franchise_id,
    v_attachment.attachment_id,
    p_event_type,
    '{}'::jsonb,
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.file_attachment_create_upload_session(text, uuid, text, text, bigint, text, text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.file_attachment_finalize_upload(uuid, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.file_attachment_list_for_entity(text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.file_attachment_soft_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.file_attachment_record_access(uuid, text) TO authenticated;

COMMIT;
