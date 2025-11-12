-- Create enums for logistics
DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'shipment_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.shipment_status AS ENUM ('draft','confirmed','in_transit','customs','out_for_delivery','delivered','cancelled','on_hold','returned');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['draft','confirmed','in_transit','customs','out_for_delivery','delivered','cancelled','on_hold','returned'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'shipment_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.shipment_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'shipment_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.shipment_type AS ENUM ('ocean_freight','air_freight','inland_trucking','railway_transport','courier','movers_packers');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['ocean_freight','air_freight','inland_trucking','railway_transport','courier','movers_packers'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'shipment_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.shipment_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'container_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.container_type AS ENUM ('20ft_standard','40ft_standard','40ft_high_cube','45ft_high_cube','reefer','open_top','flat_rack','tank');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['20ft_standard','40ft_standard','40ft_high_cube','45ft_high_cube','reefer','open_top','flat_rack','tank'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'container_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.container_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'vehicle_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.vehicle_status AS ENUM ('available','in_use','maintenance','out_of_service');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['available','in_use','maintenance','out_of_service'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'vehicle_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.vehicle_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'tracking_event_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.tracking_event_type AS ENUM ('created','confirmed','picked_up','in_transit','customs_clearance','customs_released','arrived_at_hub','out_for_delivery','delivered','delayed','exception','returned');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['created','confirmed','picked_up','in_transit','customs_clearance','customs_released','arrived_at_hub','out_for_delivery','delivered','delayed','exception','returned'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'tracking_event_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.tracking_event_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

-- Warehouses table
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  warehouse_type TEXT,
  address JSONB DEFAULT '{}'::jsonb,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  capacity_sqft NUMERIC,
  current_utilization NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  operating_hours JSONB DEFAULT '{}'::jsonb,
  facilities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  capacity_kg NUMERIC,
  capacity_cbm NUMERIC,
  status vehicle_status DEFAULT 'available',
  current_location JSONB,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  insurance_expiry DATE,
  registration_expiry DATE,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, vehicle_number)
);

-- Shipments table
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  shipment_number TEXT NOT NULL,
  shipment_type shipment_type NOT NULL,
  status shipment_status DEFAULT 'draft',
  
  -- Customer references
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  -- Origin and destination
  origin_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  destination_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  origin_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  destination_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  
  -- Dates
  pickup_date TIMESTAMPTZ,
  estimated_delivery_date TIMESTAMPTZ,
  actual_delivery_date TIMESTAMPTZ,
  
  -- Cargo details
  total_weight_kg NUMERIC,
  total_volume_cbm NUMERIC,
  total_packages INTEGER DEFAULT 0,
  container_type container_type,
  container_number TEXT,
  
  -- Financial
  declared_value NUMERIC,
  freight_charges NUMERIC,
  insurance_charges NUMERIC,
  customs_charges NUMERIC,
  other_charges NUMERIC,
  total_charges NUMERIC,
  currency TEXT DEFAULT 'USD',
  
  -- Tracking
  current_location JSONB,
  current_status_description TEXT,
  
  -- Additional info
  service_level TEXT,
  priority_level TEXT DEFAULT 'normal',
  special_instructions TEXT,
  customs_required BOOLEAN DEFAULT false,
  insurance_required BOOLEAN DEFAULT false,
  
  -- References
  reference_number TEXT,
  purchase_order_number TEXT,
  invoice_number TEXT,
  
  -- Assignments
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, shipment_number)
);

-- Shipment items table
CREATE TABLE public.shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  dimensions JSONB,
  package_type TEXT,
  hs_code TEXT,
  value NUMERIC,
  currency TEXT DEFAULT 'USD',
  is_hazardous BOOLEAN DEFAULT false,
  hazard_class TEXT,
  special_handling TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tracking events table
CREATE TABLE public.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  event_type tracking_event_type NOT NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  location JSONB,
  location_name TEXT,
  description TEXT,
  notes TEXT,
  is_milestone BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Routes table
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  route_name TEXT NOT NULL,
  route_code TEXT NOT NULL,
  origin_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  destination_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  waypoints JSONB DEFAULT '[]'::jsonb,
  distance_km NUMERIC,
  estimated_duration_hours NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, route_code)
);

-- Shipping rates table
CREATE TABLE public.shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shipment_type shipment_type NOT NULL,
  service_level TEXT,
  origin_country TEXT,
  destination_country TEXT,
  origin_zone TEXT,
  destination_zone TEXT,
  min_weight_kg NUMERIC,
  max_weight_kg NUMERIC,
  rate_per_kg NUMERIC,
  base_rate NUMERIC,
  currency TEXT DEFAULT 'USD',
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customs documents table
CREATE TABLE public.customs_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  issuing_authority TEXT,
  document_url TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Warehouse inventory table
