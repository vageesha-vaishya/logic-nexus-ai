#!/bin/bash
set -e

TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BACKUP_DIR="/root/backups"
mkdir -p "$BACKUP_DIR"

echo "Starting backup for timestamp: $TIMESTAMP"

# Dump the postgres database from the supabase-db container
docker exec supabase-db pg_dump -U postgres postgres > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

if [ $? -eq 0 ]; then
    echo "Backup successful: $BACKUP_DIR/db_backup_$TIMESTAMP.sql"
    # Keep last 7 backups, delete older ones
    find "$BACKUP_DIR" -type f -name "db_backup_*.sql" -mtime +7 -delete
else
    echo "Backup failed!"
    exit 1
fi
