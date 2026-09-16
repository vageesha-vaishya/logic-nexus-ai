# Gmail Sync Never Saves Any Email — Design

## Background

Discovered while finishing the character-encoding-corruption fix
(`docs/superpowers/specs/2026-09-16-email-encoding-corruption-fix-design.md`):
that fix's final whole-branch review found that `parseEmail`'s widened
type signature (`Buffer | Uint8Array | string`) documented an input shape
the real `mailparser` library does not actually accept. Investigating
that finding further showed the same defect independently affects
`sync-emails-v2/services/gmail.ts` — not as a documentation inaccuracy,
but as a real, live bug: **Gmail sync has likely never successfully
saved a single email, for any account, ever.**

### The confirmed bug

`gmail.ts`'s `saveGmailMessage` (lines 202-211):
```ts
private async saveGmailMessage(msgData: any, folder: string, direction: "inbound" | "outbound") {
   // msgData.raw is base64url encoded
   const rawBase64 = msgData.raw.replace(/-/g, '+').replace(/_/g, '/');
   const binaryString = atob(rawBase64);
   const bytes = new Uint8Array(binaryString.length);
   for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
   }

   const parsedEmail: ParsedEmail = await parseEmail(bytes);
   ...
```
`bytes` is a plain `Uint8Array`. `mailparser`'s `simpleParser()`
(confirmed by reading the real, installed library's source,
`node_modules/mailparser/lib/simple-parser.js:110-122`) only special-cases
a `string` (wraps it via `Buffer.from`) or a real `Buffer`
(`Buffer.isBuffer(input)`); anything else falls through to a branch that
assumes a `Readable` stream and calls `input.once('error', ...).pipe(parser)`.
A plain `Uint8Array` is not a `Buffer` instance
(`Buffer.isBuffer(new Uint8Array(...))` is `false` — a `Buffer` is a
`Uint8Array` *subclass*, not the reverse), so it falls into that third
branch and throws `TypeError: input.once is not a function`. This was
reproduced directly: `node -e "simpleParser(new Uint8Array(buf))"` throws
exactly that error against the real, installed `mailparser@3.9.28`.

This throw happens inside `saveGmailMessage`, which is called from
`processMessageList`'s per-message loop (line 188), itself wrapped in a
`try { ... } catch (e) { this.logger?.error(...) }` (lines 165-192). So
every single Gmail message hits this, throws, gets caught, gets logged
(not surfaced to the user), and the loop moves to the next message. The
sync call itself still returns success (`{ syncedCount: <however many
made it past the counter> }` — in practice 0, since the count increment
at line 189 sits after the now-always-throwing call), so nothing in the
UI or logs prominently signals a failure; only a `logger.error` entry per
message, easy to miss.

### Confirmed with live production evidence

All 3 `gmail`-provider rows in `public.email_accounts`
(`dinusaundarya@gmail.com`, `tester@gmail.com`, `bahuguna.vimal@gmail.com`)
have **zero** rows in `public.emails` — checked directly against
production. The one non-Gmail account (`smtp_imap` provider) has 33. This
is exactly the pattern this bug predicts: every Gmail account that has
ever attempted a sync has saved nothing, while the one account using a
different code path (IMAP) has real data.

## Goal

Make Gmail sync actually save emails, by giving `parseEmail()` an input
shape `mailparser` genuinely accepts.

## Architecture

One file changes: `supabase/functions/sync-emails-v2/services/gmail.ts`.

1. **Add one import** at the top of the file:
   ```ts
   import { Buffer } from "node:buffer";
   ```
   Deno's standard, built-in Node-compatibility module — no new
   dependency, no `npm:` specifier, nothing for Vitest's resolver to
   redirect (unlike `mailparser`, this is a genuine Deno built-in,
   resolved natively at runtime in both production and in this repo's
   Node-based test environment, where `Buffer` is also already a global —
   the explicit import is for clarity and to match how a real Deno module
   should declare its dependencies, not because it's strictly required to
   make the global available).

2. **Replace the `atob()` + manual byte-copy loop with a direct
   base64-to-`Buffer` decode.** Currently (lines 204-209):
   ```ts
   const rawBase64 = msgData.raw.replace(/-/g, '+').replace(/_/g, '/');
   const binaryString = atob(rawBase64);
   const bytes = new Uint8Array(binaryString.length);
   for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
   }
   ```
   Becomes:
   ```ts
   const rawBase64 = msgData.raw.replace(/-/g, '+').replace(/_/g, '/');
   const bytes = Buffer.from(rawBase64, "base64");
   ```
   `Buffer.from(string, "base64")` decodes standard base64 directly into a
   real `Buffer` in one step — no `atob()`, no intermediate "binary
   string," no manual per-character copy loop. Verified directly: encoding
   a real ISO-8859-1-charset test message to base64, decoding it with this
   exact line, produces a `Buffer` that is byte-for-byte identical to the
   original (`buffer.equals(original)` confirmed true) and that
   `mailparser` correctly decodes (including the non-UTF-8 charset case —
   this fix closes the same class of bug the IMAP-path fix closed, for the
   Gmail path).
