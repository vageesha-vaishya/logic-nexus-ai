-- Drop tenant_id from ports_locations to enforce global status

-- Drop policies dependent on tenant_id
DROP POLICY IF EXISTS "Tenant admins can manage ports" ON public.ports_locations;
DROP POLICY IF EXISTS "Users can view tenant ports" ON public.ports_locations;

ALTER TABLE "public"."ports_locations" DROP COLUMN IF EXISTS "tenant_id";
