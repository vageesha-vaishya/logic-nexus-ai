-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- Lovable Cloud Database Backup
-- Generated: 2026-01-13
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchises ENABLE ROW LEVEL SECURITY;
-- (All other tables also have RLS enabled)

-- =====================================================
-- ACCOUNTS POLICIES
-- =====================================================
CREATE POLICY "Platform admins can manage all accounts" ON accounts FOR ALL USING (is_platform_admin(auth.uid()));
CREATE POLICY "Tenant admins can manage tenant accounts" ON accounts FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Franchise admins can manage franchise accounts" ON accounts FOR ALL USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));
CREATE POLICY "Users can view franchise accounts" ON accounts FOR SELECT USING (franchise_id = get_user_franchise_id(auth.uid()));
CREATE POLICY "Users can create franchise accounts" ON accounts FOR INSERT WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- =====================================================
-- LEADS POLICIES
-- =====================================================
CREATE POLICY "Platform admins can manage all leads" ON leads FOR ALL USING (is_platform_admin(auth.uid()));
CREATE POLICY "Tenant admins can manage tenant leads" ON leads FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Franchise admins can manage franchise leads" ON leads FOR ALL USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));
CREATE POLICY "Users can view assigned leads" ON leads FOR SELECT USING (owner_id = auth.uid() OR franchise_id = get_user_franchise_id(auth.uid()));

-- =====================================================
-- QUOTES POLICIES
-- =====================================================
CREATE POLICY "Platform admins can manage all quotes" ON quotes FOR ALL USING (is_platform_admin(auth.uid()));
CREATE POLICY "Tenant admins can manage tenant quotes" ON quotes FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Franchise admins can manage franchise quotes" ON quotes FOR ALL USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));
CREATE POLICY "Users can view own quotes" ON quotes FOR SELECT USING (owner_id = auth.uid() OR franchise_id = get_user_franchise_id(auth.uid()));

-- =====================================================
-- PROFILES POLICIES
-- =====================================================
CREATE POLICY "Platform admins can manage all profiles" ON profiles FOR ALL USING (is_platform_admin(auth.uid()));
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Note: This is a summary. Full policies exported via:
-- SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public';
