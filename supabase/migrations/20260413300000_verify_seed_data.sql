-- Verify seed data exists
SELECT 
  (SELECT COUNT(*) FROM amro_tooling_registry WHERE tenant_id = '0ff7c47d-c013-49a2-8c7f-4462f4e50e02') AS tool_count,
  (SELECT COUNT(*) FROM amro_compliance_ad_sb_registry WHERE tenant_id = '0ff7c47d-c013-49a2-8c7f-4462f4e50e02') AS adsb_count,
  (SELECT COUNT(*) FROM amro_tooling_instances WHERE tenant_id = '0ff7c47d-c013-49a2-8c7f-4462f4e50e02') AS instance_count;

-- If all counts are 0, the migration didn't work
-- If counts > 0, the data exists but UI may have issues
