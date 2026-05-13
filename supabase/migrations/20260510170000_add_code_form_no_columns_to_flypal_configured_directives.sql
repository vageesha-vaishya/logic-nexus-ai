begin;

alter table if exists flypal.flypal_configured_directives
  add column if not exists code_form_no text,
  add column if not exists code_form_no_description text;

comment on column flypal.flypal_configured_directives.code_form_no is
  'Directive code/form number captured from source.';

comment on column flypal.flypal_configured_directives.code_form_no_description is
  'Directive code/form description captured from source.';

commit;
