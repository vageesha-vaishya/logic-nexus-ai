import pandas as pd
import json
import os
import sys

EXCEL_FILE = 'scripts/AESTIR_Export_Reference_Data.xlsx'
SQL_OUTPUT = 'supabase/migrations/20260130170000_import_us_port_codes.sql'

def normalize_text(text):
    if pd.isna(text): return None
    return str(text).strip()

def parse_modes(mots_txt):
    if not mots_txt or pd.isna(mots_txt):
        return []
    
    # Split by semicolon or comma
    raw_modes = str(mots_txt).replace(';', ',').split(',')
    modes = []
    
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
        
    return list(set(modes)) # Deduplicate

def determine_location_type(modes):
    # Allowed types: 'seaport', 'airport', 'inland_port', 'warehouse', 'terminal', 'railway_terminal'
    if 'Vessel' in modes: return 'seaport'
    if 'Air' in modes: return 'airport'
    if 'Rail' in modes: return 'railway_terminal'
    # Map Road/Truck to terminal or inland_port. 'terminal' is safer generic.
    if 'Road' in modes: return 'terminal' 
    return 'terminal' # Default fallback (e.g. Pipeline, Fixed, Mail)

def generate_sql(ports):
    print("Generating SQL migration...")
    
    sql_content = """-- US Port Codes Import (AESTIR)
-- Generated from official CBP Export Reference Data Excel
-- Imported Count: {count}

BEGIN;

-- Ensure necessary columns exist
ALTER TABLE public.ports_locations 
ADD COLUMN IF NOT EXISTS port_type text[];

-- Create a temp table for import
CREATE TEMP TABLE temp_us_ports (
    location_code text,
    location_name text,
    city text,
    state_province text,
    country_code text,
    port_type text[],
    location_type text
);

INSERT INTO temp_us_ports (location_code, location_name, city, state_province, country_code, port_type, location_type) VALUES
""".format(count=len(ports))

    values = []
    for port in ports:
        modes_str = "{" + ",".join(f'"{m}"' for m in port['port_type']) + "}"
        
        # Escape single quotes
        name_escaped = port['location_name'].replace("'", "''")
        city_escaped = (port['city'] or '').replace("'", "''")
        
        values.append(f"('{port['location_code']}', '{name_escaped}', '{city_escaped}', '{port['state_province']}', '{port['country_code']}', '{modes_str}', '{port['location_type']}')")

    sql_content += ",\n".join(values) + ";\n\n"

    sql_content += """
-- 1. Update existing ports by location_code
UPDATE public.ports_locations pl
SET 
    location_name = t.location_name,
    city = t.city,
    state_province = t.state_province,
    country_code = t.country_code,
    country = CASE WHEN t.country_code = 'US' THEN 'United States' ELSE pl.country END,
    port_type = t.port_type,
    location_type = t.location_type,
    schedule_d_code = t.location_code, -- Sync Schedule D code with Location Code for these US ports
    updated_at = NOW()
FROM temp_us_ports t
WHERE pl.location_code = t.location_code;

-- 2. Insert NEW ports
INSERT INTO public.ports_locations (
    location_code,
    location_name,
    city,
    state_province,
    country_code,
    country,
    port_type,
    location_type,
    schedule_d_code,
    is_active,
    customs_available,
    created_at,
    updated_at
)
SELECT 
    t.location_code,
    t.location_name,
    t.city,
    t.state_province,
    t.country_code,
    CASE WHEN t.country_code = 'US' THEN 'United States' ELSE NULL END,
    t.port_type,
    t.location_type,
    t.location_code,
    TRUE, -- Assume active if in the list
    TRUE, -- Assume customs available for official ports
    NOW(),
    NOW()
FROM temp_us_ports t
WHERE NOT EXISTS (
    SELECT 1 FROM public.ports_locations pl 
    WHERE pl.location_code = t.location_code
);

-- 3. Log the operation
INSERT INTO public.audit_logs (action, resource_type, details)
VALUES (
    'IMPORT_US_PORTS', 
    'ports_locations', 
    jsonb_build_object(
        'description', 'Import from AESTIR US_Port_Codes',
        'record_count', {count},
        'source', 'AESTIR_Export_Reference_Data.xlsx'
    )
);

DROP TABLE temp_us_ports;

COMMIT;
""".format(count=len(ports))

    with open(SQL_OUTPUT, 'w') as f:
        f.write(sql_content)
    print(f"Saved SQL to {SQL_OUTPUT}")

def main():
    if not os.path.exists(EXCEL_FILE):
        print(f"Error: File not found at {EXCEL_FILE}")
        sys.exit(1)

    print(f"Reading {EXCEL_FILE}...")
    try:
        xls = pd.ExcelFile(EXCEL_FILE)
        
        # Look for US_Port_Codes sheet
        target_sheet = 'US_Port_Codes'
        if target_sheet not in xls.sheet_names:
            print(f"Warning: Sheet '{target_sheet}' not found. Available: {xls.sheet_names}")
            # Try finding a likely candidate
            target_sheet = next((s for s in xls.sheet_names if 'Port' in s), xls.sheet_names[0])
            print(f"Using sheet: {target_sheet}")
        
        df = pd.read_excel(xls, sheet_name=target_sheet)
        
        # Verify columns
        # Mapping Requirements:
        # Port_code -> location_code
        # prot_city (PORT_CITY) -> location_name
        
        required_cols = {
            'PORT_CODE': 'location_code',
            'PORT_CITY': 'location_name' # User requested mapping
        }
        
        # Optional/Other columns to map
        # PORT_STATE -> state_province
        # CTRY -> country_code
        # ACPTD_MOTS_TXT -> port_type
        
        extracted_ports = []
        seen_codes = set()
        
        for index, row in df.iterrows():
            # Extract Raw
            p_code = row.get('PORT_CODE')
            p_city = row.get('PORT_CITY')
            p_state = row.get('PORT_STATE')
            p_country = row.get('CTRY')
            p_mots = row.get('ACPTD_MOTS_TXT')
            
            # Validation
            if pd.isna(p_code) or pd.isna(p_city):
                # print(f"Skipping row {index}: Missing Code or City")
                continue
                
            # Transform
            # 1. Location Code: Pad to 4 digits
            loc_code = str(int(p_code)).zfill(4) if isinstance(p_code, (int, float)) else str(p_code).strip()
            if loc_code.isdigit():
                 loc_code = loc_code.zfill(4)
            
            if loc_code in seen_codes:
                continue
                
            # 2. Location Name (from PORT_CITY as requested)
            loc_name = normalize_text(p_city)
            
            # 3. State
            state = normalize_text(p_state)
            
            # 4. Country
            country_code = normalize_text(p_country)
            
            # 5. Port Type
            modes = parse_modes(p_mots)
            loc_type = determine_location_type(modes)
            
            extracted_ports.append({
                'location_code': loc_code,
                'location_name': loc_name,
                'city': loc_name, # Also mapping city to city field
                'state_province': state,
                'country_code': country_code,
                'port_type': modes,
                'location_type': loc_type
            })
            seen_codes.add(loc_code)
            
        print(f"Extracted {len(extracted_ports)} valid records.")
        
        if extracted_ports:
            generate_sql(extracted_ports)
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
