-- Upgrade Platform Domains Architecture
-- Upgrades existing table or creates new one to match requirements

BEGIN;

-- 1. Upgrade Platform Domains
CREATE TABLE IF NOT EXISTS platform_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT, -- Legacy support
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns
ALTER TABLE platform_domains ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE platform_domains ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE platform_domains ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('active', 'deprecated', 'beta', 'planned')) DEFAULT 'planned';
ALTER TABLE platform_domains ADD COLUMN IF NOT EXISTS deployment_target TEXT;
ALTER TABLE platform_domains ADD COLUMN IF NOT EXISTS repository_url TEXT;
ALTER TABLE platform_domains ADD COLUMN IF NOT EXISTS swagger_endpoint TEXT;

-- Migrate code -> key if key is empty
UPDATE platform_domains SET key = code WHERE key IS NULL AND code IS NOT NULL;

-- Ensure key is unique and not null (if possible, otherwise handle duplicates)
-- We'll just add the unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'platform_domains_key_key') THEN
    ALTER TABLE platform_domains ADD CONSTRAINT platform_domains_key_key UNIQUE (key);
  END IF;
END $$;


-- 2. Domain Relationships (Dependencies)
CREATE TABLE IF NOT EXISTS domain_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_domain_id UUID REFERENCES platform_domains(id) ON DELETE CASCADE,
    target_domain_id UUID REFERENCES platform_domains(id) ON DELETE CASCADE,
    relationship_type TEXT CHECK (relationship_type IN ('upstream', 'downstream', 'peer')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(source_domain_id, target_domain_id)
);

-- 3. Domain Metadata (Extended Technical Metadata)
CREATE TABLE IF NOT EXISTS domain_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES platform_domains(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, key)
);

-- 4. Domain Config (Environment-Specific Configs)
CREATE TABLE IF NOT EXISTS domain_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES platform_domains(id) ON DELETE CASCADE,
    environment TEXT NOT NULL, -- e.g., 'dev', 'prod'
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, environment)
);

-- Enable RLS
ALTER TABLE platform_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_config ENABLE ROW LEVEL SECURITY;

-- Policies (Open Read, Admin Write)
DROP POLICY IF EXISTS "Everyone can view domains" ON platform_domains;
CREATE POLICY "Everyone can view domains" ON platform_domains FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can view relationships" ON domain_relationships;
CREATE POLICY "Everyone can view relationships" ON domain_relationships FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can view metadata" ON domain_metadata;
CREATE POLICY "Everyone can view metadata" ON domain_metadata FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can view config" ON domain_config;
CREATE POLICY "Everyone can view config" ON domain_config FOR SELECT USING (true);

-- Seed Initial Data (Upsert)
-- Logistics
INSERT INTO platform_domains (key, code, name, description, owner, status, repository_url, swagger_endpoint)
VALUES (
    'logistics', 'logistics',
    'Logistics & Transport',
    'Core transportation management, quoting, and shipment tracking.',
    'Logistics Squad',
    'active',
    'https://github.com/trae/logic-nexus-ai',
    '/api/v1/logistics/openapi.json'
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    owner = EXCLUDED.owner,
    status = EXCLUDED.status;

-- Trading
INSERT INTO platform_domains (key, code, name, description, owner, status, repository_url, swagger_endpoint)
VALUES (
    'trading', 'trading',
    'Trading & Procurement',
    'Sourcing, inspection, and trade finance services.',
    'Trading Squad',
    'beta',
    'https://github.com/trae/logic-nexus-ai',
    '/api/v1/trading/openapi.json'
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    owner = EXCLUDED.owner,
    status = EXCLUDED.status;

-- Insurance
INSERT INTO platform_domains (key, code, name, description, owner, status, repository_url, swagger_endpoint)
VALUES (
    'insurance', 'insurance',
    'Insurance Services',
    'Cargo and business liability insurance management.',
    'FinTech Squad',
    'active',
    'https://github.com/trae/logic-nexus-ai',
    '/api/v1/insurance/openapi.json'
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    owner = EXCLUDED.owner,
    status = EXCLUDED.status;

-- Customs
INSERT INTO platform_domains (key, code, name, description, owner, status, repository_url, swagger_endpoint)
VALUES (
    'customs', 'customs',
    'Customs & Compliance',
    'Regulatory compliance, HTS codes, and clearance.',
    'Compliance Squad',
    'active',
    'https://github.com/trae/logic-nexus-ai',
    '/api/v1/customs/openapi.json'
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    owner = EXCLUDED.owner,
    status = EXCLUDED.status;

-- Relationships (Bootstrap)
DO $$
DECLARE
    v_logistics UUID;
    v_trading UUID;
    v_insurance UUID;
    v_customs UUID;
BEGIN
    SELECT id INTO v_logistics FROM platform_domains WHERE key = 'logistics';
    SELECT id INTO v_trading FROM platform_domains WHERE key = 'trading';
    SELECT id INTO v_insurance FROM platform_domains WHERE key = 'insurance';
    SELECT id INTO v_customs FROM platform_domains WHERE key = 'customs';

    -- Trading depends on Logistics
    IF v_trading IS NOT NULL AND v_logistics IS NOT NULL THEN
        INSERT INTO domain_relationships (source_domain_id, target_domain_id, relationship_type)
        VALUES (v_trading, v_logistics, 'downstream')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Insurance depends on Logistics
    IF v_insurance IS NOT NULL AND v_logistics IS NOT NULL THEN
        INSERT INTO domain_relationships (source_domain_id, target_domain_id, relationship_type)
        VALUES (v_insurance, v_logistics, 'downstream')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Customs depends on Logistics
    IF v_customs IS NOT NULL AND v_logistics IS NOT NULL THEN
        INSERT INTO domain_relationships (source_domain_id, target_domain_id, relationship_type)
        VALUES (v_customs, v_logistics, 'downstream')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

COMMIT;