3. `parseEmail(bytes)` (line 211) does not change — `bytes` is now a real
   `Buffer`, which is exactly what `parseEmail`'s current signature
   (`Buffer | string`, already correct after the character-encoding fix)
   accepts. No change needed to `parser.ts`.

No other line in `gmail.ts` changes — `ensureAccessToken`,
`refreshAccessToken`, `syncLabel`, `processMessageList`'s existence-check
and error-handling structure, and the rest of `saveGmailMessage`
(messageId/snippet fallback, the final `saveEmailToDb` call) all stay
exactly as they are.

## Non-Goals

- **`imap.ts`, `parser.ts`, `pop3.ts`, `db.ts`.** None of these change.
  `imap.ts` was already fixed (previous branch, already merged) and is
  unaffected. `parser.ts`'s type signature already matches what both
  callers now send once this fix lands. `pop3.ts` is an unimplemented
  stub. `db.ts` is unrelated to this bug.
- **Re-syncing already-"processed" messages.** `processMessageList`'s own
  existence check (lines 167-178, unchanged) already re-attempts every
  message on every sync today, since nothing has ever successfully saved
  — once this fix lands, the very next sync for each Gmail account will
  naturally attempt (and, for the first time, succeed at) saving its
  recent inbox/sent messages. No backfill or migration needed; this is
  just the normal sync behavior working correctly for the first time.
- **The `processMessageList`/`saveGmailMessage` check-then-insert
  pattern.** `saveEmailToDb` (used by both the IMAP and Gmail paths) was
  already made atomic in a separate, already-merged fix
  (`docs/superpowers/specs/2026-09-16-duplicate-email-ingestion-fix-design.md`).
  `processMessageList`'s own OUTER existence check (lines 167-178) is a
  separate, non-atomic fast-path optimization specific to the Gmail API
  call flow (it exists to avoid an unnecessary Gmail API fetch for a
  message already known to be saved) — the same category of "optimization
  fast-path, not a correctness boundary" already accepted for the IMAP
  path's analogous check in `db.ts`. Not touched here; out of scope.
- **The `maxResults=20` label-sync limit, or any pagination behavior.**
  Unrelated to this bug, not touched.

## Testing

`supabase/functions/sync-emails-v2/services/gmail.ts` has no existing test
file, and `syncEmails()`/`syncLabel()`/`processMessageList()` all make
real Gmail API HTTP calls, oauth-token vault lookups, and Supabase
queries — fully unit-testing them would require extensive mocking for
very little value on a fix this narrow, the same trade-off already made
for `imap.ts`'s equivalent method. Following that precedent, this fix is
verified the same way the IMAP fix was: with a test that exercises the
narrow, actually-changed logic — the base64-to-`Buffer` decode — against
the real `mailparser` library, without needing to mock the Gmail API,
OAuth, or Supabase at all.

New file: `supabase/functions/sync-emails-v2/services/gmail.decode.test.ts`.
Required test cases:
- Build a real RFC822 message as a `Buffer` (reuse the same
  `iso-8859-1`/`0xE9` construction already proven in
  `sync-emails-v2/utils/parser.test.ts`), base64-encode it, convert to
  base64url form (replace `+`/`/` with `-`/`_`, matching what
  `msgData.raw` looks like from the real Gmail API), then run it through
  the exact decode line this fix introduces
  (`Buffer.from(rawBase64Restored, "base64")` after reversing the
  base64url substitution, mirroring `gmail.ts`'s own logic) and pass the
  result into `parseEmail()` (imported from `../utils/parser.ts`).
  Assert the decoded `bodyText` is `"café"` — proving the full decode
  pipeline (base64url → base64 → Buffer → mailparser) works end-to-end
  for a non-UTF-8 charset, the exact case that was broken before.
- The same round-trip for a plain ASCII message, asserting the decoded
  text matches exactly — confirms the fix doesn't regress the common
  case.
- Assert that decoding via this fix's approach (`Buffer.from(base64Str,
  "base64")`) produces a byte-for-byte identical result to the original
  message `Buffer` (`.equals()`), independent of `mailparser` — this
  isolates and locks in the decode step itself, separate from parsing.

## Global Constraints

- No schema changes, no new migration, no data backfill.
- No change to `imap.ts`, `parser.ts`, `pop3.ts`, `db.ts`, or any file
  besides `gmail.ts` and its new test file.
- `saveGmailMessage`'s and `processMessageList`'s external behavior
  (return values, error handling, the existence-check fast path) stay
  exactly as they are — only how the raw message bytes are decoded
  changes.
