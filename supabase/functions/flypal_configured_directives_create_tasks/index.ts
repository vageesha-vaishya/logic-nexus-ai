import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMN MAPPING: flypal.flypal_configured_directives → public.tasks
// ═══════════════════════════════════════════════════════════════════════════════
//
// Source (flypal_configured_directives)                  Target (public.tasks)        Notes
// ──────────────────────────────────────────────────     ────────────────────────     ───────────────────────────────────────────────────────────────
// tenant_id                                              tenant_id                    Direct
// franchise_id                                           franchise_id                 Direct
// directive_id                                           directive_id                 Direct FK → public.directives
// "TSK-" + registration + " " + directive_no             task_number                  e.g. "TSK-VT-ABC AMP-AD-001"
// directive_no + " — " + registration                    title                        Required NOT NULL
// notes                                                  notes                        Direct
// (fixed) "directives"                                   task_category                Always "directives"
// "AMA-" + ata_code + "-00-00"                           procedure_reference          e.g. "AMA-05-10-00-00"
// effective_from_2_actual_end_date                       actual_end_date              Cast date → timestamptz (midnight UTC)
// effective_from_2_actual_end_date − (man_hrs/8) − 1d   planned_start_date           estimated_man_hours from public.directives
// directives.estimated_man_hours                         estimated_duration_hours     Batch-fetched from public.directives
// aircraft lookup (tenant_id+franchise_id+registration   aircraft_id                  Resolved per-row; REQUIRED — fails if not found
//   +serial_number) → public.aircraft.id
// ata_codes lookup (tenant_id + ata_code)                ata_code_id                  Resolved per-row; REQUIRED — fails if not found
//   → public.ata_codes.id where ata_codes.code = ata_code
// null                                                   checklist                    Always null
// null                                                   work_order_id                Nullable — no work order at import time
// (fixed) "pending"                                      status                       Default
//
// PROCESSING FILTER:
//   directive_id IS NOT NULL
//   AND is_row_processed_success = TRUE                  ← directive id matched successfully (id_match step)
//   AND (is_task_created_success = FALSE OR IS NULL)     ← task not yet created or never attempted
//
// ON SUCCESS: is_task_created_success=true, created_task_id=<uuid>, processed_on=now(), task_created_failure_reason=null
// ON FAILURE: is_task_created_success=false, task_created_failure_reason=<message>, processed_on=now()
//             Processing continues to the next record regardless of per-row failure.
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_BATCH_SIZE = 200;
const MAX_FAILURES_IN_RESPONSE = 200;

// ─── Types ───────────────────────────────────────────────────────────────────

interface SourceRow {
  id: string;
  frequency_sequence: number;
  tenant_id: string | null;
  franchise_id: string | null;
  directive_id: string | null;
  directive_no: string | null;
  registration: string | null;
  serial_number: string | null;
  notes: string | null;
  ata_code: string | null;
  effective_from_2_actual_end_date: string | null;
}

interface DirectiveRow {
  id: string;
  estimated_man_hours: number | null;
}

interface AircraftRow {
  id: string;
}

interface AtaCodeRow {
  id: string;
}

// ─── Pure helper functions (independently testable) ───────────────────────────

export function buildTaskNumber(
  registration: string | null,
  directiveNo: string | null,
): string {
  const reg = String(registration || "").trim();
  const dn = String(directiveNo || "").trim();
  const parts = [reg, dn].filter(Boolean).join(" ");
  return parts ? `TSK-${parts}` : `TSK-UNKNOWN`;
}

