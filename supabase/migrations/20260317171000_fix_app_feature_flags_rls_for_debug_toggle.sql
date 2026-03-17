begin;

alter table public.app_feature_flags enable row level security;

grant select on table public.app_feature_flags to authenticated;
grant insert, update, delete on table public.app_feature_flags to authenticated;
revoke all on table public.app_feature_flags from anon;

drop policy if exists app_feature_flags_read_authenticated on public.app_feature_flags;
drop policy if exists app_feature_flags_write_platform_admin on public.app_feature_flags;

create policy app_feature_flags_read_authenticated
on public.app_feature_flags
for select
to authenticated
using (true);

create policy app_feature_flags_write_platform_admin
on public.app_feature_flags
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

commit;
