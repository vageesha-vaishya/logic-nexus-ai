-- Extend quote_option_legs with leg-specific fields required by business flow

ALTER TABLE public.quote_option_legs
  ADD COLUMN IF NOT EXISTS service_type_id uuid NULL REFERENCES public.service_types(id);

ALTER TABLE public.quote_option_legs
  ADD COLUMN IF NOT EXISTS container_type_id uuid NULL REFERENCES public.container_types(id);

ALTER TABLE public.quote_option_legs
  ADD COLUMN IF NOT EXISTS container_size_id uuid NULL REFERENCES public.container_sizes(id);

ALTER TABLE public.quote_option_legs
  ADD COLUMN IF NOT EXISTS trade_direction_id uuid NULL REFERENCES public.trade_directions(id);

ALTER TABLE public.quote_option_legs
  ADD COLUMN IF NOT EXISTS leg_currency_id uuid NULL REFERENCES public.currencies(id);

CREATE INDEX IF NOT EXISTS quote_option_legs_trade_dir_idx ON public.quote_option_legs (trade_direction_id);
CREATE INDEX IF NOT EXISTS quote_option_legs_container_idx ON public.quote_option_legs (container_type_id, container_size_id);
CREATE INDEX IF NOT EXISTS quote_option_legs_service_type_idx ON public.quote_option_legs (service_type_id);