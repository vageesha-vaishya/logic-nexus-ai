-- DB-VERIFICATION: airports-table-and-seed-reviewed
-- DB-ARCH-APPROVAL: required-before-merge

BEGIN;

CREATE TABLE IF NOT EXISTS public.airports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid null,
  iata_code char(3) UNIQUE,
  icao_code char(4) UNIQUE NOT NULL,
  name text NOT NULL,
  city text NOT NULL,
  country_code char(2) NOT NULL,
  latitude numeric(10, 7) NOT NULL,
  longitude numeric(10, 7) NOT NULL,
  elevation_ft integer,
  timezone text NOT NULL,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT airports_pkey PRIMARY KEY (id),
  CONSTRAINT airports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE,
  CONSTRAINT airports_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.franchises (id) ON DELETE SET NULL,
  CONSTRAINT airports_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_airports_icao ON public.airports (icao_code);
CREATE INDEX IF NOT EXISTS idx_airports_iata ON public.airports (iata_code);

INSERT INTO public.airports (
  tenant_id,
  franchise_id,
  iata_code,
  icao_code,
  name,
  city,
  country_code,
  latitude,
  longitude,
  timezone
)
VALUES
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'DEL', 'VIDP', 'Indira Gandhi International', 'Delhi', 'IN', 28.5562, 77.1, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'DXB', 'OMDB', 'Dubai International', 'Dubai', 'AE', 25.2532, 55.3657, 'Asia/Dubai'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'LHR', 'EGLL', 'London Heathrow', 'London', 'GB', 51.47, -0.4543, 'Europe/London'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'SIN', 'WSSS', 'Singapore Changi', 'Singapore', 'SG', 1.3644, 103.9915, 'Asia/Singapore'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'JFK', 'KJFK', 'John F. Kennedy International', 'New York', 'US', 40.6413, -73.7781, 'America/New_York'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'JAI', 'VIJP', 'Jaipur International', 'Jaipur', 'IN', 26.8242, 75.8122, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'KUU', 'VIKG', 'Kullu Manali', 'Bhuntar', 'IN', 31.8764, 77.1542, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'AMD', 'VAAH', 'Sardar Vallabhbhai Patel', 'Ahmedabad', 'IN', 23.0772, 72.6347, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'BOM', 'VABB', 'Chhatrapati Shivaji Maharaj', 'Mumbai', 'IN', 19.0896, 72.8656, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'PNQ', 'VAPO', 'Pune International', 'Pune', 'IN', 18.5822, 73.9197, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'HAL', 'VOBG', 'HAL Bangalore', 'Bangalore', 'IN', 12.9515, 77.6682, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'BLR', 'VOBL', 'Kempegowda International', 'Bangalore', 'IN', 13.1986, 77.7066, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'HYD', 'VOHS', 'Rajiv Gandhi International', 'Hyderabad', 'IN', 17.2403, 78.4298, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'BPM', 'VOHY', 'Begumpet Airport', 'Hyderabad', 'IN', 17.4531, 78.4676, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'MAA', 'VOMM', 'Chennai International', 'Chennai', 'IN', 12.9941, 80.1709, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'CCU', 'VECC', 'Netaji Subhash Chandra Bose', 'Kolkata', 'IN', 22.6547, 88.4467, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'SXR', 'VISR', 'Srinagar International', 'Srinagar', 'IN', 33.987, 74.7741, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'BHO', 'VABP', 'Raja Bhoj', 'Bhopal', 'IN', 23.2875, 77.3375, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'SAG', 'VASD', 'Shirdi International', 'Shirdi', 'IN', 19.6922, 74.3944, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'DED', 'VIDN', 'Jolly Grant', 'Dehradun', 'IN', 30.1897, 78.1803, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'IDR', 'VAID', 'Devi Ahilyabai Holkar', 'Indore', 'IN', 22.7217, 75.8011, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'CCJ', 'VOCL', 'Kozhikode International', 'Calicut', 'IN', 11.1367, 75.9553, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'VTZ', 'VOVZ', 'Visakhapatnam International', 'Visakhapatnam', 'IN', 17.7211, 83.2186, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'GOX', 'VOGA', 'Manohar International (Mopa)', 'Goa', 'IN', 15.7661, 73.8675, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'VNS', 'VEBN', 'Lal Bahadur Shastri', 'Varanasi', 'IN', 25.4493, 82.8587, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'REW', 'VERW', 'Rewa Airport', 'Rewa', 'IN', 24.5033, 81.2203, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'UDR', 'VAUD', 'Maharana Pratap', 'Udaipur', 'IN', 24.6178, 73.8961, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, 'BBI', 'VEBS', 'Biju Patnaik', 'Bhubaneswar', 'IN', 20.2444, 85.8178, 'Asia/Kolkata'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', null, null, 'MAIN', 'Maintenance Hangar / Shop', 'Virtual', 'IN', 0, 0, 'Asia/Kolkata')
ON CONFLICT DO NOTHING;

ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access ON public.airports;
CREATE POLICY amro_platform_admin_access
  ON public.airports
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.airports;
CREATE POLICY amro_tenant_franchise_scope
  ON public.airports
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );

COMMIT;
