-- Phase 1.4 — core.files + core.file_links + core.file_versions
-- Per master design doc §6.0 + core.md §3.4
--
-- Centralised blob registry + polymorphic link table. Replaces 8+ per-module
-- attachment tables (shipment_attachments, amro_compliance_documents,
-- quote_documents, carrier_rate_attachments, message_attachments, etc.) as
-- modules migrate.
--
-- No producers yet — Phase 5 (logistics customs docs) is the first lift.

CREATE TABLE core.files (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid         NOT NULL,

  storage_backend     text         NOT NULL                       -- 'supabase' | 's3' | 'gcs' | 'azure'
                                   CHECK (storage_backend IN ('supabase','s3','gcs','azure'))
                                   DEFAULT 'supabase',
  storage_bucket      text         NOT NULL,
  storage_path        text         NOT NULL,                       -- bucket-relative path; unique per (backend, bucket)

  filename            text         NOT NULL,                       -- original or display name
  mime_type           text,
  size_bytes          bigint,

  -- Integrity + safety
  sha256              text,                                        -- content hash; null for streamed uploads
  virus_scanned_at    timestamptz,
  virus_scan_result   text                                          -- 'clean' | 'infected' | 'error'
                                   CHECK (virus_scan_result IN ('clean','infected','error') OR virus_scan_result IS NULL),

  -- Retention classes are application-defined strings (e.g. 'compliance_evidence_7y',
  -- 'general_30d', 'temp_24h'). Cleanup jobs honour the class.
  retention_class     text         NOT NULL DEFAULT 'general_30d',

  uploaded_by_user_id uuid,
  uploaded_at         timestamptz  NOT NULL DEFAULT now(),
  -- Soft delete (right-to-deletion + retention compliance)
  deleted_at          timestamptz,

  metadata            jsonb        NOT NULL DEFAULT '{}',

  UNIQUE (storage_backend, storage_bucket, storage_path)
);

COMMENT ON TABLE core.files IS
  'Centralised blob registry. Replaces 8+ per-module attachment tables. Per master §6.0 + core.md §3.4.';

COMMENT ON COLUMN core.files.retention_class IS
  'Application-defined retention identifier. Examples: compliance_evidence_7y, general_30d, temp_24h, finance_invoice_7y. Cleanup jobs honour this.';

-- Polymorphic link table — N:M between files and any subject
CREATE TABLE core.file_links (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid         NOT NULL,
  file_id         uuid         NOT NULL REFERENCES core.files(id) ON DELETE CASCADE,

  -- subject_type per master §2.4 convention: 'logistics.shipment', 'amro.work_order',
  -- 'quotation.quote', 'compliance.screening', etc.
  subject_type    text         NOT NULL,
  subject_id      uuid         NOT NULL,

  link_role       text,                                            -- 'primary_doc' | 'attachment' | 'evidence' | 'preview' | per-module
  link_order      int          NOT NULL DEFAULT 0,                  -- for ordered display
  created_at      timestamptz  NOT NULL DEFAULT now(),
  created_by_user_id uuid,

  -- A subject may not link the same file twice in the same role
  UNIQUE (subject_type, subject_id, file_id, link_role)
);

COMMENT ON TABLE core.file_links IS
  'Polymorphic link between core.files and any module entity. subject_type is schema-qualified per master §2.4.';

-- File-version history (when a file is replaced rather than re-uploaded)
CREATE TABLE core.file_versions (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid         NOT NULL,
  file_id         uuid         NOT NULL REFERENCES core.files(id) ON DELETE CASCADE,
  version_number  int          NOT NULL,
  storage_path    text         NOT NULL,                            -- archived path of the prior version
  size_bytes      bigint,
  sha256          text,
  superseded_at   timestamptz  NOT NULL DEFAULT now(),
  superseded_by_user_id uuid,
  UNIQUE (file_id, version_number)
);

COMMENT ON TABLE core.file_versions IS
  'Archive of prior versions of a file when its content is replaced in place. core.files always points at the current version.';

-- Indexes
CREATE INDEX files_tenant_uploaded_idx
  ON core.files (tenant_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX files_retention_idx
  ON core.files (retention_class, uploaded_at)
  WHERE deleted_at IS NULL;

CREATE INDEX files_sha256_idx
  ON core.files (tenant_id, sha256)
  WHERE sha256 IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX file_links_subject_idx
  ON core.file_links (tenant_id, subject_type, subject_id, link_order);

CREATE INDEX file_links_file_idx
  ON core.file_links (file_id);

CREATE INDEX file_versions_file_idx
  ON core.file_versions (file_id, version_number DESC);

-- RLS — visibility follows the LINKING subject for now (Phase 1 limitation).
-- A future Phase will introduce core.file_visible_to_user() that delegates
-- to the owning module's helper. For now: tenant-scoped, service-role writes.
ALTER TABLE core.files          ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.file_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.file_versions  ENABLE ROW LEVEL SECURITY;

-- Tenant-isolation read for authenticated users in the file's tenant
CREATE POLICY files_tenant_select ON core.files
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE POLICY file_links_tenant_select ON core.file_links
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE POLICY file_versions_tenant_select ON core.file_versions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

-- Writes via service_role only (Phase 1). Direct-user uploads through a
-- supabase edge function or service endpoint that runs as service_role.
GRANT SELECT ON core.files          TO authenticated;
GRANT SELECT ON core.file_links     TO authenticated;
GRANT SELECT ON core.file_versions  TO authenticated;
GRANT ALL    ON core.files          TO service_role;
GRANT ALL    ON core.file_links     TO service_role;
GRANT ALL    ON core.file_versions  TO service_role;
