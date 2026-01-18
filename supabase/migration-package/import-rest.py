#!/usr/bin/env python3
import os
import sys
import csv
import json
import time
from urllib import request, error, parse
import ssl
import re


TABLES = [
    # Master/config tables first (no heavy relationships)
    "currencies",
    "service_types",
    "service_type_mappings",
    "cargo_types",
    "package_categories",
    "package_sizes",
    "container_types",
    "container_sizes",
    "ports_locations",
    "incoterms",
    "charge_bases",
    "charge_categories",
    "charge_sides",
    # CRM and tenant-scoped tables
    "tenants",
    "franchises",
    "accounts",
    "contacts",
    "leads",
    "opportunities",
    "quotes",
    "activities",
    "custom_roles",
    "custom_role_permissions",
    # Operational/Logistics tables
    "carriers",
    "services",
    "consignees",
    # Quotation v2 tables
    "quotation_versions",
    "quotation_version_options",
    "quotation_version_option_legs",
    # Quote line items and charges
    "quote_items",
    "quote_charges",
    # Optional light tables (enable as needed)
    # "carriers",
    # "services",
]

# Static FK dependencies used to guide insert ordering.
# Key: child table, Value: list of parent tables that must be inserted first
FK_DEPENDENCIES = {
    # service_type_mappings.service_type_id references service_types.id
    "service_type_mappings": ["service_types"],
    # CRM tenant/franchise relationships and transactional dependencies
    "franchises": ["tenants"],
    "accounts": ["tenants", "franchises"],
    "contacts": ["tenants", "franchises", "accounts"],
    "leads": ["tenants", "franchises"],
    "opportunities": ["tenants", "franchises", "accounts", "contacts", "leads"],
    "quotes": ["tenants", "franchises", "opportunities", "accounts", "contacts"],
    "activities": ["tenants", "franchises", "accounts", "contacts", "leads"],
    "custom_roles": ["tenants"],
    "custom_role_permissions": ["custom_roles"],
    # Logistics dependencies
    "carriers": ["tenants"],
    "services": ["service_types", "carriers"],
    "consignees": ["tenants", "franchises"],
    # Quotation v2 dependencies
    "quotation_versions": ["quotes"],
    "quotation_version_options": ["quotation_versions"],
    "quotation_version_option_legs": ["quotation_version_options"],
    # Quote details
    "quote_items": ["quotes"],
    "quote_charges": ["quotes"],
}

def collect_dependencies_from_mappings(mapping_cfg):
    deps = {}
    for table, cfg in (mapping_cfg or {}).items():
        dfk = (cfg or {}).get("derive_fk") or {}
        parents = set()
        for _, rule in dfk.items():
            lk_table = rule.get("lookup_table")
            if lk_table:
                parents.add(lk_table)
        if parents:
            deps[table] = list(parents)
    return deps

def topo_sort_tables(tables, dependencies):
    # Kahn's algorithm for topological sort
    graph = {t: set() for t in tables}
    indegree = {t: 0 for t in tables}
    for child, parents in (dependencies or {}).items():
        if child not in graph:
            continue
        for p in parents:
            if p in graph and p != child:
                graph[p].add(child)
                indegree[child] = indegree.get(child, 0) + 1
    queue = [t for t in tables if indegree.get(t, 0) == 0]
    ordered = []
    while queue:
        n = queue.pop(0)
        ordered.append(n)
        for m in graph.get(n, set()):
            indegree[m] -= 1
            if indegree[m] == 0:
                queue.append(m)
    # If cycle or missing nodes, fallback to original order with parents first
    missing = [t for t in tables if t not in ordered]
    if missing:
        return [*ordered, *missing]
    return ordered


def load_env():
    base_url = os.environ.get("NEW_SUPABASE_URL")
    anon_key = os.environ.get("NEW_SUPABASE_ANON_KEY")
    service_key = os.environ.get("NEW_SUPABASE_SERVICE_ROLE_KEY") or anon_key
    data_dir = os.path.join(os.getcwd(), "migration-data")

    if not base_url or not service_key:
        print("[ERROR] Missing NEW_SUPABASE_URL or NEW_SUPABASE_SERVICE_ROLE_KEY/NEW_SUPABASE_ANON_KEY in environment.")
        sys.exit(1)

    return base_url.rstrip('/'), anon_key or service_key, service_key, data_dir


