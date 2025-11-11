-- Export Audit and System Data
-- Run last

-- Audit Logs
COPY (
  SELECT * FROM audit_logs ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: audit_logs.csv

-- Notifications
COPY (
  SELECT * FROM notifications ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: notifications.csv

-- System Settings
COPY (
  SELECT * FROM system_settings ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: system_settings.csv
