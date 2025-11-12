-- ==========================================
-- PHASE 5: AUDIT & SYSTEM DATA INSERT STATEMENTS
-- ==========================================
-- Execute this last - after all other data
-- Depends on: all previous tables

-- ==========================================
-- Audit Logs
-- ==========================================
SELECT 'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, details, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L::jsonb, %L)',
      id, user_id, action, resource_type, resource_id, ip_address, details::text, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM audit_logs
WHERE EXISTS (SELECT 1 FROM audit_logs LIMIT 1);

-- ==========================================
-- Notifications
-- ==========================================
SELECT 'INSERT INTO notifications (id, user_id, tenant_id, notification_type, title, message, is_read, action_url, metadata, created_at, read_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L)',
      id, user_id, tenant_id, notification_type, title, message, is_read, action_url, metadata::text, created_at, read_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM notifications
WHERE EXISTS (SELECT 1 FROM notifications LIMIT 1);

-- ==========================================
-- System Settings
-- ==========================================
SELECT 'INSERT INTO system_settings (id, tenant_id, setting_key, setting_value, setting_type, description, is_public, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L::jsonb, %L, %L, %L, %L, %L)',
      id, tenant_id, setting_key, setting_value::text, setting_type, description, is_public, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM system_settings
WHERE EXISTS (SELECT 1 FROM system_settings LIMIT 1);