def sanitize_cell(value):
    if value is None:
        return None
    if isinstance(value, str):
        v = value.strip()
        if v == "":
            return None
        low = v.lower()
        if low in ("true", "false"):
            return low == "true"
        max_len = 10000
        if len(v) > max_len:
            v = v[:max_len]
        return v
    return value


def to_json_rows(csv_path):
    rows = []
    with open(csv_path, newline='') as f:
        r = csv.DictReader(f)
        for row in r:
            clean = {}
            for k, v in row.items():
                clean[k] = sanitize_cell(v)
            rows.append(clean)
    return rows


def post_rows(base_url, apikey, service_key, table, rows, on_conflict=None):
    url = f"{base_url}/rest/v1/{table}"
    if on_conflict:
        # Accept list or comma-separated string
        if isinstance(on_conflict, (list, tuple)):
            oc = ",".join(on_conflict)
        else:
            oc = str(on_conflict)
        url = f"{url}?on_conflict={parse.quote(oc)}"
    payload = json.dumps(rows).encode("utf-8")
    # Prefer header should only include resolution when on_conflict is provided
    prefer = "return=minimal,resolution=ignore-duplicates" if on_conflict else "return=minimal"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        # apikey can be anon or service; Authorization must be service
        "apikey": apikey or service_key,
        "Authorization": f"Bearer {service_key}",
        # Keep minimal return for speed; add resolution only with on_conflict
        "Prefer": prefer
    }
    req = request.Request(url, data=payload, method="POST", headers=headers)
    # SSL context: optionally allow insecure for environments missing CA bundles
    allow_insecure = os.environ.get("ALLOW_INSECURE_SSL", "false").lower() == "true"
    try:
        if allow_insecure:
            ctx = ssl._create_unverified_context()
        else:
            ctx = ssl.create_default_context()
    except Exception:
        ctx = None

    try:
        if ctx is not None:
            resp = request.urlopen(req, timeout=60, context=ctx)
        else:
            resp = request.urlopen(req, timeout=60)
        with resp:
            code = resp.getcode()
            return True, code, None
    except error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = str(e)
        return False, e.code, body
    except Exception as e:
        return False, None, str(e)


def post_rows_with_retry(base_url, apikey, service_key, table, rows, on_conflict=None, max_retries=3):
    attempt = 0
    last_code = None
    last_err = None
    while attempt < max_retries:
        ok, code, err = post_rows(base_url, apikey, service_key, table, rows, on_conflict=on_conflict)
        if ok and code in (201, 204):
            return True, code, err, attempt + 1
        retryable = code is None or (isinstance(code, int) and code >= 500)
        if not retryable:
            return ok, code, err, attempt + 1
        attempt += 1
        last_code = code
        last_err = err
        time.sleep(min(5, attempt))
    return False, last_code, last_err, max_retries