CREATE TABLE public.warehouse_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  item_description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  location_in_warehouse TEXT,
  received_date TIMESTAMPTZ DEFAULT now(),
  expected_dispatch_date TIMESTAMPTZ,
  status TEXT DEFAULT 'stored',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_shipments_tenant ON public.shipments(tenant_id);
CREATE INDEX idx_shipments_franchise ON public.shipments(franchise_id);
CREATE INDEX idx_shipments_status ON public.shipments(status);
CREATE INDEX idx_shipments_shipment_number ON public.shipments(shipment_number);
CREATE INDEX idx_shipments_account ON public.shipments(account_id);
CREATE INDEX idx_tracking_events_shipment ON public.tracking_events(shipment_id);
CREATE INDEX idx_tracking_events_date ON public.tracking_events(event_date);
CREATE INDEX idx_vehicles_tenant ON public.vehicles(tenant_id);
CREATE INDEX idx_warehouses_tenant ON public.warehouses(tenant_id);

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for warehouses
CREATE POLICY "Platform admins can manage all warehouses"
  ON public.warehouses FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant warehouses"
  ON public.warehouses FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Franchise users can view franchise warehouses"
  ON public.warehouses FOR SELECT
  USING (franchise_id = get_user_franchise_id(auth.uid()));

-- RLS Policies for vehicles
CREATE POLICY "Platform admins can manage all vehicles"
  ON public.vehicles FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant vehicles"
  ON public.vehicles FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Franchise users can view franchise vehicles"
  ON public.vehicles FOR SELECT
  USING (franchise_id = get_user_franchise_id(auth.uid()));

-- RLS Policies for shipments
CREATE POLICY "Platform admins can manage all shipments"
  ON public.shipments FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant shipments"
  ON public.shipments FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Franchise admins can manage franchise shipments"
  ON public.shipments FOR ALL
  USING (has_role(auth.uid(), 'franchise_admin'::app_role) AND franchise_id = get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can view assigned shipments"
  ON public.shipments FOR SELECT
  USING (assigned_to = auth.uid() OR franchise_id = get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can create franchise shipments"
  ON public.shipments FOR INSERT
  WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- RLS Policies for shipment items
CREATE POLICY "Platform admins can manage all shipment items"
  ON public.shipment_items FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can manage items for accessible shipments"
  ON public.shipment_items FOR ALL
  USING (shipment_id IN (
    SELECT id FROM public.shipments 
    WHERE franchise_id = get_user_franchise_id(auth.uid()) 
    OR assigned_to = auth.uid()
  ));

-- RLS Policies for tracking events
CREATE POLICY "Platform admins can manage all tracking events"
  ON public.tracking_events FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view tracking for accessible shipments"
  ON public.tracking_events FOR SELECT
  USING (shipment_id IN (
    SELECT id FROM public.shipments 
    WHERE franchise_id = get_user_franchise_id(auth.uid()) 
    OR assigned_to = auth.uid()
  ));

CREATE POLICY "Users can create tracking events for accessible shipments"
  ON public.tracking_events FOR INSERT
  WITH CHECK (shipment_id IN (
    SELECT id FROM public.shipments 
    WHERE franchise_id = get_user_franchise_id(auth.uid()) 
    OR assigned_to = auth.uid()
  ));

-- RLS Policies for routes
CREATE POLICY "Platform admins can manage all routes"
  ON public.routes FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant routes"
  ON public.routes FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant routes"
  ON public.routes FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for shipping rates
CREATE POLICY "Platform admins can manage all shipping rates"
  ON public.shipping_rates FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant shipping rates"
  ON public.shipping_rates FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant shipping rates"
  ON public.shipping_rates FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for customs documents
CREATE POLICY "Platform admins can manage all customs documents"
  ON public.customs_documents FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can manage customs documents for accessible shipments"
  ON public.customs_documents FOR ALL
  USING (shipment_id IN (
    SELECT id FROM public.shipments 
    WHERE franchise_id = get_user_franchise_id(auth.uid()) 
    OR assigned_to = auth.uid()
  ));

-- RLS Policies for warehouse inventory
CREATE POLICY "Platform admins can manage all warehouse inventory"
  ON public.warehouse_inventory FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant warehouse inventory"
  ON public.warehouse_inventory FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND 
    warehouse_id IN (SELECT id FROM public.warehouses WHERE tenant_id = get_user_tenant_id(auth.uid())));

CREATE POLICY "Users can view franchise warehouse inventory"
  ON public.warehouse_inventory FOR SELECT
  USING (warehouse_id IN (SELECT id FROM public.warehouses WHERE franchise_id = get_user_franchise_id(auth.uid())));

-- Triggers for updated_at
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipment_items_updated_at BEFORE UPDATE ON public.shipment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_rates_updated_at BEFORE UPDATE ON public.shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customs_documents_updated_at BEFORE UPDATE ON public.customs_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_warehouse_inventory_updated_at BEFORE UPDATE ON public.warehouse_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();