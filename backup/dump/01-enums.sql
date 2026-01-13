-- =====================================================
-- ENUM TYPES
-- Lovable Cloud Database Backup
-- Generated: 2026-01-13
-- =====================================================

-- Drop existing enums if they exist (uncomment if needed)
-- DROP TYPE IF EXISTS account_status CASCADE;
-- DROP TYPE IF EXISTS account_type CASCADE;
-- etc.

-- Account Status
CREATE TYPE account_status AS ENUM ('active', 'inactive', 'pending');

-- Account Type
CREATE TYPE account_type AS ENUM ('prospect', 'customer', 'partner', 'vendor');

-- Activity Status
CREATE TYPE activity_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');

-- Activity Type
CREATE TYPE activity_type AS ENUM ('call', 'email', 'meeting', 'task', 'note');

-- App Role
CREATE TYPE app_role AS ENUM ('platform_admin', 'tenant_admin', 'franchise_admin', 'user', 'sales_manager', 'viewer');

-- Billing Period
CREATE TYPE billing_period AS ENUM ('monthly', 'annual');

-- Container Type
CREATE TYPE container_type AS ENUM ('20ft_standard', '40ft_standard', '40ft_high_cube', '45ft_high_cube', 'reefer', 'open_top', 'flat_rack', 'tank');

-- Lead Source
CREATE TYPE lead_source AS ENUM ('website', 'referral', 'email', 'phone', 'social', 'event', 'other');

-- Lead Status
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'converted');

-- Opportunity Stage
CREATE TYPE opportunity_stage AS ENUM ('prospecting', 'qualification', 'needs_analysis', 'value_proposition', 'proposal', 'negotiation', 'closed_won', 'closed_lost');

-- Plan Type
CREATE TYPE plan_type AS ENUM ('crm_base', 'service_addon', 'bundle');

-- Priority Level
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');

-- Quote Reset Policy
CREATE TYPE quote_reset_policy AS ENUM ('none', 'daily', 'monthly', 'yearly');

-- Shipment Status
CREATE TYPE shipment_status AS ENUM ('draft', 'confirmed', 'in_transit', 'customs', 'out_for_delivery', 'delivered', 'cancelled', 'on_hold', 'returned');

-- Shipment Type
CREATE TYPE shipment_type AS ENUM ('ocean_freight', 'air_freight', 'inland_trucking', 'railway_transport', 'courier', 'movers_packers');

-- Subscription Status
CREATE TYPE subscription_status AS ENUM ('active', 'trial', 'past_due', 'canceled', 'expired');

-- Subscription Tier
CREATE TYPE subscription_tier AS ENUM ('starter', 'professional', 'business', 'enterprise');

-- Tracking Event Type
CREATE TYPE tracking_event_type AS ENUM ('created', 'confirmed', 'picked_up', 'in_transit', 'customs_clearance', 'customs_released', 'arrived_at_hub', 'out_for_delivery', 'delivered', 'delayed', 'exception', 'returned');

-- Transfer Entity Type
CREATE TYPE transfer_entity_type AS ENUM ('lead', 'opportunity', 'quote', 'shipment', 'account', 'contact', 'activity');

-- Transfer Status
CREATE TYPE transfer_status AS ENUM ('pending', 'approved', 'rejected', 'completed', 'failed');

-- Transfer Type
CREATE TYPE transfer_type AS ENUM ('tenant_to_tenant', 'tenant_to_franchise', 'franchise_to_franchise');

-- Vehicle Status
CREATE TYPE vehicle_status AS ENUM ('available', 'in_use', 'maintenance', 'out_of_service');
