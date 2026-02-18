CREATE OR REPLACE FUNCTION public.create_channel_account(
  p_tenant_id uuid,
  p_provider text,
  p_credentials jsonb,
  p_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF public.is_platform_admin(uid) OR 
     (public.has_role(uid, 'tenant_admin'::public.app_role) AND p_tenant_id = public.get_user_tenant_id(uid)) THEN
    INSERT INTO public.channel_accounts (tenant_id, provider, credentials, is_active)
    VALUES (p_tenant_id, p_provider, p_credentials, COALESCE(p_active, true))
    RETURNING id INTO new_id;
    RETURN new_id;
  ELSE
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_channel_account(uuid, text, jsonb, boolean) TO authenticated;
