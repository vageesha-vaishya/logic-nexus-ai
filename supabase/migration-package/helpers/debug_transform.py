#!/usr/bin/env python3
import os
import json
import csv
import importlib.util

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

def load_import_module():
    path = os.path.join(BASE_DIR, 'import-rest.py')
    spec = importlib.util.spec_from_file_location("import_rest", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def read_first_row(csv_path):
    with open(csv_path, newline='') as f:
        r = csv.DictReader(f)
        for row in r:
            return row
    return None

def main(table):
    mod = load_import_module()
    mappings = mod.load_mappings()
    lookups = {}
    csv_path = os.path.join(BASE_DIR, 'migration-data', f'{table}.csv')
    row = read_first_row(csv_path)
    if not row:
        print(json.dumps({"error": "No row"}))
        return
    # Simulate cleaning like to_json_rows
    clean = {}
    for k, v in row.items():
        if v is None:
            clean[k] = None
            continue
        v2 = v.strip()
        if v2 == "":
            clean[k] = None
        elif v2.lower() in ("true", "false"):
            clean[k] = (v2.lower() == "true")
        else:
            clean[k] = v2
    tr = mod.transform_row(table, clean, mappings, lookups)
    print(json.dumps({"raw": clean, "transformed": tr}, indent=2))

if __name__ == '__main__':
    import sys
    t = sys.argv[1] if len(sys.argv) > 1 else 'custom_roles'
    main(t)