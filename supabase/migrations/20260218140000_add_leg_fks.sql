-- Add origin/destination ID columns and FK constraints for legs
ALTER TABLE public.quotation_version_option_legs
  ADD COLUMN IF NOT EXISTS origin_location_id uuid,
  ADD COLUMN IF NOT EXISTS destination_location_id uuid;

ALTER TABLE public.quotation_version_option_legs
  DROP CONSTRAINT IF EXISTS fk_legs_origin,
  DROP CONSTRAINT IF EXISTS fk_legs_destination;

ALTER TABLE public.quotation_version_option_legs
  ADD CONSTRAINT fk_legs_origin FOREIGN KEY (origin_location_id) REFERENCES public.ports_locations(id),
  ADD CONSTRAINT fk_legs_destination FOREIGN KEY (destination_location_id) REFERENCES public.ports_locations(id);
