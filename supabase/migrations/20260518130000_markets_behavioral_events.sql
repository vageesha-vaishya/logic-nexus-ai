-- Behavioral support layer: stores user behavioral events for loss-aversion alerts
-- and inline education tracking.

create table if not exists markets.behavioral_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  event_type      text not null check (event_type in (
    'yellow_alert', 'orange_alert', 'red_alert', 'cooling_off',
    'education_shown', 'panic_sell_intercepted', 'cooling_off_waited'
  )),
  severity        text not null check (severity in ('info', 'warning', 'critical')),
  metadata        jsonb not null default '{}',
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);

alter table markets.behavioral_events enable row level security;

drop policy if exists "Users manage own behavioral events" on markets.behavioral_events;
create policy "Users manage own behavioral events"
  on markets.behavioral_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Primary query: recent unacknowledged events per user
create index if not exists idx_behavioral_events_user_unacked
  on markets.behavioral_events (user_id, created_at desc)
  where acknowledged_at is null;

-- Education dedup: check if a specific education has been shown to a user
create index if not exists idx_behavioral_events_education
  on markets.behavioral_events (user_id, (metadata->>'education_id'))
  where event_type = 'education_shown';
