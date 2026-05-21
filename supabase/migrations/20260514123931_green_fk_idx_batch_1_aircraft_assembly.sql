-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260514123931; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Batch 1: aircraft-parent + assembly_models-parent cascade FK covering indexes
CREATE INDEX IF NOT EXISTS aircraft_home_base_fk_idx ON public.aircraft (home_base);
CREATE INDEX IF NOT EXISTS aircraft_duplicate_home_base_fk_idx ON public.aircraft_duplicate (home_base);
CREATE INDEX IF NOT EXISTS amro_operational_telemetry_aircraft_id_fk_idx ON public.amro_operational_telemetry (aircraft_id);
CREATE INDEX IF NOT EXISTS asset_health_signals_aircraft_id_fk_idx ON public.asset_health_signals (aircraft_id);
CREATE INDEX IF NOT EXISTS component_positions_aircraft_id_fk_idx ON public.component_positions (aircraft_id);
CREATE INDEX IF NOT EXISTS components_aircraft_id_fk_idx ON public.components (aircraft_id);
CREATE INDEX IF NOT EXISTS forecast_outputs_aircraft_id_fk_idx ON public.forecast_outputs (aircraft_id);
CREATE INDEX IF NOT EXISTS maintenance_events_aircraft_id_fk_idx ON public.maintenance_events (aircraft_id);
CREATE INDEX IF NOT EXISTS maintenance_events_duplicate_aircraft_id_fk_idx ON public.maintenance_events_duplicate (aircraft_id);
CREATE INDEX IF NOT EXISTS schedules_aircraft_id_fk_idx ON public.schedules (aircraft_id);
CREATE INDEX IF NOT EXISTS tasks_aircraft_id_fk_idx ON public.tasks (aircraft_id);
CREATE INDEX IF NOT EXISTS aircraft_assembly_models_fk_idx ON public.aircraft (assembly_models);
CREATE INDEX IF NOT EXISTS aircraft_duplicate_assembly_models_fk_idx ON public.aircraft_duplicate (assembly_models);
CREATE INDEX IF NOT EXISTS aircraft_template_assembly_models_fk_idx ON public.aircraft_template (assembly_models);
CREATE INDEX IF NOT EXISTS task_templates_assembly_models_fk_idx ON public.task_templates (assembly_models);