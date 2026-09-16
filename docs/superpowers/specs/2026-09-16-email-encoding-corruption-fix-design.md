# Email Character-Encoding Corruption Fix (Group B, part 2) — Design

## Background

Group B of the original email-management audit
(`docs/superpowers/specs/2026-09-15-email-management-ui-bugs-design.md`)
bundled two findings under "needs real backend/data-integrity
investigation": duplicate email ingestion (investigated and fixed
separately — `docs/superpowers/specs/2026-09-16-duplicate-email-ingestion-fix-design.md`)
and character-encoding corruption in stored email text. This spec covers
the second half.

### The confirmed bug: the IMAP sync path discards raw bytes before parsing

`supabase/functions/sync-emails-v2/services/imap.ts:93-94`:
```ts
const rawSource = message.source.toString();
const parsedEmail = await parseEmail(rawSource);
```
`message.source` is the raw RFC822 message bytes as a `Buffer` — this is
`imapflow`'s documented purpose for the `{ source: true }` fetch option:
hand back the exact wire bytes for the caller to parse. Calling
`.toString()` on a `Buffer` with no argument performs an implicit
**UTF-8** decode. For any message whose body declares a non-UTF-8
charset with 8-bit content (e.g.
`Content-Type: text/plain; charset=windows-1252` or `iso-8859-1`,
`Content-Transfer-Encoding: 8bit` — a common combination from
non-English-locale senders and older mail clients), that decode either
substitutes invalid byte sequences with `�` (U+FFFD) or misreads valid
Windows-1252/Latin-1 byte sequences as entirely different, wrong Unicode
codepoints. Once that happens the original bytes are gone — nothing
downstream (`mailparser`, this project's own code, or a later re-read of
the stored row) can recover them.

The proof this is a real, fixable bug rather than a theoretical concern:
**the Gmail sync path in this same codebase already does this correctly.**
`supabase/functions/sync-emails-v2/services/gmail.ts:203-211` takes the
raw base64url message from the Gmail API, decodes it into a `Uint8Array`
that preserves every byte exactly, and passes that directly into
`parseEmail()` — never converting to a string first. `mailparser`'s
`simpleParser()` is specifically built to accept a raw `Buffer`/`Uint8Array`
(or a `Readable` stream) and do its own charset-aware decoding per the
message's actual `Content-Type` header, using an internal
charset-conversion library — this is the library's core purpose. The IMAP
path is the one inconsistent, buggy caller in this codebase; the Gmail
path is the existing, working reference for what correct usage looks
like.

### Confirmed separately: not currently reproducible in production data

All 33 emails currently in `public.emails` were checked directly for
genuine corruption signatures (`�` / U+FFFD, and the classic
UTF-8-decoded-as-Latin-1 mojibake patterns like `Ã©`/`â€™`) — none found.
This is consistent with the bug being real but simply not yet triggered:
none of the 33 emails in this small dataset happen to use a non-UTF-8
charset with 8-bit body content. It does not mean the bug isn't present
in the code, the same way the duplicate-ingestion race was real and
confirmed by reading the code despite not being reproducible in the
(equally small) live dataset at the time.

## Goal

Make the IMAP sync path preserve raw message bytes all the way into
`mailparser`, matching the already-correct pattern the Gmail sync path
uses, so non-UTF-8-charset emails decode correctly instead of being
silently corrupted.

## Architecture

Two files change, both minimally:

1. **`supabase/functions/sync-emails-v2/services/imap.ts:93-94`** — delete
   the `.toString()` call and pass the raw `Buffer` straight through:
   ```ts
   const parsedEmail = await parseEmail(message.source);
   ```
   `rawSource` is not referenced anywhere else in this function (checked
   directly — it exists solely to be passed to `parseEmail`), so removing
   it is side-effect-free.

