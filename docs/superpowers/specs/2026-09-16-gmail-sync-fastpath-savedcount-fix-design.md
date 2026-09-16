# Gmail Sync's Dead Fast Path and Inflated syncedCount — Design

## Background

Discovered via the final whole-branch review of the Gmail sync
Uint8Array/Buffer decode fix
(`docs/superpowers/plans/2026-09-16-gmail-sync-uint8array-fix.md`, branch
`fix/gmail-sync-uint8array`, held unmerged pending this investigation). The
design's own Non-Goals section had already parked `processMessageList`'s
outer existence check as "a separate, non-atomic fast-path optimization...
not touched here" — but the final reviewer, verifying the fix's real-world
impact, found that this fast path is not merely non-atomic; it is dead
code that has never actually matched anything.

### The confirmed bug

`gmail.ts`'s `processMessageList` (lines 171-199) runs, for every message
stub returned by the Gmail API's list endpoint:

```ts
for (const msgStub of messages) {
    try {
        // Check if exists first to save API calls
        const { data: existing } = await this.supabase
            .from("emails")
            .select("id")
            .eq("message_id", msgStub.id)
            .eq("account_id", this.account.id)
            .single();

        if (existing) {
            skippedCount++;
            continue;
        }

        const resp = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgStub.id}?format=raw`,
            { headers: { Authorization: `Bearer ${this.currentAccessToken}` } }
        );

        if (!resp.ok) continue;

        const msgData = await resp.json();
        await this.saveGmailMessage(msgData, folder, direction);
        savedCount++;
    } catch (e) {
        this.logger?.error(`Error processing Gmail message ${msgStub.id}:`, { error: e });
    }
}
```

`msgStub.id` is the Gmail API's own hex message id from the list endpoint
(e.g. `"19985a..."`). But the value actually stored in `emails.message_id`
(`supabase/functions/sync-emails-v2/utils/db.ts:135`,
`message_id: email.messageId`) is `parsedEmail.messageId`, which
`saveGmailMessage` (lines 208-224) sets from the RFC822 `Message-ID` MIME
header of the parsed email — only falling back to `msgData.id` (the same
value as `msgStub.id`) when that header is empty, which is rare for real
email:

```ts
if (!parsedEmail.messageId || parsedEmail.messageId.trim() === "") {
   parsedEmail.messageId = msgData.id;
}
```

So for virtually every real Gmail message *saved by this v2 sync path*,
the outer check's `.eq("message_id", msgStub.id)` compares against a
value that was never stored under that key, and can never find a match.
(**Correction, added after the final whole-branch review:** this is true
only for rows this v2 code path itself wrote. Production Gmail rows
predating this fix were written by the still-registered legacy
`sync-emails` v1 function, which stores the Gmail-native id in
`message_id` — so the outer check does match *those* rows. Deleting the
check therefore also removes the thing keeping v1-era rows from being
re-inserted as duplicates by v2's dedup, which keys on the RFC822 header
value instead. See the implementation plan's note on the pre-deploy
verification query. The fix below — delete the check — still stands; a
check that only works by silently depending on a different function's
legacy data convention is not something to keep.) Two consequences:

1. **`skippedCount` stays 0 forever**, and every sync re-fetches the full
   raw message from the Gmail API for every message, including ones
   already saved — the exact redundant work this fast path exists to
   avoid.
2. **`savedCount` is inflated/wrong.** `savedCount++` (line 195) runs
   unconditionally after every successful `saveGmailMessage` call,
   regardless of whether the inner `saveEmailToDb` call in `db.ts` (called
   by `saveGmailMessage`) actually inserted a new row or was a no-op via
   its upsert's `ignoreDuplicates`. `saveEmailToDb`'s real return
   value — a boolean, `true` for "inserted", `false` for "already
   existed" (`db.ts:114-125` inner check, `db.ts:183-193` upsert) — is
   discarded. The UI-visible `syncedCount` will report e.g. "40 synced"
   even when most of those 40 were dedup no-ops.

### Confirmed: no data-integrity risk

`db.ts`'s own inner existence check and its atomic upsert
(`onConflict: "account_id,message_id", ignoreDuplicates: true`, added by
the already-merged duplicate-ingestion fix earlier this session) both key
on the same `email.messageId` value that actually gets stored. No
duplicate rows are created, and no genuine duplicate is incorrectly
skipped. This is purely about a dead optimization and a wrong metric, not
about data correctness.

### Confirmed: Gmail-specific

`imap.ts` has no analogous outer existence-check fast path (confirmed by
grep — zero matches for `message_id`/`existing`/`skippedCount` in that
file). This bug is fully localized to `gmail.ts`.

## Goal

Make `syncedCount` accurate, and remove the dead fast-path query, without
any schema change.

## Architecture

Three changes, all in `supabase/functions/sync-emails-v2/services/gmail.ts`:

1. **Delete the outer existence-check block** in `processMessageList`
   (the `.eq("message_id", msgStub.id)...` query, and its
   `skippedCount++; continue;` branch). It never matches; removing it
   drops one wasted Supabase query per message and lets every message
   reach the real dedup logic in `saveEmailToDb`.

2. **Change `saveGmailMessage`'s return type** from implicit `void` to
   `Promise<boolean>`, returning `saveEmailToDb`'s own result directly:

   ```ts
   private async saveGmailMessage(msgData: any, folder: string, direction: "inbound" | "outbound"): Promise<boolean> {
      const bytes = decodeGmailRawMessage(msgData.raw);

      const parsedEmail: ParsedEmail = await parseEmail(bytes);

      // Override messageId if needed (Gmail provides a stable ID)
      if (!parsedEmail.messageId || parsedEmail.messageId.trim() === "") {
         parsedEmail.messageId = msgData.id;
      }

      // Ensure snippet is present if parser missed it
      if (!parsedEmail.snippet && msgData.snippet) {
         parsedEmail.snippet = msgData.snippet;
      }

      return await saveEmailToDb(this.supabase, this.account, parsedEmail, folder, direction, this.logger);
   }
   ```

   Only the final `return`/return type changes; the body above it is
   untouched.

3. **Use that return value to drive the counters** in `processMessageList`:

   ```ts
   for (const msgStub of messages) {
       try {
           const resp = await fetch(
               `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgStub.id}?format=raw`,
               { headers: { Authorization: `Bearer ${this.currentAccessToken}` } }
           );

           if (!resp.ok) continue;

           const msgData = await resp.json();
           const saved = await this.saveGmailMessage(msgData, folder, direction);
           if (saved) {
               savedCount++;
           } else {
               skippedCount++;
           }
       } catch (e) {
           this.logger?.error(`Error processing Gmail message ${msgStub.id}:`, { error: e });
       }
   }
   ```

   The `// Check if exists first to save API calls` comment and its whole
   block are gone; the `try`/`catch`, the `!resp.ok` guard, and the
   trailing `if (skippedCount > 0) { this.logger?.info(...) }` summary log
   after the loop are unchanged — `skippedCount` still feeds that same log
   line, it is just measured after the fetch (via the real DB dedup) now,
   instead of before it (via a check that never worked).

