import { beforeEach, describe, expect, it, vi } from "vitest";

type EdgeHandler = (
  req: Request,
  logger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
  supabaseAdmin: { rpc: ReturnType<typeof vi.fn> },
) => Promise<Response>;

let capturedHandler: EdgeHandler | null = null;
const requireServiceRoleOrAdminMock = vi.fn();

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
  requireServiceRoleOrAdmin: requireServiceRoleOrAdminMock,
}));

function loggerMock() {
  return {
    info: vi.fn(async () => undefined),
    error: vi.fn(async () => undefined),
  };
}

describe("generate-aircraft-tasks edge function", () => {
  beforeEach(async () => {
    capturedHandler = null;
    requireServiceRoleOrAdminMock.mockReset();
    vi.resetModules();
    await import("./index.ts");
  });

  it("returns 400 for invalid aircraft_id", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireServiceRoleOrAdminMock.mockResolvedValue({
      authorized: true,
      status: 200,
      error: null,
      user: { id: "user-1", email: "admin@example.com" },
      isServiceRole: false,
    });
    const supabaseAdmin = { rpc: vi.fn() };

    const res = await handler(
      new Request("https://example.com/generate-aircraft-tasks", {
        method: "POST",
        body: JSON.stringify({ aircraft_id: "bad-id" }),
      }),
      loggerMock(),
      supabaseAdmin,
    );

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it("returns success for pending aircraft with templates (assembly model A320)", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireServiceRoleOrAdminMock.mockResolvedValue({
      authorized: true,
      status: 200,
      error: null,
      user: { id: "user-1", email: "admin@example.com" },
      isServiceRole: false,
    });
    const supabaseAdmin = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          success: true,
          aircraft_id: "a1807454-4233-4c96-90af-d5f42f96df66",
          assembly_model_id: "a320-model-id",
          tasks_created: 3,
          tasks_skipped: 0,
          aircraft_status: "active",
        },
        error: null,
      }),
    };

    const res = await handler(
      new Request("https://example.com/generate-aircraft-tasks", {
        method: "POST",
        body: JSON.stringify({
          aircraft_id: "a1807454-4233-4c96-90af-d5f42f96df66",
        }),
      }),
      loggerMock(),
      supabaseAdmin,
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.output.tasks_created).toBe(3);
    expect(body.output.assembly_model_id).toBe("a320-model-id");
  });

  it("returns success with duplicate-prevention no-op (assembly model B737)", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireServiceRoleOrAdminMock.mockResolvedValue({
      authorized: true,
      status: 200,
      error: null,
      user: { id: "user-2", email: "admin@example.com" },
      isServiceRole: false,
    });
    const supabaseAdmin = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          success: true,
          aircraft_id: "b1807454-4233-4c96-90af-d5f42f96df66",
          assembly_model_id: "b737-model-id",
          tasks_created: 0,
          tasks_skipped: 12,
          aircraft_status: "active",
        },
        error: null,
      }),
    };

    const res = await handler(
      new Request("https://example.com/generate-aircraft-tasks", {
        method: "POST",
        body: JSON.stringify({
          aircraft_id: "b1807454-4233-4c96-90af-d5f42f96df66",
        }),
      }),
      loggerMock(),
      supabaseAdmin,
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.output.tasks_created).toBe(0);
    expect(body.output.tasks_skipped).toBe(12);
  });

  it("returns business error when templates are missing", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireServiceRoleOrAdminMock.mockResolvedValue({
      authorized: true,
      status: 200,
      error: null,
      user: { id: "user-3", email: "admin@example.com" },
      isServiceRole: false,
    });
    const supabaseAdmin = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          success: false,
          error_code: "MISSING_TEMPLATES",
          message: "No task templates found for the aircraft assembly model",
        },
        error: null,
      }),
    };

    const res = await handler(
      new Request("https://example.com/generate-aircraft-tasks", {
        method: "POST",
        body: JSON.stringify({
          aircraft_id: "c1807454-4233-4c96-90af-d5f42f96df66",
        }),
      }),
      loggerMock(),
      supabaseAdmin,
    );

    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error_code).toBe("MISSING_TEMPLATES");
  });

  it("returns 500 when rpc invocation fails", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireServiceRoleOrAdminMock.mockResolvedValue({
      authorized: true,
      status: 200,
      error: null,
      user: { id: "user-4", email: "admin@example.com" },
      isServiceRole: false,
    });
    const supabaseAdmin = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "connection reset" },
      }),
    };

    const res = await handler(
      new Request("https://example.com/generate-aircraft-tasks", {
        method: "POST",
        body: JSON.stringify({
          aircraft_id: "d1807454-4233-4c96-90af-d5f42f96df66",
        }),
      }),
      loggerMock(),
      supabaseAdmin,
    );

    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Failed to generate aircraft tasks");
  });
});
