-- DB-VERIFICATION: verified-2026-03-24-amro-15.2A.2
-- DB-ARCH-APPROVAL: approved-2026-03-24-amro-arch-board

create schema if not exists amro_audit;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'amro_audit' and t.typname = 'workflow_tx_status') then
    create type amro_audit.workflow_tx_status as enum ('STARTED', 'SUCCESS', 'FAILED');
  end if;
end
$$;

create table if not exists amro_audit.amro_workflow_tx_log (
  tx_id text primary key,
  transition_id text not null,
  gate_name text not null,
  input_payload text not null,
  output_payload text not null,
  tx_timestamp timestamp(6) without time zone not null default now(),
  user_ctx jsonb not null default '{}'::jsonb,
  tx_status amro_audit.workflow_tx_status not null
);

create index if not exists idx_amro_workflow_tx_log_transition_timestamp
  on amro_audit.amro_workflow_tx_log (transition_id, tx_timestamp desc);

create or replace function amro_audit.reject_workflow_tx_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'amro_workflow_tx_log is immutable';
end;
$$;

drop trigger if exists trg_amro_workflow_tx_log_immutable on amro_audit.amro_workflow_tx_log;

create trigger trg_amro_workflow_tx_log_immutable
before update or delete on amro_audit.amro_workflow_tx_log
for each row
execute function amro_audit.reject_workflow_tx_log_mutation();
