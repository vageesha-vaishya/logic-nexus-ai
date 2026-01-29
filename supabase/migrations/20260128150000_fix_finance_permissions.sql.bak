-- Grant usage on the finance schema to application roles
GRANT USAGE ON SCHEMA finance TO anon, authenticated, service_role;

-- Grant table permissions
-- Note: RLS policies (if enabled) will still restrict access even with these grants.
GRANT ALL ON ALL TABLES IN SCHEMA finance TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA finance TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA finance TO anon;

-- Grant sequence permissions (important for inserting new records)
GRANT ALL ON ALL SEQUENCES IN SCHEMA finance TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA finance TO authenticated;
