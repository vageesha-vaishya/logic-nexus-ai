-- Autonomous execution layer: execution rules, audit log, and per-user autonomy
-- progression tracking (paper → micro → pilot → full).

-- ─── Table 1: execution_rules ─────────────────────────────────────────────────

create table if not exists markets.execution_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  description     text not null default '',
  asset_class     text not null,
  instrument_id   uuid references markets.instruments(id),
  signal_type     text not null check (signal_type in ('buy', 'sell', 'both')),
  order_type      text not null check (order_type in ('MARKET', 'LIMIT', 'SL', 'SL-M')) default 'MARKET',
  product         text not null check (product in ('CNC', 'MIS', 'NRML')) default 'CNC',
  max_order_value numeric(18,2) not null default 10000,
  algo_id         text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_execution_rules_updated_at on markets.execution_rules;
create trigger trg_execution_rules_updated_at
  before update on markets.execution_rules
  for each row execute function platform.set_updated_at();

alter table markets.execution_rules enable row level security;

drop policy if exists "owner_all" on markets.execution_rules;
create policy "owner_all"
  on markets.execution_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_execution_rules_active on markets.execution_rules (user_id) where is_active = true;

-- ─── Table 2: execution_audit_log ─────────────────────────────────────────────

create table if not exists markets.execution_audit_log (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id),
  rule_id                 uuid references markets.execution_rules(id),
  signal_id               uuid references markets.signals(id) on delete set null,
  algo_id                 text,
  broker_order_id         text,
  instrument_id           uuid references markets.instruments(id),
  tradingsymbol           text not null,
  exchange                text not null,
  side                    text not null check (side in ('BUY', 'SELL')),
  order_type              text not null,
  quantity                integer not null,
  price                   numeric(18,4),
  trigger_price           numeric(18,4),
  order_value             numeric(18,2),
  portfolio_nav_at_order  numeric(18,2),
  phase                   text not null check (phase in ('paper', 'micro', 'pilot', 'full')),
  pre_trade_checks        jsonb not null default '{}',
  debate_summary          jsonb not null default '{}',
  status                  text not null check (status in ('submitted', 'rejected', 'error', 'paper')) default 'submitted',
  rejection_reason        text,
  kill_switch_active      boolean not null default false,
  created_at              timestamptz not null default now()
);

alter table markets.execution_audit_log enable row level security;

drop policy if exists "owner_read" on markets.execution_audit_log;
create policy "owner_read"
  on markets.execution_audit_log
  for select
  using (auth.uid() = user_id);

-- Audit records are immutable — insert only via service role, never updated or deleted
drop policy if exists "deny_insert" on markets.execution_audit_log;
create policy "deny_insert" on markets.execution_audit_log for insert with check (false);
drop policy if exists "deny_update" on markets.execution_audit_log;
create policy "deny_update" on markets.execution_audit_log for update with check (false);
drop policy if exists "deny_delete" on markets.execution_audit_log;
create policy "deny_delete" on markets.execution_audit_log for delete with check (false);

create index if not exists idx_audit_log_user_recent
  on markets.execution_audit_log (user_id, created_at desc);

create index if not exists idx_audit_log_rule on markets.execution_audit_log (rule_id);
create index if not exists idx_audit_log_instrument on markets.execution_audit_log (instrument_id);

-- ─── Table 3: autonomy_progress ───────────────────────────────────────────────

create table if not exists markets.autonomy_progress (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  current_phase      text not null check (current_phase in ('paper', 'micro', 'pilot', 'full')) default 'paper',
  paper_trades_done  integer not null default 0,
  micro_trades_done  integer not null default 0,
  kill_switch_level  text not null check (kill_switch_level in ('none', 'strategy_pause', 'all_pause', 'flatten_positions', 'revoke_api_key')) default 'none',
  kill_switch_set_at timestamptz,
  sebi_disclosures_accepted_at timestamptz,
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_autonomy_progress_updated_at on markets.autonomy_progress;
create trigger trg_autonomy_progress_updated_at
  before update on markets.autonomy_progress
  for each row execute function platform.set_updated_at();

alter table markets.autonomy_progress enable row level security;

drop policy if exists "owner_all" on markets.autonomy_progress;
create policy "owner_all"
  on markets.autonomy_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
