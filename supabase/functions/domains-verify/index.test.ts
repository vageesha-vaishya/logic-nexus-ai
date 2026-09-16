import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type EdgeHandler = (
  req: Request,
  logger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
  supabase: any,
) => Promise<Response>;

let capturedHandler: EdgeHandler | null = null;
const requireAuthMock = vi.fn();

vi.mock("npm:@aws-sdk/client-ses", () => ({
  SESClient: class {
    send() {
      return Promise.resolve({});
    }
  },
  VerifyDomainDkimCommand: class {},
}));

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

function loggerMock() {
  return {
    info: vi.fn(async () => undefined),
    error: vi.fn(async () => undefined),
  };
}

function defaultDomainRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "domain-1",
    domain_name: "example.com",
    provider_metadata: { dkim_tokens: ["tok1", "tok2", "tok3"] },
    ...overrides,
  };
}

function supabaseClientMock(opts: { domainRow?: Record<string, unknown> | null; fetchError?: unknown }) {
  const capturedUpdates: Record<string, unknown>[] = [];
  const updateEqCalls: string[] = [];

  const from = vi.fn((table: string) => {
    if (table !== "tenant_domains") throw new Error(`Unexpected table: ${table}`);
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: opts.fetchError ? null : (opts.domainRow ?? defaultDomainRow()),
            error: opts.fetchError ?? null,
          }),
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) => {
        capturedUpdates.push(payload);
        return {
          eq: vi.fn((_col: string, id: string) => {
            updateEqCalls.push(id);
            return Promise.resolve({ error: null });
          }),
        };
      }),
    };
  });

  return { from, capturedUpdates, updateEqCalls };
}

