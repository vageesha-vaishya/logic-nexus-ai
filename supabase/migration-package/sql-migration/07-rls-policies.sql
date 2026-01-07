-- =====================================================
-- 07: ROW LEVEL SECURITY POLICIES
-- =====================================================
-- This script creates RLS policies for all tables
-- Uses security definer functions to avoid infinite recursion
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_version_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_type_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ports_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoterms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_sides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_franchise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN (
        'tenants','franchises','profiles','user_roles','user_capacity',
        'custom_roles','custom_role_permissions','user_custom_roles',
        'subscription_plans','tenant_subscriptions','usage_records',
        'accounts','contacts','leads','opportunities','opportunity_line_items',
        'activities','campaigns','quotes','quotation_versions','quotation_version_options',
        'customer_selections','shipments','tracking_events','carriers','carrier_rates',
        'services','service_types','service_type_mappings','ports_locations','incoterms',
        'cargo_types','package_categories','package_sizes','container_types','container_sizes',
        'cargo_details','consignees','warehouses','vehicles','currencies','charge_categories',
        'charge_sides','charge_bases','assignment_rules','lead_assignment_history',
        'lead_assignment_queue','territory_assignments','email_accounts','emails','email_templates',
        'quote_number_config_tenant','quote_number_config_franchise','quote_number_sequences','audit_logs'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- =====================================================
-- TENANTS POLICIES
-- =====================================================

CREATE POLICY "Platform admins can view all tenants"
  ON public.tenants FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Platform admins can insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update tenants"
  ON public.tenants FOR UPDATE
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete tenants"
  ON public.tenants FOR DELETE
  USING (public.is_platform_admin(auth.uid()));

-- =====================================================
-- FRANCHISES POLICIES
-- =====================================================

CREATE POLICY "Platform admins can view all franchises"
  ON public.franchises FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their franchises"
  ON public.franchises FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Franchise admins can view their franchise"
  ON public.franchises FOR SELECT
  USING (id = public.get_user_franchise_id(auth.uid()));

CREATE POLICY "Platform and tenant admins can insert franchises"
  ON public.franchises FOR INSERT
  WITH CHECK (
    public.is_platform_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'tenant_admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
  );

CREATE POLICY "Platform and tenant admins can update franchises"
  ON public.franchises FOR UPDATE
  USING (
    public.is_platform_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'tenant_admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
  );

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles in their scope"
  ON public.profiles FOR SELECT
  USING (
    public.is_platform_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur1
      JOIN public.user_roles ur2 ON ur1.tenant_id = ur2.tenant_id
      WHERE ur1.user_id = auth.uid()
        AND ur2.user_id = public.profiles.id
        AND ur1.role IN ('tenant_admin', 'franchise_admin')
    )
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can update profiles in their scope"
  ON public.profiles FOR UPDATE
  USING (
    public.is_platform_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur1
      JOIN public.user_roles ur2 ON ur1.tenant_id = ur2.tenant_id
      WHERE ur1.user_id = auth.uid()
        AND ur2.user_id = public.profiles.id
        AND ur1.role IN ('tenant_admin', 'franchise_admin')
    )
  );

-- =====================================================
-- USER ROLES POLICIES
-- =====================================================

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view roles in their scope"
  ON public.user_roles FOR SELECT
  USING (
    public.is_platform_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'tenant_admin') AND tenant_id = public.get_user_tenant_id(auth.uid())) OR
    (public.has_role(auth.uid(), 'franchise_admin') AND franchise_id = public.get_user_franchise_id(auth.uid()))
  );

CREATE POLICY "Platform admins can insert any role"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can insert roles in their tenant"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'tenant_admin') AND
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- =====================================================
-- CRM TABLES POLICIES (tenant-scoped)
-- =====================================================

-- ACCOUNTS
CREATE POLICY "Users can view accounts in their tenant"
  ON public.accounts FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (franchise_id = public.get_user_franchise_id(auth.uid()) OR public.has_role(auth.uid(), 'tenant_admin'))
  );

CREATE POLICY "Users can insert accounts in their tenant"
  ON public.accounts FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update accounts in their tenant"
  ON public.accounts FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete accounts"
  ON public.accounts FOR DELETE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- CONTACTS
