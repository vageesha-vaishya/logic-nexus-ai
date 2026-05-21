-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260514124133; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Batch 4: work_orders-parent + work_order_templates-parent cascade FK covering indexes
CREATE INDEX IF NOT EXISTS work_orders_work_order_template_id_fk_idx ON public.work_orders (work_order_template_id);
CREATE INDEX IF NOT EXISTS work_package_template_task_templates_wot_id_fk_idx ON public.work_package_template_task_templates (work_order_template_id);
CREATE INDEX IF NOT EXISTS amro_certificates_release_service_work_package_id_fk_idx ON public.amro_certificates_release_service (work_package_id);
CREATE INDEX IF NOT EXISTS amro_compliance_events_work_package_id_fk_idx ON public.amro_compliance_events (work_package_id);
CREATE INDEX IF NOT EXISTS amro_emergency_work_packages_work_package_id_fk_idx ON public.amro_emergency_work_packages (work_package_id);
CREATE INDEX IF NOT EXISTS amro_operational_telemetry_work_package_id_fk_idx ON public.amro_operational_telemetry (work_package_id);
CREATE INDEX IF NOT EXISTS amro_tool_reservations_work_package_id_fk_idx ON public.amro_tool_reservations (work_package_id);
CREATE INDEX IF NOT EXISTS amro_work_order_compliance_records_work_order_id_fk_idx ON public.amro_work_order_compliance_records (work_order_id);
CREATE INDEX IF NOT EXISTS amro_work_order_materials_work_order_id_fk_idx ON public.amro_work_order_materials (work_order_id);
CREATE INDEX IF NOT EXISTS amro_work_order_resource_assignments_work_order_id_fk_idx ON public.amro_work_order_resource_assignments (work_order_id);
CREATE INDEX IF NOT EXISTS certification_actions_work_package_id_fk_idx ON public.certification_actions (work_package_id);
CREATE INDEX IF NOT EXISTS compliance_obligations_work_package_id_fk_idx ON public.compliance_obligations (work_package_id);
CREATE INDEX IF NOT EXISTS component_positions_installation_work_package_id_fk_idx ON public.component_positions (installation_work_package_id);
CREATE INDEX IF NOT EXISTS component_positions_removal_work_package_id_fk_idx ON public.component_positions (removal_work_package_id);
CREATE INDEX IF NOT EXISTS components_work_package_id_fk_idx ON public.components (work_package_id);
CREATE INDEX IF NOT EXISTS maintenance_events_work_package_id_fk_idx ON public.maintenance_events (work_package_id);
CREATE INDEX IF NOT EXISTS maintenance_events_duplicate_work_package_id_fk_idx ON public.maintenance_events_duplicate (work_package_id);
CREATE INDEX IF NOT EXISTS reservations_work_package_id_fk_idx ON public.reservations (work_package_id);