-- AMRO Directive master and attachment backend services
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review
-- Extension assessment:
--   Existing public.task_templates cannot be safely extended for directive lifecycle + attachment telemetry
--   without overloading task semantics and violating separation of concerns.

BEGIN;

CREATE TABLE IF NOT EXISTS public.directives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directive_sequence integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid NULL REFERENCES public.franchises(id) ON DELETE SET NULL,
  code_form_no character varying(50) NULL,
  ata_code character varying(10) NULL,
  reference_amp text NULL,
  description text NULL,
  category_code character varying(10) NULL,
  estimated_man_hours numeric(5, 2) NULL,
  revision_status text NULL,
  threshold_hours numeric(10, 2) NULL,
  threshold_cycles integer NULL,
  threshold_calendar integer NULL,
  threshold_landings integer NULL,
  is_mandatory boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  category_id uuid NULL REFERENCES public.task_categories(id) ON DELETE SET NULL,
  calendar_unit public.calendar_unit NULL,
  repeat_interval boolean NOT NULL DEFAULT false,
  assembly_models uuid NULL REFERENCES public.assembly_models(id) ON DELETE SET NULL,
  directive_detail_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  directive_scope_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  location_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  other_details_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  directive_no text NULL,
  show_in_c_of_a boolean NOT NULL DEFAULT true,
  applicability text NULL,
  effective_date timestamp with time zone NULL,
  superseded_ad_number text NULL,
  method_of_compliance text NULL,
  attach_file jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_directives_tenant_sequence
  ON public.directives(tenant_id, directive_sequence);
CREATE INDEX IF NOT EXISTS idx_directives_tenant_id
  ON public.directives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_directives_franchise_id
  ON public.directives(franchise_id);
CREATE INDEX IF NOT EXISTS idx_directives_ata_code
  ON public.directives(ata_code);
CREATE INDEX IF NOT EXISTS idx_directives_directive_no
  ON public.directives(directive_no);
CREATE INDEX IF NOT EXISTS idx_directives_assembly_models
  ON public.directives(assembly_models);

COMMENT ON TABLE public.directives IS
  'Tenant-scoped directive master records including thresholds and compliance metadata.';
COMMENT ON COLUMN public.directives.threshold_landings IS
  'Landing threshold for recurring directive intervals.';
COMMENT ON COLUMN public.directives.attach_file IS
  'Legacy-compatible attachment references; canonical metadata stored in public.directive_attachments.';

CREATE TABLE IF NOT EXISTS public.directive_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directive_id uuid NOT NULL REFERENCES public.directives(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid NULL REFERENCES public.franchises(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text NULL,
  file_size bigint NULL CHECK (file_size IS NULL OR file_size >= 0),
  checksum text NULL,
  upload_status text NOT NULL DEFAULT 'pending'
    CHECK (upload_status IN ('pending', 'uploaded', 'failed', 'deleted')),
  failure_reason text NULL,
  uploaded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NULL,
  last_accessed_at timestamptz NULL,
  download_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_directive_attachments_file_path UNIQUE (file_path)
);

CREATE INDEX IF NOT EXISTS idx_directive_attachments_directive_id
  ON public.directive_attachments(directive_id);
CREATE INDEX IF NOT EXISTS idx_directive_attachments_tenant_id
  ON public.directive_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_directive_attachments_status
  ON public.directive_attachments(upload_status);
CREATE INDEX IF NOT EXISTS idx_directive_attachments_created_at
  ON public.directive_attachments(created_at DESC);

CREATE TABLE IF NOT EXISTS public.directive_attachment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES public.directive_attachments(id) ON DELETE CASCADE,
  directive_id uuid NOT NULL REFERENCES public.directives(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid NULL REFERENCES public.franchises(id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'upload_session_created',
      'upload_completed',
      'upload_failed',
      'status_changed',
      'downloaded',
      'previewed',
      'metadata_updated',
      'deleted'
    )),
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  event_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_directive_attachment_events_attachment_id
  ON public.directive_attachment_events(attachment_id);
CREATE INDEX IF NOT EXISTS idx_directive_attachment_events_directive_id
  ON public.directive_attachment_events(directive_id);
CREATE INDEX IF NOT EXISTS idx_directive_attachment_events_tenant_id
  ON public.directive_attachment_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_directive_attachment_events_event_at
  ON public.directive_attachment_events(event_at DESC);
CREATE INDEX IF NOT EXISTS idx_directive_attachment_events_event_type
  ON public.directive_attachment_events(event_type);

INSERT INTO storage.buckets (id, name, public)
VALUES ('directive-attachments', 'directive-attachments', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.directives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directive_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directive_attachment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS directives_platform_admin_access ON public.directives;
CREATE POLICY directives_platform_admin_access
  ON public.directives
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS directives_tenant_franchise_scope ON public.directives;
CREATE POLICY directives_tenant_franchise_scope
  ON public.directives
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

DROP POLICY IF EXISTS directive_attachments_platform_admin_access ON public.directive_attachments;
CREATE POLICY directive_attachments_platform_admin_access
  ON public.directive_attachments
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS directive_attachments_tenant_franchise_scope ON public.directive_attachments;
CREATE POLICY directive_attachments_tenant_franchise_scope
  ON public.directive_attachments
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

DROP POLICY IF EXISTS directive_attachment_events_platform_admin_access ON public.directive_attachment_events;
CREATE POLICY directive_attachment_events_platform_admin_access
  ON public.directive_attachment_events
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS directive_attachment_events_tenant_franchise_scope ON public.directive_attachment_events;
CREATE POLICY directive_attachment_events_tenant_franchise_scope
  ON public.directive_attachment_events
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

DROP POLICY IF EXISTS directive_attachments_insert ON storage.objects;
CREATE POLICY directive_attachments_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'directive-attachments'
    AND (
      public.is_platform_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
        AND EXISTS (
          SELECT 1
          FROM public.directives d
          WHERE d.id::text = COALESCE((storage.foldername(name))[2], '')
            AND d.tenant_id = public.get_user_tenant_id(auth.uid())
            AND (
              public.get_user_franchise_id(auth.uid()) IS NULL
              OR d.franchise_id IS NULL
              OR d.franchise_id = public.get_user_franchise_id(auth.uid())
            )
        )
      )
    )
  );

