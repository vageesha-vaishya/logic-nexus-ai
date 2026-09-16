# Gmail Sync Dead Fast Path and Inflated syncedCount Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gmail sync's `syncedCount` accurate and remove a dead, wasted database query, by deleting an existence check that compares against the wrong ID and instead using `saveEmailToDb`'s own real save/skip result.

**Architecture:** In `gmail.ts`, delete `processMessageList`'s outer pre-fetch existence check (it keys on the Gmail API's native message id, but the row is actually stored under the RFC822 `Message-ID` header value, so it never matches anything). Change `saveGmailMessage` to return the boolean `saveEmailToDb` already produces, and use that return value to drive the `savedCount`/`skippedCount` counters instead of incrementing `savedCount` unconditionally.

**Tech Stack:** Deno edge function (TypeScript), vitest, mocking only the true external boundaries (`fetch` for the Gmail API, the Supabase client) while exercising the real `parseEmail`/`decodeGmailRawMessage`/`saveEmailToDb` code paths — the same approach `sync-emails-v2/utils/db.test.ts` already uses for `saveEmailToDb` itself.

## Global Constraints

- No schema changes, no new migration, no data backfill.
- No change to `imap.ts`, `parser.ts`, `pop3.ts`, `db.ts`, or any file besides `gmail.ts` and its new test file.
- `saveEmailToDb`'s own signature, return value, and dedup logic (`db.ts`) do not change — this fix only stops discarding a return value that already existed.
- Full spec: `docs/superpowers/specs/2026-09-16-gmail-sync-fastpath-savedcount-fix-design.md`.

---

### Task 1: Remove the dead fast path and make syncedCount accurate

**Files:**
- Modify: `supabase/functions/sync-emails-v2/services/gmail.ts:163-224` (`processMessageList` and `saveGmailMessage`)
- Test: `supabase/functions/sync-emails-v2/services/gmail.processMessageList.test.ts` (new — no test file exists for this method today)

**Interfaces:**
- Consumes: `saveEmailToDb` (`../utils/db.ts`, unchanged — signature is `(supabase, account, email, folder, direction, logger?) => Promise<boolean>`, `true` for a genuine insert, `false` for a dedup no-op).
- Produces: nothing consumed elsewhere — this is the only task in this plan. `saveGmailMessage`'s return type changes from implicit `void` to `Promise<boolean>`, but it has exactly one caller (`processMessageList`, changed in this same task).

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/sync-emails-v2/services/gmail.processMessageList.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { GmailService } from "./gmail.ts";
import type { EmailAccount } from "../utils/db.ts";

function defaultAccount(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: "account-1",
    email_address: "test@example.com",
    provider: "gmail",
    user_id: "user-1",
    tenant_id: undefined,
    franchise_id: undefined,
    ...overrides,
  };
}

function loggerMock() {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  } as any;
}

function buildRawMessage(messageId: string): Buffer {
  const headers =
    `Message-ID: ${messageId}\r\n` +
    "From: sender@example.com\r\n" +
    "To: recipient@example.com\r\n" +
    "Subject: Test\r\n" +
    "Content-Type: text/plain; charset=us-ascii\r\n" +
    "Content-Transfer-Encoding: 7bit\r\n" +
    "\r\n";
  return Buffer.from(headers + "hello world", "ascii");
}

// Mirrors gmail.ts's own base64url encoding, matching the convention
// already established in gmail.decode.test.ts.
function toGmailBase64Url(message: Buffer): string {
  return message.toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Stands in for the Gmail API's per-message raw-fetch call
 * (GET .../messages/{id}?format=raw). Returns a real base64url-encoded
 * RFC822 message for each known Gmail-native message id.
 */
function fetchMock(rawByGmailId: Record<string, Buffer>) {
  return vi.fn(async (url: string) => {
    const match = String(url).match(/\/messages\/([^?]+)\?format=raw/);
    const gmailId = match?.[1] ?? "";
    const buf = rawByGmailId[gmailId];
    if (!buf) {
      return { ok: false, text: async () => "not found" } as any;
    }
    return {
      ok: true,
      json: async () => ({ id: gmailId, raw: toGmailBase64Url(buf), snippet: "snippet" }),
    } as any;
  });
}

/**
 * Mocks the two tables saveEmailToDb touches -- "leads" (always "no
 * match", that lookup isn't what this test is verifying) and "emails"
 * (the real dedup check and upsert under test). Parameterized by which
 * RFC822 Message-ID values should be treated as already saved, so a test
 * can control which of a batch's messages saveEmailToDb dedupes vs.
 * inserts. Deliberately duplicated from utils/db.test.ts's own
 * supabaseMock rather than shared -- extracting a shared fixture would
 * require a third file, which this plan's Global Constraints prohibit.
 */
function supabaseMock(existingMessageIds: Set<string>) {
  const upsertCalls: Array<{ payload: any; options: any }> = [];

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
          eq: vi.fn((_col: string, messageId: string) => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: existingMessageIds.has(messageId) ? { id: "existing-id" } : null,
                error: null,
              })),
            })),
          })),
        })),
        upsert: vi.fn((payload: any, options: any) => {
          upsertCalls.push({ payload, options });
          return {
            select: vi.fn().mockResolvedValue({ data: [{ id: "new-id" }], error: null }),
          };
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from, upsertCalls } as any;
}

