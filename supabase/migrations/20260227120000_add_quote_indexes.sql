-- Add indexes to improve query performance on quotes table

-- Tenant/Franchise Isolation (RLS)
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_franchise_id ON quotes(franchise_id);
CREATE INDEX IF NOT EXISTS idx_quotes_owner_id ON quotes(owner_id);

-- Foreign Keys (Joins)
CREATE INDEX IF NOT EXISTS idx_quotes_account_id ON quotes(account_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contact_id ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_opportunity_id ON quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_quotes_origin_port_id ON quotes(origin_port_id);
CREATE INDEX IF NOT EXISTS idx_quotes_destination_port_id ON quotes(destination_port_id);
CREATE INDEX IF NOT EXISTS idx_quotes_carrier_id ON quotes(carrier_id);
CREATE INDEX IF NOT EXISTS idx_quotes_service_type_id ON quotes(service_type_id);

-- Filtering & Sorting
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes(quote_number);

-- Composite Index for Common Dashboard Query (Tenant + Status + Created At)
CREATE INDEX IF NOT EXISTS idx_quotes_dashboard_composite ON quotes(tenant_id, status, created_at DESC);