def dedupe_rows(rows, key_fields=None):
    seen = set()
    out = []
    for r in rows:
        if key_fields:
            key = tuple(r.get(k) for k in key_fields)
        else:
            # fallback: use sorted items for a deterministic key
            key = tuple(sorted(r.items()))
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def fetch_openapi(base_url, apikey, service_key):
    url = f"{base_url}/rest/v1/"
    headers = {
        "Accept": "application/openapi+json",
        "apikey": apikey or service_key,
        "Authorization": f"Bearer {service_key}",
    }
    req = request.Request(url, method="GET", headers=headers)
    allow_insecure = os.environ.get("ALLOW_INSECURE_SSL", "false").lower() == "true"
    ctx = ssl._create_unverified_context() if allow_insecure else ssl.create_default_context()
    with request.urlopen(req, timeout=60, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_filter_query(params):
    # params: dict of key -> value; use eq for non-null, is.null for None
    parts = []
    for k, v in params.items():
        if v is None:
            parts.append(f"{parse.quote(k)}=is.null")
        else:
            # Booleans and numbers as literals; strings url-encoded
            if isinstance(v, bool):
                lit = "true" if v else "false"
            else:
                lit = str(v)
            parts.append(f"{parse.quote(k)}=eq.{parse.quote(lit)}")
    return "&".join(parts)


def rest_count(base_url, apikey, service_key, table, match_params):
    q = build_filter_query(match_params)
    url = f"{base_url}/rest/v1/{table}?{q}&select=id&limit=1"
    headers = {
        "Accept": "application/json",
        "Prefer": "count=exact",
        "apikey": apikey or service_key,
        "Authorization": f"Bearer {service_key}",
    }
    req = request.Request(url, method="GET", headers=headers)
    allow_insecure = os.environ.get("ALLOW_INSECURE_SSL", "false").lower() == "true"
    ctx = ssl._create_unverified_context() if allow_insecure else ssl.create_default_context()
    try:
        with request.urlopen(req, timeout=30, context=ctx) as resp:
            cr = resp.headers.get("Content-Range")
            total = None
            if cr and "/" in cr:
                try:
                    total = int(cr.split("/")[-1])
                except Exception:
                    total = None
            return total if total is not None else 0
    except error.HTTPError as e:
        # Fallback on any 4xx/5xx error to avoid hard failure in upsert path
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = str(e)
        print(f"[WARN] count query failed for {table}: {e.code} {body}. URL={url}")
        return 0


def patch_rows(base_url, apikey, service_key, table, match_params, payload):
    q = build_filter_query(match_params)
    url = f"{base_url}/rest/v1/{table}?{q}"
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=minimal",
        "apikey": apikey or service_key,
        "Authorization": f"Bearer {service_key}",
    }
    req = request.Request(url, data=body, method="PATCH", headers=headers)
    allow_insecure = os.environ.get("ALLOW_INSECURE_SSL", "false").lower() == "true"
    ctx = ssl._create_unverified_context() if allow_insecure else ssl.create_default_context()
    try:
        with request.urlopen(req, timeout=60, context=ctx) as resp:
            return True, resp.getcode(), None
    except error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = str(e)
        return False, e.code, body
    except Exception as e:
        return False, None, str(e)


def extract_table_columns(openapi_json):
    columns_map = {}
    # PostgREST OpenAPI can list definitions per table
    defs = openapi_json.get("definitions") or {}
    for name, schema in defs.items():
        props = schema.get("properties") or {}
        columns_map[name] = set(props.keys())
    # Fallback: parse from paths parameters
    paths = openapi_json.get("paths") or {}
    for path, ops in paths.items():
        # Path format: /table
        m = re.match(r"^/(.+)$", path)
        if not m:
            continue
        tname = m.group(1)
        for method, op in ops.items():
            params = op.get("parameters") or []
            for p in params:
                name = p.get("name")
                if name:
                    columns_map.setdefault(tname, set()).add(name)
    return columns_map