Net effect: `syncedCount` reflects real inserts, the dead query is gone,
and the "Skipped N existing messages" log becomes true again. The only
behavior actually given up is the (already negligible — Gmail sync is
capped at ≤40 messages/account/run: `maxResults=20` per label × 2 labels)
optimization of skipping the Gmail API fetch itself for already-saved
messages.

## Non-Goals

- **Restoring the fast-path optimization itself.** Making the outer check
  actually work would require a new column to store Gmail's native
  message id separately from the RFC822 `Message-ID` (since the two id
  spaces are genuinely different and the native id isn't known to be
  redundant until after a fetch). The user explicitly chose the
  no-migration approach; recovering the optimization is a separate,
  future decision if the wasted API calls ever become a real problem.
- **`imap.ts`, `parser.ts`, `pop3.ts`, `db.ts`.** None of these change.
  `db.ts`'s existence-check-then-upsert logic (`saveEmailToDb`) is already
  correct and is exactly what this fix now relies on — its return value is
  simply no longer discarded by its caller.
- **Changing what counts as "saved" vs. "skipped" for logging/UI purposes
  beyond fixing the existing counters.** No new metrics, no new log
  lines — the existing two counters and existing log line are made
  accurate, nothing more.

## Testing

`saveGmailMessage`/`processMessageList` have no existing test file (Gmail
OAuth + the Gmail API make full integration testing expensive), but
`sync-emails-v2/utils/db.test.ts` already establishes a working precedent
for this exact situation: it mocks only the Supabase client (not
`parseEmail`, not business logic) to unit-test `saveEmailToDb`'s real
upsert behavior. This fix follows that same precedent one level up the
call stack.

New file: `supabase/functions/sync-emails-v2/services/gmail.processMessageList.test.ts`.

Mocked (the true external boundaries only):
- `global.fetch` — stands in for the Gmail API's per-message raw-fetch
  call, returning a real base64url-encoded RFC822 message (built the same
  way `gmail.decode.test.ts` already builds one) as `msgData.raw`.
- The Supabase client — mocked the same way `db.test.ts`'s `supabaseMock`
  mocks the `emails` and `leads` tables, parameterized by which
  `message_id` values should be treated as already-existing, so the test
  can control which messages `saveEmailToDb`'s inner check finds and which
  it upserts as new.

Not mocked: `decodeGmailRawMessage`, `parseEmail`, `saveEmailToDb`,
`saveGmailMessage`, `processMessageList` — all real. `GmailService` is
instantiated directly with the mocked Supabase client; `currentAccessToken`
is set directly on the instance (a private field, but TypeScript's
`private` is compile-time-only, so a test in the same package may set it)
since the token-refresh flow (`ensureAccessToken`) is not being exercised
here — this test starts from `processMessageList`, not `syncEmails`.

Required test cases:
- **All-new batch:** two message stubs, Supabase's `emails` table
  existence check returns no row for either, the upsert returns a new row
  for each. Call `processMessageList` directly (it is a private method,
  but callable via a type-erasing cast in the test, same as instance-field
  access above) with both stubs. Assert the returned count is `2`, and
  that the logger's `info` was never called with a message containing
  `"Skipped"`.
- **Mixed batch — the actual regression guard:** two message stubs. For
  the first, the mocked existence check returns an existing row (so
  `saveEmailToDb` short-circuits to `false` without upserting); for the
  second, it returns no row and the upsert succeeds. Assert the returned
  count is `1`. Assert the logger's `info` was called with a message
  containing `"Skipped 1 existing messages"`. Assert `fetch` was called
  **twice** — once per message stub, including the one that turned out to
  already exist. This last assertion is the direct proof that the dead
  pre-fetch existence check is gone: under the old, buggy code this
  assertion would still pass (since the check never matched anyway), but
  the "Skipped" log assertion above it would fail (skippedCount would
  incorrectly be `0`), which is what actually catches a regression back to
  the old behavior.

## Global Constraints

- No schema changes, no new migration, no data backfill.
- No change to `imap.ts`, `parser.ts`, `pop3.ts`, `db.ts`, or any file
  besides `gmail.ts` and its new test file.
- `saveEmailToDb`'s own signature, return value, and dedup logic
  (`db.ts`) do not change — this fix only stops discarding a return value
  that already existed.
