CREATE TABLE crm_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  user_id UUID,

  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,

  related_entity_id UUID,
  related_entity_type VARCHAR(50),

  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT NOW(),
  user_email TEXT,
  user_name TEXT,

  CONSTRAINT fk_user FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_crm_audit_tenant_created
  ON crm_audit_logs(tenant_id, created_at DESC);

CREATE INDEX idx_crm_audit_entity
  ON crm_audit_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX idx_crm_audit_user
  ON crm_audit_logs(user_id, created_at DESC);

CREATE INDEX idx_crm_audit_action
  ON crm_audit_logs(action, created_at DESC);

ALTER TABLE crm_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's audit logs"
  ON crm_audit_logs FOR SELECT
  USING (
    tenant_id = (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert audit logs"
  ON crm_audit_logs FOR INSERT
  WITH CHECK (true);

GRANT SELECT ON crm_audit_logs TO authenticated;
GRANT INSERT ON crm_audit_logs TO service_role;
