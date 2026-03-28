ALTER TABLE public.ata_codes
  ADD COLUMN IF NOT EXISTS parent_code_ref character varying(20) NULL;

CREATE TABLE IF NOT EXISTS public.ata_codes_import_temp (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  franchise_id text,
  code text NOT NULL,
  description text,
  parent_id text,
  parent_code_ref text,
  level text,
  chapter_code text,
  is_active text,
  insert_status varchar(10) NOT NULL DEFAULT 'Pending',
  error_message text,
  inserted_ata_code_id uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ata_codes_import_temp
  ADD COLUMN IF NOT EXISTS parent_id text;

TRUNCATE TABLE public.ata_codes_import_temp;

INSERT INTO public.ata_codes_import_temp (tenant_id, franchise_id, code, description, parent_id, level, chapter_code, parent_code_ref, is_active)
VALUES
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '1', 'Seats', NULL, '1', '1', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '4', 'Airworthiness Limitations', NULL, '1', '4', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '5', 'Routine Inspection', NULL, '1', '5', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '6', 'Dimensions & Areas', NULL, '1', '6', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '7', 'Lifting & Shoring', NULL, '1', '7', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '8', 'Leveling and Weighing', NULL, '1', '8', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '9', 'Towing & Taxiing', NULL, '1', '9', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '10', 'Parking, Mooring, Storage & Return To Service', NULL, '1', '10', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '11', 'Required Placards', NULL, '1', '11', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '12', 'Servicing Routine Maintenance', NULL, '1', '12', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '18', 'Vibration & Noise Analysis (Helicopter Only)', NULL, '1', '18', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '20', 'Standard Practices - Airframe', NULL, '1', '20', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '21', 'Air Conditioning', NULL, '1', '21', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '22', 'Auto Flight', NULL, '1', '22', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '23', 'Communications', NULL, '1', '23', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '24', 'Electric Power', NULL, '1', '24', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '25', 'Equipment / Furnishing', NULL, '1', '25', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '26', 'Fire Protection', NULL, '1', '26', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '27', 'Flight Controls', NULL, '1', '27', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '28', 'Fuel', NULL, '1', '28', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '29', 'Hydraulic Power', NULL, '1', '29', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '30', 'Ice and Rain Protection', NULL, '1', '30', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '31', 'Instruments', NULL, '1', '31', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '32', 'Landing Gear', NULL, '1', '32', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '33', 'Lights', NULL, '1', '33', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '34', 'Navigation Pitot /Static', NULL, '1', '34', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '35', 'Oxygen', NULL, '1', '35', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '36', 'Pneumatic', NULL, '1', '36', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '37', 'Vacuum', NULL, '1', '37', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '38', 'Water / Waste', NULL, '1', '38', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '39', 'Electronical/Electrical Panels', NULL, '1', '39', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '41', 'Water Ballast', NULL, '1', '41', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '42', 'Integrated Modular Avionics', NULL, '1', '42', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '43', 'Oil', NULL, '1', '43', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '44', 'Cabin Systems', NULL, '1', '44', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '45', 'Central Maintenance System (CMS)', NULL, '1', '45', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '46', 'Information Systems', NULL, '1', '46', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '47', 'Inert Gas System', NULL, '1', '47', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '49', 'APU', NULL, '1', '49', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '50', 'Cargo and Accessory Compartments', NULL, '1', '50', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '51', 'Structure', NULL, '1', '51', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '52', 'Doors', NULL, '1', '52', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '53', 'Fuselage', NULL, '1', '53', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '54', 'Nacelle', NULL, '1', '54', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '55', 'Horiz. & Vert. stabilizers', NULL, '1', '55', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '56', 'Window', NULL, '1', '56', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '57', 'Wing', NULL, '1', '57', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '60', 'Standard Practices - Propeller / Rotor', NULL, '1', '60', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '61', 'Propeller', NULL, '1', '61', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '62', 'Rotors', NULL, '1', '62', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '63', 'Main Rotor Drive', NULL, '1', '63', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '64', 'Tail Rotor', NULL, '1', '64', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '65', 'Tail Rotor Drive', NULL, '1', '65', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '66', 'Tail Rotor Gearbox', NULL, '1', '66', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '67', 'Flight Control - Helicopter', NULL, '1', '67', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '70', 'Standard Practices Engine', NULL, '1', '70', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '71', 'Power Plant', NULL, '1', '71', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '72', 'Engine', NULL, '1', '72', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '73', 'Engine Fuel System', NULL, '1', '73', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '74', 'Iginition', NULL, '1', '74', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '75', 'Engine Air', NULL, '1', '75', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '76', 'Engine controls', NULL, '1', '76', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '77', 'Engine Indicating', NULL, '1', '77', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '78', 'Exhaust', NULL, '1', '78', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '79', 'Oil System', NULL, '1', '79', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '80', 'Starting', NULL, '1', '80', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '81', 'Turbines', NULL, '1', '81', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '82', 'Water Injection', NULL, '1', '82', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '83', 'Accessory Gear Boxes', NULL, '1', '83', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '84', 'Propulsion Augmentation', NULL, '1', '84', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '85', 'Optional Equipment', NULL, '1', '85', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '88', 'Wiring / Harness', NULL, '1', '88', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '92', 'Wiring Elements', NULL, '1', '92', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '95', 'Instrument System', NULL, '1', '95', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '96', 'Battery', NULL, '1', '96', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '97', 'Antenna', NULL, '1', '97', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '98', 'Switches', NULL, '1', '98', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '99', 'Optional Equipment.', NULL, '1', '99', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '100', 'Others', NULL, '1', '100', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '101', 'Not an ATA Code. Assigned for DGCA Requirement', NULL, '1', '101', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '103', 'Weighing Of Aircarft', NULL, '1', '103', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '115', 'Flight Simulator Systems', NULL, '1', '115', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '116', 'Flight Simulator Cuing Systems', NULL, '1', '116', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '117', 'Fuel-MicroBiological Test', NULL, '1', '117', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '118', 'Weighing Of Cabin Fire Extinguisher', NULL, '1', '118', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '119', 'Battery CT', NULL, '1', '119', NULL, 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '05-10', 'Time Limits', NULL, '2', '5', '5', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '05-20', 'Scheduled Maintenance Checks', NULL, '2', '5', '5', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '05-50', 'Unscheduled Maintenance Checks', NULL, '2', '5', '5', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '12-10', 'Replenishing', NULL, '2', '12', '12', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '12-20', 'Scheduled Servicing', NULL, '2', '12', '12', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '21-10', 'Compression', NULL, '2', '21', '21', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '21-20', 'Distribution', NULL, '2', '21', '21', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '21-30', 'Pressurization Control', NULL, '2', '21', '21', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '21-50', 'Cooling', NULL, '2', '21', '21', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '24-10', 'Generator Drive', NULL, '2', '24', '24', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '24-20', 'AC Generation', NULL, '2', '24', '24', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '24-30', 'DC Generation', NULL, '2', '24', '24', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '27-10', 'Aileron and Tab', NULL, '2', '27', '27', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '27-20', 'Rudder and Tab', NULL, '2', '27', '27', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '27-30', 'Elevator and Tab', NULL, '2', '27', '27', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '32-10', 'Main Gear and Doors', NULL, '2', '32', '32', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '32-20', 'Nose Gear and Doors', NULL, '2', '32', '32', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '32-40', 'Wheels and Brakes', NULL, '2', '32', '32', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '52-10', 'Passenger / Crew Doors', NULL, '2', '52', '52', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '52-30', 'Cargo Doors', NULL, '2', '52', '52', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '71-10', 'Cowling', NULL, '2', '71', '71', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '71-20', 'Engine Mounts', NULL, '2', '71', '71', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '21-10-01', 'Cabin Compressor', NULL, '3', '21', '21-10', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '21-30-01', 'Outflow Valve', NULL, '3', '21', '21-30', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '24-20-01', 'Generator/IDG', NULL, '3', '24', '24-20', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '27-10-01', 'Aileron Actuator', NULL, '3', '27', '27-10', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '32-40-01', 'Brake Assembly', NULL, '3', '32', '32-40', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '32-40-02', 'Main Wheel', NULL, '3', '32', '32-40', 'TRUE'),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, '52-10-01', 'Forward Passenger Door', NULL, '3', '52', '52-10', 'TRUE');

