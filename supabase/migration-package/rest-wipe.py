#!/usr/bin/env python3
import os
import sys
import json
from urllib import request, error
import ssl

WIPE_TABLES = [
    # Delete children first to avoid FK issues
    "service_type_mappings",
    "container_sizes",
    "container_types",
    "package_sizes",
    "package_categories",
    "cargo_types",
    "ports_locations",
    # Parents last (may be referenced elsewhere; failures will be reported)
    "service_types",
    "currencies",
]


def load_env():
    base_url = os.environ.get("NEW_SUPABASE_URL")
    anon_key = os.environ.get("NEW_SUPABASE_ANON_KEY")
    service_key = os.environ.get("NEW_SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_key:
        print("[ERROR] Missing NEW_SUPABASE_URL or NEW_SUPABASE_SERVICE_ROLE_KEY.")
        sys.exit(1)
    return base_url.rstrip('/'), anon_key, service_key


def http_ctx():
    allow_insecure = os.environ.get("ALLOW_INSECURE_SSL", "false").lower() == "true"
    return ssl._create_unverified_context() if allow_insecure else ssl.create_default_context()


def headers(apikey, service_key):
    return {
        "Accept": "application/json",
        "apikey": apikey or service_key,
        "Authorization": f"Bearer {service_key}",
        "Prefer": "return=minimal,count=exact",
    }


def get_count(base_url, apikey, service_key, table):
    url = f"{base_url}/rest/v1/{table}?select=id&limit=1"
    req = request.Request(url, method="GET", headers=headers(apikey, service_key))
    with request.urlopen(req, timeout=60, context=http_ctx()) as resp:
        cr = resp.headers.get("Content-Range")
        # Content-Range: 0-0/<total>
        if cr and "/" in cr:
            try:
                total = int(cr.split("/")[-1])
                return total
            except Exception:
                return None
        return None


def delete_all(base_url, apikey, service_key, table, filter_field="id"):
    # Use a non-null filter to delete all rows
    url = f"{base_url}/rest/v1/{table}?{filter_field}=is.not_null"
    req = request.Request(url, method="DELETE", headers=headers(apikey, service_key))
    try:
        with request.urlopen(req, timeout=60, context=http_ctx()) as resp:
            return True, resp.getcode(), None
    except error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = str(e)
        return False, e.code, body
    except Exception as e:
        return False, None, str(e)


def choose_filter_field(base_url, apikey, service_key, table):
    # Probe which common fields exist by attempting a GET with select
    candidates = ["id", "code", "identifier", "name"]
    for fld in candidates:
        url = f"{base_url}/rest/v1/{table}?select={fld}&limit=1"
        req = request.Request(url, method="GET", headers=headers(apikey, service_key))
        try:
            with request.urlopen(req, timeout=30, context=http_ctx()) as resp:
                # If the response is 200, field is valid
                if resp.getcode() == 200:
                    return fld
        except Exception:
            continue
    # Fallback to id
    return "id"


def main():
    base_url, apikey, service_key = load_env()
    print("==========================================")
    print("REST Wipe: Master/Config Tables")
    print("==========================================")

    summary = []
    for t in WIPE_TABLES:
        pre = get_count(base_url, apikey, service_key, t)
        filt = choose_filter_field(base_url, apikey, service_key, t)
        ok, code, err = delete_all(base_url, apikey, service_key, t, filter_field=filt)
        if ok and code in (204, 200):
            post = get_count(base_url, apikey, service_key, t)
            print(f"[DONE] {t}: deleted_all filter={filt} before={pre} after={post}")
            summary.append({"table": t, "deleted": pre, "errors": 0})
        else:
            print(f"[ERROR] {t}: delete failed code={code} err={err}")
            summary.append({"table": t, "deleted": 0, "errors": 1})

    print("\nSummary:")
    for s in summary:
        print(f"- {s['table']}: deleted={s['deleted']} errors={s['errors']}")
    total_errors = sum(s["errors"] for s in summary)
    if total_errors > 0:
        sys.exit(2)


if __name__ == "__main__":
    main()