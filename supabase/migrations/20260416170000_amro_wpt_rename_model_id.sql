-- Up Migration
-- Rename column model_id to assembly_models_id in work_package_templates table

-- 1. Rename the column
ALTER TABLE public.work_package_templates 
RENAME COLUMN model_id TO assembly_models_id;

-- 2. Rename the foreign key constraint
ALTER TABLE public.work_package_templates
RENAME CONSTRAINT fk_work_package_templates_model_id TO fk_work_package_templates_assembly_models_id;

-- 3. Rename the check constraint
ALTER TABLE public.work_package_templates
RENAME CONSTRAINT ck_work_package_templates_model_id_required TO ck_work_package_templates_assembly_models_id_required;

-- 4. Rename the index
ALTER INDEX IF EXISTS public.idx_work_package_templates_model_id RENAME TO idx_work_package_templates_assembly_models_id;
