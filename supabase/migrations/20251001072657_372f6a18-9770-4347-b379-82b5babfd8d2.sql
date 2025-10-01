-- Create function to increment user lead count
CREATE OR REPLACE FUNCTION public.increment_user_lead_count(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update user capacity
  INSERT INTO public.user_capacity (user_id, tenant_id, current_leads, last_assigned_at)
  VALUES (p_user_id, p_tenant_id, 1, NOW())
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET
    current_leads = user_capacity.current_leads + 1,
    last_assigned_at = NOW();
END;
$$;

-- Create function to decrement user lead count
CREATE OR REPLACE FUNCTION public.decrement_user_lead_count(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_capacity
  SET current_leads = GREATEST(0, current_leads - 1)
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
END;
$$;