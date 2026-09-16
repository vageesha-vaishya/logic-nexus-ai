# Email Encoding Corruption Fix (Group B, part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the IMAP email sync path from destroying non-UTF-8 characters by forcing a premature UTF-8 string conversion before the MIME parser ever sees the raw bytes.

**Architecture:** Delete one `.toString()` call in `imap.ts` so it passes the raw `Buffer` straight into `parseEmail()`, exactly like the already-correct Gmail sync path does. Tighten `parseEmail`'s parameter type to document that contract. Add `mailparser` as a real (dev-only) dependency and one `vitest.config.ts` resolver entry so a test can exercise the *real* `mailparser` library's real charset decoding end-to-end, rather than trusting an assumption about a third-party library's behavior.

**Tech Stack:** Deno edge function (TypeScript), vitest, the real `mailparser` npm package (added as a devDependency for testing only — production still uses Deno's `npm:mailparser` specifier, untouched).

## Global Constraints

- No schema changes, no new migration, no data backfill.
- No change to `gmail.ts`, `pop3.ts`, `db.ts`, `ingest-email`, or any file besides `imap.ts`, `parser.ts`, `package.json`/`package-lock.json`, and `vitest.config.ts`.
- `parseEmail`'s exported name, return type (`ParsedEmail`), and all of its existing field-derivation logic stay exactly as they are — only the input parameter's accepted type and what `imap.ts` passes into it change.
- Full spec: `docs/superpowers/specs/2026-09-16-email-encoding-corruption-fix-design.md`.

---

### Task 1: Preserve raw bytes through the IMAP sync path, and prove it with a real end-to-end test

**Files:**
- Modify: `supabase/functions/sync-emails-v2/services/imap.ts:93-94`
- Modify: `supabase/functions/sync-emails-v2/utils/parser.ts:32`
- Modify: `package.json` (add one devDependency)
- Modify: `vitest.config.ts:9-18` (extend the existing `npm-specifier-resolver` plugin with one more branch)
- Test: `supabase/functions/sync-emails-v2/utils/parser.test.ts` (new — no test file exists for this module today)

**Interfaces:**
- Consumes: nothing from other tasks — this is the only task in this plan.
- Produces: nothing consumed elsewhere — `parseEmail`'s exported signature stays `(source: Buffer | Uint8Array | string) => Promise<ParsedEmail>`, a widening of its current `(source: any)`, not a breaking change for any caller.

- [ ] **Step 1: Install the real `mailparser` package as a devDependency**

This is genuinely necessary, not optional infrastructure: the whole point
of this fix is "trust `mailparser`'s real charset-aware decoding when
given raw bytes instead of a pre-corrupted string" — a test that mocks
`mailparser` would only prove your own assumption about it, not verify
the library actually behaves that way. `mailparser` is not installed in
this repo today (confirmed: `ls node_modules/mailparser` finds nothing,
and it's absent from `package.json` — production code only ever imports
it via Deno's `npm:mailparser` specifier, which has no corresponding
real package in this repo's `node_modules`).

Run:
```bash
npm install --save-dev mailparser@3.9.28
```
This adds one line to `package.json`'s `devDependencies` (matching this
project's existing `^x.y.z` caret-range style, e.g.
`"@testing-library/dom": "^10.4.1"`) and updates `package-lock.json`.
Confirm with `grep -n '"mailparser"' package.json` that it landed under
`devDependencies`, not `dependencies` — production code continues to use
Deno's own `npm:mailparser` resolution at runtime, completely independent
of this repo's `node_modules`; this package exists solely so Vitest can
resolve it for the test below.

- [ ] **Step 2: Extend the `vitest.config.ts` resolver so `npm:mailparser` resolves to the real package**

`parser.ts`'s production code imports `simpleParser` via
`import { simpleParser, Attachment } from "npm:mailparser";` — Deno's
`npm:` specifier syntax, which Vite/Vitest cannot resolve on its own (the
exact same class of problem the domain-verification fix hit for
`npm:@aws-sdk/client-ses`, confirmed and fixed in
`vitest.config.ts`'s `npm-specifier-resolver` plugin). This time, instead
of redirecting to a mock (there is no mock here — we want the real
library's real behavior), redirect it to the real, now-installed
`mailparser` package.

Current `vitest.config.ts` (lines 6-20):
```typescript
  plugins: [
    {
      name: 'npm-specifier-resolver',
      resolveId(id) {
        // Resolve the AWS SES SDK import used in edge function tests.
        // Any test that imports npm:@aws-sdk/client-ses must supply its own
        // matching vi.mock('npm:@aws-sdk/client-ses', ...) or it will fail
        // with a less obvious "external module resolution" error instead of
        // Vite's initial "cannot resolve import" message.
        if (id === 'npm:@aws-sdk/client-ses') {
          return { id: '__npm_mock__@aws-sdk/client-ses', external: true };
        }
      },
    },
  ],
```

Replace with:
```typescript
  plugins: [
    {
      name: 'npm-specifier-resolver',
      resolveId(id) {
        // Resolve the AWS SES SDK import used in edge function tests.
        // Any test that imports npm:@aws-sdk/client-ses must supply its own
        // matching vi.mock('npm:@aws-sdk/client-ses', ...) or it will fail
        // with a less obvious "external module resolution" error instead of
        // Vite's initial "cannot resolve import" message.
        if (id === 'npm:@aws-sdk/client-ses') {
          return { id: '__npm_mock__@aws-sdk/client-ses', external: true };
        }
        // Resolve npm:mailparser to the REAL mailparser package (installed
        // as a devDependency specifically for this) instead of a mock --
        // the fix this test verifies depends on mailparser's actual
        // charset-decoding behavior, not an assumption about it.
        if (id === 'npm:mailparser') {
          return this.resolve('mailparser', undefined, { skipSelf: true });
        }
      },
    },
  ],
```

- [ ] **Step 3: Write the failing tests**

```typescript
// supabase/functions/sync-emails-v2/utils/parser.test.ts
import { describe, expect, it } from "vitest";
import { parseEmail } from "./parser.ts";

/**
 * Builds a minimal, real RFC822 message as raw bytes: an ISO-8859-1-charset
 * text/plain body containing byte 0xE9 -- the ISO-8859-1 encoding of the
 * character 'é' (LATIN SMALL LETTER E WITH ACUTE, U+00E9). This is NOT the
 * UTF-8 encoding of 'é' (which is the two bytes 0xC3 0xA9) -- that
 * distinction is the entire point of this test.
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

describe("parseEmail charset handling", () => {
  it("correctly decodes an ISO-8859-1 body when given the raw message bytes directly", async () => {
    const raw = buildIso88591Message();
    const result = await parseEmail(raw);
    expect(result.bodyText).toBe("café");
  });

  it("produces corrupted text if the raw bytes are stringified as UTF-8 first (the exact bug this fix removes)", async () => {
    const raw = buildIso88591Message();
    // Reproduces exactly what the old buggy imap.ts code did: Buffer.toString()
    // with no argument performs an implicit UTF-8 decode before the MIME
    // parser ever sees the bytes -- byte 0xE9 alone is not valid UTF-8.
    const corruptedString = raw.toString();
    const result = await parseEmail(corruptedString);
    expect(result.bodyText).not.toBe("café");
  });

  it("decodes identically whether given a Buffer or a string, for plain ASCII content", async () => {
    const raw = buildAsciiMessage();
    const viaBuffer = await parseEmail(raw);
    const viaString = await parseEmail(raw.toString());
    expect(viaBuffer.bodyText).toBe("hello world");
    expect(viaString.bodyText).toBe("hello world");
  });
});
```

- [ ] **Step 4: Run the tests now, before touching `imap.ts`**

Run: `npx vitest run supabase/functions/sync-emails-v2/utils/parser.test.ts`
Expected: 3 passed, already, at this point.

This is not a contradiction of TDD — read carefully why: the bug this
task fixes lives in `imap.ts` (a *caller* passing the wrong input shape
into `parseEmail`), not inside `parseEmail`/`parser.ts` itself.
`parseEmail` already just forwards whatever it's given straight into
`simpleParser` — it has always correctly handled a `Buffer` when given
one. There is no version of `parser.ts` to "fix" here; only its type
signature changes in Step 5, which has no runtime effect. So this test
file cannot fail-then-pass around that change — instead, it proves the
premise Step 5's `imap.ts` fix depends on: that `parseEmail`/`simpleParser`
genuinely decodes correctly when given raw bytes, and genuinely doesn't
when given a pre-corrupted string. Confirming that fact now, before
touching `imap.ts`, is what justifies the one-line fix that follows.
If any test fails here, stop and debug Steps 1-2 (the `mailparser`
devDependency and `vitest.config.ts` resolver) before proceeding — do
not move on to Step 5 with a failing test suite.

- [ ] **Step 5: Apply the fix**

In `supabase/functions/sync-emails-v2/services/imap.ts`, find these two
lines (currently lines 93-94):

```typescript
              const rawSource = message.source.toString();
              const parsedEmail = await parseEmail(rawSource);
```

Replace with:

```typescript
              const parsedEmail = await parseEmail(message.source);
```

`rawSource` is not referenced anywhere else in this function — removing
it entirely is safe.

In `supabase/functions/sync-emails-v2/utils/parser.ts`, find this line
(currently line 32):

```typescript
export async function parseEmail(source: any): Promise<ParsedEmail> {
```

Replace with:

```typescript
export async function parseEmail(source: Buffer | Uint8Array | string): Promise<ParsedEmail> {
```

No other line in either file changes.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/sync-emails-v2/utils/parser.test.ts`
Expected: 3 passed.

- [ ] **Step 7: Lint**

Run: `npx eslint supabase/functions/sync-emails-v2/services/imap.ts supabase/functions/sync-emails-v2/utils/parser.ts supabase/functions/sync-emails-v2/utils/parser.test.ts vitest.config.ts`
Expected: clean (or the same "outside configured scope" outcome this repo's other `supabase/functions/**` files get — note which applies).

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/sync-emails-v2/services/imap.ts supabase/functions/sync-emails-v2/utils/parser.ts supabase/functions/sync-emails-v2/utils/parser.test.ts vitest.config.ts package.json package-lock.json
git commit -m "fix(email-sync): preserve raw bytes through IMAP sync so mailparser can decode non-UTF-8 charsets correctly"
```
