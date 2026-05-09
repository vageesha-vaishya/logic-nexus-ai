import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMN MAPPING: flypal.flypal_configured_directives → public.tasks
// ═══════════════════════════════════════════════════════════════════════════════
//
// Source (flypal_configured_directives)       Target (public.tasks)            Notes
// ─────────────────────────────────────────── ───────────────────────────────  ──────────────────────────────────────────────
// tenant_id                                   tenant_id                        Direct
// franchise_id                                franchise_id                     Direct
// directive_id                                directive_id                     Direct FK → public.directives
// "TSK-" + registration + " " + directive_no  task_number                      e.g. "TSK-VT-ABC AMP-AD-001"
// directive_no + " — " + registration         title                            Required NOT NULL
// notes                                       notes                            Direct
// (fixed) "directives"                        task_category                    Always "directives"
// "AMA-" + ata_code + "-00-00"               procedure_reference               e.g. "AMA-05-10-00-00"
// effective_from_2_actual_end_date            actual_end_date                  Cast date → timestamptz (midnight UTC)
// effective_from_2_actual_end_date            planned_start_date               = actual_end_date − (estimated_man_hours/8) − 1 day
//   └─ estimated_man_hours from public.directives via directive_id FK
// directives.estimated_man_hours              estimated_duration_hours         Fetched from public.directives in batch
// null                                        checklist                        Always null
// null                                        work_order_id                    Nullable — no work order at import time
// (fixed) "pending"                           status                           Default
//
// PROCESSING FILTER:
//   directive_id IS NOT NULL
//   AND is_row_processed_success = TRUE                        ← directive id was matched successfully
//   AND (is_task_created_success = FALSE OR IS NULL)           ← task not yet created or never attempted
//
// ON SUCCESS: is_task_created_success = true, created_task_id = <uuid>, processed_on = now()
// ON FAILURE: is_task_created_success = false (unchanged), task_created_failure_reason = <message>
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_BATCH_SIZE = 200;
const MAX_FAILURES_IN_RESPONSE = 200;

interface SourceRow {
  id: string;
  frequency_sequence: number;
  tenant_id: string | null;
  franchise_id: string | null;
  directive_id: string | null;
  directive_no: string | null;
  registration: string | null;
  notes: string | null;
  ata_code: string | null;
  effective_from_2_actual_end_date: string | null;
}

interface DirectiveRow {
  id: string;
  estimated_man_hours: number | null;
}

function buildTaskNumber(registration: string | null, directiveNo: string | null): string {
  const reg = String(registration || "").trim();
  const dn = String(directiveNo || "").trim();
  const parts = [reg, dn].filter(Boolean).join(" ");
  return parts ? `TSK-${parts}` : `TSK-UNKNOWN`;
}

