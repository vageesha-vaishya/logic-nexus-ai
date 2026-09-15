# Restored "Email Client" Tab's SMTP/IMAP Save Path Is Broken

**Status:** Open, confirmed live — found 2026-09-15 during the final
whole-branch review of `feat/email-management-ui-bugs`, then reproduced
against production the same day. Not fixed. This is a pre-existing bug in
code that branch didn't touch — it just made the bug reachable for the
first time by fixing an unrelated, confirmed UI bug (a duplicate tab that
had made this whole panel unreachable).

**Live confirmation (2026-09-15):** submitted the "SMTP/IMAP Email
Client" form at `/dashboard/email-management` → Email Client with dummy
test values (fake account, fake password — nothing real). Result exactly
as predicted:
- Browser console logged `API Error: 400 https://supabase.sosservices.online/rest/v1/email_accounts`
  at the moment of submission.
- No new row appeared under "Configured Accounts" — the insert did not
  persist.
- The form did not reset (the success path calls `setForm(emptyForm())`;
  it stayed filled), confirming the save handler took its error branch.

No row was written (a `400` on insert is rejected atomically by
PostgREST — there is no partial-write cleanup needed). No real credentials
were ever entered.

## Summary

`src/features/module-communications/components/email/EmailClientSettings.tsx`'s
"Save" handler for its SMTP/IMAP account form (lines ~187-208) builds an
insert payload that includes `smtp_password` and `imap_password`:

```ts
const payload: TablesInsert<"email_accounts"> = {
  ...
  smtp_password: form.smtp.password,
  ...
  imap_password: form.imap.password,
  ...
};
const { error } = await scopedDb.from("email_accounts").insert(payload);
```

Both columns were dropped from `public.email_accounts` by
`supabase/migrations/20260529010000_drop_email_accounts_plaintext_credentials.sql`,
which — per its own header comment — was **already applied to the
self-hosted production instance on 2026-05-29**, months before this
session's work. Confirmed independently:

- `src/integrations/supabase/types.ts:11093-11123` (`email_accounts`'
  `Insert` type) lists neither `smtp_password` nor `imap_password` — the
  generated types correctly reflect the drop.
- The dropping migration's own header explains why: "Vault + core.secrets
  are the canonical store from here on, accessed via the SECURITY DEFINER
  helpers `core.read_email_account_credential` /
  `core.write_email_account_credential`" (added one migration earlier,
  `20260528250000_email_account_credential_rpcs.sql`).

Submitting this form against the live database fails — confirmed live,
see above (`400` on `POST .../rest/v1/email_accounts`, most likely
PostgREST's `PGRST204` "Could not find the 'smtp_password' column of
'email_accounts' in the schema cache" or an equivalent schema-mismatch
error, though the exact response body wasn't captured — the console only
surfaced the status code and endpoint). The row (and its passwords) is
never written.

## Why this matters now, specifically

Before `feat/email-management-ui-bugs`, this form was **completely
unreachable** — a duplicate `TabsTrigger value="templates"` in
`EmailManagement.tsx` meant no tab ever pointed at the `TabsContent
value="clients"` block that renders `EmailClientSettings`. That was a
separate, confirmed bug (see
`docs/superpowers/specs/2026-09-15-email-management-ui-bugs-design.md`),
fixed correctly by that branch. The side effect: fixing it makes this
already-broken save path reachable by every user, for the first time.

## Why the obvious fix isn't a one-liner

`core.write_email_account_credential` (the intended replacement) takes
`p_account_id` as its first argument — it's designed to rotate a
credential on an **already-existing** `email_accounts` row (edge
functions like `sync-emails-v2` call it after the row exists). It cannot
be called in the same transaction as the initial insert the way the
current code structure assumes. A correct fix restructures the save flow
into two steps:
1. Insert the `email_accounts` row *without* `smtp_password`/`imap_password`
   (drop those two fields from the payload), get back the new row's `id`.
2. Call `core.write_email_account_credential(new_id, 'smtp_password', ...)`
   and again with `'imap_password'` to store the two secrets in the vault.

Whether the frontend can call that `SECURITY DEFINER` RPC directly (check
its `GRANT EXECUTE` recipients in `20260528250000_email_account_credential_rpcs.sql:135`)
or needs a new/existing edge function as an intermediary is not yet
determined — that's exactly the kind of thing a real investigation task
should pin down before writing a fix, not guess at here.

## What's not done

- **The exact PostgREST error body wasn't captured.** The live
  confirmation above got the HTTP status (400) and endpoint from the
  browser console, but not the response body's error message/code — the
  console only logged an unexpanded `Object` reference. This doesn't
  change the conclusion (a 400 on this exact insert can only be the
  schema mismatch already identified via static analysis), but whoever
  picks this up may want the precise `PGRST` code for the fix's own
  error-handling logic.
- **No fix was written.** This needs its own scoped plan (brainstorm →
  spec → plan), given it touches the credential-vault RPC surface on
  shared, production-adjacent infrastructure — not a same-branch drive-by
  fix, matching how `docs/investigation/FEATURE_FLAGS_READ_PATH_BROKEN.md`
  was handled earlier in this project.

## Recommended path forward (confirmed broken; fix not started)

1. ~~Confirm live behavior~~ — done, see "Live confirmation" above.
2. Decide whether to (a) restructure the save flow to use
   `core.write_email_account_credential` in two steps as described above,
   or (b) temporarily hide/disable the SMTP/IMAP save form in
   `EmailClientSettings.tsx` until (a) is done, so the tab doesn't present
   users with a form that silently fails.
3. Treat as its own scoped plan once a direction is chosen.

## Constraints for whoever picks this up

- Same standing caution as every other piece of work touching this
  project's self-hosted Supabase instance: it's shared, production-
  adjacent infrastructure (24 unrelated apps on the same VPS). No schema
  change, RPC-permission change, or live write should happen without
  explicit, deliberate confirmation.
- `EmailClientSettings.tsx` also renders its own "Domain Management" card,
  duplicating the separate "Domains" tab's `DomainHealth` component — a
  known, already-logged overlap (see the design spec's Non-Goals), not
  part of this specific bug but worth keeping in mind if this panel gets
  touched anyway.