def import_table(base_url, apikey, service_key, data_dir, table, table_columns, mapping_cfg, lookups):
    path = os.path.join(data_dir, f"{table}.csv")
    if not os.path.isfile(path):
        print(f"[SKIP] {table}: no CSV found")
        return {"table": table, "found": False}

    size = os.path.getsize(path)
    if size == 0:
        print(f"[SKIP] {table}: empty CSV")
        return {"table": table, "found": True, "empty": True}

    rows = None
    total = 0
    with open(path, newline='') as f:
        r = csv.DictReader(f)
        for _ in r:
            total += 1
    if total == 0:
        print(f"[SKIP] {table}: no data rows")
        return {"table": table, "found": True, "empty": True}

    print(f"[INFO] {table}: {total} rows to insert")
    chunk_size_env = os.environ.get("IMPORT_BATCH_SIZE")
    try:
        chunk_size = int(chunk_size_env) if chunk_size_env else 500
    except Exception:
        chunk_size = 500
    inserted = 0
    conflicts = 0
    errors = []

    # Determine on_conflict keys from mapping config
    cfg = mapping_cfg.get(table) or {}
    on_conflict = cfg.get("on_conflict")
    dedupe_key = cfg.get("dedupe_key")

    # Build allowed columns set.
    # Prefer strict OpenAPI schema when available to proactively trim unsupported fields.
    # If the schema is empty/unavailable, fall back to the mapping/derived/set fields.
    schema_allowed = table_columns.get(table, set()) or set()
    map_dsts = set((cfg.get("map") or {}).values())
    derive_fk_dsts = set((cfg.get("derive_fk") or {}).keys())
    set_fields = set((cfg.get("set") or {}).keys())
    match_on_fields = set(cfg.get("match_on") or [])
    # Use union to keep mapped fields even if schema introspection is incomplete
    allowed_union = set(schema_allowed) | map_dsts | derive_fk_dsts | set_fields | match_on_fields
    strict_guard = os.environ.get("STRICT_OPENAPI_GUARD", "true").lower() == "true"
    allowed_final = schema_allowed if (strict_guard and schema_allowed) else allowed_union
    # Debug logging for trimmed fields
    debug_trim = os.environ.get("LOG_TRIMMED_FIELDS", "false").lower() == "true"
    trimmed_keys = set()

    # Allow disabling on_conflict dynamically if schema doesn't support it
    disable_on_conflict = False

    # If match_on provided, perform existence-aware upsert per-row
    match_on = cfg.get("match_on")
    if match_on:
        rows = to_json_rows(path)
        total = len(rows)
        # Validate match_on against allowed set
        allowed = allowed_final
        valid_match_on = [k for k in match_on if (not allowed or k in allowed)]
        if not valid_match_on:
            print(f"[WARN] table {table}: match_on keys not in schema; falling back to insert-only.")
        else:
            match_on = valid_match_on
            for r in rows:
                tr = transform_row(table, r, mapping_cfg, lookups)
                # Filter allowed columns
                allowed = allowed_final
                filtered = {k: v for k, v in tr.items() if (not allowed or k in allowed)}
                if debug_trim:
                    for k in tr.keys():
                        if (allowed and k not in allowed):
                            trimmed_keys.add(k)
                if not filtered:
                    continue
                match_params = {k: filtered.get(k) for k in match_on}
                count = rest_count(base_url, apikey, service_key, table, match_params)
                if count and count > 0:
                    ok, code, err = patch_rows(base_url, apikey, service_key, table, match_params, filtered)
                    if ok and code in (200, 204):
                        # treat updates as inserted for reporting consistency
                        inserted += 1
                    else:
                        errors.append({"row": filtered, "operation": "patch", "row_id": filtered.get("id"), "code": code, "error": err})
                else:
                    ok, code, err = post_rows(base_url, apikey, service_key, table, [filtered], on_conflict=None)
                    if ok and code in (201, 204):
                        inserted += 1
                    elif code == 409:
                        conflicts += 1
                    else:
                        errors.append({"row": filtered, "operation": "insert", "row_id": filtered.get("id"), "code": code, "error": err})
            print(f"[DONE] {table}: inserted/updated={inserted} conflicts={conflicts} errors={len(errors)}")
            if debug_trim and trimmed_keys:
                print(f"[DEBUG] {table}: trimmed fields due to guard -> {sorted(trimmed_keys)}")
            return {
                "table": table,
                "found": True,
                "inserted": inserted,
                "conflicts": conflicts,
                "errors": errors,
            }

    processed = 0
    total_batches = (total + chunk_size - 1) // chunk_size
    batch_index = 0
    start_table = time.monotonic()
    with open(path, newline='') as f:
        r = csv.DictReader(f)
        chunk_raw = []
        for raw_row in r:
            norm_row = {k: sanitize_cell(v) for k, v in raw_row.items()}
            chunk_raw.append(norm_row)
            if len(chunk_raw) >= chunk_size:
                batch_index += 1
                batch_start = time.monotonic()
                allowed = allowed_final
                chunk = []
                for row in chunk_raw:
                    tr = transform_row(table, row, mapping_cfg, lookups)
                    filtered = {k: v for k, v in tr.items() if (not allowed or k in allowed)}
                    if debug_trim:
                        for k in tr.keys():
                            if (allowed and k not in allowed):
                                trimmed_keys.add(k)
                    if filtered:
                        chunk.append(filtered)
                if chunk:
                    chunk = dedupe_rows(chunk, key_fields=dedupe_key)
                if not chunk:
                    errors.append({"chunk": batch_index, "code": 400, "error": "No matching columns in payload"})
                    print(f"[ERROR] {table}: chunk {batch_index} has no matching columns; skipping")
                else:
                    oc = None if disable_on_conflict else on_conflict
                    ok, code, err, _ = post_rows_with_retry(base_url, apikey, service_key, table, chunk, on_conflict=oc)
                    if ok and code in (201, 204):
                        inserted += len(chunk)
                    else:
                        if code == 409:
                            print(f"[WARN] {table}: bulk conflict on chunk {batch_index}. Retrying per-row...")
                            for row in chunk:
                                ok1, code1, err1 = post_rows(base_url, apikey, service_key, table, [row], on_conflict=None)
                                if ok1 and code1 in (201, 204):
                                    inserted += 1
                                elif code1 == 409:
                                    conflicts += 1
                                else:
                                    errors.append({"chunk": batch_index, "operation": "row", "row_id": row.get("id"), "code": code1, "error": err1})
                            print(f"[INFO] {table}: per-row retry completed for chunk {batch_index}")
                        else:
                            if err and ("42P10" in str(err) or "42703" in str(err)) and not disable_on_conflict and on_conflict:
                                print(f"[WARN] {table}: disabling on_conflict due to schema mismatch; retrying chunk bulk...")
                                disable_on_conflict = True
                                ok2, code2, err2, _ = post_rows_with_retry(base_url, apikey, service_key, table, chunk, on_conflict=None)
                                if ok2 and code2 in (201, 204):
                                    inserted += len(chunk)
                                elif code2 == 409:
                                    print(f"[WARN] {table}: conflict persists; retrying per-row...")
                                    for row in chunk:
                                        ok3, code3, err3 = post_rows(base_url, apikey, service_key, table, [row], on_conflict=None)
                                        if ok3 and code3 in (201, 204):
                                            inserted += 1
                                        elif code3 == 409:
                                            conflicts += 1
                                        else:
                                            errors.append({"chunk": batch_index, "code": code3, "error": err3})
                                else:
                                    sample_id = None
                                    try:
                                        sample_id = chunk[0].get("id")
                                    except Exception:
                                        pass
                                    col_to_drop = None
                                    try:
                                        msg = str(err2 or "")
                                        m = re.search(r"Could not find the '([^']+)' column", msg)
                                        if m:
                                            col_to_drop = m.group(1)
                                    except Exception:
                                        pass
                                    if col_to_drop:
                                        reduced_chunk = []
                                        for row in chunk:
                                            r2 = dict(row)
                                            r2.pop(col_to_drop, None)
                                            reduced_chunk.append(r2)
                                        ok4, code4, err4, _ = post_rows_with_retry(base_url, apikey, service_key, table, reduced_chunk, on_conflict=oc)
                                        if ok4 and code4 in (201, 204):
                                            inserted += len(reduced_chunk)
                                        else:
                                            errors.append({"chunk": batch_index, "operation": "bulk", "row_id": sample_id, "code": code4, "error": err4})
                                    else:
                                        errors.append({"chunk": batch_index, "operation": "bulk", "row_id": sample_id, "code": code2, "error": err2})
                            else:
                                sample_id = None
                                try:
                                    sample_id = chunk[0].get("id")
                                except Exception:
                                    pass
                                col_to_drop = None
                                try:
                                    msg = str(err or "")
                                    m = re.search(r"Could not find the '([^']+)' column", msg)
                                    if m:
                                        col_to_drop = m.group(1)
                                except Exception:
                                    pass
                                if col_to_drop:
                                    reduced_chunk = []
                                    for row in chunk:
                                        r2 = dict(row)
                                        r2.pop(col_to_drop, None)
                                        reduced_chunk.append(r2)
                                    ok5, code5, err5, _ = post_rows_with_retry(base_url, apikey, service_key, table, reduced_chunk, on_conflict=oc)
                                    if ok5 and code5 in (201, 204):
                                        inserted += len(reduced_chunk)
                                    else:
                                        errors.append({"chunk": batch_index, "operation": "bulk", "row_id": sample_id, "code": code5, "error": err5})
                                        print(f"[ERROR] {table}: chunk {batch_index} failed code={code5} err={err5}")
                                else:
                                    errors.append({"chunk": batch_index, "operation": "bulk", "row_id": sample_id, "code": code, "error": err})
                                    print(f"[ERROR] {table}: chunk {batch_index} failed code={code} err={err}")
                processed += len(chunk_raw)
                batch_duration = time.monotonic() - batch_start
                if processed and total:
                    remaining = max(total - processed, 0)
                    elapsed = time.monotonic() - start_table
                    per_row = elapsed / processed
                    eta_seconds = remaining * per_row
                    print(f"[INFO] {table}: chunk {batch_index}/{total_batches} duration={batch_duration:.2f}s eta={eta_seconds:.1f}s")
                else:
                    print(f"[INFO] {table}: chunk {batch_index} duration={batch_duration:.2f}s")
                chunk_raw = []
        if chunk_raw:
            batch_index += 1
            batch_start = time.monotonic()
            allowed = allowed_final
            chunk = []
            for row in chunk_raw:
                tr = transform_row(table, row, mapping_cfg, lookups)
                filtered = {k: v for k, v in tr.items() if (not allowed or k in allowed)}
                if debug_trim:
                    for k in tr.keys():
                        if (allowed and k not in allowed):
                            trimmed_keys.add(k)
                if filtered:
                    chunk.append(filtered)
            if chunk:
                chunk = dedupe_rows(chunk, key_fields=dedupe_key)
            if not chunk:
                errors.append({"chunk": batch_index, "code": 400, "error": "No matching columns in payload"})
                print(f"[ERROR] {table}: chunk {batch_index} has no matching columns; skipping")
            else:
                oc = None if disable_on_conflict else on_conflict
                ok, code, err, _ = post_rows_with_retry(base_url, apikey, service_key, table, chunk, on_conflict=oc)
                if ok and code in (201, 204):
                    inserted += len(chunk)
                else:
                    if code == 409:
                        print(f"[WARN] {table}: bulk conflict on chunk {batch_index}. Retrying per-row...")
                        for row in chunk:
                            ok1, code1, err1 = post_rows(base_url, apikey, service_key, table, [row], on_conflict=None)
                            if ok1 and code1 in (201, 204):
                                inserted += 1
                            elif code1 == 409:
                                conflicts += 1
                            else:
                                errors.append({"chunk": batch_index, "operation": "row", "row_id": row.get("id"), "code": code1, "error": err1})
                        print(f"[INFO] {table}: per-row retry completed for chunk {batch_index}")
                    else:
                        if err and ("42P10" in str(err) or "42703" in str(err)) and not disable_on_conflict and on_conflict:
                            print(f"[WARN] {table}: disabling on_conflict due to schema mismatch; retrying chunk bulk...")
                            disable_on_conflict = True
                            ok2, code2, err2, _ = post_rows_with_retry(base_url, apikey, service_key, table, chunk, on_conflict=None)
                            if ok2 and code2 in (201, 204):
                                inserted += len(chunk)
                            elif code2 == 409:
                                print(f"[WARN] {table}: conflict persists; retrying per-row...")
                                for row in chunk:
                                    ok3, code3, err3 = post_rows(base_url, apikey, service_key, table, [row], on_conflict=None)
                                    if ok3 and code3 in (201, 204):
                                        inserted += 1
                                    elif code3 == 409:
                                        conflicts += 1
                                    else:
                                        errors.append({"chunk": batch_index, "code": code3, "error": err3})
                        else:
                            sample_id = None
                            try:
                                sample_id = chunk[0].get("id")
                            except Exception:
                                pass
                            errors.append({"chunk": batch_index, "operation": "bulk", "row_id": sample_id, "code": code, "error": err})
                            print(f"[ERROR] {table}: chunk {batch_index} failed code={code} err={err}")
            processed += len(chunk_raw)
            batch_duration = time.monotonic() - batch_start
            if processed and total:
                remaining = max(total - processed, 0)
                elapsed = time.monotonic() - start_table
                per_row = elapsed / processed
                eta_seconds = remaining * per_row
                print(f"[INFO] {table}: chunk {batch_index}/{total_batches} duration={batch_duration:.2f}s eta={eta_seconds:.1f}s")
            else:
                print(f"[INFO] {table}: chunk {batch_index} duration={batch_duration:.2f}s")

    print(f"[DONE] {table}: inserted={inserted} conflicts={conflicts} errors={len(errors)}")
    if debug_trim and trimmed_keys:
        print(f"[DEBUG] {table}: trimmed fields due to guard -> {sorted(trimmed_keys)}")
    return {
        "table": table,
        "found": True,
        "inserted": inserted,
        "conflicts": conflicts,
        "errors": errors,
    }


