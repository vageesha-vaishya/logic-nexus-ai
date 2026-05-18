-- ── Risk Profiles ─────────────────────────────────────────────────────────────
create table if not exists markets.risk_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  experience_level text not null check (experience_level in ('beginner','casual','self_directed')),
  risk_tag        text not null check (risk_tag in ('conservative','moderate','aggressive')),
  goals           jsonb not null default '[]',
  behavioral_flags jsonb not null default '{}',
  quiz_answers    jsonb not null default '{}',
  onboarding_complete boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_risk_profile_user unique (user_id)
);

alter table markets.risk_profiles enable row level security;

drop policy if exists "Users manage own risk profile" on markets.risk_profiles;
create policy "Users manage own risk profile"
  on markets.risk_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Portfolio Tiers ───────────────────────────────────────────────────────────
create table if not exists markets.portfolio_tiers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  tier_number     int not null check (tier_number in (1,2,3)),
  name            text not null,
  portfolio_id    uuid references markets.portfolios(id) on delete set null,
  target_amount   numeric(18,2),
  goals           jsonb not null default '[]',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_portfolio_tier unique (user_id, tier_number)
);

alter table markets.portfolio_tiers enable row level security;

drop policy if exists "Users manage own tiers" on markets.portfolio_tiers;
create policy "Users manage own tiers"
  on markets.portfolio_tiers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_portfolio_tiers_portfolio_id
  on markets.portfolio_tiers (portfolio_id);

-- Reuse platform.set_updated_at() (defined in platform_schema_bootstrap, used cross-schema)
drop trigger if exists trg_risk_profiles_updated_at on markets.risk_profiles;
create trigger trg_risk_profiles_updated_at
  before update on markets.risk_profiles
  for each row execute function platform.set_updated_at();

drop trigger if exists trg_portfolio_tiers_updated_at on markets.portfolio_tiers;
create trigger trg_portfolio_tiers_updated_at
  before update on markets.portfolio_tiers
  for each row execute function platform.set_updated_at();
