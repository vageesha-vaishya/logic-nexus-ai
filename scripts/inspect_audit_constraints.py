import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT column_name, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'audit_logs';
    """)
    columns = cur.fetchall()
    print("Audit Logs Constraints:")
    for col in columns:
        print(col)
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
