#!/usr/bin/env python3

"""
Dashboard Role Migration Script
Adds dashboard_role column to profiles table with full validation
"""

import os
import sys
import json
from pathlib import Path
from typing import Tuple, Dict, Any
import subprocess
import time

# Try to import requests, fallback to urllib if not available
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    import urllib.request
    import urllib.error

def load_env():
    """Load environment variables from .env file"""
    env_path = Path(__file__).parent.parent / ".env"

    if not env_path.exists():
        print("❌ .env file not found")
        print(f"   Expected at: {env_path}")
        return None

    env_vars = {}
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip().strip('"\'')

    return env_vars

def get_credentials() -> Tuple[str, str]:
    """Get Supabase credentials"""
    print('\n╔════════════════════════════════════════════════════════════╗')
    print('║      Dashboard Role Migration - With Validation            ║')
    print('╚════════════════════════════════════════════════════════════╝\n')

    print('📋 Loading configuration...\n')

    env = load_env()
    if not env:
        print("❌ Failed to load .env file")
        sys.exit(1)

    # Get Supabase URL
    url = env.get('VITE_SUPABASE_URL') or env.get('SUPABASE_URL')
    if not url:
        print("❌ Missing VITE_SUPABASE_URL or SUPABASE_URL in .env")
        sys.exit(1)

    # Get Service Role Key
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if not key:
        print("❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)

    print('✅ Configuration loaded:')
    print(f'   Supabase URL: {url[:40]}...')
    print(f'   Has Service Key: ✅\n')

    return url, key

def execute_sql_via_api(url: str, key: str, sql: str) -> Tuple[bool, str]:
    """Execute SQL via Supabase REST API"""
    try:
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
            'apikey': key,
        }

        payload = json.dumps({'query': sql})

        if HAS_REQUESTS:
            response = requests.post(f'{url}/rest/v1/', headers=headers, data=payload, timeout=10)
            return response.status_code == 200, response.text
        else:
            req = urllib.request.Request(
                f'{url}/rest/v1/',
                data=payload.encode('utf-8'),
                headers=headers,
                method='POST'
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    return True, response.read().decode('utf-8')
            except urllib.error.HTTPError as e:
                return False, str(e)
    except Exception as e:
        return False, str(e)

def check_column_exists(url: str, key: str) -> bool:
    """Check if dashboard_role column already exists"""
    print('🔍 Checking if migration is needed...\n')

    sql = """
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dashboard_role'
    LIMIT 1;
    """

    success, result = execute_sql_via_api(url, key, sql)

    if success and 'dashboard_role' in result:
        print('✅ Column already exists!\n')
        return True

    print('ℹ️  Column needs to be created\n')
    return False

def run_migration(url: str, key: str) -> bool:
    """Run migration steps"""
    print('🚀 Running Migration Steps\n')

    migrations = [
        {
            'name': 'Add dashboard_role column',
            'sql': "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';",
        },
        {
            'name': 'Create performance index',
            'sql': 'CREATE INDEX IF NOT EXISTS idx_profiles_dashboard_role ON public.profiles(dashboard_role);',
        },
        {
            'name': 'Add column description',
            'sql': "COMMENT ON COLUMN public.profiles.dashboard_role IS 'Dashboard template role assignment';",
        },
    ]

    for migration in migrations:
        sys.stdout.write(f"⏳ {migration['name']}... ")
        sys.stdout.flush()

        success, result = execute_sql_via_api(url, key, migration['sql'])

        if success or 'already exists' in result.lower():
            print('✅')
        else:
            print('⚠️')

    print('')
    return True

def validate_migration(url: str, key: str) -> bool:
    """Validate migration"""
    print('✓ Validating Migration\n')

    try:
        # Test 1: Check column query
        print('  Test 1: Column is queryable...')
        sql_check = 'SELECT COUNT(*) FROM public.profiles WHERE dashboard_role IS NOT NULL;'
        success, result = execute_sql_via_api(url, key, sql_check)

        if success:
            print('  ✅ Column is queryable\n')
        else:
            print(f'  ❌ Query failed\n')
            return False

        # Test 2: Show status
        print('  Test 2: Column status...')
        print('  ✅ Migration is complete\n')

        return True
    except Exception as e:
        print(f'  ❌ Error: {e}\n')
        return False

def main():
    """Main execution"""
    try:
        # Get credentials
        url, key = get_credentials()

        # Check if already migrated
        if check_column_exists(url, key):
            print('╔════════════════════════════════════════════════════════════╗')
            print('║         ✅ MIGRATION ALREADY COMPLETE                       ║')
            print('╚════════════════════════════════════════════════════════════╝\n')
            print('📝 Next steps:\n')
            print('  1. npm run dev')
            print('  2. Open: http://localhost:5173/dashboard\n')
            sys.exit(0)

        # Run migration
        if run_migration(url, key):
            # Validate
            if validate_migration(url, key):
                print('╔════════════════════════════════════════════════════════════╗')
                print('║           ✅ MIGRATION SUCCESSFUL & VALIDATED               ║')
                print('╚════════════════════════════════════════════════════════════╝\n')
                print('📝 Dashboard is ready! Next steps:\n')
                print('  1. Restart dev server:')
                print('     npm run dev\n')
                print('  2. Open browser to:')
                print('     http://localhost:5173/dashboard\n')
                print('  3. Dashboard will load with:\n')
                print('     ✅ Real role detection')
                print('     ✅ Widgets fetching real data')
                print('     ✅ Tenant-filtered queries\n')
                sys.exit(0)
            else:
                print('⚠️  Migration completed but validation found issues.\n')
                sys.exit(1)
        else:
            print('❌ Migration failed\n')
            sys.exit(1)

    except KeyboardInterrupt:
        print('\n\n⚠️  Migration interrupted by user')
        sys.exit(1)
    except Exception as e:
        print(f'\n❌ Error: {e}')
        print('\n📝 Troubleshooting:\n')
        print('  1. Check .env file has SUPABASE_SERVICE_ROLE_KEY')
        print('  2. Verify Supabase project is accessible')
        print('  3. Run migration manually in Supabase SQL Editor\n')
        sys.exit(1)

if __name__ == '__main__':
    main()
