# Duplicate Email Ingestion Fix (Group B) — Design

## Background

Group B of the original email-management audit
(`docs/superpowers/specs/2026-09-15-email-management-ui-bugs-design.md`)
flagged "duplicate email ingestion" as needing real backend/data-integrity
investigation before any fix — riskier than Group C, since duplicate rows
might already exist in production data rather than just a broken code
path.

That investigation found a real, confirmed bug, but could not reproduce
the originally-observed symptom directly: production currently holds only
33 rows in `public.emails`, all distinct, no duplicate or near-duplicate
rows exist right now, and all 6 active `email_accounts` rows have distinct
addresses. Whatever the original audit saw is not currently reproducible
in live data. The investigation proceeded anyway on the strength of what
it found in the code itself — a real, structural race condition — per
explicit direction to fix that on its own merits rather than chase an
unreproduced historical symptom.

### The confirmed bug: a non-atomic check-then-insert race

`supabase/functions/sync-emails-v2/utils/db.ts`'s `saveEmailToDb()`
(lines 114-125, 180-185) checks whether a message already exists, then —
if not — inserts it, as two separate round-trips:
```ts
const { data: existing } = await supabase
  .from("emails")
  .select("id")
  .eq("message_id", email.messageId)
  .eq("account_id", account.id)
  .single();

if (existing) {
  logger?.info(`Email ${email.messageId} already exists. Skipping.`);
  return false;
}
// ... attachment upload, payload construction ...
const { error } = await supabase.from("emails").insert(payload);
```

This is a classic check-then-act race. Two overlapping sync calls for the
same account can both pass the "not found" check before either commits.
This isn't a rare edge case here — it's structurally easy to trigger,
because every sync path re-fetches the same window of recent messages
every single time, with no incremental "since last sync" tracking:
`sync-emails-v2/services/imap.ts:68-81` always re-searches the last 50
messages by IMAP sequence number (`${start}:*`) regardless of what was
already synced in a prior run. Three separate call sites can trigger this
concurrently for the same account:
- `useEmailInbox.ts:409-419` auto-syncs on every component mount (guarded
  only by a `useRef` that resets whenever the component remounts).
- The manual "Sync" button (`useEmailInbox.ts:214-257`, same
  `sync-emails-v2` call).
- "Sync All Mailboxes" (`useEmailInbox.ts:259-304`), which itself calls
  `sync-emails-v2` once per account.

The `UNIQUE(account_id, message_id)` constraint on `public.emails`
(`supabase/migrations/20251001073702_...sql:94`) is the reason no actual
duplicate row exists in production today: when two racing inserts for the
same message both go through, Postgres accepts the first and rejects the
second with a `23505` unique-violation. That rejection is caught by
`imap.ts:114-118`'s per-message `try/catch`, logged into a mostly-invisible
`debugInfo.errors` array, and the sync loop continues — so today's actual
failure mode is a silently-swallowed error and wasted work, not a visible
duplicate row. But the race is real, and correctness should not depend on
a constraint catching every case after the fact — a future change to this
function (e.g., a batched insert, or removing the `.single()` existence
check for a performance reason) could silently reintroduce visible
duplicates by relying on the same non-atomic pattern.

## Goal

Make the insert path atomic, so the DB-level constraint is never the last
line of defense against a race — the write itself cannot race.

## Architecture

One file changes: `supabase/functions/sync-emails-v2/utils/db.ts`.

1. **Keep the existing `SELECT` as a fast-path optimization** — for the
   overwhelmingly common case (re-syncing a message already ingested in a
   prior run, since every sync re-fetches the last 50 messages
   regardless), this avoids the wasted work of uploading attachments to
   Supabase Storage (`uploadAttachments`, called at line 128) for a
   message that's about to be skipped anyway. This check is *not* the
   correctness boundary — it's purely a performance shortcut, so its
   being racy is fine: at worst, a race causes one redundant attachment
   upload, not a duplicate row.
2. **Replace the plain `.insert(payload)` with an atomic upsert**, using
   this codebase's existing established pattern for exactly this
   situation (already used in `comms-unsubscribe/index.ts:174`,
   `clone-user-from-example/index.ts:164`, and others):
   ```ts
   const { data: inserted, error } = await supabase
     .from("emails")
     .upsert(payload, { onConflict: "account_id,message_id", ignoreDuplicates: true })
     .select("id");

   if (error) {
     logger?.error(`DB Insert Error for ${email.messageId}:`, { error });
     throw error;
   }

   return Boolean(inserted && inserted.length > 0);
   ```
   `ignoreDuplicates: true` compiles to `INSERT ... ON CONFLICT (account_id, message_id) DO NOTHING`.
   Postgres returns no row for a conflicting insert, so chaining
   `.select("id")` means `inserted` is an array with exactly one element
   when the row was genuinely new, and empty when it collided with an
   already-existing row (whether from a normal prior sync or a race with
   a concurrent one) — both same-account-same-message races and the
   completely normal "already synced this in a prior run" case are now
   handled by the identical, safe code path. The function's return value
   (`true`/`false`, used by `imap.ts:105`'s `if (saved) count++` to build
   the reported `syncedCount`) keeps its existing meaning: `true` only for
   a message that was actually newly stored.
