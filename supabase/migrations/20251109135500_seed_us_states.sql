-- Seed all USA states (including District of Columbia) into public.states

BEGIN;

DO $$
DECLARE
  v_us uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'US');
BEGIN
  IF v_us IS NULL THEN
    RAISE NOTICE 'United States (US) not found in public.countries; skipping states seed.';
    RETURN;
  END IF;

  WITH vals(name, code_iso) AS (
    VALUES
      ('Alabama','AL'),('Alaska','AK'),('Arizona','AZ'),('Arkansas','AR'),('California','CA'),('Colorado','CO'),
      ('Connecticut','CT'),('Delaware','DE'),('Florida','FL'),('Georgia','GA'),('Hawaii','HI'),('Idaho','ID'),
      ('Illinois','IL'),('Indiana','IN'),('Iowa','IA'),('Kansas','KS'),('Kentucky','KY'),('Louisiana','LA'),
      ('Maine','ME'),('Maryland','MD'),('Massachusetts','MA'),('Michigan','MI'),('Minnesota','MN'),('Mississippi','MS'),
      ('Missouri','MO'),('Montana','MT'),('Nebraska','NE'),('Nevada','NV'),('New Hampshire','NH'),('New Jersey','NJ'),
      ('New Mexico','NM'),('New York','NY'),('North Carolina','NC'),('North Dakota','ND'),('Ohio','OH'),('Oklahoma','OK'),
      ('Oregon','OR'),('Pennsylvania','PA'),('Rhode Island','RI'),('South Carolina','SC'),('South Dakota','SD'),('Tennessee','TN'),
      ('Texas','TX'),('Utah','UT'),('Vermont','VT'),('Virginia','VA'),('Washington','WA'),('West Virginia','WV'),('Wisconsin','WI'),('Wyoming','WY'),
      ('District of Columbia','DC')
  )
  INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
  SELECT NULL, v_us, v.name, v.code_iso, NULL, true
  FROM vals v
  LEFT JOIN public.states s
    ON s.country_id = v_us AND s.code_iso = v.code_iso
  WHERE s.id IS NULL;
END$$;

COMMIT;