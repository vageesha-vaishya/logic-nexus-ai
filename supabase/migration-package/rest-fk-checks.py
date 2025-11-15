#!/usr/bin/env python3
import os
import json
import ssl
from urllib import request, parse

BASE_DIR = os.path.dirname(__file__)

def load_env():
    # Attempt to source from local env file
    env_path = os.path.join(BASE_DIR, 'new-supabase-config.env')
    if os.path.isfile(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    k, v = line.split('=', 1)
                    v = v.strip().strip('"')
                    os.environ.setdefault(k.strip(), v)
    url = os.environ.get('NEW_SUPABASE_URL')
    key = os.environ.get('NEW_SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise RuntimeError('Missing NEW_SUPABASE_URL or NEW_SUPABASE_SERVICE_ROLE_KEY')
    return url.rstrip('/'), key

def get_json(base_url, key, path, params=None):
    url = f"{base_url}/rest/v1/{path}"
    if params:
        qs = parse.urlencode(params, doseq=True)
        url = f"{url}?{qs}"
    headers = {
        'Accept': 'application/json',
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Prefer': 'count=exact'
    }
    req = request.Request(url, headers=headers)
    allow_insecure = os.environ.get('ALLOW_INSECURE_SSL', 'false').lower() == 'true'
    ctx = ssl._create_unverified_context() if allow_insecure else ssl.create_default_context()
    with request.urlopen(req, context=ctx) as resp:
        data = resp.read()
        return json.loads(data.decode('utf-8'))

def count_rows(base_url, key, table):
    # Use count via HEAD-like count param workaround: select=* and parse length
    data = get_json(base_url, key, table, {'select': 'id', 'limit': 10000})
    return len(data) if isinstance(data, list) else None

def distinct_ids(base_url, key, table, field):
    arr = get_json(base_url, key, table, {'select': field, 'order': field, 'limit': 10000})
    ids = set()
    for row in arr:
        val = row.get(field)
        if val is not None:
            ids.add(val)
    return ids

def exists_id(base_url, key, table, id_value):
    arr = get_json(base_url, key, table, {'select': 'id', 'id': f'eq.{id_value}', 'limit': 1})
    return bool(arr)

def main():
    base_url, key = load_env()
    checks = [
        {'child': 'franchises', 'field': 'tenant_id', 'parent': 'tenants'},
        {'child': 'accounts', 'field': 'tenant_id', 'parent': 'tenants'},
        {'child': 'accounts', 'field': 'franchise_id', 'parent': 'franchises'},
        {'child': 'contacts', 'field': 'tenant_id', 'parent': 'tenants'},
        {'child': 'contacts', 'field': 'account_id', 'parent': 'accounts'},
        {'child': 'contacts', 'field': 'franchise_id', 'parent': 'franchises'},
        {'child': 'leads', 'field': 'tenant_id', 'parent': 'tenants'},
        {'child': 'leads', 'field': 'franchise_id', 'parent': 'franchises'},
        {'child': 'opportunities', 'field': 'tenant_id', 'parent': 'tenants'},
        {'child': 'opportunities', 'field': 'account_id', 'parent': 'accounts'},
        {'child': 'opportunities', 'field': 'contact_id', 'parent': 'contacts'},
        {'child': 'opportunities', 'field': 'lead_id', 'parent': 'leads'},
        {'child': 'opportunities', 'field': 'franchise_id', 'parent': 'franchises'},
        {'child': 'quotes', 'field': 'tenant_id', 'parent': 'tenants'},
        {'child': 'quotes', 'field': 'opportunity_id', 'parent': 'opportunities'},
        {'child': 'quotes', 'field': 'account_id', 'parent': 'accounts'},
        {'child': 'quotes', 'field': 'contact_id', 'parent': 'contacts'},
        {'child': 'quotes', 'field': 'franchise_id', 'parent': 'franchises'},
        {'child': 'quote_items', 'field': 'quote_id', 'parent': 'quotes'},
        {'child': 'activities', 'field': 'tenant_id', 'parent': 'tenants'},
        {'child': 'activities', 'field': 'account_id', 'parent': 'accounts'},
        {'child': 'activities', 'field': 'contact_id', 'parent': 'contacts'},
        {'child': 'activities', 'field': 'lead_id', 'parent': 'leads'},
    ]

    results = { 'tables': {}, 'fk_orphans': [] }
    # counts per table
    for t in ['tenants','franchises','accounts','contacts','leads','opportunities','quotes','quote_items','activities']:
        results['tables'][t] = count_rows(base_url, key, t)

    # fk orphan checks
    for c in checks:
        child, field, parent = c['child'], c['field'], c['parent']
        ids = distinct_ids(base_url, key, child, field)
        missing = 0
        for val in ids:
            if not exists_id(base_url, key, parent, val):
                missing += 1
        results['fk_orphans'].append({
            'child': child,
            'field': field,
            'parent': parent,
            'distinct_fk_values': len(ids),
            'missing_parent_count': missing
        })

    print(json.dumps(results, indent=2))

if __name__ == '__main__':
    main()