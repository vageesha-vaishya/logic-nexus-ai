import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";

type JsonRecord = Record<string, unknown>;

const AIRCRAFT_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getErrorStatus(errorCode: string): number {
  if (errorCode === "INVALID_AIRCRAFT_ID") return 404;
  if (errorCode === "MISSING_ASSEMBLY_MODEL") return 422;
  if (errorCode === "MISSING_TEMPLATES") return 404;
  if (errorCode === "AIRCRAFT_NOT_PENDING") return 409;
  return 400;
}

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const corsHeaders = getCorsHeaders(req);
  const correlationId =
    req.headers.get("x-correlation-id") || crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed",
        correlation_id: correlationId,
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const access = await requireServiceRoleOrAdmin(req, supabaseAdmin, logger);
  if (!access.authorized) {
    return new Response(
      JSON.stringify({
        success: false,
        error: access.error || "Unauthorized",
        correlation_id: correlationId,
      }),
      {
        status: access.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let payload: JsonRecord = {};
  try {
    payload = (await req.json()) as JsonRecord;
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid JSON payload",
        correlation_id: correlationId,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const aircraftId = String(payload.aircraft_id || "").trim();
  if (!AIRCRAFT_ID_REGEX.test(aircraftId)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "aircraft_id must be a valid UUID",
        correlation_id: correlationId,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const requestedBy = access.isServiceRole
      ? null
      : (access.user?.id ?? null);
    const { data, error } = await supabaseAdmin.rpc(
      "generate_aircraft_tasks_from_templates",
      {
        p_aircraft_id: aircraftId,
        p_requested_by: requestedBy,
        p_correlation_id: correlationId,
      },
    );

    if (error) {
      await logger.error("RPC generate_aircraft_tasks_from_templates failed", {
        aircraft_id: aircraftId,
        correlation_id: correlationId,
        message: error.message,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to generate aircraft tasks",
          details: error.message,
          correlation_id: correlationId,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = (data || {}) as JsonRecord;
    if (!result.success) {
      const errorCode = String(result.error_code || "BUSINESS_RULE_FAILED");
      const status = getErrorStatus(errorCode);
      return new Response(
        JSON.stringify({
          success: false,
          error_code: errorCode,
          message: String(result.message || "Task generation failed"),
          details: result,
          correlation_id: correlationId,
        }),
        {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await logger.info("Aircraft task generation completed", {
      aircraft_id: aircraftId,
      tasks_created: result.tasks_created,
      tasks_skipped: result.tasks_skipped,
      assembly_model_id: result.assembly_model_id,
      correlation_id: correlationId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        output: result,
        correlation_id: correlationId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.error("Unhandled generate-aircraft-tasks failure", {
      aircraft_id: aircraftId,
      correlation_id: correlationId,
      message,
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unhandled exception while generating aircraft tasks",
        details: message,
        correlation_id: correlationId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}, "generate-aircraft-tasks");