DROP POLICY IF EXISTS directive_attachments_select ON storage.objects;
CREATE POLICY directive_attachments_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'directive-attachments'
    AND (
      public.is_platform_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
        AND EXISTS (
          SELECT 1
          FROM public.directives d
          WHERE d.id::text = COALESCE((storage.foldername(name))[2], '')
            AND d.tenant_id = public.get_user_tenant_id(auth.uid())
            AND (
              public.get_user_franchise_id(auth.uid()) IS NULL
              OR d.franchise_id IS NULL
              OR d.franchise_id = public.get_user_franchise_id(auth.uid())
            )
        )
      )
    )
  );

DROP POLICY IF EXISTS directive_attachments_update ON storage.objects;
CREATE POLICY directive_attachments_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'directive-attachments'
    AND (
      public.is_platform_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
        AND EXISTS (
          SELECT 1
          FROM public.directives d
          WHERE d.id::text = COALESCE((storage.foldername(name))[2], '')
            AND d.tenant_id = public.get_user_tenant_id(auth.uid())
            AND (
              public.get_user_franchise_id(auth.uid()) IS NULL
              OR d.franchise_id IS NULL
              OR d.franchise_id = public.get_user_franchise_id(auth.uid())
            )
        )
      )
    )
  );

DROP POLICY IF EXISTS directive_attachments_delete ON storage.objects;
CREATE POLICY directive_attachments_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'directive-attachments'
    AND (
      public.is_platform_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
        AND EXISTS (
          SELECT 1
          FROM public.directives d
          WHERE d.id::text = COALESCE((storage.foldername(name))[2], '')
            AND d.tenant_id = public.get_user_tenant_id(auth.uid())
            AND (
              public.get_user_franchise_id(auth.uid()) IS NULL
              OR d.franchise_id IS NULL
              OR d.franchise_id = public.get_user_franchise_id(auth.uid())
            )
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.create_directive_attachment_upload_session(
  p_directive_id uuid,
  p_file_name text,
  p_mime_type text DEFAULT NULL,
  p_file_size bigint DEFAULT NULL,
  p_checksum text DEFAULT NULL
)
RETURNS TABLE (
  attachment_id uuid,
  storage_bucket text,
  storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_directive public.directives%ROWTYPE;
  v_safe_file_name text;
  v_generated_path text;
BEGIN
  IF p_file_name IS NULL OR btrim(p_file_name) = '' THEN
    RAISE EXCEPTION 'File name is required';
  END IF;

  SELECT *
  INTO v_directive
  FROM public.directives d
  WHERE d.id = p_directive_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Directive % not found', p_directive_id;
  END IF;

  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF v_directive.tenant_id <> public.get_user_tenant_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized tenant scope for directive %', p_directive_id;
    END IF;

    IF public.get_user_franchise_id(auth.uid()) IS NOT NULL
       AND v_directive.franchise_id IS NOT NULL
       AND v_directive.franchise_id <> public.get_user_franchise_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized franchise scope for directive %', p_directive_id;
    END IF;
  END IF;

  v_safe_file_name := regexp_replace(p_file_name, '[^a-zA-Z0-9._-]+', '_', 'g');
  v_generated_path := format(
    '%s/%s/%s-%s',
    v_directive.tenant_id::text,
    v_directive.id::text,
    extract(epoch FROM clock_timestamp())::bigint,
    lower(v_safe_file_name)
  );

  INSERT INTO public.directive_attachments (
    directive_id,
    tenant_id,
    franchise_id,
    file_name,
    file_path,
    mime_type,
    file_size,
    checksum,
    upload_status,
    uploaded_by
  )
  VALUES (
    v_directive.id,
    v_directive.tenant_id,
    v_directive.franchise_id,
    p_file_name,
    v_generated_path,
    p_mime_type,
    p_file_size,
    p_checksum,
    'pending',
    auth.uid()
  )
  RETURNING id INTO attachment_id;

  INSERT INTO public.directive_attachment_events (
    attachment_id,
    directive_id,
    tenant_id,
    franchise_id,
    event_type,
    event_payload,
    event_by
  )
  VALUES (
    attachment_id,
    v_directive.id,
    v_directive.tenant_id,
    v_directive.franchise_id,
    'upload_session_created',
    jsonb_build_object('file_name', p_file_name, 'mime_type', p_mime_type, 'file_size', p_file_size),
    auth.uid()
  );

  storage_bucket := 'directive-attachments';
  storage_path := v_generated_path;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_directive_attachment_upload(
  p_attachment_id uuid,
  p_upload_success boolean DEFAULT true,
  p_failure_reason text DEFAULT NULL
)
RETURNS public.directive_attachments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attachment public.directive_attachments%ROWTYPE;
  v_event_type text;
BEGIN
  SELECT *
  INTO v_attachment
  FROM public.directive_attachments
  WHERE id = p_attachment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attachment % not found', p_attachment_id;
  END IF;

  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF v_attachment.tenant_id <> public.get_user_tenant_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized tenant scope for attachment %', p_attachment_id;
    END IF;

    IF public.get_user_franchise_id(auth.uid()) IS NOT NULL
       AND v_attachment.franchise_id IS NOT NULL
       AND v_attachment.franchise_id <> public.get_user_franchise_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized franchise scope for attachment %', p_attachment_id;
    END IF;
  END IF;

  UPDATE public.directive_attachments
  SET
    upload_status = CASE WHEN p_upload_success THEN 'uploaded' ELSE 'failed' END,
    failure_reason = CASE WHEN p_upload_success THEN NULL ELSE p_failure_reason END,
    uploaded_at = CASE WHEN p_upload_success THEN now() ELSE uploaded_at END,
    updated_at = now()
  WHERE id = p_attachment_id
  RETURNING * INTO v_attachment;

  v_event_type := CASE WHEN p_upload_success THEN 'upload_completed' ELSE 'upload_failed' END;

  INSERT INTO public.directive_attachment_events (
    attachment_id,
    directive_id,
    tenant_id,
    franchise_id,
    event_type,
    event_payload,
    event_by
  )
  VALUES (
    v_attachment.id,
    v_attachment.directive_id,
    v_attachment.tenant_id,
    v_attachment.franchise_id,
    v_event_type,
    jsonb_build_object('failure_reason', p_failure_reason),
    auth.uid()
  );

  RETURN v_attachment;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_directive_attachment_access(
  p_attachment_id uuid,
  p_event_type text DEFAULT 'downloaded'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attachment public.directive_attachments%ROWTYPE;
BEGIN
  IF p_event_type NOT IN ('downloaded', 'previewed') THEN
    RAISE EXCEPTION 'Unsupported event type: %', p_event_type;
  END IF;

  SELECT *
  INTO v_attachment
  FROM public.directive_attachments
  WHERE id = p_attachment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attachment % not found', p_attachment_id;
  END IF;

  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF v_attachment.tenant_id <> public.get_user_tenant_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized tenant scope for attachment %', p_attachment_id;
    END IF;
  END IF;

  UPDATE public.directive_attachments
  SET
    last_accessed_at = now(),
    download_count = CASE WHEN p_event_type = 'downloaded' THEN download_count + 1 ELSE download_count END,
    updated_at = now()
  WHERE id = p_attachment_id;

  INSERT INTO public.directive_attachment_events (
    attachment_id,
    directive_id,
    tenant_id,
    franchise_id,
    event_type,
    event_payload,
    event_by
  )
  VALUES (
    v_attachment.id,
    v_attachment.directive_id,
    v_attachment.tenant_id,
    v_attachment.franchise_id,
    p_event_type,
    '{}'::jsonb,
    auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_directive_attachments(
  p_directive_id uuid
)
RETURNS TABLE (
  id uuid,
  file_name text,
  file_path text,
  mime_type text,
  file_size bigint,
  upload_status text,
  uploaded_by uuid,
  uploaded_at timestamptz,
  last_accessed_at timestamptz,
  download_count integer,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_directive public.directives%ROWTYPE;
BEGIN
  SELECT *
  INTO v_directive
  FROM public.directives
  WHERE directives.id = p_directive_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Directive % not found', p_directive_id;
  END IF;

  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF v_directive.tenant_id <> public.get_user_tenant_id(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized tenant scope for directive %', p_directive_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.file_name,
    a.file_path,
    a.mime_type,
    a.file_size,
    a.upload_status,
    a.uploaded_by,
    a.uploaded_at,
    a.last_accessed_at,
    a.download_count,
    a.metadata
  FROM public.directive_attachments a
  WHERE a.directive_id = p_directive_id
  ORDER BY a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_directive_attachment_monitoring(
  p_from timestamptz DEFAULT (now() - interval '30 days'),
  p_to timestamptz DEFAULT now()
)
RETURNS TABLE (
  tenant_id uuid,
  total_files bigint,
  total_bytes numeric,
  uploaded_count bigint,
  failed_count bigint,
  download_events bigint,
  last_event_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.tenant_id,
    count(*)::bigint AS total_files,
    coalesce(sum(a.file_size), 0)::numeric AS total_bytes,
    count(*) FILTER (WHERE a.upload_status = 'uploaded')::bigint AS uploaded_count,
    count(*) FILTER (WHERE a.upload_status = 'failed')::bigint AS failed_count,
    count(e.*) FILTER (WHERE e.event_type = 'downloaded')::bigint AS download_events,
    max(e.event_at) AS last_event_at
  FROM public.directive_attachments a
  LEFT JOIN public.directive_attachment_events e
    ON e.attachment_id = a.id
    AND e.event_at >= p_from
    AND e.event_at <= p_to
  WHERE
    public.is_platform_admin(auth.uid())
    OR a.tenant_id = public.get_user_tenant_id(auth.uid())
  GROUP BY a.tenant_id
  ORDER BY a.tenant_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_directive_attachment_change_tracker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.upload_status IS DISTINCT FROM NEW.upload_status THEN
      v_event_type := 'status_changed';
      v_payload := jsonb_build_object('old_status', OLD.upload_status, 'new_status', NEW.upload_status);
    ELSE
      v_event_type := 'metadata_updated';
      v_payload := jsonb_build_object('updated_at', NEW.updated_at);
    END IF;

    INSERT INTO public.directive_attachment_events (
      attachment_id,
      directive_id,
      tenant_id,
      franchise_id,
      event_type,
      event_payload,
      event_by
    )
    VALUES (
      NEW.id,
      NEW.directive_id,
      NEW.tenant_id,
      NEW.franchise_id,
      v_event_type,
      coalesce(v_payload, '{}'::jsonb),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.directive_attachment_events (
      attachment_id,
      directive_id,
      tenant_id,
      franchise_id,
      event_type,
      event_payload,
      event_by
    )
    VALUES (
      OLD.id,
      OLD.directive_id,
      OLD.tenant_id,
      OLD.franchise_id,
      'deleted',
      jsonb_build_object('file_path', OLD.file_path),
      auth.uid()
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_directive_attachment_change_tracker ON public.directive_attachments;
CREATE TRIGGER trg_directive_attachment_change_tracker
AFTER UPDATE OR DELETE ON public.directive_attachments
FOR EACH ROW
EXECUTE FUNCTION public.trg_directive_attachment_change_tracker();

GRANT EXECUTE ON FUNCTION public.create_directive_attachment_upload_session(uuid, text, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_directive_attachment_upload(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_directive_attachment_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_directive_attachments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_directive_attachment_monitoring(timestamptz, timestamptz) TO authenticated;

COMMIT;