function requestWith(body: Record<string, unknown>) {
  return new Request("https://example.com/domains-verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Controls what Deno.resolveDns returns per (name, recordType) pair. */
function mockResolveDns(rules: { txt?: Record<string, string[]>; cname?: Record<string, string[]> }) {
  return vi.fn((name: string, type: string) => {
    if (type === "TXT") {
      const rec = rules.txt?.[name];
      if (rec) return Promise.resolve(rec.map((r) => [r]));
      return Promise.reject(new Error("no TXT record"));
    }
    if (type === "CNAME") {
      const rec = rules.cname?.[name];
      if (rec) return Promise.resolve(rec);
      return Promise.reject(new Error("no CNAME record"));
    }
    return Promise.reject(new Error(`unexpected DNS type ${type}`));
  });
}

describe("domains-verify edge function", () => {
  beforeEach(async () => {
    capturedHandler = null;
    requireAuthMock.mockReset();
    vi.resetModules();
    await import("./index.ts");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when not authenticated, with no DNS lookups or update attempted", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: null, error: "no session", supabaseClient: null });
    const resolveDns = mockResolveDns({});
    vi.stubGlobal("Deno", { resolveDns, env: { get: vi.fn().mockReturnValue(undefined) } });

    const res = await handler(requestWith({ domain_id: "domain-1" }), loggerMock(), null);

    expect(res.status).toBe(401);
    expect(resolveDns).not.toHaveBeenCalled();
  });

  it("returns 400 when the domain is not found, without attempting DNS lookups or an update", async () => {
    const handler = capturedHandler as EdgeHandler;
    const client = supabaseClientMock({ fetchError: { message: "not found" } });
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null, supabaseClient: client });
    const resolveDns = mockResolveDns({});
    vi.stubGlobal("Deno", { resolveDns, env: { get: vi.fn().mockReturnValue(undefined) } });

    const res = await handler(requestWith({ domain_id: "missing-id" }), loggerMock(), null);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Domain not found or access denied");
    expect(resolveDns).not.toHaveBeenCalled();
    expect(client.capturedUpdates).toHaveLength(0);
  });

  it("never sends a status column, and sets is_verified true when SPF and DKIM pass even if DMARC fails", async () => {
    const handler = capturedHandler as EdgeHandler;
    const client = supabaseClientMock({});
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null, supabaseClient: client });
    const resolveDns = mockResolveDns({
      txt: { "example.com": ["v=spf1 include:amazonses.com ~all"] },
      cname: { "tok1._domainkey.example.com": ["tok1.dkim.amazonses.com"] },
    });
    vi.stubGlobal("Deno", { resolveDns, env: { get: vi.fn().mockReturnValue(undefined) } });

    const res = await handler(requestWith({ domain_id: "domain-1" }), loggerMock(), null);

    expect(res.status).toBe(200);
    const payload = client.capturedUpdates[0];
    expect(payload).not.toHaveProperty("status");
    expect(payload.spf_verified).toBe(true);
    expect(payload.dmarc_verified).toBe(false);
    expect(payload.dkim_verified).toBe(true);
    expect(payload.is_verified).toBe(true);
    expect(client.updateEqCalls).toEqual(["domain-1"]);
  });

  it("sets is_verified false when SPF passes but DKIM fails, and never sends a status column", async () => {
    const handler = capturedHandler as EdgeHandler;
    const client = supabaseClientMock({});
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null, supabaseClient: client });
    const resolveDns = mockResolveDns({
      txt: { "example.com": ["v=spf1 include:amazonses.com ~all"] },
      // No matching CNAME entries at all -- every DKIM token lookup rejects.
      cname: {},
    });
    vi.stubGlobal("Deno", { resolveDns, env: { get: vi.fn().mockReturnValue(undefined) } });

    const res = await handler(requestWith({ domain_id: "domain-1" }), loggerMock(), null);

    expect(res.status).toBe(200);
    const payload = client.capturedUpdates[0];
    expect(payload).not.toHaveProperty("status");
    expect(payload.spf_verified).toBe(true);
    expect(payload.dkim_verified).toBe(false);
    expect(payload.is_verified).toBe(false);
  });

  it("computes is_verified false (not a crash) when DKIM tokens are absent and identity provisioning also fails", async () => {
    const handler = capturedHandler as EdgeHandler;
    // No dkim_tokens in provider_metadata -- the function will try to
    // provision an identity. Force that to fail by requesting the
    // aws-ses provider with no AWS credentials configured, matching the
    // real getEmailProvider()'s "Missing AWS credentials" throw, which
    // the surrounding try/catch swallows (logs, doesn't rethrow).
    const client = supabaseClientMock({ domainRow: defaultDomainRow({ provider_metadata: {} }) });
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null, supabaseClient: client });
    const resolveDns = mockResolveDns({
      txt: { "example.com": ["v=spf1 include:amazonses.com ~all"] },
    });
    const envGet = vi.fn((key: string) => (key === "EMAIL_PROVIDER_TYPE" ? "aws-ses" : undefined));
    vi.stubGlobal("Deno", { resolveDns, env: { get: envGet } });

    const res = await handler(requestWith({ domain_id: "domain-1" }), loggerMock(), null);

    expect(res.status).toBe(200);
    const payload = client.capturedUpdates[0];
    expect(payload).not.toHaveProperty("status");
    expect(payload.spf_verified).toBe(true);
    expect(payload).not.toHaveProperty("dkim_verified");
    expect(payload.is_verified).toBe(false);
  });

  it("sets is_verified true when SPF, DKIM, and DMARC all pass", async () => {
    const handler = capturedHandler as EdgeHandler;
    const client = supabaseClientMock({});
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null, supabaseClient: client });
    const resolveDns = mockResolveDns({
      txt: {
        "example.com": ["v=spf1 include:amazonses.com ~all"],
        "_dmarc.example.com": ["v=DMARC1; p=none;"],
      },
      cname: { "tok1._domainkey.example.com": ["tok1.dkim.amazonses.com"] },
    });
    vi.stubGlobal("Deno", { resolveDns, env: { get: vi.fn().mockReturnValue(undefined) } });

    const res = await handler(requestWith({ domain_id: "domain-1" }), loggerMock(), null);

    expect(res.status).toBe(200);
    const payload = client.capturedUpdates[0];
    expect(payload).not.toHaveProperty("status");
    expect(payload.spf_verified).toBe(true);
    expect(payload.dmarc_verified).toBe(true);
    expect(payload.dkim_verified).toBe(true);
    expect(payload.is_verified).toBe(true);

    // Response body must use the `results` key (not `verification`) so
    // consumers like DomainManagement.tsx and TenantForm.tsx can read
    // data.results.{spf,dmarc,dkim} instead of getting `undefined`.
    const body = await res.json();
    expect(body.results).toEqual({ spf: true, dmarc: true, dkim: true });
    expect(body).not.toHaveProperty("verification");
  });
});
