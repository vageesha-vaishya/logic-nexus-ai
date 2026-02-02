-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to find expiring contracts
CREATE OR REPLACE FUNCTION get_expiring_contracts(days_threshold INT DEFAULT 30)
RETURNS TABLE (
  contract_id UUID,
  vendor_id UUID,
  vendor_name TEXT,
  contract_title TEXT,
  end_date DATE,
  days_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vc.id,
    v.id,
    v.name,
    vc.title,
    vc.end_date,
    (vc.end_date - CURRENT_DATE)::INT
  FROM vendor_contracts vc
  JOIN vendors v ON vc.vendor_id = v.id
  WHERE vc.status = 'active'
    AND vc.end_date IS NOT NULL
    AND vc.end_date <= (CURRENT_DATE + days_threshold)
    AND vc.end_date >= CURRENT_DATE;
END;
$$;

-- Function for data retention (archive old docs)
-- Adds 'archived' status to DocumentStatus type if not present (handled in app logic mostly, but good to have DB support)
-- Note: Check constraints on status might fail if 'archived' is not allowed.
-- Let's check constraint. For now, assume it's text or has room.
-- If status is an enum, we might need to alter it.
-- Let's just use 'expired' for now if 'archived' isn't there, or assume text.
-- Previous types file showed type DocumentStatus = 'pending' | 'verified' | 'rejected' | 'expired';
-- So 'archived' might fail validation if there's a DB constraint.
-- Let's check constraints later. For now, I'll use 'expired' with a note or just 'expired'.
-- Actually, let's ALTER the type if possible, or just use 'expired'.
-- Better: Create a separate 'archived_at' column?
-- For this migration, I'll skip the archiving logic update to status to avoid breaking things, 
-- and instead just return candidates.

CREATE OR REPLACE FUNCTION get_documents_for_retention(years_threshold INT DEFAULT 7)
RETURNS TABLE (
  doc_id UUID,
  vendor_id UUID,
  doc_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    vendor_id,
    name,
    created_at
  FROM vendor_documents
  WHERE created_at < (NOW() - (years_threshold || ' years')::INTERVAL);
END;
$$;
