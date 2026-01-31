import pandas as pd
import json
import os
import sys

# Default file name (user should update or rename their file to this)
EXCEL_FILE = 'scripts/AESTIR_Export_Reference_Data.xlsx'
JSON_OUTPUT = 'scripts/aes_port_codes_full.json'
SQL_OUTPUT = 'supabase/migrations/20260130160000_seed_aes_full_excel.sql'

def normalize_text(text):
    if pd.isna(text): return None
    return str(text).strip()

def generate_sql(ports):
    print("Generating SQL migration...")
    
    sql_content = """-- AES-AESTIR Full Appendix D Seeding (Excel Source)
-- Generated from official CBP Export Reference Data Excel
-- Seeded Count: {count}

BEGIN;

-- Ensure port_type column exists
ALTER TABLE public.ports_locations 
ADD COLUMN IF NOT EXISTS port_type text[];

-- Create a temp table for the new data
CREATE TEMP TABLE temp_aes_ports_full (
    code text,
    name text,
    modes text[]
);

INSERT INTO temp_aes_ports_full (code, name, modes) VALUES
""".format(count=len(ports))

    values = []
    for port in ports:
        modes_str = "{" + ",".join(f'"{m}"' for m in port['modes']) + "}"
        # Escape single quotes in name
        name_escaped = port['name'].replace("'", "''")
        values.append(f"('{port['code']}', '{name_escaped}', '{modes_str}')")

    sql_content += ",\n".join(values) + ";\n\n"

    sql_content += """
-- 1. Update existing ports with Schedule D code and name normalization
UPDATE public.ports_locations pl
SET 
    location_name = t.name,
    port_type = t.modes,
    schedule_d_code = t.code, -- Ensure Schedule D is set
    updated_at = NOW()
FROM temp_aes_ports_full t
WHERE pl.location_code = t.code OR pl.schedule_d_code = t.code;

-- 2. Insert NEW ports that don't exist
INSERT INTO public.ports_locations (
    location_code,
    location_name,
    schedule_d_code,
    port_type,
    country_code,
    country,
    created_at,
    updated_at
)
SELECT 
    t.code,
    t.name,
    t.code,
    t.modes,
    'US',
    'United States',
    NOW(),
    NOW()
FROM temp_aes_ports_full t
WHERE NOT EXISTS (
    SELECT 1 FROM public.ports_locations pl 
    WHERE pl.location_code = t.code OR pl.schedule_d_code = t.code
);

-- 3. Log the operation
INSERT INTO public.audit_logs (action, resource_type, details)
VALUES (
    'SEED_AES_APPENDIX_D_FULL', 
    'ports_locations', 
    jsonb_build_object(
        'description', 'Full seeding from AESTIR Excel',
        'record_count', {count},
        'source', 'AESTIR_Export_Reference_Data.xlsx'
    )
);

DROP TABLE temp_aes_ports_full;

COMMIT;
""".format(count=len(ports))

    with open(SQL_OUTPUT, 'w') as f:
        f.write(sql_content)
    print(f"Saved SQL to {SQL_OUTPUT}")

