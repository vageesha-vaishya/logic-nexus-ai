import { beforeEach, describe, expect, it, vi } from "vitest";

type EdgeHandler = (
  req: Request,
  logger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
  supabase: {
    schema: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
  },
) => Promise<Response>;

let capturedHandler: EdgeHandler | null = null;
const requireAuthMock = vi.fn();

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

function schemaSupabaseMock(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { schema: vi.fn(() => ({ rpc })), rpc };
}

function tableSupabaseMock(opts: {
  userRoleRow?: { role: string } | null;
  listData?: unknown[];
  listError?: unknown;
  updateData?: unknown;
  updateError?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.userRoleRow ?? null,
    error: null,
  });
  const order = vi.fn().mockResolvedValue({
    data: opts.listData ?? [],
    error: opts.listError ?? null,
  });
  const selectSingle = vi.fn().mockResolvedValue({
    data: opts.updateData ?? null,
    error: opts.updateError ?? null,
  });
  const eqChainForRoleCheck = { eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) };
  const from = vi.fn((table: string) => {
    if (table === "user_roles") {
      return { select: vi.fn(() => eqChainForRoleCheck) };
    }
    // platform.feature_flags direct table access for list/upsert
    return {
      select: vi.fn(() => ({ order })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ select: vi.fn(() => ({ single: selectSingle })) })),
      })),
    };
  });
  return { from };
}

describe("feature-flags edge function", () => {
  beforeEach(async () => {
    capturedHandler = null;
    requireAuthMock.mockReset();
    vi.resetModules();
    await import("./index.ts");
  });

  it("GET resolves flags via platform.resolve_flags and returns {data:{flags}}", async () => {
    const handler = capturedHandler as EdgeHandler;
    const supabase = schemaSupabaseMock({
      data: { amro_rbac_fix_enabled: true, domain_grouped_nav: false },
      error: null,
    });

    const res = await handler(
      new Request("https://example.com/feature-flags?keys=amro_rbac_fix_enabled,domain_grouped_nav"),
      loggerMock(),
      supabase as any,
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.flags).toEqual({ amro_rbac_fix_enabled: true, domain_grouped_nav: false });
    expect(supabase.schema).toHaveBeenCalledWith("platform");
    expect(supabase.rpc).toHaveBeenCalledWith("resolve_flags", expect.objectContaining({
      p_keys: ["amro_rbac_fix_enabled", "domain_grouped_nav"],
    }));
  });

  it("GET with missing keys returns 400", async () => {
    const handler = capturedHandler as EdgeHandler;
    const supabase = schemaSupabaseMock({ data: {}, error: null });

    const res = await handler(
      new Request("https://example.com/feature-flags"),
      loggerMock(),
      supabase as any,
    );

    expect(res.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("GET with more than 50 keys returns 400", async () => {
    const handler = capturedHandler as EdgeHandler;
    const supabase = schemaSupabaseMock({ data: {}, error: null });
    const manyKeys = Array.from({ length: 51 }, (_, i) => `k${i}`).join(",");

    const res = await handler(
      new Request(`https://example.com/feature-flags?keys=${manyKeys}`),
      loggerMock(),
      supabase as any,
    );

    expect(res.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("POST list with no Authorization header returns 401", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: null, error: "Missing Authorization header" });

    const res = await handler(
      new Request("https://example.com/feature-flags", {
        method: "POST",
        body: JSON.stringify({ action: "list" }),
      }),
      loggerMock(),
      {} as any,
    );

    expect(res.status).toBe(401);
  });

  it("POST list with auth but no platform_admin row returns 403", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "u1" }, error: null });
    const supabase = tableSupabaseMock({ userRoleRow: null });

    const res = await handler(
      new Request("https://example.com/feature-flags", {
        method: "POST",
        body: JSON.stringify({ action: "list" }),
      }),
      loggerMock(),
      supabase as any,
    );

    expect(res.status).toBe(403);
  });

  it("POST list with platform_admin returns all FlagRow fields", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "admin-1" }, error: null });
    const flagRow = {
      id: "id-1", key: "amro_rbac_fix_enabled", name: "AMRO RBAC Fix",
      description: "d", enabled: true, rollout_pct: 100, tags: ["amro"],
      updated_at: "2026-01-01T00:00:00Z",
    };
    const supabase = tableSupabaseMock({
      userRoleRow: { role: "platform_admin" },
      listData: [flagRow],
    });

    const res = await handler(
      new Request("https://example.com/feature-flags", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: JSON.stringify({ action: "list" }),
      }),
      loggerMock(),
      supabase as any,
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.flags).toEqual([flagRow]);
  });

  it("POST upsert against an unknown key returns 404", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "admin-1" }, error: null });
    const supabase = tableSupabaseMock({
      userRoleRow: { role: "platform_admin" },
      updateData: null,
      updateError: null,
    });

    const res = await handler(
      new Request("https://example.com/feature-flags", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: JSON.stringify({ action: "upsert", key: "nope", name: "Nope", enabled: true }),
      }),
      loggerMock(),
      supabase as any,
    );

    expect(res.status).toBe(404);
  });

  it("POST with an unrecognized action returns 400", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "admin-1" }, error: null });
    const supabase = tableSupabaseMock({ userRoleRow: { role: "platform_admin" } });

    const res = await handler(
      new Request("https://example.com/feature-flags", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: JSON.stringify({ action: "delete_everything" }),
      }),
      loggerMock(),
      supabase as any,
    );

    expect(res.status).toBe(400);
  });

  it("OPTIONS returns CORS headers with no auth check", async () => {
    const handler = capturedHandler as EdgeHandler;

    const res = await handler(
      new Request("https://example.com/feature-flags", { method: "OPTIONS" }),
      loggerMock(),
      {} as any,
    );

    expect(res.status).toBeLessThan(400);
    expect(requireAuthMock).not.toHaveBeenCalled();
  });
});