CREATE POLICY "Users can view contacts in their tenant"
  ON public.contacts FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (franchise_id = public.get_user_franchise_id(auth.uid()) OR public.has_role(auth.uid(), 'tenant_admin'))
  );

CREATE POLICY "Users can insert contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update contacts"
  ON public.contacts FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- LEADS
CREATE POLICY "Users can view leads in their scope"
  ON public.leads FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (
      public.has_role(auth.uid(), 'tenant_admin') OR
      franchise_id = public.get_user_franchise_id(auth.uid()) OR
      owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert leads"
  ON public.leads FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Lead owners can update their leads"
  ON public.leads FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (owner_id = auth.uid() OR public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

CREATE POLICY "Admins can delete leads"
  ON public.leads FOR DELETE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- OPPORTUNITIES
CREATE POLICY "Users can view opportunities in their scope"
  ON public.opportunities FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (
      public.has_role(auth.uid(), 'tenant_admin') OR
      franchise_id = public.get_user_franchise_id(auth.uid()) OR
      owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert opportunities"
  ON public.opportunities FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Opportunity owners can update"
  ON public.opportunities FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (owner_id = auth.uid() OR public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

CREATE POLICY "Admins can delete opportunities"
  ON public.opportunities FOR DELETE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- OPPORTUNITY LINE ITEMS
CREATE POLICY "Users can view line items for their opportunities"
  ON public.opportunity_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (o.owner_id = auth.uid() OR public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
    )
  );

CREATE POLICY "Users can manage line items for their opportunities"
  ON public.opportunity_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (o.owner_id = auth.uid() OR public.has_role(auth.uid(), 'tenant_admin'))
    )
  );

-- ACTIVITIES
CREATE POLICY "Users can view activities in their scope"
  ON public.activities FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (
      public.has_role(auth.uid(), 'tenant_admin') OR
      franchise_id = public.get_user_franchise_id(auth.uid()) OR
      assigned_to = auth.uid() OR
      created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create activities"
  ON public.activities FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update their activities"
  ON public.activities FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (assigned_to = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- CAMPAIGNS
CREATE POLICY "Users can view campaigns in their tenant"
  ON public.campaigns FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage campaigns"
  ON public.campaigns FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- =====================================================
-- QUOTES AND SHIPMENTS POLICIES
-- =====================================================

-- QUOTES
CREATE POLICY "Users can view quotes in their scope"
  ON public.quotes FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (
      public.has_role(auth.uid(), 'tenant_admin') OR
      franchise_id = public.get_user_franchise_id(auth.uid()) OR
      created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create quotes"
  ON public.quotes FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update their quotes"
  ON public.quotes FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (created_by = auth.uid() OR public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- QUOTATION VERSIONS
CREATE POLICY "Users can view quote versions"
  ON public.quotation_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id
        AND q.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Users can manage quote versions"
  ON public.quotation_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id
        AND q.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- QUOTATION VERSION OPTIONS
CREATE POLICY "Users can view quote options"
  ON public.quotation_version_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotation_versions qv
      JOIN public.quotes q ON q.id = qv.quote_id
      WHERE qv.id = quotation_version_id
        AND q.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Users can manage quote options"
  ON public.quotation_version_options FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quotation_versions qv
      JOIN public.quotes q ON q.id = qv.quote_id
      WHERE qv.id = quotation_version_id
        AND q.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- SHIPMENTS
CREATE POLICY "Users can view shipments in their scope"
  ON public.shipments FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (
      public.has_role(auth.uid(), 'tenant_admin') OR
      franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Users can create shipments"
  ON public.shipments FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update shipments"
  ON public.shipments FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- TRACKING EVENTS
CREATE POLICY "Users can view tracking for their shipments"
  ON public.tracking_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shipments s
      WHERE s.id = shipment_id
        AND s.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Users can add tracking events"
  ON public.tracking_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shipments s
      WHERE s.id = shipment_id
        AND s.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- =====================================================
-- MASTER DATA POLICIES (tenant-scoped or global)
-- =====================================================

-- CARRIERS (tenant-scoped)
CREATE POLICY "Users can view carriers in their tenant"
  ON public.carriers FOR SELECT
  USING (
    tenant_id IS NULL OR
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Admins can manage carriers"
  ON public.carriers FOR ALL
  USING (
    public.is_platform_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'tenant_admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
  );

-- SERVICES (tenant-scoped)
CREATE POLICY "Users can view services"
  ON public.services FOR SELECT
  USING (
    tenant_id IS NULL OR
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Admins can manage services"
  ON public.services FOR ALL
  USING (
    public.is_platform_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'tenant_admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
  );

-- GLOBAL MASTER DATA (read-only for users, writable by platform admins)
CREATE POLICY "Anyone can view global master data"
  ON public.service_types FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage service types"
  ON public.service_types FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view ports"
  ON public.ports_locations FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage ports"
  ON public.ports_locations FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view incoterms"
  ON public.incoterms FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage incoterms"
  ON public.incoterms FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view cargo types"
  ON public.cargo_types FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage cargo types"
  ON public.cargo_types FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view package categories"
  ON public.package_categories FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage package categories"
  ON public.package_categories FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view package sizes"
  ON public.package_sizes FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage package sizes"
  ON public.package_sizes FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view container types"
  ON public.container_types FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage container types"
  ON public.container_types FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view container sizes"
  ON public.container_sizes FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage container sizes"
  ON public.container_sizes FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view currencies"
  ON public.currencies FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage currencies"
  ON public.currencies FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view charge categories"
  ON public.charge_categories FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage charge categories"
  ON public.charge_categories FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view charge sides"
  ON public.charge_sides FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage charge sides"
  ON public.charge_sides FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can view charge bases"
  ON public.charge_bases FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage charge bases"
  ON public.charge_bases FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- =====================================================
-- TENANT-SPECIFIC MASTER DATA POLICIES
-- =====================================================

-- WAREHOUSES
CREATE POLICY "Users can view warehouses in their tenant"
  ON public.warehouses FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage warehouses"
  ON public.warehouses FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- VEHICLES
CREATE POLICY "Users can view vehicles in their tenant"
  ON public.vehicles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage vehicles"
  ON public.vehicles FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- CONSIGNEES
CREATE POLICY "Users can view consignees in their tenant"
  ON public.consignees FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can manage consignees"
  ON public.consignees FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- CARGO DETAILS
CREATE POLICY "Users can view cargo details in their tenant"
  ON public.cargo_details FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can manage cargo details"
  ON public.cargo_details FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- =====================================================
-- ASSIGNMENT SYSTEM POLICIES
-- =====================================================

CREATE POLICY "Users can view assignment rules in their tenant"
  ON public.assignment_rules FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage assignment rules"
  ON public.assignment_rules FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

CREATE POLICY "Users can view assignment history in their scope"
  ON public.lead_assignment_history FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (
      public.has_role(auth.uid(), 'tenant_admin') OR
      assigned_to = auth.uid() OR
      assigned_from = auth.uid()
    )
  );

CREATE POLICY "System can insert assignment history"
  ON public.lead_assignment_history FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view assignment queue"
  ON public.lead_assignment_queue FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "System can manage assignment queue"
  ON public.lead_assignment_queue FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view their capacity"
  ON public.user_capacity FOR SELECT
  USING (
    user_id = auth.uid() OR
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin'))
  );

CREATE POLICY "Admins can manage user capacity"
  ON public.user_capacity FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

CREATE POLICY "Users can view territories in their tenant"
  ON public.territory_assignments FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage territories"
  ON public.territory_assignments FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- =====================================================
-- EMAIL SYSTEM POLICIES
-- =====================================================

CREATE POLICY "Users can view their email accounts"
  ON public.email_accounts FOR SELECT
  USING (
    user_id = auth.uid() OR
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin'))
  );

CREATE POLICY "Users can manage their email accounts"
  ON public.email_accounts FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view emails in their scope"
  ON public.emails FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (
      public.has_role(auth.uid(), 'tenant_admin') OR
      EXISTS (
        SELECT 1 FROM public.email_accounts ea
        WHERE ea.id = account_id AND ea.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert emails"
  ON public.emails FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view email templates in their tenant"
  ON public.email_templates FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage email templates"
  ON public.email_templates FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'franchise_admin'))
  );

-- =====================================================
-- SUBSCRIPTION AND CONFIGURATION POLICIES
-- =====================================================

CREATE POLICY "Anyone can view subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage plans"
  ON public.subscription_plans FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their subscriptions"
  ON public.tenant_subscriptions FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    public.has_role(auth.uid(), 'tenant_admin')
  );

CREATE POLICY "Platform admins can manage subscriptions"
  ON public.tenant_subscriptions FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their usage"
  ON public.usage_records FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    public.has_role(auth.uid(), 'tenant_admin')
  );

CREATE POLICY "Tenant admins can view their quote number config"
  ON public.quote_number_config_tenant FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can manage their quote number config"
  ON public.quote_number_config_tenant FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin'));

CREATE POLICY "Franchise admins can view their quote number config"
  ON public.quote_number_config_franchise FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    franchise_id = public.get_user_franchise_id(auth.uid())
  );

CREATE POLICY "Franchise admins can manage their quote number config"
  ON public.quote_number_config_franchise FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    franchise_id = public.get_user_franchise_id(auth.uid()) AND
    public.has_role(auth.uid(), 'franchise_admin')
  );

-- =====================================================
-- CUSTOM ROLES POLICIES
-- =====================================================

CREATE POLICY "Users can view custom roles in their tenant"
  ON public.custom_roles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can manage custom roles"
  ON public.custom_roles FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    public.has_role(auth.uid(), 'tenant_admin')
  );

CREATE POLICY "Users can view custom role permissions"
  ON public.custom_role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_roles cr
      WHERE cr.id = role_id
        AND cr.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Tenant admins can manage custom role permissions"
  ON public.custom_role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_roles cr
      WHERE cr.id = role_id
        AND cr.tenant_id = public.get_user_tenant_id(auth.uid())
        AND public.has_role(auth.uid(), 'tenant_admin')
    )
  );