2. **`supabase/functions/sync-emails-v2/utils/parser.ts:32`** — tighten
   `parseEmail`'s parameter type from `source: any` to
   `source: Buffer | Uint8Array | string`, matching the three real
   call-site shapes in this codebase (`imap.ts` now passes a `Buffer`,
   `gmail.ts` already passes a `Uint8Array`, and any future/test caller
   may reasonably pass a `string` for already-ASCII content). This
   documents the contract `simpleParser()` itself supports and makes the
   fix's intent visible in the function signature, not just at one call
   site. No behavior change — `simpleParser(source)` on line 33 is
   unchanged; only the declared type of its input parameter changes.

No change to `gmail.ts` (already correct), `pop3.ts` (unimplemented
stub — see Non-Goals), `db.ts` (unrelated to this bug), or any other file.

## Non-Goals

- **`pop3.ts`.** Confirmed by reading it directly: `syncEmails()` is a
  25-line stub that logs "POP3 Sync not fully implemented yet" and
  returns `{ syncedCount: 0 }` — no parsing logic exists to have this bug.
- **`ingest-email`'s webhook ingestion path.** Confirmed by direct search:
  it never calls `parseEmail()` and has no raw-MIME-buffer handling at
  all — it receives an already-decoded JSON payload from whatever webhook
  provider delivers it (fields like subject/text/html arrive pre-decoded
  as JSON strings). It is not exposed to this class of bug; a different
  provider-side decoding bug, if any, is out of scope here.
- **Manual charset detection/conversion.** Not needed — `mailparser`
  already does this correctly per-MIME-part when given raw bytes, which
  is exactly what this fix restores. Reimplementing that logic manually
  (e.g., with `iconv-lite` against a single guessed charset) would be
  redundant and actually worse for multipart messages where different
  parts declare different charsets.
- **Re-processing already-stored rows.** No migration, no backfill. This
  fix only changes how *future* syncs decode messages. Any already-stored
  row that was corrupted by the old code path (none currently confirmed
  in production, per Background) stays as-is — re-deriving correct text
  from an already-corrupted stored string is not generally possible
  (the original bytes are gone), so there is nothing safe to backfill.

## Testing

New file: `supabase/functions/sync-emails-v2/utils/parser.test.ts` (none
exists today). Rather than attempting to unit-test `imap.ts`'s
`syncEmails()` method directly — which would require mocking `ImapFlow`'s
full connect/lock/fetch lifecycle for a fix that is really just "stop
converting to string before this point" — the test targets the actual
mechanism the fix depends on: that `parseEmail()` correctly decodes a
non-UTF-8-charset message when given raw bytes, and fails to when given
an already-UTF-8-decoded string (proving the bug's mechanism, not just
the fix's absence of one).

Required test cases:
- Construct a real, minimal RFC822 message as a raw `Buffer`: a
  `Content-Type: text/plain; charset=iso-8859-1` body containing the byte
  `0xE9` (the ISO-8859-1 encoding of `é`) with `Content-Transfer-Encoding: 8bit`.
  Call `parseEmail()` with that `Buffer` directly and assert the resulting
  `bodyText` contains the correct character `é` (U+00E9), not `�` or a
  mojibake sequence.
- Take the same raw message bytes, convert them to a string via
  `.toString()` first (reproducing the old buggy `imap.ts` code path
  exactly), and call `parseEmail()` with that string. Assert the result
  is now wrong (either contains `�` or a different codepoint than `é`) —
  this is a regression guard proving the bug this fix closes was real,
  not an assumption.
- A plain 7-bit ASCII message (no special charset) decodes identically
  whether passed as a `Buffer` or a `string` — confirms the fix doesn't
  regress the common case.

## Global Constraints

- No schema changes, no new migration, no data backfill.
- No change to `gmail.ts`, `pop3.ts`, `db.ts`, `ingest-email`, or any file
  besides `imap.ts` and `parser.ts`.
- `parseEmail`'s exported name, return type (`ParsedEmail`), and all of
  its existing field-derivation logic (subject/from/to/cc/bcc/body/etc.)
  stay exactly as they are — only the input parameter's accepted type and
  what `imap.ts` passes into it change.
