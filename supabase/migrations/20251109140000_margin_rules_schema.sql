create table if not exists margin_rules (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references tenants(id) not null,
    name text not null,
    condition_json jsonb not null default '{}'::jsonb,
    adjustment_type text not null check (adjustment_type in ('percent', 'fixed')),
    adjustment_value numeric not null,
    priority int not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table margin_rules enable row level security;

create policy "Tenants can view their own margin rules"
    on margin_rules for select
    using (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "Tenants can manage their own margin rules"
    on margin_rules for all
    using (tenant_id = public.get_user_tenant_id(auth.uid()));

create index idx_margin_rules_tenant_id on margin_rules(tenant_id);
