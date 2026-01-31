import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM aes_hts_codes;")
    print(f"Count: {cur.fetchone()[0]}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
