-- Update system role flag by role name. Adjust the list as needed.
-- This targets names in public.custom_roles.role_name.
-- Extend or change to match your canonical system custom roles.
UPDATE public.custom_roles
SET is_system_role = TRUE
WHERE role_name IN (
  'Owner',
  'Admin',
  'Super Admin',
  'Platform Admin',
  'Tenant Admin',
  'Franchise Admin'
);

-- To unset for non-system roles if needed:
-- UPDATE public.custom_roles SET is_system_role = FALSE WHERE role_name NOT IN (...);