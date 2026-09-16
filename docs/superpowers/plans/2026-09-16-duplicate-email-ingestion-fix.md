# Duplicate Email Ingestion Fix (Group B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close a real check-then-insert race in the email-sync save path by making the write atomic, so overlapping syncs for the same account can never race past the "does this message already exist" check.

**Architecture:** One function, one file: `saveEmailToDb` in `sync-emails-v2/utils/db.ts` keeps its existing existence-check fast path (an optimization, not a correctness boundary) but replaces its final plain `.insert()` with an atomic `.upsert(..., { onConflict: "account_id,message_id", ignoreDuplicates: true })` — this codebase's own established idiom for exactly this situation.

**Tech Stack:** Deno edge function (TypeScript), vitest, `@supabase/supabase-js`'s query builder (mocked in tests).

## Global Constraints

- No schema changes, no new migration — the `UNIQUE(account_id, message_id)` constraint this fix relies on already exists.
- No change to the IMAP/Gmail/POP3 fetch logic, the last-50-messages window, attachment upload logic, lead auto-linking, or any file besides `sync-emails-v2/utils/db.ts`.
- `saveEmailToDb`'s return value must keep its existing meaning: `true` only when a message was newly stored, `false` for both "already existed" and "lost the race" — callers must not be able to distinguish those two `false` cases.
- Full spec: `docs/superpowers/specs/2026-09-16-duplicate-email-ingestion-fix-design.md`.

---

### Task 1: Make `saveEmailToDb`'s write atomic

**Files:**
- Modify: `supabase/functions/sync-emails-v2/utils/db.ts:180-187`
- Test: `supabase/functions/sync-emails-v2/utils/db.test.ts` (new — no test file exists for this module today)

**Interfaces:**
- Consumes: nothing from other tasks — this is the only task in this plan.
- Produces: nothing consumed elsewhere — `saveEmailToDb`'s exported signature (`(supabase, account, email, folder?, direction?, logger?) => Promise<boolean>`) and return-value meaning are unchanged; only its internal write mechanism changes.

- [ ] **Step 1: Write the failing tests**

`db.ts` has no `Deno` global reference and no `npm:`-specifier import, so neither of the extra mocking steps from the domain-verification fix's test file are needed here — this is a plain Supabase-query-builder mock.

