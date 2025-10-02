-- Remove duplicate platform_admin roles (keep only the first one for each user)
DELETE FROM public.user_roles
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, role) id
  FROM public.user_roles
  ORDER BY user_id, role, assigned_at ASC
);

-- Add unique constraint to prevent duplicate role assignments
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role);