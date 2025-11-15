#!/usr/bin/env python3
import os
import csv
import json
import ssl
from urllib import request, error

CSV_PATH = os.path.join(os.getcwd(), "supabase/migration-package/migration-data/carriers.csv")

def http_ctx():
    allow_insecure = os.environ.get("ALLOW_INSECURE_SSL", "false").lower() == "true"
    return ssl._create_unverified_context() if allow_insecure else ssl.create_default_context()

def load_env():
    base_url = os.environ.get("NEW_SUPABASE_URL")
    apikey = os.environ.get("NEW_SUPABASE_ANON_KEY")
    service_key = os.environ.get("NEW_SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_key:
        raise RuntimeError("Missing NEW_SUPABASE_URL or NEW_SUPABASE_SERVICE_ROLE_KEY")
    return base_url.rstrip('/'), apikey, service_key

def get_or_create_default_tenant(base_url, apikey, service_key):
    # Try fetch by slug
    url = f"{base_url}/rest/v1/tenants?slug=eq.default&select=id&limit=1"
    headers = {
        'Accept': 'application/json',
        'apikey': apikey or service_key,
        'Authorization': f'Bearer {service_key}',
    }
    req = request.Request(url, method='GET', headers=headers)
    with request.urlopen(req, timeout=30, context=http_ctx()) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        if data:
            return data[0]['id']
    # Create if missing
    url = f"{base_url}/rest/v1/tenants"
    payload = json.dumps([{ 'name': 'Default Tenant', 'slug': 'default', 'domain': None, 'is_active': True }]).encode('utf-8')
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': apikey or service_key,
        'Authorization': f'Bearer {service_key}',
        'Prefer': 'return=representation',
    }
    req = request.Request(url, data=payload, method='POST', headers=headers)
    with request.urlopen(req, timeout=60, context=http_ctx()) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        return data[0]['id'] if data else None

def read_rows(path):
    rows = []
    with open(path, newline='') as f:
        r = csv.DictReader(f)
        for row in r:
            rows.append(row)
    return rows

def clean_row(r, default_tenant_id: str | None):
    # Drop ID to let DB generate, null tenant_id to avoid FK mismatch
    r.pop('id', None)
    # Map to default tenant to satisfy NOT NULL constraint
    r['tenant_id'] = default_tenant_id
    # Normalize placeholder '[object Object]' to None
    for k in ['address','service_routes','notes','website','contact_email','contact_phone','contact_person']:
        v = r.get(k)
        if v and v.strip() == '[object Object]':
            r[k] = None
    # Normalize booleans and numerics
    r['is_active'] = str(r.get('is_active','true')).lower() in ('true','1','t','yes')
    try:
        r['rating'] = float(r['rating']) if r.get('rating') else None
    except Exception:
        r['rating'] = None
    # Empty strings to None
    for k, v in list(r.items()):
        if v is None:
            continue
        v2 = str(v).strip()
        if v2 == "":
            r[k] = None
    return r

def dedupe(rows):
    seen = set()
    out = []
    for r in rows:
        key = (
            r.get('carrier_name'),
            r.get('mode'),
            r.get('scac'),
            r.get('iata'),
            r.get('mc_dot'),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out

def post_rows(base_url, apikey, service_key, table, rows):
    url = f"{base_url}/rest/v1/{table}"
    payload = json.dumps(rows).encode('utf-8')
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': apikey or service_key,
        'Authorization': f'Bearer {service_key}',
        'Prefer': 'return=minimal',
    }
    req = request.Request(url, data=payload, method='POST', headers=headers)
    with request.urlopen(req, timeout=120, context=http_ctx()) as resp:
        return resp.getcode()

def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i+size]

def main():
    base_url, apikey, service_key = load_env()
    # Ensure a tenant exists to attach carriers
    default_tenant_id = get_or_create_default_tenant(base_url, apikey, service_key)
    if not os.path.exists(CSV_PATH):
        print(f"[ERROR] Missing carriers.csv at {CSV_PATH}")
        return 1

    raw = read_rows(CSV_PATH)
    cleaned = [clean_row(r, default_tenant_id) for r in raw]
    cleaned = dedupe(cleaned)

    total = len(cleaned)
    if total == 0:
        print("[WARN] No carriers to import after cleaning/dedupe")
        return 0

    imported = 0
    for batch in chunked(cleaned, 200):
        try:
            post_rows(base_url, apikey, service_key, 'carriers', batch)
            imported += len(batch)
        except error.HTTPError as e:
            body = e.read().decode('utf-8')
            print(f"[WARN] Batch import failed: {e.code} -> {body}")
        except Exception as e:
            print(f"[WARN] Batch import error: {e}")

    print(f"[OK] Imported carriers: {imported}/{total}")
    return 0

if __name__ == '__main__':
    raise SystemExit(main() or 0)