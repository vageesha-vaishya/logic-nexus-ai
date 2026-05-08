import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

// ─── Column Mapping Reference ────────────────────────────────────────────────
//
// flypal.flypal_configured_directives  →  public.tasks
// ─────────────────────────────────────────────────────────────────────────────
// tenant_id                            →  tenant_id          (direct)
// franchise_id                         →  franchise_id       (direct)
// directive_id                         →  directive_id       (direct FK)
// frequency_sequence                   →  sequence_order     (ordering)
// directive_no + frequency_sequence    →  task_number        (generated: "TASK-{directive_no}-{seq}")
// code_form_no_and_description         →  title              (primary; fallback: directive_no)
// notes                                →  notes              (direct)
// category_code                        →  task_category      (fallback: 'maintenance')
// reference_amp                        →  procedure_reference (AMP reference)
// last_done_on                         →  actual_end_date    (cast to timestamptz)
// effective_from_2_actual_end_hours    →  actual_end_hours   (interval)
// effective_from_2_actual_end_date     →  actual_start_date  (effective-from date → planned start)
// threshold_hours                      →  estimated_duration_hours (hours portion extracted)
// current_2_aircraft_current_flight_hours → (stored in notes_json / not mapped — see GAPS)
// ─────────────────────────────────────────────────────────────────────────────
// NOT MAPPED (gaps documented below):
//   assembly_models, aircraft_template_id, registration, serial_number
//   → tasks has no direct aircraft columns; linkage is via work_order_id → work_orders.aircraft_id
//   work_order_id  → set to NULL (work_order_id is nullable per migration 20260507150000)
//   threshold_cycles, threshold_calendar, threshold_landings, threshold_rins, threshold_hobbs
//   → no direct tasks columns; could be stored in checklist jsonb (see GAPS)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BATCH_SIZE = 200;
const MAX_FAILURES_IN_RESPONSE = 200;

interface SourceRow {
  id: string;
  frequency_sequence: number;
  tenant_id: string | null;
  franchise_id: string | null;
  directive_id: string | null;
  directive_no: string | null;
  code_form_no_and_description: string | null;
  notes: string | null;
  category_code: string | null;
  reference_amp: string | null;
  last_done_on: string | null;
  effective_from_2_actual_end_hours: string | null;
  effective_from_2_actual_end_date: string | null;
  threshold_hours: string | null;
  threshold_cycles: number | null;
  threshold_calendar: number | null;
  calendar_unit: string | null;
  threshold_landings: number | null;
  threshold_rins: number | null;
  threshold_hobbs: number | null;
  current_2_aircraft_current_flight_hours: string | null;
  current_2_aircraft_current_landings: number | null;
  current_2_aircraft_current_reading_date: string | null;
  ata_code: string | null;
  registration: string | null;
  serial_number: string | null;
  assembly_models: string | null;
  aircraft_template_id: string | null;
}

function buildTaskNumber(row: SourceRow): string {
  const dn = String(row.directive_no || "").trim().replace(/\s+/g, "-").toUpperCase();
  const seq = row.frequency_sequence;
  return dn ? `TASK-${dn}-${seq}` : `TASK-${seq}`;
}

function buildTitle(row: SourceRow): string {
  const desc = String(row.code_form_no_and_description || "").trim();
  if (desc) return desc.slice(0, 500);
  const dn = String(row.directive_no || "").trim();
  return dn ? `Directive ${dn}` : `Imported Directive (seq ${row.frequency_sequence})`;
}

