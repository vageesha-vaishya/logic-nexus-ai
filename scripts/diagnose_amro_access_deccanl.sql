-- Diagnostic Query for deccanl@gmail.com AMRO Access Issue
-- Run this in your Supabase SQL Editor

-- Step 1: Find the user's profile and tenant
SELECT 
  p.id as profile_id, 
  p.email, 
  p.tenant_id,
  t.name as tenant_name,
  t.is_active as tenant_active
FROM profiles p
LEFT JOIN tenants t ON t.id = p.tenant_id
WHERE p.email = 'deccanl@gmail.com';

-- Step 2: Check user roles
SELECT 
  ur.id,
  ur.user_id,
  ur.role,
  ur.tenant_id,
  ur.franchise_id,
  ur.created_at
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE au.email = 'deccanl@gmail.com';

-- Step 3: Check tenant_domain_assignments for AMRO
SELECT 
  tda.id,
  tda.tenant_id,
  tda.domain_id,
  tda.is_active,
  tda.subscription_status,
  tda.created_at,
  pd.code as domain_code, 
  pd.name as domain_name,
  pd.is_active as domain_active
FROM tenant_domain_assignments tda
JOIN platform_domains pd ON pd.id = tda.domain_id
JOIN profiles p ON p.tenant_id = tda.tenant_id
WHERE p.email = 'deccanl@gmail.com'
  AND tda.is_active = true;

-- Step 4: Check if AMRO domain exists in platform_domains
SELECT 
  id, 
  code, 
  name, 
  is_active,
  status
FROM platform_domains 
WHERE code = 'AMRO' OR key = 'amro';

-- Step 5: Check user permissions (if custom permissions exist)
SELECT 
  ucp.id,
  ucp.user_id,
  ucp.permission,
  ucp.tenant_id
FROM user_custom_permissions ucp
JOIN auth.users au ON au.id = ucp.user_id
WHERE au.email = 'deccanl@gmail.com';

-- Step 6: If user has no AMRO domain assignment, show what's needed
-- (This will show the INSERT statement needed if missing)
SELECT 
  p.tenant_id,
  pd.id as amro_domain_id,
  format(
    'INSERT INTO tenant_domain_assignments (tenant_id, domain_id, is_active, subscription_status) VALUES (%L, %L, true, ''active'');',
    p.tenant_id,
    pd.id
  ) as fix_query
FROM profiles p
CROSS JOIN platform_domains pd
WHERE p.email = 'deccanl@gmail.com'
  AND (pd.code = 'AMRO' OR pd.key = 'amro')
  AND NOT EXISTS (
    SELECT 1 
    FROM tenant_domain_assignments tda 
    WHERE tda.tenant_id = p.tenant_id 
      AND tda.domain_id = pd.id 
      AND tda.is_active = true
  );
