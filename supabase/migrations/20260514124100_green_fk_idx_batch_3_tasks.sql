-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260514124100; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Batch 3: tasks-parent cascade FK covering indexes (16 FKs across child tables, plus 2 self-references on tasks)
CREATE INDEX IF NOT EXISTS flypal_configured_directives_created_task_id_fk_idx ON flypal.flypal_configured_directives (created_task_id);
CREATE INDEX IF NOT EXISTS aircraft_maintenance_tasks_task_id_fk_idx ON public.aircraft_maintenance_tasks (task_id);
CREATE INDEX IF NOT EXISTS amro_compliance_events_task_id_fk_idx ON public.amro_compliance_events (task_id);
CREATE INDEX IF NOT EXISTS amro_inventory_work_order_links_task_id_fk_idx ON public.amro_inventory_work_order_links (task_id);
CREATE INDEX IF NOT EXISTS amro_task_dependencies_depends_on_task_id_fk_idx ON public.amro_task_dependencies (depends_on_task_id);
CREATE INDEX IF NOT EXISTS amro_task_time_logs_task_id_fk_idx ON public.amro_task_time_logs (task_id);
CREATE INDEX IF NOT EXISTS amro_work_order_compliance_records_task_id_fk_idx ON public.amro_work_order_compliance_records (task_id);
CREATE INDEX IF NOT EXISTS amro_work_order_resource_assignments_task_id_fk_idx ON public.amro_work_order_resource_assignments (task_id);
CREATE INDEX IF NOT EXISTS certification_actions_task_id_fk_idx ON public.certification_actions (task_id);
CREATE INDEX IF NOT EXISTS compliance_records_task_id_fk_idx ON public.compliance_records (task_id);
CREATE INDEX IF NOT EXISTS compliance_records_duplicate_task_id_fk_idx ON public.compliance_records_duplicate (task_id);
CREATE INDEX IF NOT EXISTS reservations_task_id_fk_idx ON public.reservations (task_id);
CREATE INDEX IF NOT EXISTS task_due_extensions_task_id_fk_idx ON public.task_due_extensions (task_id);
CREATE INDEX IF NOT EXISTS task_intervals_task_id_fk_idx ON public.task_intervals (task_id);
CREATE INDEX IF NOT EXISTS tasks_linked_previous_task_id_fk_idx ON public.tasks (linked_previous_task_id);
CREATE INDEX IF NOT EXISTS tasks_superseded_by_id_fk_idx ON public.tasks (superseded_by_id);