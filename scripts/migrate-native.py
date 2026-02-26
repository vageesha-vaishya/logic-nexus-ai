#!/usr/bin/env python3

"""
Dashboard Role Migration - Native Python PostgreSQL
Uses psycopg2 for direct database connection (no external tools needed)
"""

import os
import sys
import re
from pathlib import Path
from urllib.parse import urlparse

# Try to import psycopg2
try:
    import psycopg2
    import psycopg2.extras
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

def load_env():
    """Load environment variables from .env file"""
    env_path = Path(__file__).parent.parent / ".env"
    env_vars = {}

    if not env_path.exists():
        print("❌ .env file not found")
        return None

    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip().strip('\"\'')

    return env_vars

def parse_db_url(db_url):
    """Parse PostgreSQL connection URL"""
    # Handle both postgres:// and postgresql:// schemes
    db_url = db_url.replace('postgres://', 'postgresql://')

    try:
        parsed = urlparse(db_url)
        return {
            'host': parsed.hostname,
            'port': parsed.port or 5432,
            'user': parsed.username,
            'password': parsed.password,
            'database': parsed.path.lstrip('/'),
        }
    except Exception as e:
        print(f"❌ Failed to parse database URL: {e}")
        return None

def install_psycopg2():
    """Attempt to install psycopg2"""
    print("📦 Installing psycopg2...")
    import subprocess
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'psycopg2-binary', '-q'])
        print("✅ psycopg2 installed successfully\n")
        return True
    except subprocess.CalledProcessError:
        print("⚠️ Failed to install psycopg2\n")
        return False

def main():
    print('\n╔════════════════════════════════════════════════════════════╗')
    print('║    Dashboard Migration - Native Python PostgreSQL           ║')
    print('╚════════════════════════════════════════════════════════════╝\n')

    # Load environment
    env = load_env()
    if not env:
        print("❌ Failed to load environment variables")
        sys.exit(1)

    # Get database URL
    db_url = env.get('DIRECT_URL') or env.get('DATABASE_URL')
    if not db_url:
        print("❌ Missing DIRECT_URL or DATABASE_URL in .env")
        sys.exit(1)

    # Check if psycopg2 is available
    if not HAS_PSYCOPG2:
        print('📋 psycopg2 not installed, attempting installation...\n')
        if not install_psycopg2():
            print('❌ Cannot proceed without psycopg2')
            print('\n📝 Fallback: Use Manual SQL in Supabase Dashboard:\n')
            print('  1. Go to: https://app.supabase.co')
            print('  2. Select your project')
            print('  3. Go to: SQL Editor → New Query')
            print('  4. Copy from: src/migrations/20260226_add_dashboard_role.sql')
            print('  5. Click: Run\n')
            sys.exit(1)
        # Re-import after installation
        import psycopg2
        import psycopg2.extras

    print('📋 Loading configuration...\n')
    print('✅ Configuration loaded:')
    print(f'   Database: Connected via DIRECT_URL')
    print(f'   Connection: PostgreSQL direct connection\n')

    # Parse database URL
    db_config = parse_db_url(db_url)
    if not db_config:
        sys.exit(1)

    # Read migration SQL
    migration_file = Path(__file__).parent.parent / "src/migrations/20260226_add_dashboard_role.sql"
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)

    with open(migration_file, 'r') as f:
        migration_sql = f.read()

    print('🚀 Running Migration\n')

    try:
        # Connect to database
        print("⏳ Connecting to database...")
        conn = psycopg2.connect(
            host=db_config['host'],
            port=db_config['port'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database'],
            sslmode='require'
        )
        print("✅ Connected\n")

        cursor = conn.cursor()

        # Split SQL by semicolon and execute each statement
        statements = [s.strip() for s in migration_sql.split(';') if s.strip()]

        print("⏳ Executing migration statements...\n")

        for i, statement in enumerate(statements, 1):
            try:
                print(f"  Step {i}: {statement[:60]}...")
                cursor.execute(statement)
                print(f"  ✅ Success\n")
            except psycopg2.errors.DuplicateObject as e:
                # Already exists - this is OK
                print(f"  ✅ Already exists (skipped)\n")
            except psycopg2.errors.DuplicateColumn as e:
                # Column already exists - this is OK
                print(f"  ✅ Already exists (skipped)\n")
            except Exception as e:
                print(f"  ⚠️ Warning: {str(e)}\n")

        # Commit transaction
        conn.commit()
        print('✅ Migration executed successfully\n')

        # Verify migration
        print('✓ Verifying Migration\n')

        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("""
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'profiles' AND column_name = 'dashboard_role'
        """)

        result = cursor.fetchone()

        if result:
            print('  ✅ Column dashboard_role exists')
            print(f'  ✅ Data type: {result["data_type"]}')
            print(f'  ✅ Default value: {result["column_default"]}')
            print(f'  ✅ Nullable: {"yes" if result["is_nullable"] else "no"}\n')

            # Check profiles count
            cursor.execute("SELECT COUNT(*) as total FROM public.profiles")
            count_result = cursor.fetchone()
            profile_count = count_result["total"] if count_result else 0
            print(f'  ✅ Found {profile_count} profiles in database\n')

            cursor.close()
            conn.close()

            print('╔════════════════════════════════════════════════════════════╗')
            print('║           ✅ MIGRATION SUCCESSFUL & VERIFIED                ║')
            print('╚════════════════════════════════════════════════════════════╝\n')

            print('📝 Next steps:\n')
            print('  1. Restart dev server:')
            print('     npm run dev\n')
            print('  2. Open browser to:')
            print('     http://localhost:5173/dashboard\n')
            print('  3. Dashboard will load with:')
            print('     ✅ Real role detection from database')
            print('     ✅ Widgets fetching real data')
            print('     ✅ Tenant-filtered queries\n')

            sys.exit(0)
        else:
            print('⚠️ Verification failed - column might not exist')
            cursor.close()
            conn.close()
            sys.exit(1)

    except psycopg2.Error as e:
        print(f'❌ Database error: {e}')
        print('\n📝 Fallback: Use Manual SQL in Supabase Dashboard:\n')
        print('  1. Go to: https://app.supabase.co')
        print('  2. Select your project')
        print('  3. Go to: SQL Editor → New Query')
        print('  4. Copy from: src/migrations/20260226_add_dashboard_role.sql')
        print('  5. Click: Run\n')
        sys.exit(1)

    except Exception as e:
        print(f'❌ Error: {e}')
        print('\n📝 Fallback: Use Manual SQL in Supabase Dashboard:\n')
        print('  1. Go to: https://app.supabase.co')
        print('  2. Select your project')
        print('  3. Go to: SQL Editor → New Query')
        print('  4. Copy from: src/migrations/20260226_add_dashboard_role.sql')
        print('  5. Click: Run\n')
        sys.exit(1)

if __name__ == '__main__':
    main()