export function buildTitle(
  directiveNo: string | null,
  registration: string | null,
  seq: number,
): string {
  const parts = [
    String(directiveNo || "").trim(),
    String(registration || "").trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : `Directive task (seq ${seq})`;
}

export function buildProcedureReference(ataCode: string | null): string | null {
  const ata = String(ataCode || "").trim();
  return ata ? `AMA-${ata}-00-00` : null;
}

export function calcPlannedStartDate(
  effectiveFromDate: string | null,
  estimatedManHours: number | null,
): string | null {
  if (!effectiveFromDate) return null;
  const d = new Date(effectiveFromDate);
  if (isNaN(d.getTime())) return null;
  // Days to subtract = ceil(man_hours / 8h per working day) + 1 buffer day
  const workingDays = estimatedManHours != null && estimatedManHours > 0
    ? estimatedManHours / 8
    : 0;
  const totalDaysBack = Math.ceil(workingDays) + 1;
  d.setUTCDate(d.getUTCDate() - totalDaysBack);
  return d.toISOString();
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Resolve aircraft.id from tenant_id + franchise_id + registration + serial_number.
 * Returns null if no match; throws if the DB query itself errors.
 */
export async function resolveAircraftId(
  supabase: any,
  tenantId: string,
  franchiseId: string | null,
  registration: string | null,
  serialNumber: string | null,
): Promise<string | null> {
  if (!registration && !serialNumber) return null;

  let query = supabase
    .from("aircraft")
    .select("id")
    .eq("tenant_id", tenantId);

  // franchise_id: match explicitly when present, otherwise allow any
  if (franchiseId) {
    query = query.eq("franchise_id", franchiseId);
  }
  if (registration) {
    query = query.eq("registration", registration.trim());
  }
  if (serialNumber) {
    query = query.eq("serial_number", serialNumber.trim());
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`aircraft lookup failed: ${error.message}`);
  return (data as AircraftRow | null)?.id ?? null;
}

/**
 * Resolve ata_codes.id from tenant_id + ata_code string.
 * Matches ata_codes.code = ata_code (case-insensitive trim).
 * Returns null if no match; throws if the DB query itself errors.
 */
export async function resolveAtaCodeId(
  supabase: any,
  tenantId: string,
  ataCode: string | null,
): Promise<string | null> {
  if (!ataCode) return null;

  const { data, error } = await supabase
    .from("ata_codes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("code", ataCode.trim())
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`ata_codes lookup failed: ${error.message}`);
  return (data as AtaCodeRow | null)?.id ?? null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

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

    const tenantFilter = requestUrl.searchParams.get("tenant_id")?.trim() || null;

    let totalRows = 0;
    let createdCount = 0;
    let failedCount = 0;
    const failures: Array<{ id: string; frequency_sequence: number; reason: string }> = [];
    let offset = 0;

    while (true) {
      // ── Fetch next batch ──────────────────────────────────────────────────
      let query = supabase
        .schema("flypal")
        .from("flypal_configured_directives")
        .select(
          "id,frequency_sequence,tenant_id,franchise_id,directive_id," +
          "directive_no,registration,serial_number,notes,ata_code," +
          "effective_from_2_actual_end_date",
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

      // ── Batch-fetch directive estimated_man_hours ─────────────────────────
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
          // ── Guard: required context fields ────────────────────────────────
          if (!rawRow.tenant_id) {
            throw new Error("tenant_id is null — cannot create task without tenant context");
          }
          if (!rawRow.directive_id) {
            throw new Error(
              "directive_id is null — run flypal_configured_directives_id_match first",
            );
          }

          // ── Resolve aircraft_id (REQUIRED) ────────────────────────────────
          const aircraftId = await resolveAircraftId(
            supabase,
            rawRow.tenant_id,
            rawRow.franchise_id,
            rawRow.registration,
            rawRow.serial_number,
          );
          if (!aircraftId) {
            throw new Error(
              `No matching aircraft found for tenant_id=${rawRow.tenant_id}, ` +
              `franchise_id=${rawRow.franchise_id ?? "null"}, ` +
              `registration=${rawRow.registration ?? "null"}, ` +
              `serial_number=${rawRow.serial_number ?? "null"}`,
            );
          }

          // ── Resolve ata_code_id (REQUIRED) ───────────────────────────────
          const ataCodeId = await resolveAtaCodeId(
            supabase,
            rawRow.tenant_id,
            rawRow.ata_code,
          );
          if (!ataCodeId) {
            throw new Error(
              `No matching ata_code found for tenant_id=${rawRow.tenant_id}, ` +
              `ata_code=${rawRow.ata_code ?? "null"}`,
            );
          }

          // ── Resolve directive data ────────────────────────────────────────
          const estimatedManHours = directiveMap.get(rawRow.directive_id) ?? null;

          // ── Dates ─────────────────────────────────────────────────────────
          const actualEndDate = rawRow.effective_from_2_actual_end_date
            ? new Date(rawRow.effective_from_2_actual_end_date).toISOString()
            : null;

          const plannedStartDate = calcPlannedStartDate(
            rawRow.effective_from_2_actual_end_date,
            estimatedManHours,
          );

          // ── Build task payload ────────────────────────────────────────────
          const taskPayload: Record<string, unknown> = {
            tenant_id: rawRow.tenant_id,
            franchise_id: rawRow.franchise_id ?? null,
            work_order_id: null,
            directive_id: rawRow.directive_id,
            aircraft_id: aircraftId,
            ata_code_id: ataCodeId,
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

          // ── Insert task ───────────────────────────────────────────────────
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

          // ── Mark source row as succeeded ──────────────────────────────────
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
            await logger.warn("Task created but source-row update failed", {
              rowId, seq, createdTaskId, error: updateError.message,
            });
          }

          createdCount += 1;
        } catch (rowErr: unknown) {
          // ── Per-row failure: write reason and continue ────────────────────
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
