import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env")
    sys.exit(1)

supabase: Client = create_client(url, key)

def validate_ports():
    print("Validating ports_locations table...")
    
    # Fetch all ports
    # Note: If table is huge, we should paginate. For 500 ports, this is fine.
    response = supabase.table("ports_locations").select("id, location_code, location_name, schedule_d_code").execute()
    
    ports = response.data
    issues = []
    
    for port in ports:
        loc_code = port.get('location_code')
        sched_code = port.get('schedule_d_code')
        
        # Check location_code format (should be 4 digits for US ports generally, but might vary globally)
        # Assuming we are validating US ports primarily or standard format
        if loc_code and len(loc_code) != 4 and loc_code.isdigit():
             issues.append(f"Port {port['id']} ({port['location_name']}) has suspicious location_code: '{loc_code}'")
        
        # Check if schedule_d_code matches location_code for US ports
        # (This might be a business rule, but good to check)
        
    if issues:
        print(f"Found {len(issues)} issues:")
        for issue in issues:
            print(f"- {issue}")
        sys.exit(1)
    else:
        print("Validation passed. No obvious issues found in location_code format.")

if __name__ == "__main__":
    validate_ports()
