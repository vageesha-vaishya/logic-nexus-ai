BEGIN;

INSERT INTO public.app_feature_flags (flag_key, is_enabled, description)
VALUES
  ('lead_workspace_enhancements_v1', false, 'Enable enhanced lead workspace UX including simplified sections and account/contact tabs'),
  ('lead_workspace_scrolling_v1', false, 'Enable sticky section headers and independent vertical scrolling on lead workspace panels')
ON CONFLICT (flag_key) DO UPDATE
SET description = EXCLUDED.description;

COMMIT;
