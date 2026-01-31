import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")

migration_file = "supabase/migrations/20260130170000_hts_system_enhancement.sql"

try:
    with open(migration_file, 'r') as f:
        sql = f.read()

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print(f"Applying migration: {migration_file}")
    cur.execute(sql)
    conn.commit()
    print("Migration applied successfully.")

    cur.close()
    conn.close()
except Exception as e:
    print(f"Error applying migration: {e}")
