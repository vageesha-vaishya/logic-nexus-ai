CREATE TABLE IF NOT EXISTS vendor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  document_id UUID REFERENCES vendor_documents(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('expiration_30', 'expiration_7', 'expiration_1')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_vendor_notifications_doc_type ON vendor_notifications(document_id, notification_type);

ALTER TABLE vendor_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view notifications" ON vendor_notifications;
CREATE POLICY "Platform admins can view notifications" ON vendor_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'platform_admin'
    )
  );
