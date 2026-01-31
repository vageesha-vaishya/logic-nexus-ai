import pandas as pd
import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load env
load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Env vars missing")
    sys.exit(1)

supabase: Client = create_client(url, key)

EXCEL_FILE = 'scripts/AESTIR_Export_Reference_Data.xlsx'

def rollback():
    print("WARNING: This will DELETE ports from the database that match the Excel file.")
    confirm = input("Are you sure? (type 'yes' to confirm): ")
    if confirm != 'yes':
        print("Aborted.")
        return

    print(f"Reading {EXCEL_FILE}...")
    df = pd.read_excel(EXCEL_FILE, sheet_name='US_Port_Codes')
    
    codes_to_remove = []
    for index, row in df.iterrows():
        raw_code = row.get('PORT_CODE')
        if pd.isna(raw_code): continue
        
        # Normalize code using same logic as import
        if isinstance(raw_code, (int, float)):
            code = str(int(raw_code)).zfill(4)
        else:
            code = str(raw_code).strip()
            if code.isdigit():
                code = code.zfill(4)
                
        if len(code) == 4:
            codes_to_remove.append(code)
            
    print(f"Identified {len(codes_to_remove)} codes to potentially remove.")
    
    # Batch delete
    batch_size = 100
    for i in range(0, len(codes_to_remove), batch_size):
        batch = codes_to_remove[i:i+batch_size]
        response = supabase.table("ports_locations").delete().in_("location_code", batch).execute()
        print(f"Deleted batch {i//batch_size + 1}")
        
    print("Rollback complete.")

if __name__ == "__main__":
    rollback()