describe("GmailService.processMessageList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves every message in an all-new batch and never logs a skip", async () => {
    const rawByGmailId = {
      "gmail-id-1": buildRawMessage("<msg-1@example.com>"),
      "gmail-id-2": buildRawMessage("<msg-2@example.com>"),
    };
    vi.stubGlobal("fetch", fetchMock(rawByGmailId));

    const supabase = supabaseMock(new Set());
    const logger = loggerMock();
    const service = new GmailService(defaultAccount(), supabase, undefined, logger);
    (service as any).currentAccessToken = "test-token";

    const savedCount = await (service as any).processMessageList(
      [{ id: "gmail-id-1" }, { id: "gmail-id-2" }],
      "inbox",
      "inbound",
    );

    expect(savedCount).toBe(2);
    expect(supabase.upsertCalls).toHaveLength(2);
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining("Skipped"));
  });

  it("fetches every message even when one is already saved, and reports the accurate saved/skipped split", async () => {
    const rawByGmailId = {
      "gmail-id-1": buildRawMessage("<already-saved@example.com>"),
      "gmail-id-2": buildRawMessage("<brand-new@example.com>"),
    };
    const fetch = fetchMock(rawByGmailId);
    vi.stubGlobal("fetch", fetch);

    const supabase = supabaseMock(new Set(["<already-saved@example.com>"]));
    const logger = loggerMock();
    const service = new GmailService(defaultAccount(), supabase, undefined, logger);
    (service as any).currentAccessToken = "test-token";

    const savedCount = await (service as any).processMessageList(
      [{ id: "gmail-id-1" }, { id: "gmail-id-2" }],
      "inbox",
      "inbound",
    );

    expect(savedCount).toBe(1);
    expect(supabase.upsertCalls).toHaveLength(1);
    // The direct regression guard: under the OLD buggy code this call count
    // would ALSO be 2 (the outer check never matched anyway, so it never
    // gated the fetch) -- but the skip-log assertion below would fail,
    // since skippedCount was always 0 under the old code.
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Skipped 1 existing messages"));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail against the current, buggy code**

Run: `npx vitest run supabase/functions/sync-emails-v2/services/gmail.processMessageList.test.ts`

Expected: the first test (all-new batch) passes already — nothing about
it depends on the bug. The second test fails: `savedCount` will be `2`
instead of the expected `1` (the current code increments `savedCount`
unconditionally after every `saveGmailMessage` call, since it discards
`saveEmailToDb`'s return value), and the "Skipped 1 existing messages" log
assertion will fail (the outer existence check never runs the code path
that logs it, since it never finds a match). Confirm you see exactly this
failure before proceeding — if the first test also fails, stop and debug
the test file itself before touching `gmail.ts`.

- [ ] **Step 3: Apply the fix**

In `supabase/functions/sync-emails-v2/services/gmail.ts`, find
`processMessageList` (currently lines 163-206):

```typescript
  private async processMessageList(messages: any[], folder: string, direction: "inbound" | "outbound"): Promise<number> {
    if (!messages || messages.length === 0) return 0;
    
    this.logger?.info(`Processing ${messages.length} messages for ${folder}`);
    
    let savedCount = 0;
    let skippedCount = 0;

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
    
    if (skippedCount > 0) {
        this.logger?.info(`Skipped ${skippedCount} existing messages for ${folder}`);
    }
    
    return savedCount;
  }
```

Replace with:

```typescript
  private async processMessageList(messages: any[], folder: string, direction: "inbound" | "outbound"): Promise<number> {
    if (!messages || messages.length === 0) return 0;
    
    this.logger?.info(`Processing ${messages.length} messages for ${folder}`);
    
    let savedCount = 0;
    let skippedCount = 0;

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
    
    if (skippedCount > 0) {
        this.logger?.info(`Skipped ${skippedCount} existing messages for ${folder}`);
    }
    
    return savedCount;
  }
```

Then find `saveGmailMessage` (currently lines 208-224):

```typescript
  private async saveGmailMessage(msgData: any, folder: string, direction: "inbound" | "outbound") {
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
     
     await saveEmailToDb(this.supabase, this.account, parsedEmail, folder, direction, this.logger);
  }
```

Replace with:

```typescript
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

No other line in `gmail.ts` changes — `ensureAccessToken`, `refreshAccessToken`, `syncLabel`, `syncEmails`, and `decodeGmailRawMessage` all stay exactly as they are.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/sync-emails-v2/services/gmail.processMessageList.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Run the full sync-emails-v2 suite to check for collateral breakage**

Run: `npx vitest run supabase/functions/sync-emails-v2`
Expected: all passing (this includes `gmail.decode.test.ts`, `utils/db.test.ts`, and `utils/parser.test.ts` from the earlier, already-merged fixes on this same branch — none of their code changed, so they should be unaffected).

- [ ] **Step 6: Lint**

Run: `npx eslint supabase/functions/sync-emails-v2/services/gmail.ts supabase/functions/sync-emails-v2/services/gmail.processMessageList.test.ts`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/sync-emails-v2/services/gmail.ts supabase/functions/sync-emails-v2/services/gmail.processMessageList.test.ts
git commit -m "fix(email-sync): remove Gmail sync's dead fast path and report accurate syncedCount"
```
