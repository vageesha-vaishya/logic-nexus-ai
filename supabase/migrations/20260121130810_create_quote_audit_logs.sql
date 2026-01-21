create table if not exists public.quote_audit_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id),
    action text not null,
    payload jsonb,
    result_summary jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz default now()
);

-- RLS
alter table public.quote_audit_logs enable row level security;

-- Drop policies if they exist to avoid errors on re-run
drop policy if exists "Admins can view all audit logs" on public.quote_audit_logs;
drop policy if exists "Users can view their own audit logs" on public.quote_audit_logs;
drop policy if exists "Service role can insert logs" on public.quote_audit_logs;

-- Admins can view all
create policy "Admins can view all audit logs"
    on public.quote_audit_logs
    for select
    using ( 
        (auth.jwt() ->> 'role')::text = 'service_role' 
        or 
        exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
            and ur.role = 'platform_admin'
        )
    );

-- Users can view their own
create policy "Users can view their own audit logs"
    on public.quote_audit_logs
    for select
    using ( auth.uid() = user_id );

-- Service role can insert (and authenticated users for now, controlled by app logic)
create policy "Service role can insert logs"
    on public.quote_audit_logs
    for insert
    with check ( true );