function extractEstimatedHours(thresholdHours: string | null): number | null {
  // threshold_hours is a PostgreSQL interval string like "1500:00:00" or "00:30:00"
  if (!thresholdHours) return null;
  const trimmed = thresholdHours.trim();
  // HH:MM:SS format
  const match = trimmed.match(/^(-?)(\d+):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const mins = Number(match[3]);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  const total = sign * (hours + mins / 60);
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : null;
}

function buildChecklist(row: SourceRow): Record<string, unknown> {
  // Store unmapped threshold data in checklist so it isn't lost
  const checklist: Record<string, unknown> = {};
  if (row.threshold_cycles !== null) checklist.threshold_cycles = row.threshold_cycles;
  if (row.threshold_calendar !== null) {
    checklist.threshold_calendar = row.threshold_calendar;
    checklist.calendar_unit = row.calendar_unit;
  }
  if (row.threshold_landings !== null) checklist.threshold_landings = row.threshold_landings;
  if (row.threshold_rins !== null) checklist.threshold_rins = row.threshold_rins;
  if (row.threshold_hobbs !== null) checklist.threshold_hobbs = row.threshold_hobbs;
  if (row.current_2_aircraft_current_flight_hours !== null)
    checklist.current_flight_hours = row.current_2_aircraft_current_flight_hours;
  if (row.current_2_aircraft_current_landings !== null)
    checklist.current_landings = row.current_2_aircraft_current_landings;
  if (row.current_2_aircraft_current_reading_date !== null)
    checklist.current_reading_date = row.current_2_aircraft_current_reading_date;
  // Preserve aircraft identification for reference
  if (row.registration) checklist.registration = row.registration;
  if (row.serial_number) checklist.serial_number = row.serial_number;
  if (row.ata_code) checklist.ata_code = row.ata_code;
  if (row.assembly_models) checklist.assembly_models = row.assembly_models;
  if (row.aircraft_template_id) checklist.aircraft_template_id = row.aircraft_template_id;
  return checklist;
}

function mapRowToTask(
  row: SourceRow,
): Record<string, unknown> {
  const taskNumber = buildTaskNumber(row);
  const title = buildTitle(row);
  const taskCategory = String(row.category_code || "").trim() || "maintenance";
  const estimatedDurationHours = extractEstimatedHours(row.threshold_hours);
  const checklist = buildChecklist(row);

  return {
    // Identity
    tenant_id: row.tenant_id,
    franchise_id: row.franchise_id ?? null,
    work_order_id: null, // Intentionally null — see GAPS section

    // Identification
    task_number: taskNumber,
    title: title,
    description: String(row.notes || "").trim() || null,

    // Classification
    task_category: taskCategory,
    procedure_reference: String(row.reference_amp || "").trim() || null,
    sequence_order: row.frequency_sequence,

    // Directive linkage
    directive_id: row.directive_id,

    // Duration estimate derived from threshold_hours
    estimated_duration_hours: estimatedDurationHours,

    // Dates: last_done_on → actual_end_date (when was it last completed)
    actual_end_date: row.last_done_on ? new Date(row.last_done_on).toISOString() : null,
    // effective_from date → planned_start_date (when should it be active from)
    planned_start_date: row.effective_from_2_actual_end_date
      ? new Date(row.effective_from_2_actual_end_date).toISOString()
      : null,
    // effective_from hours → actual_end_hours
    actual_end_hours: row.effective_from_2_actual_end_hours ?? null,

    // Status
    status: "pending",
    progress_percentage: 0,

    // Unmapped threshold/current data preserved in checklist
    checklist: Object.keys(checklist).length > 0 ? checklist : "{}",

    // Audit
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
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

    // Optional tenant filter — if provided, only process rows for that tenant
    const tenantFilter = requestUrl.searchParams.get("tenant_id")?.trim() || null;

    let totalRows = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const failures: Array<{ id: string; frequency_sequence: number; reason: string }> = [];
    let offset = 0;

    while (true) {
      // ── Fetch next batch ──────────────────────────────────────────────────
      let query = supabase
        .schema("flypal")
        .from("flypal_configured_directives")
        .select([
          "id",
          "frequency_sequence",
          "tenant_id",
          "franchise_id",
          "directive_id",
          "directive_no",
          "code_form_no_and_description",
          "notes",
          "category_code",
          "reference_amp",
          "last_done_on",
          "effective_from_2_actual_end_hours",
          "effective_from_2_actual_end_date",
          "threshold_hours",
          "threshold_cycles",
          "threshold_calendar",
          "calendar_unit",
          "threshold_landings",
          "threshold_rins",
          "threshold_hobbs",
          "current_2_aircraft_current_flight_hours",
          "current_2_aircraft_current_landings",
          "current_2_aircraft_current_reading_date",
          "ata_code",
          "registration",
          "serial_number",
          "assembly_models",
          "aircraft_template_id",
        ].join(","))
        // Core filters: frequency parsed OK, directive matched, task not yet created
        .eq("is_frequency_parsed_success", true)
        .not("directive_id", "is", null)
        .is("created_task_id", null)
        .order("frequency_sequence", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (tenantFilter) {
        query = query.eq("tenant_id", tenantFilter);
      }

      const { data: rows, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      if (!rows || rows.length === 0) break;

      totalRows += rows.length;

      for (const rawRow of rows) {
        const row = rawRow as unknown as SourceRow;
        const rowId = String(row.id || "");
        const seq = Number(row.frequency_sequence);

        try {
          // ── Validate required fields ───────────────────────────────────
          if (!row.tenant_id) {
            throw new Error("tenant_id is null — cannot insert task without tenant context");
          }
          if (!row.directive_id) {
            // Defensive — filtered above, but guard anyway
            throw new Error("directive_id is null — run id_match step before create_tasks");
          }

          // ── Build task payload ─────────────────────────────────────────
          const taskPayload = mapRowToTask(row);

          // ── Insert task ────────────────────────────────────────────────
          const { data: insertedTask, error: insertError } = await supabase
            .from("tasks")
            .insert(taskPayload)
            .select("id")
            .single();

          if (insertError) {
            throw new Error(`Task insert failed: ${insertError.message}`);
          }

          const createdTaskId = insertedTask?.id as string;
          if (!createdTaskId) {
            throw new Error("Task inserted but no id returned");
          }

          // ── Update source row ──────────────────────────────────────────
          const { error: updateError } = await supabase
            .schema("flypal")
            .from("flypal_configured_directives")
            .update({
              created_task_id: createdTaskId,
              is_task_created_success: true,
              failure_reason: null,
              processed_on: new Date().toISOString(),
            })
            .eq("id", rowId);

          if (updateError) {
            // Task was created but we failed to mark it — log but don't fail the row
            await logger.warn(
              "Task created but source row update failed",
              { rowId, seq, createdTaskId, error: updateError.message },
            );
          }

          createdCount += 1;
        } catch (rowErr: unknown) {
          const reason = rowErr instanceof Error ? rowErr.message : String(rowErr);

          // Mark the source row as failed
          await supabase
            .schema("flypal")
            .from("flypal_configured_directives")
            .update({
              is_task_created_success: false,
              failure_reason: reason.slice(0, 1000),
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

    skippedCount = 0; // All eligible rows are attempted; no skip logic in this function

    await logger.info("flypal_configured_directives_create_tasks completed", {
      total_rows: totalRows,
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
    await logger.error("flypal_configured_directives_create_tasks failed", { error: message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
}, "flypal_configured_directives_create_tasks");
