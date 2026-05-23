-- Marketing site contact-form submissions (sosservices.online + logicnexus.sosservices.online)
-- Edge function "marketing-inquiry" uses service_role to insert. RLS keeps anon out entirely.
-- Applied via MCP apply_migration on 2026-05-23.

create extension if not exists pgcrypto;

create table if not exists public.marketing_inquiries (
  id uuid primary key default gen_random_uuid(),
  source_site text not null check (char_length(source_site) <= 255),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 200),
  company text check (char_length(company) <= 200),
  role text check (char_length(role) <= 100),
  topic text check (char_length(topic) <= 100),
  message text not null check (char_length(message) between 1 and 5000),
  user_agent text check (char_length(user_agent) <= 500),
  ip_hash text check (char_length(ip_hash) <= 128),
  created_at timestamptz not null default now()
);

create index if not exists marketing_inquiries_created_at_idx
  on public.marketing_inquiries (created_at desc);

create index if not exists marketing_inquiries_source_site_idx
  on public.marketing_inquiries (source_site);

-- RLS on; no policies for anon/authenticated → only service_role (which bypasses RLS) can read/write
alter table public.marketing_inquiries enable row level security;

comment on table public.marketing_inquiries is
  'Demo/contact form submissions from sosservices.online + logicnexus.sosservices.online. Edge function "marketing-inquiry" inserts via service_role. Read via Supabase Studio.';
