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
