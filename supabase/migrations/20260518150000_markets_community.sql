-- supabase/migrations/20260518150000_markets_community.sql

-- ── Add verified_creator to risk_profiles ─────────────────────────────────────
alter table markets.risk_profiles
  add column if not exists verified_creator boolean not null default false;

-- ── community_baskets ─────────────────────────────────────────────────────────
create table if not exists markets.community_baskets (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  theme           text not null,
  description     text not null default '',
  risk_level      text not null check (risk_level in ('low', 'medium', 'high')) default 'medium',
  rebalance_freq  text not null check (rebalance_freq in ('monthly', 'quarterly', 'yearly')) default 'quarterly',
  status          text not null check (status in ('draft', 'published', 'archived')) default 'draft',
  total_invested  numeric(18,2) not null default 0,
  follower_count  integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_community_baskets_updated_at on markets.community_baskets;
create trigger trg_community_baskets_updated_at
  before update on markets.community_baskets
  for each row execute function platform.set_updated_at();

alter table markets.community_baskets enable row level security;

drop policy if exists "public_read_published" on markets.community_baskets;
create policy "public_read_published" on markets.community_baskets
  for select using (status = 'published' or auth.uid() = creator_id);

drop policy if exists "creator_write" on markets.community_baskets;
create policy "creator_write" on markets.community_baskets
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

create index if not exists idx_community_baskets_published
  on markets.community_baskets (status, created_at desc) where status = 'published';

-- ── basket_holdings ───────────────────────────────────────────────────────────
create table if not exists markets.basket_holdings (
  id            uuid primary key default gen_random_uuid(),
  basket_id     uuid not null references markets.community_baskets(id) on delete cascade,
  instrument_id uuid not null references markets.instruments(id),
  weight_pct    numeric(5,2) not null check (weight_pct > 0 and weight_pct <= 100),
  created_at    timestamptz not null default now()
);

alter table markets.basket_holdings enable row level security;

drop policy if exists "public_read" on markets.basket_holdings;
create policy "public_read" on markets.basket_holdings
  for select using (true);

drop policy if exists "creator_write" on markets.basket_holdings;
create policy "creator_write" on markets.basket_holdings
  for all using (
    auth.uid() = (
      select creator_id from markets.community_baskets where id = basket_id
    )
  ) with check (
    auth.uid() = (
      select creator_id from markets.community_baskets where id = basket_id
    )
  );

create index if not exists idx_basket_holdings_basket
  on markets.basket_holdings (basket_id);

-- ── basket_user_positions ─────────────────────────────────────────────────────
create table if not exists markets.basket_user_positions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  basket_id     uuid not null references markets.community_baskets(id) on delete cascade,
  invested_amt  numeric(18,2) not null default 0,
  portfolio_id  uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, basket_id)
);

drop trigger if exists trg_basket_user_positions_updated_at on markets.basket_user_positions;
create trigger trg_basket_user_positions_updated_at
  before update on markets.basket_user_positions
  for each row execute function platform.set_updated_at();

alter table markets.basket_user_positions enable row level security;

drop policy if exists "owner_all" on markets.basket_user_positions;
create policy "owner_all" on markets.basket_user_positions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── strategy_marketplace ──────────────────────────────────────────────────────
create table if not exists markets.strategy_marketplace (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  description         text not null default '',
  asset_class         text not null,
  rule_config         jsonb not null default '{}',
  backtest_summary    jsonb not null default '{}',
  live_users          integer not null default 0,
  rating              numeric(3,2) check (rating >= 0 and rating <= 5),
  paper_required_days integer not null default 14,
  status              text not null check (status in ('draft', 'published', 'archived')) default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_strategy_marketplace_updated_at on markets.strategy_marketplace;
create trigger trg_strategy_marketplace_updated_at
  before update on markets.strategy_marketplace
  for each row execute function platform.set_updated_at();

alter table markets.strategy_marketplace enable row level security;

drop policy if exists "public_read_published" on markets.strategy_marketplace;
create policy "public_read_published" on markets.strategy_marketplace
  for select using (status = 'published' or auth.uid() = creator_id);

drop policy if exists "creator_write" on markets.strategy_marketplace;
create policy "creator_write" on markets.strategy_marketplace
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

create index if not exists idx_strategy_marketplace_published
  on markets.strategy_marketplace (status, rating desc nulls last) where status = 'published';

-- ── copy_trading_extended ─────────────────────────────────────────────────────
create table if not exists markets.copy_trading_extended (
  copy_trade_id       uuid primary key references markets.copy_trades(id) on delete cascade,
  target_tier_number  integer not null check (target_tier_number = 3) default 3,
  budget_cap          numeric(18,2),
  max_drawdown_pct    numeric(5,2) check (max_drawdown_pct > 0 and max_drawdown_pct <= 100),
  auto_unfollowed_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_copy_trading_extended_updated_at on markets.copy_trading_extended;
create trigger trg_copy_trading_extended_updated_at
  before update on markets.copy_trading_extended
  for each row execute function platform.set_updated_at();

alter table markets.copy_trading_extended enable row level security;

drop policy if exists "owner_all" on markets.copy_trading_extended;
create policy "owner_all" on markets.copy_trading_extended
  for all using (
    auth.uid() = (
      select copier_id from markets.copy_trades where id = copy_trade_id
    )
  ) with check (
    auth.uid() = (
      select copier_id from markets.copy_trades where id = copy_trade_id
    )
  );