function buildTitle(directiveNo: string | null, registration: string | null, seq: number): string {
  const parts = [
    String(directiveNo || "").trim(),
    String(registration || "").trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : `Directive task (seq ${seq})`;
}

function buildProcedureReference(ataCode: string | null): string | null {
  const ata = String(ataCode || "").trim();
  return ata ? `AMA-${ata}-00-00` : null;
}

function calcPlannedStartDate(
  effectiveFromDate: string | null,
  estimatedManHours: number | null,
): string | null {
  if (!effectiveFromDate) return null;
  const d = new Date(effectiveFromDate);
  if (isNaN(d.getTime())) return null;
  // working days back = estimated_man_hours / 8h per day, plus 1 buffer day
  const workingDays = estimatedManHours != null && estimatedManHours > 0
    ? estimatedManHours / 8
    : 0;
  const totalDaysBack = Math.ceil(workingDays) + 1;
  d.setUTCDate(d.getUTCDate() - totalDaysBack);
  return d.toISOString();
}

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const access = await requireServiceRoleOrAdmin(req, supabase, logger);
  if (!access.authorized) {
    return new Response(
      JSON.stringify({ error: access.error || "Unauthorized" }),
      { status: access.status, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  try {
    const requestUrl = new URL(req.url);
    const batchSizeRaw = Number(
      requestUrl.searchParams.get("batch_size") || DEFAULT_BATCH_SIZE,
    );
    const batchSize = Number.isFinite(batchSizeRaw) && batchSizeRaw > 0
      ? Math.min(Math.floor(batchSizeRaw), 2000)
      : DEFAULT_BATCH_SIZE;

    // Optional: restrict to a single tenant
    const tenantFilter = requestUrl.searchParams.get("tenant_id")?.trim() || null;

    let totalRows = 0;
    let createdCount = 0;
    let failedCount = 0;
    const failures: Array<{ id: string; frequency_sequence: number; reason: string }> = [];
    let offset = 0;

    while (true) {
      // ── Fetch next batch ──────────────────────────────────────────────────
      // Eligible rows:
      //   • directive_id IS NOT NULL  (id match was done)
      //   • is_row_processed_success = TRUE  (id match succeeded)
      //   • is_task_created_success = FALSE  (task not yet created — default false)
      let query = supabase
        .schema("flypal")
        .from("flypal_configured_directives")
        .select(
          "id,frequency_sequence,tenant_id,franchise_id,directive_id," +
          "directive_no,registration,notes,ata_code,effective_from_2_actual_end_date",
        )
        .not("directive_id", "is", null)
        .eq("is_row_processed_success", true)
        .or("is_task_created_success.is.null,is_task_created_success.eq.false")
        .order("frequency_sequence", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (tenantFilter) {
        query = query.eq("tenant_id", tenantFilter);
      }

      const { data: rows, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      if (!rows || rows.length === 0) break;

      totalRows += rows.length;

      // ── Batch-fetch estimated_man_hours from public.directives ────────────
      const directiveIds = [
        ...new Set(
          (rows as unknown as SourceRow[])
            .map((r) => r.directive_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const directiveMap = new Map<string, number | null>();
      if (directiveIds.length > 0) {
        const { data: dirRows, error: dirErr } = await supabase
          .from("directives")
          .select("id,estimated_man_hours")
          .in("id", directiveIds);

        if (dirErr) {
          await logger.warn("Failed to batch-fetch directives", { error: dirErr.message });
        } else {
          for (const d of (dirRows ?? []) as DirectiveRow[]) {
            directiveMap.set(d.id, d.estimated_man_hours ?? null);
          }
        }
      }

      // ── Process each row — continue on both success and failure ───────────
      for (const rawRow of rows as unknown as SourceRow[]) {
        const rowId = String(rawRow.id || "");
        const seq = Number(rawRow.frequency_sequence);

        try {
          // ── Guard: required fields ─────────────────────────────────────
          if (!rawRow.tenant_id) {
            throw new Error("tenant_id is null — cannot create task without tenant context");
          }
          if (!rawRow.directive_id) {
            throw new Error(
              "directive_id is null — run flypal_configured_directives_id_match first",
            );
          }

          // ── Resolve directive data ─────────────────────────────────────
          const estimatedManHours = directiveMap.get(rawRow.directive_id) ?? null;

          // ── Dates ──────────────────────────────────────────────────────
          const actualEndDate = rawRow.effective_from_2_actual_end_date
            ? new Date(rawRow.effective_from_2_actual_end_date).toISOString()
            : null;

          const plannedStartDate = calcPlannedStartDate(
            rawRow.effective_from_2_actual_end_date,
            estimatedManHours,
          );

          // ── Task payload ───────────────────────────────────────────────
          const taskPayload: Record<string, unknown> = {
            tenant_id: rawRow.tenant_id,
            franchise_id: rawRow.franchise_id ?? null,
            work_order_id: null,
            directive_id: rawRow.directive_id,
            task_number: buildTaskNumber(rawRow.registration, rawRow.directive_no),
            title: buildTitle(rawRow.directive_no, rawRow.registration, seq),
            notes: String(rawRow.notes || "").trim() || null,
            task_category: "directives",
            procedure_reference: buildProcedureReference(rawRow.ata_code),
            actual_end_date: actualEndDate,
            planned_start_date: plannedStartDate,
            estimated_duration_hours: estimatedManHours,
            checklist: null,
            status: "pending",
            progress_percentage: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // ── Insert task ────────────────────────────────────────────────
          const { data: inserted, error: insertError } = await supabase
            .from("tasks")
            .insert(taskPayload)
            .select("id")
            .single();

          if (insertError) {
            throw new Error(`Task insert failed: ${insertError.message}`);
          }

          const createdTaskId = (inserted as { id: string } | null)?.id;
          if (!createdTaskId) {
            throw new Error("Task inserted but no id returned");
          }

          // ── Mark source row as succeeded ───────────────────────────────
          const { error: updateError } = await supabase
            .schema("flypal")
            .from("flypal_configured_directives")
            .update({
              created_task_id: createdTaskId,
              is_task_created_success: true,
              task_created_failure_reason: null,
              processed_on: new Date().toISOString(),
            })
            .eq("id", rowId);

          if (updateError) {
            // Task was created — log but don't count as failure
            await logger.warn("Task created but source-row update failed", {
              rowId,
              seq,
              createdTaskId,
              error: updateError.message,
            });
          }

          createdCount += 1;
        } catch (rowErr: unknown) {
          // ── Mark source row as failed — continue to next record ────────
          const reason = rowErr instanceof Error ? rowErr.message : String(rowErr);

          await supabase
            .schema("flypal")
            .from("flypal_configured_directives")
            .update({
              is_task_created_success: false,
              task_created_failure_reason: reason.slice(0, 1000),
              processed_on: new Date().toISOString(),
            })
            .eq("id", rowId);

          failedCount += 1;
          if (failures.length < MAX_FAILURES_IN_RESPONSE) {
            failures.push({ id: rowId, frequency_sequence: seq, reason });
          }
          // continue — next record is processed regardless
        }
      }

      offset += rows.length;
    }

    await logger.info("flypal_configured_directives_create_tasks completed", {
      total_eligible_rows: totalRows,
      created: createdCount,
      failed: failedCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_eligible_rows: totalRows,
        created_count: createdCount,
        failed_count: failedCount,
        failures,
        failures_truncated: failedCount > failures.length,
        batch_size: batchSize,
      }),
      { headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.error("flypal_configured_directives_create_tasks fatal error", {
      error: message,
    });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
}, "flypal_configured_directives_create_tasks");