CREATE POLICY "Users can view their custom roles"
  ON public.user_custom_roles FOR SELECT
  USING (
    user_id = auth.uid() OR
    (
      EXISTS (
        SELECT 1 FROM public.custom_roles cr
        WHERE cr.id = role_id
          AND cr.tenant_id = public.get_user_tenant_id(auth.uid())
          AND public.has_role(auth.uid(), 'tenant_admin')
      )
    )
  );

CREATE POLICY "Tenant admins can manage user custom roles"
  ON public.user_custom_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_roles cr
      WHERE cr.id = role_id
        AND cr.tenant_id = public.get_user_tenant_id(auth.uid())
        AND public.has_role(auth.uid(), 'tenant_admin')
    )
  );

-- =====================================================
-- AUDIT LOGS POLICIES
-- =====================================================

CREATE POLICY "Admins can view audit logs in their scope"
  ON public.audit_logs FOR SELECT
  USING (
    public.is_platform_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = audit_logs.user_id
        AND ur.tenant_id = public.get_user_tenant_id(auth.uid())
        AND public.has_role(auth.uid(), 'tenant_admin')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- CARRIER RATES AND SERVICE TYPE MAPPINGS
-- =====================================================

CREATE POLICY "Users can view carrier rates"
  ON public.carrier_rates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.carriers c
      WHERE c.id = carrier_id
        AND (c.tenant_id IS NULL OR c.tenant_id = public.get_user_tenant_id(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage carrier rates"
  ON public.carrier_rates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.carriers c
      WHERE c.id = carrier_id
        AND (
          public.is_platform_admin(auth.uid()) OR
          (c.tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin'))
        )
    )
  );

CREATE POLICY "Anyone can view service type mappings"
  ON public.service_type_mappings FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage service type mappings"
  ON public.service_type_mappings FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can view customer selections"
  ON public.customer_selections FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id
        AND (q.created_by = auth.uid() OR public.has_role(auth.uid(), 'tenant_admin'))
    )
  );

CREATE POLICY "Users can insert customer selections"
  ON public.customer_selections FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can view quote number sequences"
  ON public.quote_number_sequences FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (franchise_id = public.get_user_franchise_id(auth.uid()) OR public.has_role(auth.uid(), 'tenant_admin'))
  );

-- =====================================================
-- END OF RLS POLICIES
-- =====================================================
