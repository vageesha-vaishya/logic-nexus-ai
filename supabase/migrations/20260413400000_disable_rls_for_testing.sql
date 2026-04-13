-- Disable RLS temporarily for testing
-- This will help us identify if RLS is the root cause

ALTER TABLE amro_tooling_registry DISABLE ROW LEVEL SECURITY;
ALTER TABLE amro_compliance_ad_sb_registry DISABLE ROW LEVEL SECURITY;
ALTER TABLE amro_tooling_instances DISABLE ROW LEVEL SECURITY;

-- Verify data exists
SELECT 
  'Tools: ' || COUNT(*) AS check_result 
FROM amro_tooling_registry 
UNION ALL
SELECT 
  'AD/SB: ' || COUNT(*) 
FROM amro_compliance_ad_sb_registry
UNION ALL
SELECT 
  'Instances: ' || COUNT(*) 
FROM amro_tooling_instances;
