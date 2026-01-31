import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Check if table exists
    cur.execute("SELECT to_regclass('public.aes_hts_codes');")
    exists = cur.fetchone()[0]
    
    if exists:
        print("Table public.aes_hts_codes exists.")
        # Get columns
        cur.execute("""
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'aes_hts_codes';
        """)
        columns = cur.fetchall()
        print("\nColumns:")
        for col in columns:
            print(col)
    else:
        print("Table public.aes_hts_codes does NOT exist.")

    # Check for audit_logs
    cur.execute("SELECT to_regclass('public.audit_logs');")
    audit_exists = cur.fetchone()[0]
    if audit_exists:
        print("\nTable public.audit_logs exists.")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'audit_logs';
        """)
        cols = cur.fetchall()
        print("Audit Logs Columns:", cols)
    else:
        print("\nTable public.audit_logs does NOT exist.")

    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