def main():
    base_url, apikey, service_key, data_dir = load_env()
    mappings = load_mappings()
    try:
        openapi = fetch_openapi(base_url, apikey, service_key)
        table_columns = extract_table_columns(openapi)
    except Exception as e:
        print(f"[WARN] Could not fetch OpenAPI schema: {e}. Proceeding without column filtering.")
        table_columns = {}
    # Assemble dependency graph from static map and mapping configuration
    dep_map = dict(FK_DEPENDENCIES)
    dep_map.update(collect_dependencies_from_mappings(mappings))
    ordered_tables = topo_sort_tables(TABLES, dep_map)
    print("[INFO] Insert order (FK-aware):", ", ".join(ordered_tables))

    # Lookups will be rebuilt per-table based on derive_fk needs, so that
    # parents inserted earlier are visible to children.
    lookups = {}
    results = []
    print("==========================================")
    print("REST Import: Master/Config Tables")
    print("==========================================")

    def ensure_lookups_for_table(table):
        cfg = mappings.get(table) or {}
        dfk = cfg.get("derive_fk") or {}
        for _, rule in dfk.items():
            lk_table = rule.get("lookup_table")
            lk_key = rule.get("lookup_target") or "id"
            lk_val_field = rule.get("lookup_key") or "identifier"
            if lk_table and lk_table not in lookups:
                try:
                    lookups[lk_table] = build_lookup(base_url, apikey, service_key, lk_table, lk_key, lk_val_field)
                    # If API returns empty, fallback to CSV
                    if not lookups[lk_table]:
                        lookups[lk_table] = build_lookup_from_csv(data_dir, lk_table, lk_key, lk_val_field)
                except Exception as e:
                    print(f"[WARN] Could not build {lk_table} lookup from API: {e}. Trying CSV fallback.")
                    try:
                        lookups[lk_table] = build_lookup_from_csv(data_dir, lk_table, lk_key, lk_val_field)
                    except Exception as e2:
                        print(f"[WARN] CSV fallback for {lk_table} lookup failed: {e2}")

    for t in ordered_tables:
        ensure_lookups_for_table(t)
        res = import_table(base_url, apikey, service_key, data_dir, t, table_columns, mappings, lookups)
        results.append(res)

    print("\nSummary:")
    for r in results:
        if not r.get("found"):
            print(f"- {r['table']}: skipped (no CSV)")
            continue
        if r.get("empty"):
            print(f"- {r['table']}: empty")
            continue
        print(f"- {r['table']}: inserted={r.get('inserted',0)} conflicts={r.get('conflicts',0)} errors={len(r.get('errors', []))}")

    # Detailed error preview per table (top 3)
    for r in results:
        errs = r.get("errors", [])
        if errs:
            print(f"\nErrors for {r['table']} (showing up to 3):")
            for e in errs[:3]:
                msg = str(e.get("error"))
                if len(msg) > 200:
                    msg = msg[:200] + "..."
                print(f"  - code={e.get('code')} op={e.get('operation','bulk')} row_id={e.get('row_id')} chunk={e.get('chunk')} msg={msg}")

    # Non-zero errors should cause non-success exit
    total_errors = sum(len(r.get("errors", [])) for r in results)
    if total_errors > 0:
        sys.exit(2)
