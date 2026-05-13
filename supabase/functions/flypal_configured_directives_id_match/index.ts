import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

const DEFAULT_BATCH_SIZE = 1000;
const MAX_BATCH_SIZE = 5000;
const DEFAULT_MAX_BATCHES = 20;
const MAX_FAILURES_IN_RESPONSE = 200;

type BatchResultRow = {
  row_id: string;
  is_success: boolean;
  failure_reason: string | null;
};

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const access = await requireServiceRoleOrAdmin(req, supabase, logger);
  if (!access.authorized) {
    return new Response(JSON.stringify({ error: access.error || "Unauthorized" }), {
      status: access.status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const requestUrl = new URL(req.url);
    const batchSizeRaw = Number(requestUrl.searchParams.get("batch_size") || DEFAULT_BATCH_SIZE);
    const maxBatchesRaw = Number(requestUrl.searchParams.get("max_batches") || DEFAULT_MAX_BATCHES);

    const batchSize = Number.isFinite(batchSizeRaw) && batchSizeRaw > 0
      ? Math.min(Math.floor(batchSizeRaw), MAX_BATCH_SIZE)
      : DEFAULT_BATCH_SIZE;

    const maxBatches = Number.isFinite(maxBatchesRaw) && maxBatchesRaw > 0
      ? Math.min(Math.floor(maxBatchesRaw), 200)
      : DEFAULT_MAX_BATCHES;

    let totalRowsProcessed = 0;
    let successfulMatches = 0;
    let failedMatches = 0;
    const failureDetails: Array<{ row_id: string; failure_reason: string }> = [];

    for (let i = 0; i < maxBatches; i += 1) {
      const { data, error } = await supabase.rpc("flypal_configured_directives_id_match_batch", {
        p_batch_size: batchSize,
      });

      if (error) {
        throw new Error(`Batch RPC failed: ${error.message}`);
      }

      const rows = (data ?? []) as BatchResultRow[];
      if (rows.length === 0) break;

      totalRowsProcessed += rows.length;

      for (const row of rows) {
        if (row.is_success) {
          successfulMatches += 1;
          continue;
        }

        failedMatches += 1;
        if (failureDetails.length < MAX_FAILURES_IN_RESPONSE) {
          failureDetails.push({
            row_id: row.row_id,
            failure_reason: row.failure_reason ?? "Unknown matching failure",
          });
        }
      }
    }

    return new Response(JSON.stringify({
      total_rows_processed: totalRowsProcessed,
      successful_matches: successfulMatches,
      failed_matches: failedMatches,
      failure_details: failureDetails,
      failure_details_truncated: failedMatches > failureDetails.length,
      batch_size: batchSize,
      max_batches: maxBatches,
    }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.error("flypal_configured_directives_id_match execution failed", { error: message });
    return new Response(JSON.stringify({
      error: message,
      total_rows_processed: 0,
      successful_matches: 0,
      failed_matches: 0,
      failure_details: [],
    }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}, "flypal_configured_directives_id_match");
