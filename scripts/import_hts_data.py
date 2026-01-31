import argparse
import pandas as pd
import os
import json
import psycopg2
from dotenv import load_dotenv
import re

load_dotenv()

def get_db_connection():
    db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    return psycopg2.connect(db_url)

def validate_hts_format(code):
    # Regex from DB constraint: ^[0-9]{4}(\.[0-9]{2}){0,3}$
    pattern = r'^[0-9]{4}(\.[0-9]{2}){0,3}$'
    return re.match(pattern, str(code)) is not None

def clean_hts_code(code):
    # Try to format raw digits to HTS format if possible, or return as is
    # This is a helper, but strictly we should expect valid input or reject
    code = str(code).strip()
    # If it's just digits, we might want to format it? 
    # For now, let's assume input should be relatively clean or we validate strict
    return code

def import_data(file_path, dry_run=False):
    ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if ext == '.csv':
            df = pd.read_csv(file_path)
        elif ext == '.json':
            df = pd.read_json(file_path)
        elif ext in ['.xls', '.xlsx']:
            df = pd.read_excel(file_path)
        else:
            print(f"Unsupported file format: {ext}")
            return
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # Normalize columns
    # Map common variations to DB columns
    column_map = {
        'HTS Code': 'hts_code', 'HTS Number': 'hts_code', 'Code': 'hts_code',
        'Description': 'description', 'Commodity': 'description',
        'Unit': 'unit_of_measure', 'UOM': 'unit_of_measure',
        'Duty Rate': 'duty_rate', 'Rate': 'duty_rate',
        'Category': 'category',
        'Schedule B': 'schedule_b', 'Sched B': 'schedule_b'
    }
    df.rename(columns=column_map, inplace=True)
    
    # Required columns
    required = ['hts_code', 'description', 'category']
    missing = [c for c in required if c not in df.columns]
    
    # If category is missing, try to derive from HTS code (Chapter)
    if 'category' in missing and 'hts_code' in df.columns:
        print("Deriving 'category' from HTS Code (Chapter)...")
        df['category'] = df['hts_code'].apply(lambda x: f"Chapter {str(x)[:2]}")
        missing.remove('category')

    if missing:
        print(f"Missing required columns: {missing}")
        return

    print(f"Found {len(df)} records.")
    
    valid_records = []
    invalid_records = []
    
    for _, row in df.iterrows():
        record = row.to_dict()
        record['hts_code'] = clean_hts_code(record['hts_code'])
        
        if validate_hts_format(record['hts_code']):
            valid_records.append(record)
        else:
            invalid_records.append(record)
            
    print(f"Valid records: {len(valid_records)}")
    print(f"Invalid format records: {len(invalid_records)}")
    if len(invalid_records) > 0:
        print(f"Example invalid: {invalid_records[0]['hts_code']}")

    if dry_run:
        print("Dry run enabled. No changes made to DB.")
        return

    conn = get_db_connection()
    cur = conn.cursor()
    
    upsert_sql = """
        INSERT INTO public.aes_hts_codes (
            hts_code, description, category, unit_of_measure, 
            duty_rate, schedule_b, special_provisions,
            sub_category, sub_sub_category, uom1, uom2
        ) VALUES (
            %(hts_code)s, %(description)s, %(category)s, %(unit_of_measure)s,
            %(duty_rate)s, %(schedule_b)s, %(special_provisions)s,
            %(sub_category)s, %(sub_sub_category)s, %(uom1)s, %(uom2)s
        )
        ON CONFLICT (hts_code) DO UPDATE SET
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            unit_of_measure = EXCLUDED.unit_of_measure,
            duty_rate = EXCLUDED.duty_rate,
            schedule_b = EXCLUDED.schedule_b,
            special_provisions = EXCLUDED.special_provisions,
            updated_at = NOW();
    """
    
    success_count = 0
    error_count = 0
    
    for rec in valid_records:
        # Fill missing optional keys with None
        for key in ['unit_of_measure', 'duty_rate', 'schedule_b', 'special_provisions', 
                   'sub_category', 'sub_sub_category', 'uom1', 'uom2']:
            if key not in rec or pd.isna(rec[key]):
                rec[key] = None
                
        try:
            cur.execute(upsert_sql, rec)
            success_count += 1
        except Exception as e:
            print(f"Error inserting {rec['hts_code']}: {e}")
            conn.rollback()
            error_count += 1
            # Continue to next? usually yes for bulk import
            continue
            
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"Import complete. Inserted/Updated: {success_count}, Errors: {error_count}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import HTS Codes from CSV/JSON/Excel")
    parser.add_argument("file", help="Path to data file")
    parser.add_argument("--dry-run", action="store_true", help="Validate without inserting")
    
    args = parser.parse_args()
    
    if os.path.exists(args.file):
        import_data(args.file, args.dry_run)
    else:
        print(f"File not found: {args.file}")