def load_mappings():
    path = os.path.join(os.path.dirname(__file__), "column-mappings.json")
    if not os.path.isfile(path):
        return {}
    with open(path, "r") as f:
        return json.load(f)


def derive_size_feet(row):
    # Try explicit length_ft
    val = row.get("length_ft") or row.get("size_feet")
    if val and str(val).strip():
        try:
            return int(float(str(val)))
        except Exception:
            pass
    # Try from name: leading number before apostrophe
    name = row.get("name") or row.get("size_name") or ""
    m = re.search(r"(\d{2})\s*'", name)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            pass
    # Try from code: first digits
    code = row.get("code") or row.get("size_code") or ""
    m2 = re.search(r"(\d{2,3})", code)
    if m2:
        try:
            return int(m2.group(1))
        except Exception:
            pass
    return None


def build_lookup(base_url, apikey, service_key, table, key_field, value_field):
    url = f"{base_url}/rest/v1/{table}?select={key_field},{value_field}&limit=1000"
    headers = {
        "Accept": "application/json",
        "apikey": apikey or service_key,
        "Authorization": f"Bearer {service_key}",
    }
    req = request.Request(url, method="GET", headers=headers)
    allow_insecure = os.environ.get("ALLOW_INSECURE_SSL", "false").lower() == "true"
    ctx = ssl._create_unverified_context() if allow_insecure else ssl.create_default_context()
    with request.urlopen(req, timeout=60, context=ctx) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        # Build mapping value_field -> key_field (e.g., identifier -> id)
        return {str(d.get(value_field)): d.get(key_field) for d in data if d.get(value_field) is not None}

