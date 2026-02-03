-- scripts/verify_rps_implementation.sql
-- Verify Restricted Party Lists table
SELECT 'restricted_party_lists exists' as check, EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'restricted_party_lists'
) as result;

-- Verify Compliance Screenings table
SELECT 'compliance_screenings exists' as check, EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'compliance_screenings'
) as result;

-- Verify Indexes
SELECT indexname
FROM pg_indexes 
WHERE tablename = 'restricted_party_lists' 
OR tablename = 'compliance_screenings';

-- Verify Seed Data
SELECT source_list, entity_name, country_code 
FROM public.restricted_party_lists 
LIMIT 5;

-- Test Screening RPC (should find Huawei)
SELECT * FROM public.screen_restricted_party('Huawei', 'CN', 0.4);

-- Test Screening RPC with mismatch (should return empty)
SELECT * FROM public.screen_restricted_party('Random Innocent Guy', 'US');
