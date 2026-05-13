-- Down Migration
-- Revert rename of column assembly_models_id to model_id in work_order_templates table

-- 1. Revert index rename
ALTER INDEX IF EXISTS public.idx_work_order_templates_assembly_models_id RENAME TO idx_work_order_templates_model_id;

-- 2. Revert check constraint rename
ALTER TABLE public.work_order_templates
RENAME CONSTRAINT ck_work_order_templates_assembly_models_id_required TO ck_work_order_templates_model_id_required;

-- 3. Revert foreign key constraint rename
ALTER TABLE public.work_order_templates
RENAME CONSTRAINT fk_work_order_templates_assembly_models_id TO fk_work_order_templates_model_id;

-- 4. Revert column rename
ALTER TABLE public.work_order_templates 
RENAME COLUMN assembly_models_id TO model_id;
