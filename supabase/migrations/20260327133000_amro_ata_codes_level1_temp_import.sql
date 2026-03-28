ALTER TABLE public.ata_codes
  ADD COLUMN IF NOT EXISTS parent_code_ref character varying(20) NULL;

CREATE TABLE IF NOT EXISTS public.ata_codes_import_temp (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  franchise_id text,
  code text NOT NULL,
  description text,
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

TRUNCATE TABLE public.ata_codes_import_temp;

COPY public.ata_codes_import_temp (tenant_id, franchise_id, code, description, parent_code_ref, level, chapter_code, is_active)
FROM STDIN
WITH (FORMAT csv, HEADER true);
tenant_id,franchise_id,code,description,parent_code_ref,level,chapter_code,is_active
e42ec6fd-6b88-4721-befe-4443d9743120,,1,Seats,null,1,1,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,4,Airworthiness Limitations,null,1,4,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,5,Routine Inspection,null,1,5,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,6,Dimensions & Areas,null,1,6,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,7,Lifting & Shoring,null,1,7,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,8,Leveling and Weighing,null,1,8,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,9,Towing & Taxiing,null,1,9,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,10,"Parking, Mooring, Storage & Return To Service",null,1,10,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,11,Required Placards,null,1,11,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,12,Servicing Routine Maintenance,null,1,12,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,18,Vibration & Noise Analysis (Helicopter Only),null,1,18,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,20,Standard Practices - Airframe,null,1,20,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,21,Air Conditioning,null,1,21,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,22,Auto Flight,null,1,22,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,23,Communications,null,1,23,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,24,Electric Power,null,1,24,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,25,Equipment / Furnishing,null,1,25,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,26,Fire Protection,null,1,26,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,27,Flight Controls,null,1,27,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,28,Fuel,null,1,28,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,29,Hydraulic Power,null,1,29,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,30,Ice and Rain Protection,null,1,30,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,31,Instruments,null,1,31,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,32,Landing Gear,null,1,32,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,33,Lights,null,1,33,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,34,Navigation Pitot /Static,null,1,34,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,35,Oxygen,null,1,35,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,36,Pneumatic,null,1,36,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,37,Vacuum,null,1,37,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,38,Water / Waste,null,1,38,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,39,Electronical/Electrical Panels,null,1,39,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,41,Water Ballast,null,1,41,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,42,Integrated Modular Avionics,null,1,42,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,43,Oil,null,1,43,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,44,Cabin Systems,null,1,44,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,45,Central Maintenance System (CMS),null,1,45,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,46,Information Systems,null,1,46,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,47,Inert Gas System,null,1,47,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,49,APU,null,1,49,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,50,Cargo and Accessory Compartments,null,1,50,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,51,Structure,null,1,51,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,52,Doors,null,1,52,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,53,Fuselage,null,1,53,
e42ec6fd-6b88-4721-befe-4443d9743120,,54,Nacelle,null,1,54,
e42ec6fd-6b88-4721-befe-4443d9743120,,55,Horiz. & Vert. stabilizers,null,1,55,
e42ec6fd-6b88-4721-befe-4443d9743120,,56,Window,null,1,56,
e42ec6fd-6b88-4721-befe-4443d9743120,,57,Wing,null,1,57,
e42ec6fd-6b88-4721-befe-4443d9743120,,60,Standard Practices - Propeller / Rotor,null,1,60,
e42ec6fd-6b88-4721-befe-4443d9743120,,61,Propeller,null,1,61,
e42ec6fd-6b88-4721-befe-4443d9743120,,62,Rotors,null,1,62,
e42ec6fd-6b88-4721-befe-4443d9743120,,63,Main Rotor Drive,null,1,63,
e42ec6fd-6b88-4721-befe-4443d9743120,,64,Tail Rotor,null,1,64,
e42ec6fd-6b88-4721-befe-4443d9743120,,65,Tail Rotor Drive,null,1,65,
e42ec6fd-6b88-4721-befe-4443d9743120,,66,Tail Rotor Gearbox,null,1,66,
e42ec6fd-6b88-4721-befe-4443d9743120,,67,Flight Control - Helicopter,null,1,67,
e42ec6fd-6b88-4721-befe-4443d9743120,,70,Standard Practices Engine,null,1,70,
e42ec6fd-6b88-4721-befe-4443d9743120,,71,Power Plant,null,1,71,
e42ec6fd-6b88-4721-befe-4443d9743120,,72,Engine,null,1,72,
e42ec6fd-6b88-4721-befe-4443d9743120,,73,Engine Fuel System,null,1,73,
e42ec6fd-6b88-4721-befe-4443d9743120,,74,Iginition,null,1,74,
e42ec6fd-6b88-4721-befe-4443d9743120,,75,Engine Air,null,1,75,
e42ec6fd-6b88-4721-befe-4443d9743120,,76,Engine controls,null,1,76,
e42ec6fd-6b88-4721-befe-4443d9743120,,77,Engine Indicating,null,1,77,
e42ec6fd-6b88-4721-befe-4443d9743120,,78,Exhaust,null,1,78,
e42ec6fd-6b88-4721-befe-4443d9743120,,79,Oil System,null,1,79,
e42ec6fd-6b88-4721-befe-4443d9743120,,80,Starting,null,1,80,
e42ec6fd-6b88-4721-befe-4443d9743120,,81,Turbines,null,1,81,
e42ec6fd-6b88-4721-befe-4443d9743120,,82,Water Injection,null,1,82,
e42ec6fd-6b88-4721-befe-4443d9743120,,83,Accessory Gear Boxes,null,1,83,
e42ec6fd-6b88-4721-befe-4443d9743120,,84,Propulsion Augmentation,null,1,84,
e42ec6fd-6b88-4721-befe-4443d9743120,,85,Optional Equipment,null,1,85,
e42ec6fd-6b88-4721-befe-4443d9743120,,88,Wiring / Harness,null,1,88,
e42ec6fd-6b88-4721-befe-4443d9743120,,92,Wiring Elements,null,1,92,
e42ec6fd-6b88-4721-befe-4443d9743120,,95,Instrument System,null,1,95,
e42ec6fd-6b88-4721-befe-4443d9743120,,96,Battery,null,1,96,
e42ec6fd-6b88-4721-befe-4443d9743120,,97,Antenna,null,1,97,
e42ec6fd-6b88-4721-befe-4443d9743120,,98,Switches,null,1,98,
e42ec6fd-6b88-4721-befe-4443d9743120,,99,Optional Equipment.,null,1,99,
e42ec6fd-6b88-4721-befe-4443d9743120,,100,Others,null,1,100,
e42ec6fd-6b88-4721-befe-4443d9743120,,101,Not an ATA Code. Assigned for DGCA Requirement,null,1,101,
e42ec6fd-6b88-4721-befe-4443d9743120,,103,Weighing Of Aircarft,null,1,103,
e42ec6fd-6b88-4721-befe-4443d9743120,,115,Flight Simulator Systems,null,1,115,
e42ec6fd-6b88-4721-befe-4443d9743120,,116,Flight Simulator Cuing Systems,null,1,116,
e42ec6fd-6b88-4721-befe-4443d9743120,,117,Fuel-MicroBiological Test,null,1,117,
e42ec6fd-6b88-4721-befe-4443d9743120,,118,Weighing Of Cabin Fire Extinguisher,null,1,118,
e42ec6fd-6b88-4721-befe-4443d9743120,,119,Battery CT,null,1,119,
e42ec6fd-6b88-4721-befe-4443d9743120,,05-10,Time Limits,5,2,5,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,05-20,Scheduled Maintenance Checks,5,2,5,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,05-50,Unscheduled Maintenance Checks,5,2,5,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,12-10,Replenishing,12,2,12,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,12-20,Scheduled Servicing,12,2,12,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,21-10,Compression,21,2,21,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,21-20,Distribution,21,2,21,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,21-30,Pressurization Control,21,2,21,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,21-50,Cooling,21,2,21,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,24-10,Generator Drive,24,2,24,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,24-20,AC Generation,24,2,24,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,24-30,DC Generation,24,2,24,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,27-10,Aileron and Tab,27,2,27,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,27-20,Rudder and Tab,27,2,27,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,27-30,Elevator and Tab,27,2,27,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,32-10,Main Gear and Doors,32,2,32,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,32-20,Nose Gear and Doors,32,2,32,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,32-40,Wheels and Brakes,32,2,32,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,52-10,Passenger / Crew Doors,52,2,52,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,52-30,Cargo Doors,52,2,52,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,71-10,Cowling,71,2,71,TRUE
e42ec6fd-6b88-4721-befe-4443d9743120,,71-20,Engine Mounts,71,2,71,TRUE
\.

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
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.ata_codes_import_temp
    ORDER BY id
  LOOP
    BEGIN
      v_inserted_id := gen_random_uuid();
      v_parent_id := NULL;

      IF v_row.parent_code_ref IS NULL OR trim(lower(v_row.parent_code_ref)) IN ('', 'null') THEN
        v_parent_id := NULL;
      ELSE
        SELECT ac.id
        INTO v_parent_id
        FROM public.ata_codes ac
        WHERE ac.tenant_id = v_row.tenant_id::uuid
          AND ac.code = trim(v_row.parent_code_ref)
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
        NULLIF(trim(v_row.parent_code_ref), ''),
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
