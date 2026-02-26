#!/usr/bin/env python3

"""
Migration Diagnostic Script
Identifies root causes of migration failures with detailed debugging
"""

import os
import sys
import json
from pathlib import Path
from typing import Tuple, Dict, Any

# Try to import requests
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    import urllib.request
    import urllib.error

def print_section(title: str):
    """Print formatted section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def load_env() -> Dict[str, str]:
    """Load environment variables from .env file"""
    env_path = Path(__file__).parent.parent / ".env"

    if not env_path.exists():
        print(f"❌ .env file not found at: {env_path}")
        return {}

    env_vars = {}
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip().strip('\"\'')

    return env_vars

def check_env_vars(env: Dict[str, str]) -> bool:
    """Check if all required environment variables are present"""
    print_section("1. Environment Variables Check")

    required_vars = {
        'VITE_SUPABASE_URL': 'Supabase Project URL',
        'SUPABASE_SERVICE_ROLE_KEY': 'Service Role Key (admin privileges)',
    }

    all_present = True
    for var, description in required_vars.items():
        value = env.get(var)
        if value:
            # Show first 40 chars and last 10 chars
            display = f"{value[:40]}...{value[-10:]}" if len(value) > 50 else value
            print(f"✅ {var}")
            print(f"   Description: {description}")
            print(f"   Value: {display}\n")
        else:
            print(f"❌ {var} - MISSING")
            print(f"   Description: {description}\n")
            all_present = False

    return all_present

def test_connectivity(url: str, key: str) -> Tuple[bool, str]:
    """Test basic connectivity to Supabase"""
    print_section("2. Connectivity Test")

    try:
        # Test 1: Basic HTTP connectivity
        print("Testing basic HTTP connectivity...")
        if HAS_REQUESTS:
            response = requests.head(url, timeout=5)
            connectivity_ok = response.status_code < 500
        else:
            req = urllib.request.Request(url, method='HEAD')
            try:
                with urllib.request.urlopen(req, timeout=5) as response:
                    connectivity_ok = response.status_code < 500
            except urllib.error.HTTPError as e:
                connectivity_ok = e.code < 500

        if connectivity_ok:
            print(f"✅ Connected to {url}\n")
        else:
            print(f"❌ Unable to reach {url}\n")
            return False, "Connectivity failed"

        # Test 2: Authentication
        print("Testing authentication with Service Role Key...")
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
            'apikey': key,
        }

        if HAS_REQUESTS:
            response = requests.get(f"{url}/rest/v1/", headers=headers, timeout=5)
            auth_ok = response.status_code in [200, 401, 400, 404]  # Any response means auth was processed
        else:
            req = urllib.request.Request(f"{url}/rest/v1/", headers=headers, method='GET')
            try:
                with urllib.request.urlopen(req, timeout=5) as response:
                    auth_ok = response.status_code in [200, 401, 400, 404]
            except urllib.error.HTTPError as e:
                auth_ok = e.code in [200, 401, 400, 404]

        if auth_ok:
            print(f"✅ Authentication headers accepted\n")
            return True, "Connectivity OK"
        else:
            print(f"❌ Authentication failed\n")
            return False, "Authentication failed"

    except Exception as e:
        print(f"❌ Connection error: {str(e)}\n")
        return False, str(e)

def test_profiles_table(url: str, key: str) -> Tuple[bool, int]:
    """Test if we can query the profiles table"""
    print_section("3. Profiles Table Access")

    try:
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
            'apikey': key,
        }

        # Simple query to get count
        query_sql = "SELECT COUNT(*) as total FROM public.profiles LIMIT 1;"
        payload = json.dumps({'query': query_sql})

        print(f"Executing: {query_sql}")

        if HAS_REQUESTS:
            response = requests.post(
                f'{url}/rest/v1/',
                headers=headers,
                data=payload,
                timeout=10
            )
            success = response.status_code == 200
            result = response.text
        else:
            req = urllib.request.Request(
                f'{url}/rest/v1/',
                data=payload.encode('utf-8'),
                headers=headers,
                method='POST'
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    success = True
                    result = response.read().decode('utf-8')
            except urllib.error.HTTPError as e:
                success = False
                result = str(e)

        if success:
            print(f"✅ Query successful")
            try:
                data = json.loads(result)
                if isinstance(data, list) and len(data) > 0:
                    count = data[0].get('total', 'unknown')
                    print(f"   Profiles in table: {count}\n")
                    return True, int(count) if isinstance(count, int) else 0
                else:
                    print(f"   Response: {result[:100]}\n")
                    return True, 0
            except:
                print(f"   Response: {result[:100]}\n")
                return True, 0
        else:
            print(f"❌ Query failed")
            print(f"   Response: {result[:200]}\n")
            return False, 0

    except Exception as e:
        print(f"❌ Error: {str(e)}\n")
        return False, 0

def check_migration_exists(url: str, key: str) -> bool:
    """Check if dashboard_role column already exists"""
    print_section("4. Check Migration Status")

    try:
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
            'apikey': key,
        }

        query_sql = """
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'dashboard_role'
        LIMIT 1;
        """
        payload = json.dumps({'query': query_sql})

        print("Checking if dashboard_role column exists...")

        if HAS_REQUESTS:
            response = requests.post(
                f'{url}/rest/v1/',
                headers=headers,
                data=payload,
                timeout=10
            )
            success = response.status_code == 200
            result = response.text
        else:
            req = urllib.request.Request(
                f'{url}/rest/v1/',
                data=payload.encode('utf-8'),
                headers=headers,
                method='POST'
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    success = True
                    result = response.read().decode('utf-8')
            except urllib.error.HTTPError as e:
                success = False
                result = str(e)

        if success:
            if 'dashboard_role' in result:
                print(f"✅ Column EXISTS - Migration already complete!")
                print(f"   Next: Restart dev server and test\n")
                return True
            else:
                print(f"ℹ️  Column DOES NOT EXIST - Migration needed\n")
                return False
        else:
            print(f"⚠️  Unable to check column status")
            print(f"   Response: {result[:200]}\n")
            return False

    except Exception as e:
        print(f"⚠️  Error checking column: {str(e)}\n")
        return False

def print_recommendations(env_ok: bool, connectivity_ok: bool, profiles_ok: bool, migration_exists: bool):
    """Print recommendations based on diagnostic results"""
    print_section("Recommendations")

    if not env_ok:
        print("""
