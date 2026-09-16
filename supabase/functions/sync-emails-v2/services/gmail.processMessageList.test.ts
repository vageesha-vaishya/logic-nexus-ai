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
