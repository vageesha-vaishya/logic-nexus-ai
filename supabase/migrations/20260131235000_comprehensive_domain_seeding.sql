-- Comprehensive Domain Seeding & Service Architecture Linkage
-- 1. Links Service Categories to Platform Domains
-- 2. Seeds Banking, Ecommerce, Telecom domains
-- 3. Seeds Categories and Types for these domains
-- 4. Ensures referential integrity

BEGIN;

-----------------------------------------------------------------------------
-- 1. Schema Updates: Link Categories to Domains
-----------------------------------------------------------------------------
-- Ensure 'code' in platform_domains is nullable (it's legacy)
ALTER TABLE platform_domains ALTER COLUMN code DROP NOT NULL;

ALTER TABLE service_categories 
ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES platform_domains(id);

CREATE INDEX IF NOT EXISTS idx_service_categories_domain_id ON service_categories(domain_id);

-----------------------------------------------------------------------------
-- 2. Seed Platform Domains
-----------------------------------------------------------------------------
-- Helper function to upsert domain and return ID
CREATE OR REPLACE FUNCTION upsert_platform_domain(
    p_key TEXT, 
    p_name TEXT, 
    p_desc TEXT
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Cleanup duplicates (uppercase keys) before upserting
    -- We delete uppercase versions if they conflict with our target name or just to clean up
    DELETE FROM platform_domains WHERE key = upper(p_key);
    
    INSERT INTO platform_domains (key, code, name, description, owner, status)
    VALUES (p_key, p_key, p_name, p_desc, 'Platform Admin', 'active')
    ON CONFLICT (key) DO UPDATE SET
        code = EXCLUDED.code, -- Sync code with key
        name = EXCLUDED.name,
        description = EXCLUDED.description
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    v_logistics_id UUID;
    v_banking_id UUID;
    v_ecommerce_id UUID;
    v_telecom_id UUID;
    v_insurance_id UUID;
    v_customs_id UUID;
    v_trading_id UUID;
    
    v_digital_mode_id UUID;
    
    v_cat_accounts UUID;
    v_cat_loans UUID;
    v_cat_payments UUID;
    v_cat_catalog UUID;
    v_cat_orders UUID;
    v_cat_network UUID;
    v_cat_support UUID;
BEGIN
    -- 2.1 Upsert Domains
    v_logistics_id := upsert_platform_domain('logistics', 'Logistics & Supply Chain', 'Transportation, Warehousing, and Freight Management');
    v_banking_id := upsert_platform_domain('banking', 'Banking & Finance', 'Financial services, accounts, and lending');
    v_ecommerce_id := upsert_platform_domain('ecommerce', 'E-Commerce', 'Online retail, catalog, and order management');
    v_telecom_id := upsert_platform_domain('telecom', 'Telecommunications', 'Network services, connectivity, and billing');
    v_insurance_id := upsert_platform_domain('insurance', 'Insurance', 'Risk management and coverage');
    v_customs_id := upsert_platform_domain('customs', 'Customs & Compliance', 'Regulatory compliance and border clearance');
    v_trading_id := upsert_platform_domain('trading', 'Trading & Procurement', 'Sourcing and trade execution');

    -- 2.2 Link Existing Categories to Logistics (default)
    UPDATE service_categories SET domain_id = v_logistics_id 
    WHERE code IN ('transport', 'storage', 'handling') AND domain_id IS NULL;

    -- Link existing Non-Logistics Categories to their Domains
    UPDATE service_categories SET domain_id = v_insurance_id WHERE code = 'insurance';
    UPDATE service_categories SET domain_id = v_customs_id WHERE code = 'customs';
    UPDATE service_categories SET domain_id = v_trading_id WHERE code = 'trading';

    -- 2.3 Get Digital Mode ID
    SELECT id INTO v_digital_mode_id FROM service_modes WHERE code = 'digital';
    
    -- If digital mode doesn't exist, create it
    IF v_digital_mode_id IS NULL THEN
        INSERT INTO service_modes (code, name, description, icon_name)
        VALUES ('digital', 'Digital Services', 'Non-physical services', 'FileDigit')
        RETURNING id INTO v_digital_mode_id;
    END IF;

    -------------------------------------------------------------------------
    -- 3. Seed Banking Services
    -------------------------------------------------------------------------
    -- Categories
    INSERT INTO service_categories (code, name, description, domain_id, icon_name)
    VALUES 
        ('banking_accounts', 'Account Management', 'Bank accounts and deposits', v_banking_id, 'Briefcase'),
        ('banking_loans', 'Lending Services', 'Loans and mortgages', v_banking_id, 'Banknote'),
        ('banking_payments', 'Payments', 'Transaction processing', v_banking_id, 'CreditCard')
    ON CONFLICT (code) DO UPDATE SET domain_id = v_banking_id;

    -- Get IDs
    SELECT id INTO v_cat_accounts FROM service_categories WHERE code = 'banking_accounts';
    SELECT id INTO v_cat_loans FROM service_categories WHERE code = 'banking_loans';
    SELECT id INTO v_cat_payments FROM service_categories WHERE code = 'banking_payments';

    -- Types
    INSERT INTO service_types (code, name, description, category_id, mode_id)
    VALUES
        ('savings_account', 'Savings Account', 'Interest-bearing deposit account', v_cat_accounts, v_digital_mode_id),
        ('checking_account', 'Checking Account', 'Transactional deposit account', v_cat_accounts, v_digital_mode_id),
        ('business_loan', 'Business Loan', 'Commercial lending', v_cat_loans, v_digital_mode_id),
        ('wire_transfer', 'Wire Transfer', 'Electronic funds transfer', v_cat_payments, v_digital_mode_id)
    ON CONFLICT (name) DO NOTHING; -- Using name as unique constraint based on previous schema

    -------------------------------------------------------------------------
    -- 4. Seed Ecommerce Services
    -------------------------------------------------------------------------
    -- Categories
    INSERT INTO service_categories (code, name, description, domain_id, icon_name)
    VALUES 
        ('ecom_catalog', 'Catalog Management', 'Product listings and inventory', v_ecommerce_id, 'ShoppingBag'),
        ('ecom_orders', 'Order Processing', 'Order lifecycle management', v_ecommerce_id, 'ShoppingCart')
    ON CONFLICT (code) DO UPDATE SET domain_id = v_ecommerce_id;

    -- Get IDs
    SELECT id INTO v_cat_catalog FROM service_categories WHERE code = 'ecom_catalog';
    SELECT id INTO v_cat_orders FROM service_categories WHERE code = 'ecom_orders';

    -- Types
    INSERT INTO service_types (code, name, description, category_id, mode_id)
    VALUES
        ('product_listing', 'Product Listing', 'Marketplace product entry', v_cat_catalog, v_digital_mode_id),
        ('inventory_sync', 'Inventory Sync', 'Real-time stock synchronization', v_cat_catalog, v_digital_mode_id),
        ('order_fulfillment', 'Order Fulfillment', 'Pick, pack, and ship', v_cat_orders, v_digital_mode_id)
    ON CONFLICT (name) DO NOTHING;

    -------------------------------------------------------------------------
    -- 5. Seed Telecommunications Services
    -------------------------------------------------------------------------
    -- Categories
    INSERT INTO service_categories (code, name, description, domain_id, icon_name)
    VALUES 
        ('telecom_network', 'Network Services', 'Connectivity and infrastructure', v_telecom_id, 'Wifi'),
        ('telecom_support', 'Customer Support', 'Helpdesk and technical support', v_telecom_id, 'Headphones')
    ON CONFLICT (code) DO UPDATE SET domain_id = v_telecom_id;

    -- Get IDs
    SELECT id INTO v_cat_network FROM service_categories WHERE code = 'telecom_network';
    SELECT id INTO v_cat_support FROM service_categories WHERE code = 'telecom_support';

    -- Types
    INSERT INTO service_types (code, name, description, category_id, mode_id)
    VALUES
        ('fiber_internet', 'Fiber Optic Internet', 'High-speed broadband', v_cat_network, v_digital_mode_id),
        ('5g_connectivity', '5G Mobile Data', 'Next-gen mobile network', v_cat_network, v_digital_mode_id),
        ('managed_voip', 'Managed VoIP', 'Voice over IP services', v_cat_network, v_digital_mode_id),
        ('tech_support_l1', 'L1 Tech Support', 'Basic troubleshooting', v_cat_support, v_digital_mode_id)
    ON CONFLICT (name) DO NOTHING;

END $$;

-- Drop helper function
DROP FUNCTION upsert_platform_domain;

COMMIT;
