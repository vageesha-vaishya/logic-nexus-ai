#!/bin/bash
set -e

echo "Starting migration process..."

# Create schema and table if not exists
echo "Checking migration table..."
docker exec -i supabase-db psql -U postgres -c "CREATE SCHEMA IF NOT EXISTS supabase_migrations;"
docker exec -i supabase-db psql -U postgres -c "CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);"

# Directory containing migrations
MIGRATION_DIR="migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
    echo "Error: Directory '$MIGRATION_DIR' not found."
    exit 1
fi

echo "Processing migrations from $MIGRATION_DIR..."

# Iterate through sorted migration files
for file in $(ls "$MIGRATION_DIR"/*.sql | sort); do
    filename=$(basename "$file")
    
    # Extract version (digits before underscore)
    version=$(echo "$filename" | grep -oE '^[0-9]+')
    
    if [ -z "$version" ]; then
        echo "Skipping $filename (no version prefix found)"
        continue
    fi
    
    # Check if migration is already applied
    count=$(docker exec -i supabase-db psql -U postgres -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '$version';")
    
    if [ "$count" -eq "0" ]; then
        echo "Applying migration: $filename (version: $version)"
        
        # Apply the SQL file
        # Note: Using cat to pipe content to docker exec
        if cat "$file" | docker exec -i supabase-db psql -U postgres -f - > /dev/null; then
            echo "Successfully applied $filename"
            
            # Record the migration
            # Extract name part (remove version and extension)
            name=$(echo "$filename" | sed -E "s/^${version}_//;s/\.sql$//")
            
            # Insert record
            docker exec -i supabase-db psql -U postgres -c "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('$version', '$name', NULL);"
        else
            echo "Error applying $filename"
            exit 1
        fi
    else
        echo "Skipping $filename (already applied)"
    fi
done

echo "All migrations processed successfully."
