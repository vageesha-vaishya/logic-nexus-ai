#!/usr/bin/env python3
import os
import json
import ssl
from urllib import request, error

# Minimal baseline seed to unblock usage. Extend as needed.

CONTINENTS = [
    {"code": "AF", "name": "Africa", "is_active": True},
    {"code": "AN", "name": "Antarctica", "is_active": True},
    {"code": "AS", "name": "Asia", "is_active": True},
    {"code": "EU", "name": "Europe", "is_active": True},
    {"code": "NA", "name": "North America", "is_active": True},
    {"code": "OC", "name": "Oceania", "is_active": True},
    {"code": "SA", "name": "South America", "is_active": True},
]

COUNTRIES = [
    {"name": "United States", "code_iso2": "US", "code_iso3": "USA", "phone_code": "+1", "is_active": True},
    {"name": "India", "code_iso2": "IN", "code_iso3": "IND", "phone_code": "+91", "is_active": True},
]

STATES_US = [
    {"name": "California", "code_iso": "CA", "code_national": "CA", "is_active": True},
    {"name": "New York", "code_iso": "NY", "code_national": "NY", "is_active": True},
    {"name": "Texas", "code_iso": "TX", "code_national": "TX", "is_active": True},
]

CITIES_US = [
    {"name": "New York", "code": "NYC", "latitude": 40.7128, "longitude": -74.0060, "is_active": True},
    {"name": "Los Angeles", "code": "LAX", "latitude": 34.0522, "longitude": -118.2437, "is_active": True},
    {"name": "San Francisco", "code": "SFO", "latitude": 37.7749, "longitude": -122.4194, "is_active": True},
]

def http_ctx():
    allow_insecure = os.environ.get("ALLOW_INSECURE_SSL", "false").lower() == "true"
    return ssl._create_unverified_context() if allow_insecure else ssl.create_default_context()

def post_rows(base_url, apikey, service_key, table, rows):
    url = f"{base_url}/rest/v1/{table}"
    payload = json.dumps(rows).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "apikey": apikey or service_key,
        "Authorization": f"Bearer {service_key}",
        "Prefer": "return=minimal",
    }
    req = request.Request(url, data=payload, method="POST", headers=headers)
    with request.urlopen(req, timeout=60, context=http_ctx()) as resp:
        return resp.getcode()

def get_country_id(base_url, apikey, service_key, iso2):
    url = f"{base_url}/rest/v1/countries?code_iso2=eq.{iso2}&select=id&limit=1"
    headers = {
        "Accept": "application/json",
        "apikey": apikey or service_key,
        "Authorization": f"Bearer {service_key}",
    }
    req = request.Request(url, method="GET", headers=headers)
    with request.urlopen(req, timeout=30, context=http_ctx()) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return (data[0]["id"] if data else None)

def main():
    base_url = os.environ.get("NEW_SUPABASE_URL")
    apikey = os.environ.get("NEW_SUPABASE_ANON_KEY")
    service_key = os.environ.get("NEW_SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_key:
        print("[ERROR] Missing NEW_SUPABASE_URL or NEW_SUPABASE_SERVICE_ROLE_KEY")
        return 1

    # 1) Seed continents
    try:
        post_rows(base_url, apikey, service_key, "continents", CONTINENTS)
        print("[OK] Seeded continents (baseline)")
    except error.HTTPError as e:
        print(f"[WARN] Continents seeding failed: {e.code} -> {e.read().decode('utf-8')}")

    # 2) Seed countries (baseline)
    try:
        post_rows(base_url, apikey, service_key, "countries", COUNTRIES)
        print("[OK] Seeded countries (US, IN)")
    except error.HTTPError as e:
        print(f"[WARN] Countries seeding failed: {e.code} -> {e.read().decode('utf-8')}")

    # 3) Seed states (US)
    try:
        us_id = get_country_id(base_url, apikey, service_key, "US")
        if us_id:
            rows = [{**s, "country_id": us_id} for s in STATES_US]
            post_rows(base_url, apikey, service_key, "states", rows)
            print("[OK] Seeded US states (CA, NY, TX)")
        else:
            print("[WARN] Could not resolve United States country_id; skipping states")
    except error.HTTPError as e:
        print(f"[WARN] States seeding failed: {e.code} -> {e.read().decode('utf-8')}")

    # 4) Seed cities (US)
    try:
        us_id = get_country_id(base_url, apikey, service_key, "US")
        if us_id:
            rows = [{**c, "country_id": us_id} for c in CITIES_US]
            post_rows(base_url, apikey, service_key, "cities", rows)
            print("[OK] Seeded US cities (NYC, LA, SF)")
        else:
            print("[WARN] Could not resolve United States country_id; skipping cities")
    except error.HTTPError as e:
        print(f"[WARN] Cities seeding failed: {e.code} -> {e.read().decode('utf-8')}")

    return 0

if __name__ == "__main__":
    raise SystemExit(main() or 0)