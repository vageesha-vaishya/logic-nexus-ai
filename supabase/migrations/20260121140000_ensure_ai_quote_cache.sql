-- Create the AI Quote Cache table if it doesn't exist
create table if not exists public.ai_quote_cache (
    id uuid default gen_random_uuid() primary key,
    request_hash text not null,
    response_payload jsonb not null,
    created_at timestamptz default now(),
    expires_at timestamptz default (now() + interval '24 hours')
);

-- Add index for cache lookup
create index if not exists idx_ai_quote_cache_hash on public.ai_quote_cache(request_hash);
create index if not exists idx_ai_quote_cache_expires on public.ai_quote_cache(expires_at);

-- Enable RLS
alter table public.ai_quote_cache enable row level security;

-- Drop policies if they exist to avoid errors
drop policy if exists "Service role can manage cache" on public.ai_quote_cache;
drop policy if exists "Authenticated users can read cache" on public.ai_quote_cache;
drop policy if exists "Authenticated users can insert cache" on public.ai_quote_cache;

-- Service role can do everything
create policy "Service role can manage cache"
    on public.ai_quote_cache
    for all
    using ( (auth.jwt() ->> 'role')::text = 'service_role' )
    with check ( (auth.jwt() ->> 'role')::text = 'service_role' );

-- Authenticated users can read valid cache entries
create policy "Authenticated users can read cache"
    on public.ai_quote_cache
    for select
    using ( expires_at > now() );

-- Authenticated users can insert cache (needed if Edge Function uses user token)
create policy "Authenticated users can insert cache"
    on public.ai_quote_cache
    for insert
    with check ( true );
