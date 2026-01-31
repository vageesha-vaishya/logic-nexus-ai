import argparse
import requests
import psycopg2
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Census Bureau AES Concordance File URLs (Potential)
DEFAULT_URL = "https://www.census.gov/foreign-trade/aes/documentlibrary/concordance/expaes.txt"
# Fallback or alternative
# DEFAULT_URL = "https://www.census.gov/foreign-trade/aes/documentlibrary/expaes.txt"

def get_db_connection():
    db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    return psycopg2.connect(db_url)

def fetch_data(url):
    print(f"Downloading data from {url}...")
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.text.splitlines()
    except Exception as e:
        print(f"Error downloading data: {e}")
        return None

def parse_line_fixed(line):
    # Layout based on IMPAES.TXT structure (0-based indexing)
    # 1-10: COMMODITY (0:10)
    # 16-165: DESCRIPTION (15:165)
    # 171-173: UOM1 (170:173)
    # 179-181: UOM2 (178:181)
    
    if len(line) < 10:
        return None
        
    try:
        code = line[0:10].strip()
        desc = line[15:165].strip()
        uom1 = line[170:173].strip()
        uom2 = line[178:181].strip()
        
        # Basic validation
        if not code or not desc:
            return None
            
        # Format code (add dots for readability: 1234567890 -> 1234.56.78.90)
        # AES codes are 10 digits. Standard DB regex expects 4.2.2.2 format: ^[0-9]{4}(\.[0-9]{2}){0,3}$
        if len(code) == 10 and code.isdigit():
            fmt_code = f"{code[:4]}.{code[4:6]}.{code[6:8]}.{code[8:10]}"
        else:
            fmt_code = code

        return {
            'hts_code': fmt_code,
            'description': desc,
            'unit_of_measure': uom1,
            'uom1': uom1,
            'uom2': uom2,
            'category': 'Export Commodity', # Default category
            'schedule_b': fmt_code # For exports, HTS is often Sched B
        }
    except Exception:
        return None

def seed_database(lines, dry_run=False):
    conn = get_db_connection()
    cur = conn.cursor()
    
    total = 0
    inserted = 0
    errors = 0
    
    print("Starting seeding process...")
    
    upsert_sql = """
        INSERT INTO public.aes_hts_codes (
            hts_code, description, category, unit_of_measure, uom1, uom2, schedule_b, updated_at
        ) VALUES (
            %(hts_code)s, %(description)s, %(category)s, %(unit_of_measure)s, %(uom1)s, %(uom2)s, %(schedule_b)s, NOW()
        )
        ON CONFLICT (hts_code) DO UPDATE SET
            description = EXCLUDED.description,
            unit_of_measure = EXCLUDED.unit_of_measure,
            uom1 = EXCLUDED.uom1,
            uom2 = EXCLUDED.uom2,
            schedule_b = EXCLUDED.schedule_b,
            updated_at = NOW();
    """
    
    for line in lines:
        if not line.strip():
            continue
            
        total += 1
        record = parse_line_fixed(line)
        
        if not record:
            # Try delimited if fixed fails? 
            # For now assume fixed based on documentation
            errors += 1
            continue
            
        if dry_run:
            if total <= 5:
                print(f"Dry Run Record: {record}")
            continue
            
        try:
            cur.execute(upsert_sql, record)
            inserted += 1
            
            # Commit every 1000 records
            if inserted % 1000 == 0:
                conn.commit()
                print(f"Processed {inserted} records...")
                
        except Exception as e:
            conn.rollback()
            # print(f"Error inserting {record['hts_code']}: {e}")
            errors += 1
            
    conn.commit()
    
    # Log to audit (summary)
    if not dry_run:
        cur.execute("""
            INSERT INTO public.audit_logs (
                action, resource_type, details, created_at
            ) VALUES (
                'SEED_AES_HTS_CENSUS', 'aes_hts_codes', %s, NOW()
            );
        """, (f'{{"total_processed": {total}, "inserted_updated": {inserted}, "errors": {errors}}}',))
        conn.commit()

    cur.close()
    conn.close()
    
    print(f"\nSeeding Complete.")
    print(f"Total Lines: {total}")
    print(f"Inserted/Updated: {inserted}")
    print(f"Skipped/Errors: {errors}")

def generate_validation_report():
    conn = get_db_connection()
    cur = conn.cursor()
    
    report = {}
    
    # Total count
    cur.execute("SELECT count(*) FROM aes_hts_codes")
    report['total_count'] = cur.fetchone()[0]
    
    # Invalid formats (though DB constraint prevents this, check raw imports if any)
    cur.execute("SELECT count(*) FROM aes_hts_codes WHERE hts_code !~ '^[0-9]{4}(\.[0-9]{2}){0,3}$'")
    report['invalid_format'] = cur.fetchone()[0]
    
    # Missing Descriptions
    cur.execute("SELECT count(*) FROM aes_hts_codes WHERE description IS NULL OR description = ''")
    report['missing_description'] = cur.fetchone()[0]
    
    # Missing UOM
    cur.execute("SELECT count(*) FROM aes_hts_codes WHERE unit_of_measure IS NULL OR unit_of_measure = ''")
    report['missing_uom'] = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    print("\n--- Validation Report ---")
    print(f"Total Records: {report['total_count']}")
    print(f"Invalid Formats: {report['invalid_format']}")
    print(f"Missing Description: {report['missing_description']}")
    print(f"Missing UOM: {report['missing_uom']}")
    
    if report['invalid_format'] == 0 and report['missing_description'] == 0:
        print("Status: HEALTHY")
    else:
        print("Status: WARNING - Check Data Integrity")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed AES HTS Codes from Census Bureau Data")
    parser.add_argument("--url", default=DEFAULT_URL, help="URL to Census Concordance File")
    parser.add_argument("--file", help="Path to local file (overrides URL)")
    parser.add_argument("--dry-run", action="store_true", help="Validate without DB changes")
    
    args = parser.parse_args()
    
    lines = []
    if args.file and os.path.exists(args.file):
        print(f"Reading from local file: {args.file}")
        try:
            with open(args.file, 'r', encoding='latin-1') as f:
                lines = f.readlines()
        except Exception as e:
            print(f"Error reading file: {e}")
            sys.exit(1)
    else:
        # Try default URL if no file provided
        lines = fetch_data(args.url)
        if not lines:
            print("Failed to fetch data from URL. Please provide a local file with --file.")
            sys.exit(1)
            
    seed_database(lines, args.dry_run)
    
    if not args.dry_run:
        generate_validation_report()
