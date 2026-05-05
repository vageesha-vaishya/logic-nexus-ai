// @ts-ignore Deno URL import is valid in Supabase Edge runtime.
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";
declare const Deno: any;

/**
 * FlyPal Directives Migration Function - v2
 *
 * Atomically migrates directive records from flypal.flypal_directives to public.directives
 * with comprehensive error handling, batch processing, and audit logging.
 */

type PgClient = {
  queryObject: <T = Record<string, unknown>>(
    sql: string,
    params: unknown[]
  ) => Promise<{ rows: T[] }>;
  release: () => void;
};

type FlypalDirective = {
  row_locator: string;
  data_sequence: number;
  code_form_no: string | null;
  ata_code: string | null;
  reference_amp: string | null;
  description: string | null;
  category_code: string | null;
  issue_date: string | null;
  directive_no: string | null;
  is_rii: boolean | null;
  show_in_c_of_a: boolean | null;
  estimated_man_hours: string | null;
  note: string | null;
  applicability: string | null;
};

type ProcessingResult = {
  record_id: string;
  failure_reason: string;
};

// Constants - aligned with requirements
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BATCH_SIZE = 100;
const RECORD_TIMEOUT_MS = 30_000;
const POOL_SIZE = 5;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;
const MAX_FAILURE_ITEMS = 500;
const MAX_FAILURE_REASON_CHARS = 1200;

/**
 * Helper: Format JSON response with CORS headers
 */
function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/**
 * Helper: Truncate error messages to column max length
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

/**
 * Helper: Check if error is a connectivity issue
 */
function isConnectivityError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes("connection") ||
    lower.includes("econn") ||
    lower.includes("network") ||
    lower.includes("broken pipe") ||
    lower.includes("connection reset")
  );
}

/**
 * Helper: Normalize date to YYYY-MM-DD
 */
function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * Helper: Normalize interval to HH:MM:SS
 */
function normalizeInterval(raw: string | null): string | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (/^\d{1,4}:\d{2}(:\d{2})?$/.test(v)) {
    return v.length === 5 ? `${v}:00` : v;
  }
  try {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const mins = Math.round(n * 60);
    const hh = Math.floor(mins / 60);
    const mm = Math.abs(mins % 60);
    return `${hh}:${String(mm).padStart(2, "0")}:00`;
  } catch {
    return null;
  }
}

/**
 * Helper: Enforce operation timeout
 */