UPDATE public.ata_codes_import_temp
SET
  insert_status = 'Pending',
  error_message = NULL,
  inserted_ata_code_id = NULL,
  processed_at = NULL;

DO $$
DECLARE
  v_row public.ata_codes_import_temp%ROWTYPE;
  v_inserted_id uuid;
  v_parent_id uuid;
  v_parent_code_ref text;
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.ata_codes_import_temp
    ORDER BY id
  LOOP
    BEGIN
      v_inserted_id := gen_random_uuid();
      v_parent_id := NULL;
      v_parent_code_ref := NULL;

      IF v_row.parent_id IS NOT NULL AND trim(lower(v_row.parent_id)) NOT IN ('', 'null') THEN
        BEGIN
          v_parent_id := trim(v_row.parent_id)::uuid;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid parent_id % for code %', v_row.parent_id, v_row.code;
        END;

        SELECT ac.code
        INTO v_parent_code_ref
        FROM public.ata_codes ac
        WHERE ac.id = v_parent_id
          AND ac.tenant_id = v_row.tenant_id::uuid
        LIMIT 1;

        IF v_parent_code_ref IS NULL THEN
          RAISE EXCEPTION 'Parent id % not found for tenant %', v_row.parent_id, v_row.tenant_id;
        END IF;
      ELSIF v_row.parent_code_ref IS NULL OR trim(lower(v_row.parent_code_ref)) IN ('', 'null') THEN
        v_parent_id := NULL;
        v_parent_code_ref := NULL;
      ELSE
        v_parent_code_ref := trim(v_row.parent_code_ref);

        SELECT ac.id
        INTO v_parent_id
        FROM public.ata_codes ac
        WHERE ac.tenant_id = v_row.tenant_id::uuid
          AND ac.code = v_parent_code_ref
        ORDER BY ac.created_at DESC
        LIMIT 1;

        IF v_parent_id IS NULL THEN
          RAISE EXCEPTION 'Parent code % not found for tenant %', v_row.parent_code_ref, v_row.tenant_id;
        END IF;
      END IF;

      INSERT INTO public.ata_codes (
        id,
        tenant_id,
        franchise_id,
        code,
        description,
        parent_code_ref,
        parent_id,
        level,
        chapter_code,
        created_at,
        updated_at,
        is_active
      )
      VALUES (
        v_inserted_id,
        v_row.tenant_id::uuid,
        NULLIF(v_row.franchise_id, '')::uuid,
        v_row.code,
        v_row.description,
        v_parent_code_ref,
        v_parent_id,
        NULLIF(v_row.level, '')::smallint,
        NULLIF(v_row.chapter_code, ''),
        now(),
        now(),
        COALESCE(
          CASE
            WHEN v_row.is_active IS NULL OR trim(v_row.is_active) = '' THEN NULL
            WHEN lower(trim(v_row.is_active)) IN ('true', 't', '1', 'yes', 'y') THEN TRUE
            WHEN lower(trim(v_row.is_active)) IN ('false', 'f', '0', 'no', 'n') THEN FALSE
            ELSE NULL
          END,
          TRUE
        )
      );

      UPDATE public.ata_codes_import_temp
      SET
        insert_status = 'Passed',
        error_message = NULL,
        inserted_ata_code_id = v_inserted_id,
        processed_at = now()
      WHERE id = v_row.id;
    EXCEPTION
      WHEN OTHERS THEN
        UPDATE public.ata_codes_import_temp
        SET
          insert_status = 'Failed',
          error_message = left(SQLERRM, 4000),
          inserted_ata_code_id = NULL,
          processed_at = now()
        WHERE id = v_row.id;
    END;
  END LOOP;
END;
$$;
