#!/usr/bin/env python3
import csv
import os
from datetime import datetime

"""
Build a minimal auth_users.csv from profiles.csv.

This is useful when you only exported profiles but need auth.users
FKs to exist in the target database before importing profiles.

Input:  migration-data/profiles.csv (id, email, created_at, updated_at ...)
Output: migration-data/auth_users.csv (id, email, phone, created_at, updated_at, raw_user_meta_data, user_metadata)

Only required fields are included; extra fields are left empty. The importer
script will automatically restrict columns to the destination schema.
"""

ROOT = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(ROOT, 'migration-data')
PROFILES_CSV = os.path.join(DATA_DIR, 'profiles.csv')
AUTH_USERS_CSV = os.path.join(DATA_DIR, 'auth_users.csv')

def main():
    if not os.path.isfile(PROFILES_CSV):
        raise SystemExit(f"profiles.csv not found at {PROFILES_CSV}")

    rows = []
    with open(PROFILES_CSV, newline='') as f:
        r = csv.DictReader(f)
        for row in r:
            uid = (row.get('id') or '').strip()
            email = (row.get('email') or '').strip()
            # Fallback timestamps
            created_at = (row.get('created_at') or '').strip() or datetime.utcnow().isoformat() + 'Z'
            updated_at = (row.get('updated_at') or '').strip() or created_at

            if not uid or not email:
                # Skip incomplete rows; auth.users requires id + email
                continue

            rows.append({
                'id': uid,
                'email': email,
                'phone': '',
                'created_at': created_at,
                'updated_at': updated_at,
                'instance_id': '',
                'aud': '',
                'role': 'authenticated',
                'email_confirmed_at': '',
                'phone_confirmed_at': '',
                'confirmation_sent_at': '',
                'recovery_sent_at': '',
                'last_sign_in_at': '',
                'is_super_admin': 'false',
                'raw_user_meta_data': '',
                'user_metadata': ''
            })

    if not rows:
        raise SystemExit("No valid rows found in profiles.csv to build auth_users.csv")

    fieldnames = list(rows[0].keys())
    with open(AUTH_USERS_CSV, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow(row)

    print(f"Wrote {len(rows)} users to {AUTH_USERS_CSV}")

if __name__ == '__main__':
    main()