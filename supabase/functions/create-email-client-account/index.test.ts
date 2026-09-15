import { beforeEach, describe, expect, it, vi } from "vitest";

type EdgeHandler = (
  req: Request,
  logger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
  supabase: any,
) => Promise<Response>;

let capturedHandler: EdgeHandler | null = null;
const requireAuthMock = vi.fn();
const setEmailCredentialMock = vi.fn();

vi.mock("../_shared/logger.ts", () => ({
  serveWithLogger: (handler: EdgeHandler) => {
    capturedHandler = handler;
  },
}));

vi.mock("../_shared/cors.ts", () => ({
  getCorsHeaders: () => ({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  }),
}));

vi.mock("../_shared/auth.ts", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("../_shared/email-credentials.ts", () => ({
  setEmailCredential: setEmailCredentialMock,
}));

function loggerMock() {
  return {
    info: vi.fn(async () => undefined),
    error: vi.fn(async () => undefined),
  };
}

const VALID_BODY = {
  display_name: "Test Account",
  email_address: "test@example.com",
  is_primary: false,
  smtp: { host: "smtp.gmail.com", port: 587, username: "test@example.com", password: "smtp-secret", use_tls: true },
  imap: { host: "imap.gmail.com", port: 993, username: "test@example.com", password: "imap-secret", use_ssl: true },
  settings: { preset: "gmail" },
};

function supabaseMock(opts: {
  userRolesRow?: { tenant_id: string | null; franchise_id: string | null } | null;
  insertedAccount?: Record<string, unknown> | null;
  insertError?: unknown;
  deleteAccountError?: unknown;
  deleteSecretError?: unknown;
}) {
  const insertedAccount = opts.insertedAccount ?? { id: "new-account-id", ...VALID_BODY };
  const capturedInserts: unknown[] = [];
  const deleteEmailAccountsCalls: string[] = [];
  const deleteSecretsCalls: Array<{ subject_kind: string; subject_id: string }> = [];

  const from = vi.fn((table: string) => {
    if (table === "user_roles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: opts.userRolesRow ?? { tenant_id: "tenant-1", franchise_id: null },
                error: null,
              }),
            })),
          })),
        })),
      };
    }
    if (table === "email_accounts") {
      return {
        insert: vi.fn((payload: unknown) => {
          capturedInserts.push(payload);
          return {
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: opts.insertError ? null : insertedAccount,
                error: opts.insertError ?? null,
              }),
            })),
          };
        }),
        delete: vi.fn(() => ({
          eq: vi.fn((_col: string, id: string) => {
            deleteEmailAccountsCalls.push(id);
            return Promise.resolve({ error: opts.deleteAccountError ?? null });
          }),
        })),
      };
    }
    throw new Error(`Unexpected table in from(): ${table}`);
  });

  const schema = vi.fn((name: string) => {
    if (name !== "core") throw new Error(`Unexpected schema: ${name}`);
    return {
      from: vi.fn((table: string) => {
        if (table !== "secrets") throw new Error(`Unexpected core table: ${table}`);
        return {
          delete: vi.fn(() => ({
            eq: vi.fn((col1: string, val1: string) => ({
              eq: vi.fn((col2: string, val2: string) => {
                deleteSecretsCalls.push({ subject_kind: val1, subject_id: val2 });
                return Promise.resolve({ error: opts.deleteSecretError ?? null });
              }),
            })),
          })),
        };
      }),
    };
  });

  return { from, schema, capturedInserts, deleteEmailAccountsCalls, deleteSecretsCalls };
}

