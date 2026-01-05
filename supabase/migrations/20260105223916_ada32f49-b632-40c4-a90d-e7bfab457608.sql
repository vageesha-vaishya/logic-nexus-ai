-- Create queues table (used by Queue Management + Lead Routing)
create table if not exists public.queues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text null,
  email text null,
  type text not null default 'holding',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create queue_members table (many-to-many between queues and users)
create table if not exists public.queue_members (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.queues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (queue_id, user_id)
);

create index if not exists idx_queues_tenant_id on public.queues(tenant_id);
create index if not exists idx_queue_members_queue_id on public.queue_members(queue_id);
create index if not exists idx_queue_members_user_id on public.queue_members(user_id);

alter table public.queues enable row level security;
alter table public.queue_members enable row level security;

-- Queues policies
create policy "Platform admins can manage all queues"
on public.queues
for all
using (is_platform_admin(auth.uid()))
with check (is_platform_admin(auth.uid()));

create policy "Tenant admins can manage tenant queues"
on public.queues
for all
using (
  has_role(auth.uid(), 'tenant_admin'::public.app_role)
  and tenant_id = get_user_tenant_id(auth.uid())
)
with check (
  has_role(auth.uid(), 'tenant_admin'::public.app_role)
  and tenant_id = get_user_tenant_id(auth.uid())
);

-- Queue members policies
create policy "Platform admins can manage all queue members"
on public.queue_members
for all
using (is_platform_admin(auth.uid()))
with check (is_platform_admin(auth.uid()));

create policy "Tenant admins can manage members of their tenant queues"
on public.queue_members
for all
using (
  has_role(auth.uid(), 'tenant_admin'::public.app_role)
  and exists (
    select 1
    from public.queues q
    where q.id = queue_members.queue_id
      and q.tenant_id = get_user_tenant_id(auth.uid())
  )
)
with check (
  has_role(auth.uid(), 'tenant_admin'::public.app_role)
  and exists (
    select 1
    from public.queues q
    where q.id = queue_members.queue_id
      and q.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Best-effort schema cache refresh signal
select pg_notify('pgrst', 'reload schema');