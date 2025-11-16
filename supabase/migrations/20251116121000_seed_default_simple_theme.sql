-- Seed platform-wide default theme: "Default Simple"
-- Ensures a clean, accessible light palette is the default across the app

begin;

-- Remove existing platform theme with the same name to avoid conflicts
delete from public.ui_themes
 where scope = 'platform'
   and lower(name) = lower('Default Simple');

-- Clear previous platform defaults
update public.ui_themes
   set is_default = false
 where scope = 'platform';

-- Insert the Default Simple preset as the platform default
insert into public.ui_themes (name, tokens, scope, is_default, is_active)
values (
  'Default Simple',
  '{
    "start": "220 80% 98%",
    "end": "220 70% 94%",
    "primary": "220 90% 55%",
    "accent": "200 70% 50%",
    "angle": 120,
    "radius": "0.5rem",
    "sidebarBackground": "0 0% 100%",
    "sidebarAccent": "220 15% 95%",
    "dark": false,
    "bgStart": "0 0% 100%",
    "bgEnd": "220 20% 97%",
    "bgAngle": 120,
    "tableHeaderText": "222.2 84% 4.9%",
    "tableHeaderSeparator": "220 20% 80%",
    "tableHeaderBackground": "220 50% 96%",
    "tableBackground": "0 0% 100%",
    "tableForeground": "222.2 84% 4.9%"
  }'::jsonb,
  'platform',
  true,
  true
);

commit;