def main():
    if not os.path.exists(EXCEL_FILE):
        print(f"Error: File not found at {EXCEL_FILE}")
        print("Please download the 'AESTIR Export Reference Data Excel File' from CBP.gov")
        print("and save it to the 'scripts/' directory with the name 'AESTIR_Export_Reference_Data.xlsx'.")
        sys.exit(1)

    print(f"Reading {EXCEL_FILE}...")
    try:
        # Load Excel file - find sheet with "Port" or "Appendix D"
        xls = pd.ExcelFile(EXCEL_FILE)
        print(f"Sheet names: {xls.sheet_names}")
        
        target_sheet = None
        for sheet in xls.sheet_names:
            if "Appendix D" in sheet or "Port" in sheet:
                target_sheet = sheet
                break
        
        if not target_sheet:
            print("Could not automatically identify Port Codes sheet. Using first sheet.")
            target_sheet = xls.sheet_names[0]

        print(f"Processing sheet: {target_sheet}")
        df = pd.read_excel(xls, sheet_name=target_sheet)
        
        # Normalize columns
        df.columns = [str(c).strip() for c in df.columns]
        print(f"Columns found: {df.columns.tolist()}")

        # Identify key columns (Code, Name) using user-defined strict mapping
        # Mapping Rule: PORT_CODE -> code, PORT_NAME -> name
        required_columns = ['PORT_CODE', 'PORT_NAME']
        
        # Verify columns exist
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            print(f"Error: Missing required columns: {missing_columns}")
            print(f"Available columns: {df.columns.tolist()}")
            print("Please ensure the Excel file contains 'PORT_CODE' and 'PORT_NAME' columns.")
            sys.exit(1)

        code_col = 'PORT_CODE'
        name_col = 'PORT_NAME'

        extracted_ports = []
        seen_codes = set()

        for index, row in df.iterrows():
            code_raw = row[code_col]
            name_raw = row[name_col]

            # Error handling for null values
            if pd.isna(code_raw) or pd.isna(name_raw):
                # print(f"Warning: Skipping row {index+2} due to null values")
                continue

            # Logic to handle Integer codes (e.g. 101 -> "0101")
            if isinstance(code_raw, (int, float)):
                code = str(int(code_raw)).zfill(4)
            else:
                code = str(code_raw).strip()
                if code.isdigit():
                    code = code.zfill(4)
            
            name = normalize_text(name_raw)

            # Validate Code format (Appendix D is typically 4 digits)
            if not code or len(code) != 4:
                 print(f"Warning: Skipping row {index+2} due to invalid code format: '{code}' (Raw: {code_raw})")
                 continue

            
            if code in seen_codes:
                # print(f"Info: Skipping duplicate code {code}")
                continue

            # Check for mode flags if available (Vessel, Air, Rail, Road, Fixed)
            modes = []
            
            # Parse ACPTD_MOTS_TXT if present
            mots_txt = row.get('ACPTD_MOTS_TXT')
            if not pd.isna(mots_txt):
                raw_modes = str(mots_txt).replace(';', ',').split(',')
                for m in raw_modes:
                    m = m.strip().upper()
                    if 'VESSEL' in m: modes.append('Vessel')
                    if 'AIR' in m: modes.append('Air')
                    if 'RAIL' in m: modes.append('Rail')
                    if 'TRUCK' in m or 'ROAD' in m: modes.append('Road')
                    if 'MAIL' in m: modes.append('Mail')
                    if 'PASSENGER' in m: modes.append('Passenger')
                    if 'PIPELINE' in m: modes.append('Pipeline')
                    if 'FIXED' in m: modes.append('Fixed')
                modes = list(set(modes))
            
            # Fallback Heuristic for finding mode columns if ACPTD_MOTS_TXT is missing/empty
            if not modes:
                for col in df.columns:
                    val = normalize_text(row[col])
                    if val == 'Y':
                        if 'Vessel' in col: modes.append('Vessel')
                        elif 'Air' in col: modes.append('Air')
                        elif 'Rail' in col: modes.append('Rail')
                        elif 'Road' in col: modes.append('Road')
                        elif 'Fixed' in col: modes.append('Fixed')

            extracted_ports.append({
                "code": code,
                "name": name,
                "modes": modes
            })
            seen_codes.add(code)

        print(f"Extracted {len(extracted_ports)} valid port records.")
        
        # Save JSON
        with open(JSON_OUTPUT, 'w') as f:
            json.dump(extracted_ports, f, indent=2)
        print(f"Saved JSON to {JSON_OUTPUT}")

        # Generate SQL
        if extracted_ports:
            generate_sql(extracted_ports)

    except Exception as e:
        print(f"Error processing Excel file: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
