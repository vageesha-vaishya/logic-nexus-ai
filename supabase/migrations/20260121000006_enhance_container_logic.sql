-- Enhanced Container Logic Migration

-- 1. Container Transactions Table (History/Granular Tracking)
CREATE TABLE IF NOT EXISTS public.container_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
    size_id UUID REFERENCES public.container_sizes(id) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'AUDIT')),
    quantity_change INTEGER NOT NULL,
    location_name TEXT NOT NULL,
    status TEXT DEFAULT 'AVAILABLE', -- Status of containers (Empty, Loaded, etc.)
    reference_id TEXT, -- Shipment ID, Order ID, etc.
    notes TEXT,
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_container_transactions_tenant_date ON public.container_transactions(tenant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_container_transactions_size ON public.container_transactions(size_id);
CREATE INDEX IF NOT EXISTS idx_container_transactions_location ON public.container_transactions(location_name);

-- 2. Vessel Hierarchy Enhancements
-- Vessel Class Capacities (Specific limits per container size if needed, beyond just TEU)
CREATE TABLE IF NOT EXISTS public.vessel_class_capacities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.vessel_classes(id) ON DELETE CASCADE,
    container_size_id UUID REFERENCES public.container_sizes(id) ON DELETE CASCADE,
    max_slots INTEGER, -- specific limit for this container size
    weight_limit_per_slot_kg NUMERIC,
    tenant_id UUID REFERENCES public.tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE public.container_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessel_class_capacities ENABLE ROW LEVEL SECURITY;

-- Transactions Policy
CREATE POLICY "Tenant Access Transactions" ON public.container_transactions
    USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::UUID));

CREATE POLICY "Tenant Insert Transactions" ON public.container_transactions
    WITH CHECK (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::UUID));

-- Vessel Capacities Policy
CREATE POLICY "Tenant Access Vessel Capacities" ON public.vessel_class_capacities
    USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::UUID));

-- 4. Constraint for Summary Table Upsert
-- We need to ensure container_tracking allows unique identification for upserts
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'container_tracking_unique_key'
    ) THEN
        ALTER TABLE public.container_tracking 
        ADD CONSTRAINT container_tracking_unique_key UNIQUE (tenant_id, size_id, location_name, status);
    END IF;
END $$;

-- 5. Trigger to Maintain Summary (Container Tracking)
CREATE OR REPLACE FUNCTION public.update_container_inventory_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the summary table (container_tracking)
    -- We assume container_tracking tracks current counts per size, location, and status
    
    INSERT INTO public.container_tracking (
        tenant_id, 
        size_id, 
        location_name, 
        status, 
        quantity, 
        teu_total, 
        recorded_at
    )
    VALUES (
        NEW.tenant_id, 
        NEW.size_id, 
        NEW.location_name, 
        NEW.status::public.container_status, -- Cast to enum if needed, assuming status maps to container_status enum
        NEW.quantity_change,
        0, -- Will calculate TEU below or let trigger handle it if exists
        NOW()
    )
    ON CONFLICT (tenant_id, size_id, location_name, status)
    DO UPDATE SET 
        quantity = public.container_tracking.quantity + NEW.quantity_change,
        recorded_at = NOW();
        
    -- Note: TEU calculation should ideally be done via join or separate trigger, 
    -- but for simplicity we'll leave TEU update to the application or a separate recalculation
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory ON public.container_transactions;
CREATE TRIGGER trigger_update_inventory
AFTER INSERT ON public.container_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_container_inventory_summary();

-- 6. Helper Function for TEU Calculation
CREATE OR REPLACE FUNCTION public.calculate_teu(
    p_size_id UUID,
    p_quantity INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
    v_teu_factor NUMERIC;
BEGIN
    SELECT teu_factor INTO v_teu_factor
    FROM public.container_sizes
    WHERE id = p_size_id;
    
    RETURN COALESCE(v_teu_factor, 0) * p_quantity;
END;
$$ LANGUAGE plpgsql;

-- 7. View for Analytics
DROP VIEW IF EXISTS public.view_container_inventory_summary CASCADE;

CREATE OR REPLACE VIEW public.view_container_inventory_summary AS
SELECT 
    ct.id,
    ct.tenant_id,
    ct.size_id,
    ct.location_name,
    t.name as category,
    s.name as size,
    s.iso_code,
    ct.status,
    ct.quantity as total_quantity,
    (ct.quantity * COALESCE(s.teu_factor, 0)) as total_teu
FROM public.container_tracking ct
JOIN public.container_sizes s ON ct.size_id = s.id
LEFT JOIN public.container_types t ON s.type_id = t.id;

-- Grant access to view
GRANT SELECT ON public.view_container_inventory_summary TO authenticated;
GRANT SELECT ON public.view_container_inventory_summary TO service_role;
