# Gmail Sync Never Saves Any Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Gmail sync so it actually saves emails, by decoding the Gmail API's base64url message directly into a real `Buffer` instead of a plain `Uint8Array` that the real `mailparser` library rejects at runtime.

**Architecture:** Replace `atob()` plus a manual byte-by-byte copy loop with a single `Buffer.from(rawBase64, "base64")` call in `gmail.ts`. `parseEmail()` itself and its type signature (already `Buffer | string` from a prior, already-merged fix) need no change — a real `Buffer` is exactly what it already accepts.

**Tech Stack:** Deno edge function (TypeScript), Deno's built-in `node:buffer` compatibility module, vitest, the real `mailparser` npm package (already installed as a devDependency by the prior character-encoding fix).

## Global Constraints

- No schema changes, no new migration, no data backfill.
- No change to `imap.ts`, `parser.ts`, `pop3.ts`, `db.ts`, or any file besides `gmail.ts` and its new test file.
- `saveGmailMessage`'s and `processMessageList`'s external behavior (return values, error handling, the existence-check fast path) stay exactly as they are — only how the raw message bytes are decoded changes.
- Full spec: `docs/superpowers/specs/2026-09-16-gmail-sync-uint8array-fix-design.md`.

---

### Task 1: Decode Gmail's base64url message directly into a real `Buffer`

**Files:**
- Modify: `supabase/functions/sync-emails-v2/services/gmail.ts:1-9` (add one import), `:202-211` (replace the decode logic)
- Test: `supabase/functions/sync-emails-v2/services/gmail.decode.test.ts` (new — no test file exists for this module today)

**Interfaces:**
- Consumes: `parseEmail` (`../utils/parser.ts`, unchanged — signature is `(source: Buffer | string) => Promise<ParsedEmail>`, already merged by the character-encoding fix).
- Produces: nothing consumed elsewhere — this is the only task in this plan.

- [ ] **Step 1: Write the failing tests**

`mailparser` is already installed as a real devDependency and
`vitest.config.ts` already redirects `npm:mailparser` to it (both from
the prior, already-merged character-encoding fix) — no new test
infrastructure is needed this time.