3. No change to the `SELECT`'s early `return false`, the attachment
   upload step, payload construction, lead auto-linking, or anything in
   `imap.ts`, `gmail.ts`, `pop3.ts`, or the router (`index.ts`) — this is
   a single-function, single-file fix.

## Non-Goals

- **The always-refetch-last-50-messages behavior**
  (`sync-emails-v2/services/imap.ts:68-81`, no incremental UID/date
  tracking). Real inefficiency, but not itself unsafe once the write is
  atomic — a separate performance concern with materially larger scope
  (new tracking state, UID-based search logic), not pursued here.
- **A sync-in-progress lock per account.** Would prevent the redundant
  concurrent IMAP round-trips entirely, but adds real complexity (lock
  acquisition, expiry on crash) to solve an efficiency problem the atomic
  upsert already makes safe by construction. Not needed for correctness.
- **Two `email_accounts` rows pointing at the same real mailbox.** Nothing
  in the schema currently prevents two different users from independently
  connecting the same real address (only `UNIQUE(user_id, email_address)`
  exists, confirmed in `20251110120000_unique_email_accounts.sql` — no
  tenant- or platform-wide uniqueness). Each would sync and store its own
  copy of every incoming email under its own `account_id`, and an
  unfiltered "all accounts" view (`useEmailInbox.ts`'s `fetchEmails`, when
  `selectedAccountId` is empty) would show them side by side as visible
  duplicates. This is real and not currently prevented, but it is a
  data-model/product question (should the same mailbox even be
  connectable twice? should the inbox de-duplicate by address across
  accounts?) rather than a sync-code bug, and it is not currently
  manifesting in production (checked directly: all 6 active accounts have
  distinct addresses today). Flagged here for awareness, not fixed.
- **The empty-`Message-ID`-header case.** `sync-emails-v2/utils/parser.ts:50`
  falls back to `""` when a raw email genuinely lacks an RFC822
  `Message-ID:` header. This does not cause duplicates (a second,
  different header-less email would collide with the first's `""`
  placeholder and be *skipped*, not duplicated) — it's a distinct,
  already out-of-scope "some emails may go missing" risk, not part of
  this fix.
- **`sync-emails` (v1, legacy, 1249 lines).** Confirmed via repo-wide
  search: no frontend code calls it (only `sync-emails-v2` and
  `sync-all-mailboxes` are invoked from `src/`), so it cannot be
  contributing to any currently-observed behavior. Untouched.

## Testing

`supabase/functions/sync-emails-v2/utils/db.test.ts` (new — no test file
exists for this module today). Following this repo's established
Deno-edge-function test pattern (mock the Supabase client's query-builder
chain; no `Deno` global or `npm:` specifier is referenced by `db.ts`
itself, so neither of those extra mocking steps from the domain-verification
fix apply here):

- **Fast-path skip:** existence check finds a row → `saveEmailToDb`
  returns `false` without calling `.upsert()` or `uploadAttachments`.
- **New message:** existence check finds nothing, `.upsert(...).select("id")`
  returns one row → returns `true`.
- **Race / already-exists-at-write-time:** existence check finds nothing
  (simulating the race window), but `.upsert(...).select("id")` returns
  an empty array (simulating `ON CONFLICT DO NOTHING` silently absorbing
  a concurrent duplicate) → `saveEmailToDb` returns `false`, and — this is
  the regression guard for the actual bug — no error is thrown and no
  second row is attempted.
- **Genuine DB error:** `.upsert(...)` returns a real (non-conflict) error
  → `saveEmailToDb` throws, matching today's existing behavior for a
  real failure (unchanged).
- Assert the exact `.upsert()` call arguments in the "new message" case:
  `onConflict: "account_id,message_id"` and `ignoreDuplicates: true`,
  since a typo in the conflict target string is exactly the kind of
  mistake that would silently defeat this fix (Postgres would report an
  error about no matching unique constraint rather than silently doing
  the wrong thing, but pinning the exact string is cheap insurance).

## Global Constraints

- No schema changes, no new migration — the `UNIQUE(account_id, message_id)`
  constraint this fix relies on already exists.
- No change to the IMAP/Gmail/POP3 fetch logic, the last-50-messages
  window, attachment upload logic, lead auto-linking, or any file besides
  `sync-emails-v2/utils/db.ts`.
- `saveEmailToDb`'s return value must keep its existing meaning: `true`
  only when a message was newly stored (used for the reported
  `syncedCount`), `false` for both "already existed" and "lost the race" —
  callers must not be able to distinguish those two `false` cases, since
  they're semantically the same outcome (nothing new to report).
