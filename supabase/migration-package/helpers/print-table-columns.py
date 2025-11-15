#!/usr/bin/env python3
import os
import json
import ssl
from urllib import request, error

TABLES = [
    "cargo_types",
    "package_categories",
    "package_sizes",
    "service_type_mappings",
]

def http_ctx():
    allow_insecure = os.environ.get("ALLOW_INSECURE_SSL", "false").lower() == "true"
    return ssl._create_unverified_context() if allow_insecure else ssl.create_default_context()

def fetch_openapi(base_url, service_key):
    url = f"{base_url}/rest/v1/"
    headers = {
        "Accept": "application/openapi+json",
        "Authorization": f"Bearer {service_key}",
    }
    req = request.Request(url, headers=headers, method="GET")
    with request.urlopen(req, timeout=60, context=http_ctx()) as resp:
        return json.loads(resp.read().decode("utf-8"))

def extract_table_props(openapi, table):
    # PostgREST can expose schemas under 'definitions' or 'components/schemas'
    defs = openapi.get("definitions") or {}
    comp = openapi.get("components", {}).get("schemas", {})
    schema = defs.get(table) or comp.get(table) or {}
    props = schema.get("properties") or {}
    return sorted(list(props.keys()))

def main():
    base_url = os.environ.get("NEW_SUPABASE_URL")
    service_key = os.environ.get("NEW_SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_key:
        print("[ERROR] Missing NEW_SUPABASE_URL or NEW_SUPABASE_SERVICE_ROLE_KEY.")
        return 1
    try:
        openapi = fetch_openapi(base_url, service_key)
    except error.HTTPError as e:
        print(f"[ERROR] OpenAPI fetch failed: {e.code}")
        try:
            body = e.read().decode("utf-8")
            print(body)
        except Exception:
            pass
        return 1
    except Exception as e:
        print(f"[ERROR] {e}")
        return 1

    print("==========================================")
    print("OpenAPI Columns: Target Tables")
    print("==========================================")
    for t in TABLES:
        cols = extract_table_props(openapi, t)
        print(f"- {t}: {', '.join(cols) if cols else '(no properties found)'}")

if __name__ == "__main__":
    raise SystemExit(main() or 0)