❌ ISSUE: Missing environment variables

FIX:
1. Open .env file in your project root
2. Add these lines:
   VITE_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

3. Get values from:
   - Go to: https://app.supabase.com
   - Select your project
   - Go to: Settings → API
   - Copy: Project URL and Service Role Key

4. Save and try again
""")

    elif not connectivity_ok:
        print("""
❌ ISSUE: Cannot connect to Supabase

FIX:
1. Verify VITE_SUPABASE_URL is correct:
   - Should start with: https://
   - Should end with: .supabase.co
   - Example: https://myproject.supabase.co

2. Check your internet connection

3. Verify Supabase project is not paused:
   - Go to: https://app.supabase.com
   - Select your project
   - Check status (should be green/active)

4. Try accessing https://app.supabase.com directly
""")

    elif not profiles_ok:
        print("""
❌ ISSUE: Cannot access profiles table

FIX:
1. Check that profiles table exists:
   - Go to: https://app.supabase.co
   - Select your project
   - Go to: Database → Tables
   - Look for 'profiles' table

2. Verify Service Role Key permissions:
   - Make sure you're using SUPABASE_SERVICE_ROLE_KEY (not ANON_KEY)
   - Service role has admin privileges

3. If profiles table doesn't exist, create it:
   - Go to: SQL Editor
   - Run:
     CREATE TABLE IF NOT EXISTS public.profiles (
       id UUID PRIMARY KEY REFERENCES auth.users(id),
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
     );
""")

    elif migration_exists:
        print("""
✅ MIGRATION ALREADY COMPLETE!

Your database already has the dashboard_role column.

NEXT STEPS:
1. Restart development server:
   npm run dev

2. Open browser to:
   http://localhost:5173/dashboard

3. Log in with your test user

4. Dashboard should now display with real role detection
""")

    else:
        print("""
✅ All checks passed! Ready to migrate.

NEXT STEPS:

Option 1: Use direct SQL in Supabase Dashboard (SAFEST)
  1. Go to: https://app.supabase.co
  2. Select your project
  3. Go to: SQL Editor → New Query
  4. Copy the SQL from: src/migrations/20260226_add_dashboard_role.sql
  5. Paste and click Run
  6. Wait for "Query executed successfully"

Option 2: Re-run this diagnostic after manually running SQL
  python3 scripts/diagnose-migration.py
  (It will detect the completed migration)

Option 3: Try the Python migration script
  python3 scripts/migrate_dashboard.py
  (Now that connectivity is verified)
""")

def main():
    """Main diagnostic execution"""
    print('\n╔════════════════════════════════════════════════════════════╗')
    print('║        Dashboard Migration - Diagnostic Tool               ║')
    print('╚════════════════════════════════════════════════════════════╝')

    # Load environment
    env = load_env()
    env_ok = check_env_vars(env)

    if not env_ok:
        print_recommendations(False, False, False, False)
        sys.exit(1)

    url = env.get('VITE_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')

    # Test connectivity
    connectivity_ok, conn_msg = test_connectivity(url, key)

    if not connectivity_ok:
        print_recommendations(True, False, False, False)
        sys.exit(1)

    # Test profiles table
    profiles_ok, profile_count = test_profiles_table(url, key)

    if not profiles_ok:
        print_recommendations(True, True, False, False)
        sys.exit(1)

    # Check migration status
    migration_exists = check_migration_exists(url, key)

    # Print recommendations
    print_recommendations(True, True, True, migration_exists)

    if migration_exists:
        sys.exit(0)
    else:
        print("\n⚠️  Manual migration required. Use Option 1 above (recommended).")
        sys.exit(0)

if __name__ == '__main__':
    main()