def build_lookup_from_csv(data_dir, table, key_field, value_field):
    path = os.path.join(data_dir, f"{table}.csv")
    if not os.path.isfile(path):
        return {}
    mapping = {}
    with open(path, newline='') as f:
        r = csv.DictReader(f)
        for row in r:
            k = row.get(value_field)
            v = row.get(key_field)
            if k is not None and v is not None and str(k).strip():
                mapping[str(k)] = v
    return mapping


def transform_row(table, row, mapping_cfg, lookups):
    cfg = mapping_cfg.get(table) or {}
    mapped = {}
    # Simple map
    for src, dst in (cfg.get("map") or {}).items():
        val = row.get(src)
        mapped[dst] = val
    # Carry through untouched fields if not mapped
    for k, v in row.items():
        if k not in mapped:
            mapped[k] = v
    # Derivations
    derive = cfg.get("derive") or {}
    if derive.get("size_feet") == "from_name_or_code":
        sf = derive_size_feet({**row, **mapped})
        if sf is not None:
            mapped["size_feet"] = sf
    # Foreign key derivations
    dfk = cfg.get("derive_fk") or {}
    for dst, rule in dfk.items():
        src_field = rule.get("from")
        lk_table = rule.get("lookup_table")
        lk_key = rule.get("lookup_key")
        lk_target = rule.get("lookup_target")
        aliases = rule.get("aliases") or {}
        src_val = row.get(src_field)
        if src_val is not None:
            # Apply alias remapping if provided
            alt_val = aliases.get(str(src_val))
            key_val = str(alt_val) if alt_val is not None else str(src_val)
            lookup = lookups.get(lk_table)
            # Only set derived FK if destination is missing/falsy and lookup yields a value
            if lookup and (not mapped.get(dst)):
                lk_val = lookup.get(key_val)
                if lk_val is not None:
                    mapped[dst] = lk_val
    # Set constants
    for k, v in (cfg.get("set") or {}).items():
        mapped[k] = v
    return mapped


if __name__ == "__main__":
    main()
