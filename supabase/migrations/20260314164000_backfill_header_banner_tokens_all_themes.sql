begin;

update public.ui_themes
set tokens = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          tokens,
          '{headerBannerVisible}',
          case
            when jsonb_typeof(tokens->'headerBannerVisible') = 'boolean' then tokens->'headerBannerVisible'
            when lower(name) = lower('Default Simple') then to_jsonb(true)
            else to_jsonb(false)
          end,
          true
        ),
        '{headerBannerContent}',
        to_jsonb(
          coalesce(
            nullif(tokens->>'headerBannerContent', ''),
            case when lower(name) = lower('Default Simple') then 'System notification' else '' end
          )
        ),
        true
      ),
      '{headerBannerColor}',
      to_jsonb(
        coalesce(
          nullif(tokens->>'headerBannerColor', ''),
          nullif(tokens->>'stripColor', ''),
          nullif(tokens->>'accent', ''),
          nullif(tokens->>'primary', ''),
          '217 91% 60%'
        )
      ),
      true
    ),
    '{headerBannerTextColor}',
    to_jsonb(
      coalesce(
        nullif(tokens->>'headerBannerTextColor', ''),
        '0 0% 100%'
      )
    ),
    true
  ),
  '{headerBannerHeight}',
  to_jsonb(
    coalesce(
      nullif(tokens->>'headerBannerHeight', ''),
      '48px'
    )
  ),
  true
)
where tokens is not null;

commit;
