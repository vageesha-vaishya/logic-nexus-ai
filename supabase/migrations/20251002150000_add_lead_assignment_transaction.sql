-- Create function to handle lead assignment in a transaction
create or replace function assign_lead_with_transaction(
  p_lead_id uuid,
  p_assigned_to uuid,
  p_assignment_method text,
  p_rule_id uuid,
  p_tenant_id uuid,
  p_franchise_id uuid
) returns void as $$
begin
  -- Start transaction
  begin
    -- Update lead owner
    update leads
    set owner_id = p_assigned_to
    where id = p_lead_id;

    -- Record assignment history
    insert into lead_assignment_history (
      lead_id,
      assigned_to,
      assignment_method,
      rule_id,
      tenant_id,
      franchise_id,
      assigned_by
    ) values (
      p_lead_id,
      p_assigned_to,
      p_assignment_method,
      p_rule_id,
      p_tenant_id,
      p_franchise_id,
      null -- automated assignment
    );

    -- Update user capacity
    update user_capacity
    set 
      current_leads = current_leads + 1,
      last_assigned_at = now()
    where user_id = p_assigned_to
    and tenant_id = p_tenant_id;

    -- Commit transaction
    commit;
  exception
    when others then
      -- Rollback transaction on error
      rollback;
      raise;
  end;
end;
$$ language plpgsql;