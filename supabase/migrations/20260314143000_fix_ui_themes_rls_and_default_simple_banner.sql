begin;

drop policy if exists ui_themes_read_authenticated on public.ui_themes;
drop policy if exists ui_themes_user_write on public.ui_themes;
drop policy if exists ui_themes_read_scoped on public.ui_themes;
drop policy if exists ui_themes_write_scoped on public.ui_themes;

create policy ui_themes_read_scoped
on public.ui_themes
for select
to authenticated
using (
  is_active
  and (
    (scope = 'platform')
    or (scope = 'tenant' and tenant_id = public.get_user_tenant_id(auth.uid()))
    or (scope = 'franchise' and franchise_id = public.get_user_franchise_id(auth.uid()))
    or (scope = 'user' and user_id = auth.uid())
  )
);

create policy ui_themes_write_scoped
on public.ui_themes
for all
to authenticated
using (
  (scope = 'platform' and public.is_platform_admin(auth.uid()))
  or (scope = 'tenant' and public.is_tenant_admin(auth.uid()) and tenant_id = public.get_user_tenant_id(auth.uid()))
  or (scope = 'franchise' and public.is_franchise_admin(auth.uid()) and franchise_id = public.get_user_franchise_id(auth.uid()))
  or (scope = 'user' and user_id = auth.uid())
)
with check (
  (scope = 'platform' and public.is_platform_admin(auth.uid()))
  or (scope = 'tenant' and public.is_tenant_admin(auth.uid()) and tenant_id = public.get_user_tenant_id(auth.uid()))
  or (scope = 'franchise' and public.is_franchise_admin(auth.uid()) and franchise_id = public.get_user_franchise_id(auth.uid()))
  or (scope = 'user' and user_id = auth.uid())
);

update public.ui_themes
set tokens = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(tokens, '{headerBannerVisible}', to_jsonb(true), true),
        '{headerBannerContent}', to_jsonb('System notification'::text), true
      ),
      '{headerBannerColor}', to_jsonb(coalesce(tokens->>'headerBannerColor', tokens->>'accent', tokens->>'primary', '217 91% 60%')), true
    ),
    '{headerBannerTextColor}', to_jsonb(coalesce(tokens->>'headerBannerTextColor', '0 0% 100%')), true
  ),
  '{headerBannerHeight}', to_jsonb(coalesce(tokens->>'headerBannerHeight', '48px')), true
)
where lower(name) = lower('Default Simple');

commit;
