-- Backfill existing module-specific attachments into generic attachment module
-- Safe to re-run due deduplication checks.

BEGIN;

-- Shipment attachments -> file_attachments + attachment_links
DO $$
BEGIN
  IF to_regclass('public.shipment_attachments') IS NOT NULL THEN
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
      uploaded_date,
      is_active,
      scan_status,
      metadata
    )
    SELECT
      COALESCE(sa.tenant_id, public.get_user_tenant_id(auth.uid())),
      sa.franchise_id,
      sa.name,
      sa.content_type,
      sa.size,
      sa.path,
      'shipments',
      (sa.public_url IS NOT NULL),
      sa.public_url,
      sa.created_by,
      sa.uploaded_at,
      true,
      'pending',
      jsonb_build_object('legacy_table', 'shipment_attachments', 'legacy_id', sa.id)
    FROM public.shipment_attachments sa
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.file_attachments fa
      WHERE fa.storage_bucket = 'shipments'
        AND fa.file_path = sa.path
    );

    INSERT INTO public.attachment_links (
      attachment_id,
      tenant_id,
      franchise_id,
      entity_type,
      entity_id,
      field_name,
      relationship_role,
      linked_by,
      linked_at,
      is_primary,
      is_active,
      metadata
    )
    SELECT
      fa.attachment_id,
      fa.tenant_id,
      fa.franchise_id,
      'shipment',
      sa.shipment_id,
      'attachments',
      COALESCE(sa.document_type::text, 'supporting'),
      sa.created_by,
      sa.uploaded_at,
      (sa.document_type = 'proof_of_delivery'),
      true,
      jsonb_build_object('legacy_table', 'shipment_attachments', 'legacy_id', sa.id)
    FROM public.shipment_attachments sa
    JOIN public.file_attachments fa
      ON fa.storage_bucket = 'shipments'
     AND fa.file_path = sa.path
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.attachment_links al
      WHERE al.attachment_id = fa.attachment_id
        AND al.entity_type = 'shipment'
        AND al.entity_id = sa.shipment_id
    );
  END IF;
END $$;

-- Commodity documents -> file_attachments + attachment_links
DO $$
BEGIN
  IF to_regclass('public.commodity_documents') IS NOT NULL THEN
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
      uploaded_date,
      is_active,
      scan_status,
      metadata
    )
    SELECT
      COALESCE(
        (SELECT mc.tenant_id FROM public.master_commodities mc WHERE mc.id = cd.commodity_id),
        public.get_user_tenant_id(auth.uid())
      ),
      NULL,
      cd.file_name,
      cd.file_type,
      cd.file_size,
      cd.file_path,
      'commodity-docs',
      true,
      format('/storage/v1/object/public/%s/%s', 'commodity-docs', cd.file_path),
      cd.uploaded_by,
      cd.created_at,
      true,
      'pending',
      jsonb_build_object('legacy_table', 'commodity_documents', 'legacy_id', cd.id)
    FROM public.commodity_documents cd
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.file_attachments fa
      WHERE fa.storage_bucket = 'commodity-docs'
        AND fa.file_path = cd.file_path
    );

    INSERT INTO public.attachment_links (
      attachment_id,
      tenant_id,
      franchise_id,
      entity_type,
      entity_id,
      field_name,
      relationship_role,
      linked_by,
      linked_at,
      is_primary,
      is_active,
      metadata
    )
    SELECT
      fa.attachment_id,
      fa.tenant_id,
      fa.franchise_id,
      'commodity',
      cd.commodity_id,
      'documents',
      'supporting',
      cd.uploaded_by,
      cd.created_at,
      false,
      true,
      jsonb_build_object('legacy_table', 'commodity_documents', 'legacy_id', cd.id)
    FROM public.commodity_documents cd
    JOIN public.file_attachments fa
      ON fa.storage_bucket = 'commodity-docs'
     AND fa.file_path = cd.file_path
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.attachment_links al
      WHERE al.attachment_id = fa.attachment_id
        AND al.entity_type = 'commodity'
        AND al.entity_id = cd.commodity_id
    );
  END IF;
END $$;

-- Vendor documents -> file_attachments + attachment_links
DO $$
BEGIN
  IF to_regclass('public.vendor_documents') IS NOT NULL THEN
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
      uploaded_date,
      is_active,
      scan_status,
      metadata
    )
    SELECT
      COALESCE(v.tenant_id, public.get_user_tenant_id(auth.uid())),
      v.franchise_id,
      vd.name,
      vd.mime_type,
      vd.file_size,
      vd.file_path,
      'vendor-documents',
      false,
      NULL,
      CASE
        WHEN coalesce(to_jsonb(vd)->>'created_by', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN (to_jsonb(vd)->>'created_by')::uuid
        ELSE NULL::uuid
      END,
      vd.created_at,
      true,
      CASE
        WHEN coalesce(to_jsonb(vd)->>'virus_scan_status', '') = 'clean' THEN 'clean'
        WHEN coalesce(to_jsonb(vd)->>'virus_scan_status', '') = 'infected' THEN 'infected'
        WHEN coalesce(to_jsonb(vd)->>'virus_scan_status', '') = 'failed' THEN 'failed'
        ELSE 'pending'
      END,
      jsonb_build_object('legacy_table', 'vendor_documents', 'legacy_id', vd.id)
    FROM public.vendor_documents vd
    LEFT JOIN public.vendors v ON v.id = vd.vendor_id
    WHERE vd.file_path IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.file_attachments fa
        WHERE fa.storage_bucket = 'vendor-documents'
          AND fa.file_path = vd.file_path
      );

    INSERT INTO public.attachment_links (
      attachment_id,
      tenant_id,
      franchise_id,
      entity_type,
      entity_id,
      field_name,
      relationship_role,
      linked_by,
      linked_at,
      is_primary,
      is_active,
      metadata
    )
    SELECT
      fa.attachment_id,
      fa.tenant_id,
      fa.franchise_id,
      'vendor',
      vd.vendor_id,
      'documents',
      COALESCE(vd.type::text, 'supporting'),
      CASE
        WHEN coalesce(to_jsonb(vd)->>'created_by', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN (to_jsonb(vd)->>'created_by')::uuid
        ELSE NULL::uuid
      END,
      vd.created_at,
      false,
      true,
      jsonb_build_object('legacy_table', 'vendor_documents', 'legacy_id', vd.id)
    FROM public.vendor_documents vd
    JOIN public.file_attachments fa
      ON fa.storage_bucket = 'vendor-documents'
     AND fa.file_path = vd.file_path
    WHERE vd.file_path IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.attachment_links al
        WHERE al.attachment_id = fa.attachment_id
          AND al.entity_type = 'vendor'
          AND al.entity_id = vd.vendor_id
      );
  END IF;
END $$;

COMMIT;
