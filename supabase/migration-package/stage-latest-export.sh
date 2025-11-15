#!/usr/bin/env bash
set -euo pipefail

# Stage the latest REST export CSVs into migration-data/ for the importer
# It copies and normalizes filenames by removing numeric prefixes.

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
HELPERS_DIR="$ROOT_DIR/helpers"
LATEST_DIR=$(ls -dt "$HELPERS_DIR"/migration-export-* 2>/dev/null | head -n 1 || true)

if [[ -z "$LATEST_DIR" ]]; then
  echo "[ERROR] No migration-export-* directory found in $HELPERS_DIR"
  exit 1
fi

DATA_DIR="$LATEST_DIR/data"
if [[ ! -d "$DATA_DIR" ]]; then
  echo "[ERROR] Data directory not found: $DATA_DIR"
  exit 1
fi

DEST_DIR="$ROOT_DIR/migration-data"
mkdir -p "$DEST_DIR"

tables=(
  currencies
  service_types
  service_type_mappings
  cargo_types
  package_categories
  package_sizes
  container_types
  container_sizes
  ports_locations
)

echo "Staging latest export from: $LATEST_DIR"
for t in "${tables[@]}"; do
  src=$(ls "$DATA_DIR"/*-"$t".csv 2>/dev/null | head -n 1 || true)
  if [[ -z "$src" ]]; then
    echo "[WARN] Missing CSV for table $t in $DATA_DIR"
    continue
  fi
  cp "$src" "$DEST_DIR/$t.csv"
  echo "[OK] Staged $t.csv"
done

echo "Done. Files are in $DEST_DIR"