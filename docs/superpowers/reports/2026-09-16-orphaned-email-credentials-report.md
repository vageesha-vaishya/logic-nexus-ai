# Orphaned Email-Account Credentials — Remediation Report (2026-09-16)

## What happened

A 2026-05-28 migration that moved plaintext email credentials into vault
left 12 `core.secrets` rows pointing at vault secrets that don't exist.
Every account below has a credential the application believes is active
but cannot actually read. Full root-cause writeup:
`docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md`.

The original plaintext values are permanently gone (the source columns
were dropped by a later migration) — there is no way to recover them.
Each account below needs its credential re-entered or re-authorized by
its owner.

## Affected accounts

| Account email | Provider | Owning user | What they need to do |
|---|---|---|---|
| dinusaundarya@gmail.com | gmail | admin-user-tenant001@gmail.com | Connect this account via Google OAuth (it was never actually completed for this account — it was set up with IMAP-style credentials despite being labeled "gmail"). |
| tester@gmail.com | gmail | e2e_test_1770604489753@example.com | Re-run Google OAuth consent for this account. |
| bahuguna.vimal@gmail.com | gmail | bahuguna.vimal@gmail.com | Re-run Google OAuth consent for this account. |
| vimal.bahuguna@miapps.co | smtp_imap | bahuguna.vimal@gmail.com | Re-enter the SMTP/IMAP password in account settings. |
| vimal_s390@hotmail.com | office365 | admin-user-tenant001@gmail.com | Re-enter the IMAP/SMTP app password in account settings. |
| Bahuguna.vimal@outlook.com | office365 | admin-user-tenant001@gmail.com | Re-enter the IMAP/SMTP app password in account settings. |

## Fixed as part of this remediation

- `core.email_accounts_secret_parity()` is redeployed and can be re-run at
  any time to check for this class of problem going forward.
- A new trigger on `core.secrets` now rejects any future attempt to
  activate a credential row with no matching vault secret — this class
  of silent orphan can no longer happen undetected.
- The 12 known-orphaned rows are deactivated (not deleted), so
  `core.email_accounts_secret_parity()` returns zero rows as of this
  report.

## Not fixed by this remediation

Nothing above happens automatically — each account owner must take the
listed action before that account's email sync will work again.
