-- Add linked previous task done date for directive-driven task creation.
alter table public.tasks
  add column if not exists linked_previous_task_done_on date null;

comment on column public.tasks.linked_previous_task_done_on is
  'Date of previous linked task completion from flypal configured directives last_done_on.';
