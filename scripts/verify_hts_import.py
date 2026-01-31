import os
import psycopg2
from dotenv import load_dotenv
import json

load_dotenv()
db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- AES HTS Codes ---")
    cur.execute("SELECT hts_code, description, category FROM aes_hts_codes ORDER BY hts_code;")
    rows = cur.fetchall()
    for r in rows:
        print(r)
        
    print("\n--- History ---")
    cur.execute("SELECT hts_code, operation_type, changed_at FROM aes_hts_codes_history ORDER BY changed_at;")
    rows = cur.fetchall()
    for r in rows:
        print(r)

    print("\n--- Audit Logs (Last 5) ---")
    cur.execute("SELECT action, resource_type, details FROM audit_logs ORDER BY created_at DESC LIMIT 5;")
    rows = cur.fetchall()
    for r in rows:
        print(f"Action: {r[0]}, Type: {r[1]}")
        # print(f"Details: {r[2]}") # Can be verbose
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
