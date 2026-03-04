#!/bin/bash
set -e

DB_CONTAINER="supabase-db"
DB_USER="postgres"
MIGRATIONS_DIR="/root/migrations"

echo "Checking database connection..."
docker exec -i $DB_CONTAINER psql -U $DB_USER -c "SELECT 1" > /dev/null
if [ $? -ne 0 ]; then
    echo "Error: Cannot connect to database container $DB_CONTAINER"
    exit 1
fi

echo "Ensuring schema_migrations table exists..."
docker exec -i $DB_CONTAINER psql -U $DB_USER -c "
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text PRIMARY KEY,
    statements text[],
    name text
);"

echo "Starting migration application from $MIGRATIONS_DIR..."

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: Migrations directory $MIGRATIONS_DIR does not exist"
    exit 1
fi

cd "$MIGRATIONS_DIR"

# Sort files by version number
for file in $(ls *.sql | sort); do
    # Extract version (leading digits)
    version=$(echo "$file" | grep -oE '^[0-9]+')
    
    if [ -z "$version" ]; then
        echo "Skipping $file (no version number found)"
        continue
    fi

    # Check if already applied
    applied=$(docker exec -i $DB_CONTAINER psql -U $DB_USER -tAc "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$version'")

    if [ "$applied" != "1" ]; then
        echo "Applying $file (Version: $version)..."
        
        # Apply the migration
        # We use cat | docker exec to avoid mounting issues
        cat "$file" | docker exec -i $DB_CONTAINER psql -U $DB_USER -v ON_ERROR_STOP=1
        
        if [ $? -eq 0 ]; then
             # Record the migration
             docker exec -i $DB_CONTAINER psql -U $DB_USER -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '$file');"
             echo "Successfully applied $version"
        else
             echo "Failed to apply $file"
             exit 1
        fi
    else
        # echo "Skipping $version (already applied)"
        :
    fi
done

echo "All migrations processed successfully."