```typescript
// supabase/functions/sync-emails-v2/services/gmail.decode.test.ts
import { describe, expect, it } from "vitest";
import { parseEmail } from "../utils/parser.ts";

/**
 * Builds a minimal, real RFC822 message as raw bytes: an ISO-8859-1-charset
 * text/plain body containing byte 0xE9 -- the ISO-8859-1 encoding of 'é'
 * (U+00E9). This is the same construction proven in ../utils/parser.test.ts.
 */
function buildIso88591Message(): Buffer {
  const headers =
    "From: sender@example.com\r\n" +
    "To: recipient@example.com\r\n" +
    "Subject: Test\r\n" +
    "Content-Type: text/plain; charset=iso-8859-1\r\n" +
    "Content-Transfer-Encoding: 8bit\r\n" +
    "\r\n";
  const headerBytes = Buffer.from(headers, "ascii");
  const bodyBytes = Buffer.from([0x63, 0x61, 0x66, 0xe9]); // "caf" + 0xE9
  return Buffer.concat([headerBytes, bodyBytes]);
}

function buildAsciiMessage(): Buffer {
  const headers =
    "From: sender@example.com\r\n" +
    "To: recipient@example.com\r\n" +
    "Subject: Test\r\n" +
    "Content-Type: text/plain; charset=us-ascii\r\n" +
    "Content-Transfer-Encoding: 7bit\r\n" +
    "\r\n";
  return Buffer.from(headers + "hello world", "ascii");
}

/**
 * Mirrors gmail.ts's own base64url -> base64 substitution
 * (msgData.raw.replace(/-/g, '+').replace(/_/g, '/')) in reverse, to build
 * a realistic `msgData.raw` value the way the real Gmail API sends it
 * (base64url: '+' -> '-', '/' -> '_').
 */
function toGmailBase64Url(message: Buffer): string {
  return message.toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * The exact decode this task's fix performs in gmail.ts's
 * saveGmailMessage: reverse the base64url substitution, then decode
 * directly to a Buffer.
 */
function decodeGmailBase64Url(rawBase64Url: string): Buffer {
  const rawBase64 = rawBase64Url.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(rawBase64, "base64");
}

describe("Gmail message decode pipeline", () => {
  it("decodes an ISO-8859-1 message end-to-end (base64url -> Buffer -> parseEmail) correctly", async () => {
    const original = buildIso88591Message();
    const gmailRaw = toGmailBase64Url(original);
    const bytes = decodeGmailBase64Url(gmailRaw);
    const result = await parseEmail(bytes);
    expect(result.bodyText).toBe("café");
  });

  it("decodes a plain ASCII message identically through the same pipeline", async () => {
    const original = buildAsciiMessage();
    const gmailRaw = toGmailBase64Url(original);
    const bytes = decodeGmailBase64Url(gmailRaw);
    const result = await parseEmail(bytes);
    expect(result.bodyText).toBe("hello world");
  });

  it("produces a byte-for-byte identical Buffer to the original message, independent of mailparser", () => {
    const original = buildIso88591Message();
    const gmailRaw = toGmailBase64Url(original);
    const bytes = decodeGmailBase64Url(gmailRaw);
    expect(bytes.equals(original)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail against the current, buggy code**

Run: `npx vitest run supabase/functions/sync-emails-v2/services/gmail.decode.test.ts`
Expected: 3 passed already, at this point — same situation as the
character-encoding fix's test file. This task's test file does not import
anything from `gmail.ts` (it only mirrors `gmail.ts`'s decode logic
locally, via `decodeGmailBase64Url`, and calls `parseEmail` directly), so
it cannot fail-then-pass around a change to `gmail.ts` itself. What it
proves is the premise this task's fix relies on: that decoding a real
Gmail-shaped base64url message directly into a `Buffer` (rather than the
current code's `atob()` + manual `Uint8Array` copy) produces correct,
byte-identical results that `mailparser` decodes correctly — including
for a non-UTF-8 charset. Confirm 3 passed now, before touching `gmail.ts`,
the same way the character-encoding fix's plan confirmed its test
infrastructure worked before touching `imap.ts`. If any test fails here,
stop and debug this test file before proceeding to Step 3 — do not move
on with a failing suite.

- [ ] **Step 3: Apply the fix**

In `supabase/functions/sync-emails-v2/services/gmail.ts`, add this import
after the existing imports (currently ending at line 8):

```typescript
import { Buffer } from "node:buffer";
```

Then find this block (currently lines 202-211):

```typescript
  private async saveGmailMessage(msgData: any, folder: string, direction: "inbound" | "outbound") {
     // msgData.raw is base64url encoded
     const rawBase64 = msgData.raw.replace(/-/g, '+').replace(/_/g, '/');
     const binaryString = atob(rawBase64);
     const bytes = new Uint8Array(binaryString.length);
     for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
     }

     const parsedEmail: ParsedEmail = await parseEmail(bytes);
```

Replace with:

```typescript
  private async saveGmailMessage(msgData: any, folder: string, direction: "inbound" | "outbound") {
     // msgData.raw is base64url encoded
     const rawBase64 = msgData.raw.replace(/-/g, '+').replace(/_/g, '/');
     const bytes = Buffer.from(rawBase64, "base64");

     const parsedEmail: ParsedEmail = await parseEmail(bytes);
```

No other line in `gmail.ts` changes — everything after this point in
`saveGmailMessage` (the messageId/snippet fallback logic, the final
`saveEmailToDb` call), and every other method in the file, stays exactly
as it is.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/sync-emails-v2/services/gmail.decode.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Lint**

Run: `npx eslint supabase/functions/sync-emails-v2/services/gmail.ts supabase/functions/sync-emails-v2/services/gmail.decode.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/sync-emails-v2/services/gmail.ts supabase/functions/sync-emails-v2/services/gmail.decode.test.ts
git commit -m "fix(email-sync): decode Gmail messages into a real Buffer so mailparser can parse them"
```