describe("create-email-client-account edge function", () => {
  beforeEach(async () => {
    capturedHandler = null;
    requireAuthMock.mockReset();
    setEmailCredentialMock.mockReset();
    vi.resetModules();
    await import("./index.ts");
  });

  it("returns 401 when not authenticated", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: null, error: "no session" });
    const supabase = supabaseMock({});

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
      loggerMock(),
      supabase,
    );

    expect(res.status).toBe(401);
    expect(supabase.capturedInserts).toHaveLength(0);
  });

  it("creates the account and both credentials on the happy path", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    setEmailCredentialMock.mockResolvedValue({ ok: true });
    const supabase = supabaseMock({});

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
      loggerMock(),
      supabase,
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.account.id).toBe("new-account-id");

    // The insert payload must carry user_id, and must NEVER carry the
    // dropped smtp_password/imap_password columns -- the two concrete
    // regression guards for the original bug.
    const insertPayload = supabase.capturedInserts[0] as Record<string, unknown>;
    expect(insertPayload.user_id).toBe("user-1");
    expect(insertPayload).not.toHaveProperty("smtp_password");
    expect(insertPayload).not.toHaveProperty("imap_password");

    expect(setEmailCredentialMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ account_id: "new-account-id", purpose: "smtp_password", value: "smtp-secret" }),
      expect.anything(),
    );
    expect(setEmailCredentialMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ account_id: "new-account-id", purpose: "imap_password", value: "imap-secret" }),
      expect.anything(),
    );
  });

  it("rolls back the account row when the smtp_password write fails, and never attempts imap_password", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    setEmailCredentialMock.mockResolvedValueOnce({ ok: false, error: "vault error" });
    const supabase = supabaseMock({});

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
      loggerMock(),
      supabase,
    );

    expect(res.status).toBe(500);
    expect(setEmailCredentialMock).toHaveBeenCalledTimes(1);
    expect(supabase.deleteEmailAccountsCalls).toEqual(["new-account-id"]);
    // Nothing was written to core.secrets yet -- no cleanup call needed.
    expect(supabase.deleteSecretsCalls).toHaveLength(0);
  });

  it("rolls back the account row AND cleans up the already-written smtp_password secret when imap_password fails", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    setEmailCredentialMock
      .mockResolvedValueOnce({ ok: true }) // smtp_password succeeds
      .mockResolvedValueOnce({ ok: false, error: "vault error" }); // imap_password fails
    const supabase = supabaseMock({});

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
      loggerMock(),
      supabase,
    );

    expect(res.status).toBe(500);
    expect(supabase.deleteEmailAccountsCalls).toEqual(["new-account-id"]);
    expect(supabase.deleteSecretsCalls).toEqual([
      { subject_kind: "comms.email_account", subject_id: "new-account-id" },
    ]);
  });

  it("returns 400 when required fields are missing", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const supabase = supabaseMock({});

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify({ ...VALID_BODY, email_address: undefined }),
      }),
      loggerMock(),
      supabase,
    );

    expect(res.status).toBe(400);
    expect(supabase.capturedInserts).toHaveLength(0);
  });

  it("returns CORS headers for OPTIONS with no auth check", async () => {
    const handler = capturedHandler as EdgeHandler;

    const res = await handler(
      new Request("https://example.com/create-email-client-account", { method: "OPTIONS" }),
      loggerMock(),
      {} as any,
    );

    expect(res.status).toBeLessThan(400);
    expect(requireAuthMock).not.toHaveBeenCalled();
  });

  it("logs error when account delete fails after smtp_password write fails", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    setEmailCredentialMock.mockResolvedValueOnce({ ok: false, error: "vault error" });
    const logger = loggerMock();
    const supabase = supabaseMock({ deleteAccountError: "permission denied" });

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
      logger,
      supabase,
    );

    expect(res.status).toBe(500);
    // Verify that logger.error was called for the delete failure
    const errorCalls = (logger.error as any).mock.calls;
    const deleteErrorLogged = errorCalls.some((call: any[]) =>
      call[0]?.includes("account row delete failed after smtp_password write failed"),
    );
    expect(deleteErrorLogged).toBe(true);
  });

  it("logs error when secret delete fails after imap_password write fails", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    setEmailCredentialMock
      .mockResolvedValueOnce({ ok: true }) // smtp_password succeeds
      .mockResolvedValueOnce({ ok: false, error: "vault error" }); // imap_password fails
    const logger = loggerMock();
    const supabase = supabaseMock({ deleteSecretError: "permission denied" });

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
      logger,
      supabase,
    );

    expect(res.status).toBe(500);
    // Verify that logger.error was called for the secret delete failure
    const errorCalls = (logger.error as any).mock.calls;
    const deleteErrorLogged = errorCalls.some((call: any[]) =>
      call[0]?.includes("secret delete failed after imap_password write failed"),
    );
    expect(deleteErrorLogged).toBe(true);
  });
});