```typescript
// supabase/functions/sync-emails-v2/utils/db.test.ts
import { describe, expect, it, vi } from "vitest";
import { saveEmailToDb } from "./db.ts";
import type { EmailAccount } from "./db.ts";
import type { ParsedEmail } from "./parser.ts";

function loggerMock() {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  } as any;
}

function defaultAccount(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: "account-1",
    email_address: "test@example.com",
    provider: "smtp_imap",
    user_id: "user-1",
    tenant_id: undefined,
    franchise_id: undefined,
    ...overrides,
  };
}

function defaultEmail(overrides: Partial<ParsedEmail> = {}): ParsedEmail {
  return {
    messageId: "<msg-1@example.com>",
    subject: "Test subject",
    from: { name: "Sender", email: "sender@example.com" },
    to: [{ name: "Recipient", email: "test@example.com" }],
    cc: [],
    bcc: [],
    bodyText: "Hello",
    bodyHtml: "<p>Hello</p>",
    receivedAt: "2026-09-16T00:00:00.000Z",
    inReplyTo: null,
    references: [],
    attachments: [],
    headers: {},
    snippet: "Hello",
    hasInlineImages: false,
    ...overrides,
  };
}

/**
 * Mocks the two tables saveEmailToDb touches:
 * - "leads" (findLinkedLeadId's lookup, always returns "no match" here --
 *   that lookup isn't what this task is testing)
 * - "emails" (the existence check, and the upsert write under test)
 */
function supabaseMock(opts: {
  existingRow?: { id: string } | null;
  existingError?: unknown;
  upsertData?: Array<{ id: string }> | null;
  upsertError?: unknown;
}) {
  const capturedUpserts: Array<{ payload: any; options: any }> = [];

  const from = vi.fn((table: string) => {
    if (table === "leads") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      };
    }
    if (table === "emails") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: opts.existingRow ?? null,
                error: opts.existingError ?? null,
              }),
            })),
          })),
        })),
        upsert: vi.fn((payload: any, options: any) => {
          capturedUpserts.push({ payload, options });
          return {
            select: vi.fn().mockResolvedValue({
              data: opts.upsertData ?? [],
              error: opts.upsertError ?? null,
            }),
          };
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from, capturedUpserts } as any;
}

describe("saveEmailToDb", () => {
  it("returns false and never writes when the fast-path existence check finds the message already stored", async () => {
    const supabase = supabaseMock({ existingRow: { id: "existing-id" } });
    const logger = loggerMock();

    const result = await saveEmailToDb(supabase, defaultAccount(), defaultEmail(), "inbox", "inbound", logger);

    expect(result).toBe(false);
    expect(supabase.capturedUpserts).toHaveLength(0);
  });

  it("upserts with the exact conflict target and ignoreDuplicates, and returns true for a genuinely new message", async () => {
    const supabase = supabaseMock({ existingRow: null, upsertData: [{ id: "new-id" }] });
    const logger = loggerMock();

    const result = await saveEmailToDb(supabase, defaultAccount(), defaultEmail(), "inbox", "inbound", logger);

    expect(result).toBe(true);
    expect(supabase.capturedUpserts).toHaveLength(1);
    expect(supabase.capturedUpserts[0].options).toEqual({
      onConflict: "account_id,message_id",
      ignoreDuplicates: true,
    });
    expect(supabase.capturedUpserts[0].payload.message_id).toBe("<msg-1@example.com>");
    expect(supabase.capturedUpserts[0].payload.account_id).toBe("account-1");
  });

  it("returns false without throwing when the write loses a race (upsert returns no row)", async () => {
    // The fast-path check found nothing (as if this were the losing side of
    // a race with a concurrent sync that inserted the same message a moment
    // earlier) -- ON CONFLICT DO NOTHING silently absorbs it: no row comes
    // back from .select(), and this must NOT be treated as an error.
    const supabase = supabaseMock({ existingRow: null, upsertData: [] });
    const logger = loggerMock();

    const result = await saveEmailToDb(supabase, defaultAccount(), defaultEmail(), "inbox", "inbound", logger);

    expect(result).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("throws on a genuine database error from the upsert", async () => {
    const supabase = supabaseMock({ existingRow: null, upsertError: { message: "connection reset" } });
    const logger = loggerMock();

    await expect(
      saveEmailToDb(supabase, defaultAccount(), defaultEmail(), "inbox", "inbound", logger),
    ).rejects.toEqual({ message: "connection reset" });
    expect(logger.error).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail against the current, buggy code**

Run: `npx vitest run supabase/functions/sync-emails-v2/utils/db.test.ts`
Expected: the first test ("fast-path existence check") and the fourth test ("genuine database error") PASS already — neither depends on the atomic-write change. The second and third tests FAIL: the current code calls `.insert(payload)` (no `.upsert`, no `.select("id")`), so `supabase.capturedUpserts` stays empty and the mock's `.insert` isn't even defined on the "emails" branch above — the second test's assertions on `capturedUpserts` fail, and the third test's `result` comes back `true` (today's `.insert()` always returns `true` on success, with no way to represent "the write silently no-opped").

- [ ] **Step 3: Apply the fix**

In `supabase/functions/sync-emails-v2/utils/db.ts`, find this block (currently lines 180-187, the end of `saveEmailToDb`):

```typescript
  const { error } = await supabase.from("emails").insert(payload);
  
  if (error) {
    logger?.error(`DB Insert Error for ${email.messageId}:`, { error });
    throw error;
  }
  
  return true;
}
```

Replace it with:

```typescript
  const { data: inserted, error } = await supabase
    .from("emails")
    .upsert(payload, { onConflict: "account_id,message_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    logger?.error(`DB Insert Error for ${email.messageId}:`, { error });
    throw error;
  }

  return Boolean(inserted && inserted.length > 0);
}
```

Nothing else in the file changes — the existence check above this block, `uploadAttachments`, the `payload` object construction, and the lead auto-linking `try/catch` all stay exactly as they are.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/sync-emails-v2/utils/db.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Lint**

Run: `npx eslint supabase/functions/sync-emails-v2/utils/db.ts supabase/functions/sync-emails-v2/utils/db.test.ts`
Expected: clean (or the same "outside configured scope" outcome this repo's other `supabase/functions/**` files get — note which applies).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/sync-emails-v2/utils/db.ts supabase/functions/sync-emails-v2/utils/db.test.ts
git commit -m "fix(email-sync): make saveEmailToDb's write atomic to close a check-then-insert race"
```
