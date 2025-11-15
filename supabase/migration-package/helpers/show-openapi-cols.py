#!/usr/bin/env python3
import os
import json
import importlib.util

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

def load_import_module():
    path = os.path.join(BASE_DIR, 'import-rest.py')
    spec = importlib.util.spec_from_file_location("import_rest", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def main(tables):
    mod = load_import_module()
    base_url, apikey, service_key, _ = mod.load_env()
    try:
        openapi = mod.fetch_openapi(base_url, apikey, service_key)
    except Exception as e:
        print(json.dumps({"error": f"Failed to fetch OpenAPI: {e}"}))
        return
    cols_map = mod.extract_table_columns(openapi)
    out = {}
    for t in tables:
        out[t] = sorted(list(cols_map.get(t, [])))
    print(json.dumps(out, indent=2))

if __name__ == '__main__':
    import sys
    tables = sys.argv[1:] or ['custom_roles','service_type_mappings','ports_locations']
    main(tables)