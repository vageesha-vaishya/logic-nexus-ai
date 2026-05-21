-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260514124025; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Batch 2: components-parent + directives-parent cascade FK covering indexes
CREATE INDEX IF NOT EXISTS amro_work_order_materials_component_id_fk_idx ON public.amro_work_order_materials (component_id);
CREATE INDEX IF NOT EXISTS asset_health_signals_component_id_fk_idx ON public.asset_health_signals (component_id);
CREATE INDEX IF NOT EXISTS component_positions_component_id_fk_idx ON public.component_positions (component_id);
CREATE INDEX IF NOT EXISTS components_parent_component_id_fk_idx ON public.components (parent_component_id);
CREATE INDEX IF NOT EXISTS engine_parameter_history_component_id_fk_idx ON public.engine_parameter_history (component_id);
CREATE INDEX IF NOT EXISTS forecast_outputs_component_id_fk_idx ON public.forecast_outputs (component_id);
CREATE INDEX IF NOT EXISTS maintenance_events_component_id_fk_idx ON public.maintenance_events (component_id);
CREATE INDEX IF NOT EXISTS maintenance_events_duplicate_component_id_fk_idx ON public.maintenance_events_duplicate (component_id);
CREATE INDEX IF NOT EXISTS parts_inventory_component_id_fk_idx ON public.parts_inventory (component_id);
CREATE INDEX IF NOT EXISTS directive_attachment_events_directive_id_fk_idx ON public.directive_attachment_events (directive_id);
CREATE INDEX IF NOT EXISTS directive_attachments_directive_id_fk_idx ON public.directive_attachments (directive_id);
CREATE INDEX IF NOT EXISTS tasks_directive_id_fk_idx ON public.tasks (directive_id);