async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([work, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Process a single directive record within transaction
 */
async function processRecord(args: {
  client: PgClient;
  tenantId: string;
  modelId: string;
  record: FlypalDirective;
  failureMaxLen: number;
  actorUserId: string | null;
  logger: any;
}): Promise<{ success: boolean; recordId: string; reason?: string }> {
  const recordId = String(args.record.data_sequence);

  try {
    // Begin transaction
    await args.client.queryObject("BEGIN", []);
    await args.client.queryObject("SET LOCAL statement_timeout = '30s'", []);
    await args.client.queryObject("SAVEPOINT record_unit", []);

    try {
      // Insert directive record
      const inserted = await args.client.queryObject<{ id: string }>(
        `
          INSERT INTO public.directives (
            tenant_id,
            assembly_models,
            code_form_no,
            ata_code,
            reference_amp,
            description,
            category_code,
            issue_date,
            directive_no,
            is_rii,
            show_in_c_of_a,
            estimated_man_hours,
            note,
            applicability
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id::text AS id
        `,
        [
          args.tenantId,
          args.modelId,
          args.record.code_form_no,
          args.record.ata_code,
          args.record.reference_amp,
          args.record.description,
          args.record.category_code,
          normalizeDate(args.record.issue_date),
          args.record.directive_no,
          args.record.is_rii,
          args.record.show_in_c_of_a,
          normalizeInterval(args.record.estimated_man_hours),
          args.record.note,
          args.record.applicability,
        ]
      );

      const directiveId = String(inserted.rows[0]?.id || "");
      if (!UUID_REGEX.test(directiveId)) {
        throw new Error(`Invalid inserted directive ID: ${directiveId}`);
      }

      // Update source record - success state
      await args.client.queryObject(
        `
          UPDATE flypal.flypal_directives
          SET
            is_success = true,
            processing_date = CURRENT_TIMESTAMP,
            public_directives_uuid = $2,
            failure_reasone = NULL
          WHERE ctid = $1::tid
        `,
        [args.record.row_locator, directiveId]
      );

      // Audit log - success
      await args.client.queryObject(
        `
          INSERT INTO public.audit_logs (
            user_id, action, resource_type, tenant_id, details, created_at
          )
          VALUES (
            CASE
              WHEN $1::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              THEN $1::uuid
              ELSE NULL
            END,
            $2,
            'flypal_directive',
            $3,
            $4::jsonb,
            now()
          )
        `,
        [
          args.actorUserId,
          "migrated",
          args.tenantId,
          JSON.stringify({
            record_sequence: recordId,
            directive_id: directiveId,
            model_id: args.modelId,
          }),
        ]
      );

      await args.client.queryObject("COMMIT", []);
      return { success: true, recordId };
    } catch (error: unknown) {
      // Rollback to savepoint
      await args.client.queryObject("ROLLBACK TO SAVEPOINT record_unit", []);

      const errorMsg = error instanceof Error
        ? `${error.message}\n${error.stack || ""}`
        : String(error);
      const reason = truncate(errorMsg, args.failureMaxLen);

      // Update source record - failure state
      await args.client.queryObject(
        `
          UPDATE flypal.flypal_directives
          SET
            is_success = false,
            failure_reasone = $2,
            processing_date = CURRENT_TIMESTAMP
          WHERE ctid = $1::tid
        `,
        [args.record.row_locator, reason]
      );

      // Audit log - failure
      await args.client.queryObject(
        `
          INSERT INTO public.audit_logs (
            user_id, action, resource_type, tenant_id, details, created_at
          )
          VALUES (
            CASE
              WHEN $1::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              THEN $1::uuid
              ELSE NULL
            END,
            $2,
            'flypal_directive',
            $3,
            $4::jsonb,
            now()
          )
        `,
        [
          args.actorUserId,
          "migration_failed",
          args.tenantId,
          JSON.stringify({
            record_sequence: recordId,
            error: reason,
            model_id: args.modelId,
          }),
        ]
      );

      await args.client.queryObject("COMMIT", []);
      return { success: false, recordId, reason };
    }
  } catch (fatal: unknown) {
    try {
      await args.client.queryObject("ROLLBACK", []);
    } catch {
      /* no-op */
    }
    throw fatal;
  }
}

/**
 * Main handler
 */
serveWithLogger(async (req, logger, supabaseAdmin) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed. Use POST." },
      405,
      corsHeaders
    );
  }

  // Authorization check
  let access;
  try {
    access = await requireServiceRoleOrAdmin(req, supabaseAdmin, logger);
  } catch (authError: unknown) {
    const errMsg = authError instanceof Error ? authError.message : String(authError);
    await logger.error("Auth check failed", { error: errMsg });
    return jsonResponse(
      { error: "Authentication failed" },
      500,
      corsHeaders
    );
  }

  if (!access || !access.authorized) {
    const errorMsg = access?.error || "Unauthorized";
    return jsonResponse(
      { error: errorMsg },
      access?.status || 401,
      corsHeaders
    );
  }

  const actorUserId = access.user?.id
    ? String(access.user.id).trim()
    : null;

  // Parse request body
  let body: { tenant_id?: string; model_name?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload." }, 400, corsHeaders);
  }

  const tenantId = String(body.tenant_id || "").trim();
  const modelName = String(body.model_name || "").trim();

  // Validate input parameters
  if (!UUID_REGEX.test(tenantId)) {
    return jsonResponse(
      { error: "tenant_id must be a valid UUID format." },
      400,
      corsHeaders
    );
  }
  if (!modelName) {
    return jsonResponse(
      { error: "model_name is required and must be non-empty." },
      400,
      corsHeaders
    );
  }

  await logger.debug("Request validated", {
    tenant_id: tenantId,
    model_name: modelName,
  });

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return jsonResponse(
      { error: "SUPABASE_DB_URL environment variable not configured." },
      500,
      corsHeaders
    );
  }

  let pool;
  let rootClient: PgClient | null = null;

  try {
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL not configured");
    }

    pool = new Pool(dbUrl, POOL_SIZE);
    rootClient = (await pool.connect()) as PgClient;

    if (!rootClient) {
      throw new Error("Failed to establish database connection");
    }

    // ==================== INPUT VALIDATION PHASE ====================

    // Check tenant exists
    const tenantCheck = await rootClient.queryObject<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM public.tenants WHERE id = $1) AS exists`,
      [tenantId]
    );

    if (!tenantCheck.rows[0]?.exists) {
      return jsonResponse(
        {
          error: `Tenant not found: ${tenantId}`,
        },
        400,
        corsHeaders
      );
    }

    // Retrieve model ID
    const modelQuery = await rootClient.queryObject<{ id: string }>(
      `
        SELECT id
        FROM public.assembly_models
        WHERE tenant_id = $1
          AND name = $2
        LIMIT 1
      `,
      [tenantId, modelName]
    );

    const modelId = modelQuery.rows[0]?.id;
    if (!modelId || !UUID_REGEX.test(modelId)) {
      return jsonResponse(
        {
          error: `Model not found: ${modelName} for tenant ${tenantId}`,
        },
        400,
        corsHeaders
      );
    }

    await logger.debug("Validation passed", {
      tenant_id: tenantId,
      model_id: modelId,
    });

    // RLS check (non-service-role users)
    if (!access.isServiceRole) {
      const roleCheck = await rootClient.queryObject<{ role: string }>(
        `
          SELECT role FROM public.user_roles
          WHERE user_id::text = $1
        `,
        [actorUserId]
      );

      const hasAccess = roleCheck.rows.some((r) => {
        const role = String(r.role || "").toLowerCase();
        return ["platform_admin", "super_admin", "admin"].includes(role);
      });

      if (!hasAccess) {
        return jsonResponse(
          { error: "Forbidden: insufficient permissions" },
          403,
          corsHeaders
        );
      }
    }

    // Get failure_reason column max length
    let failureMaxLen = MAX_FAILURE_REASON_CHARS;
    try {
      const colMeta = await rootClient.queryObject<{
        character_maximum_length: number | null;
      }>(
        `
          SELECT character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = 'flypal'
            AND table_name = 'flypal_directives'
            AND column_name = 'failure_reasone'
        `,
        []
      );

      if (
        colMeta &&
        colMeta.rows &&
        colMeta.rows[0]?.character_maximum_length
      ) {
        failureMaxLen = colMeta.rows[0].character_maximum_length;
      }
    } catch (colError: unknown) {
      await logger.warn("Could not determine failure_reason column length, using default", {
        error: colError instanceof Error ? colError.message : String(colError),
      });
    }

    // ==================== RECORD PROCESSING PHASE ====================

    let totalProcessed = 0;
    let successCount = 0;
    let failureCount = 0;
    const failures: ProcessingResult[] = [];

    let connectivityErrors = 0;
    let circuitBreakerOpenedAt: number | null = null;

    while (true) {
      // Check circuit breaker
      if (
        circuitBreakerOpenedAt &&
        Date.now() - circuitBreakerOpenedAt < CIRCUIT_BREAKER_COOLDOWN_MS
      ) {
        await logger.warn("Circuit breaker active, stopping batch loop", {
          tenant_id: tenantId,
        });
        break;
      }

      let batch: FlypalDirective[] = [];

      try {
        // Fetch batch of unprocessed records
        const batchQuery = await rootClient.queryObject<FlypalDirective>(
          `
            SELECT
              ctid::text AS row_locator,
              data_sequence,
              code_form_no,
              ata_code,
              reference_amp,
              description,
              category_code,
              issue_date,
              directive_no,
              is_rii,
              show_in_c_of_a,
              estimated_man_hours,
              note,
              applicability
            FROM flypal.flypal_directives
            WHERE is_wrong_data IS NULL
              AND COALESCE(is_success, false) = false
              AND processing_date IS NULL
              AND assembly_models_name = $1
            ORDER BY data_sequence ASC
            LIMIT $2
          `,
          [modelName, BATCH_SIZE]
        );

        batch = batchQuery.rows;
        connectivityErrors = 0;
        circuitBreakerOpenedAt = null;

        if (batch.length === 0) break;
      } catch (batchError: unknown) {
        const errMsg = batchError instanceof Error
          ? batchError.message
          : String(batchError);

        await logger.error("Batch query failed", {
          error: errMsg,
          model_name: modelName,
        });

        if (isConnectivityError(batchError)) {
          connectivityErrors++;
          if (connectivityErrors >= CIRCUIT_BREAKER_THRESHOLD) {
            circuitBreakerOpenedAt = Date.now();
            continue;
          }
          // Retry after brief delay
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        throw batchError;
      }

      // Process each record in batch
      for (const record of batch) {
        totalProcessed++;

        let recordClient: PgClient | null = null;
        try {
          recordClient = (await pool.connect()) as PgClient;

          if (!recordClient) {
            throw new Error("Failed to acquire database connection for record processing");
          }

          const result = await withTimeout(
            processRecord({
              client: recordClient,
              tenantId,
              modelId,
              record,
              failureMaxLen: failureMaxLen as number,
              actorUserId,
              logger,
            }),
            RECORD_TIMEOUT_MS,
            `Record ${record.data_sequence} timeout`
          );

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
            if (failures.length < MAX_FAILURE_ITEMS) {
              failures.push({
                record_id: result.recordId,
                failure_reason: result.reason || "Unknown error",
              });
            }
          }
        } catch (recordError: unknown) {
          failureCount++;
          const errorMsg = recordError instanceof Error
            ? recordError.message
            : String(recordError);

          if (failures.length < MAX_FAILURE_ITEMS) {
            failures.push({
              record_id: String(record.data_sequence),
              failure_reason: truncate(errorMsg, MAX_FAILURE_REASON_CHARS),
            });
          }

          await logger.error("Record processing error", {
            record_id: record.data_sequence,
            error: errorMsg,
          });
        } finally {
          if (recordClient) {
            try {
              recordClient.release();
            } catch {
              /* no-op */
            }
          }
        }
      }
    }

    // Return summary
    const status =
      failureCount === 0
        ? "completed"
        : successCount === 0
        ? "failed"
        : "partial";

    return jsonResponse(
      {
        status,
        processed_count: totalProcessed,
        success_count: successCount,
        failure_count: failureCount,
        failures,
      },
      200,
      corsHeaders
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error
      ? `${error.message}\n${error.stack || ""}`
      : String(error);

    await logger.error("Unhandled error in migrate-flypal-directives-v2", {
      error: errorMsg,
      tenant_id: tenantId,
      model_name: modelName,
    });

    return jsonResponse(
      {
        status: "failed",
        processed_count: 0,
        success_count: 0,
        failure_count: 0,
        failures: [],
        error: errorMsg,
      },
      500,
      corsHeaders
    );
  } finally {
    try {
      if (rootClient) {
        try {
          rootClient.release();
        } catch {
          /* no-op */
        }
      }
      if (pool) {
        try {
          await pool.end();
        } catch {
          /* no-op */
        }
      }
    } catch {
      /* no-op */
    }
  }
}, "migrate-flypal-directives-v2");
