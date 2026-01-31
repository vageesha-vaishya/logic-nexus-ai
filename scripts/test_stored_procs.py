import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("Testing validate_hts_code:")
    cur.execute("SELECT public.validate_hts_code('0101.21.00')")
    print(f"Valid: {cur.fetchone()[0]}")
    cur.execute("SELECT public.validate_hts_code('BADCODE')")
    print(f"Invalid: {cur.fetchone()[0]}")
    
    print("\nTesting search_hts_codes:")
    cur.execute("SELECT hts_code, description FROM public.search_hts_codes('horse')")
    print(cur.fetchall())
    
    print("\nTesting get_hts_code_details:")
    cur.execute("SELECT current_record FROM public.get_hts_code_details('0101.21.00')")
    print(cur.fetchone()[0])

    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
