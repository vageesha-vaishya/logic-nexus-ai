import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

type CalendarUnit = "Dy" | "Mt" | "Yr";

interface ParsedFrequency {
  threshold_hours: string | null;
  threshold_cycles: number | null;
  threshold_calendar: number | null;
  calendar_unit: CalendarUnit | null;
  threshold_landings: number | null;
  threshold_rins: number | null;
  threshold_hobbs: number | null;
  is_frequency_parsed_success?: boolean;
}

const TOKEN_PATTERN = /(\d+(?::\d{1,2})?|\d+(?:\.\d+)?)\s*(Ho|RI|Dy|Mt|Yr|L|C|H)\b/gi;
const DEFAULT_BATCH_SIZE = 500;
const MAX_FAILURES_IN_RESPONSE = 200;

function toRoundedInt(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function toIntervalText(rawHours: string): string | null {
  const trimmed = rawHours.trim();
  if (!trimmed) return null;

  if (trimmed.includes(":")) {
    const [hPart, mPart] = trimmed.split(":", 2);
    const hours = Number(hPart);
    const mins = Number(mPart);
    if (!Number.isFinite(hours) || !Number.isFinite(mins) || mins < 0 || mins >= 60) {
      return null;
    }
    return `${Math.trunc(hours)}:${String(Math.trunc(mins)).padStart(2, "0")}:00`;
  }

  const decimalHours = Number(trimmed);
  if (!Number.isFinite(decimalHours)) return null;
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.abs(totalMinutes % 60);
  return `${hours}:${String(mins).padStart(2, "0")}:00`;
}

function normalizeCalendarUnit(unit: string): CalendarUnit | null {
  const value = unit.toLowerCase();
  if (value === "dy") return "Dy";
  if (value === "mt") return "Mt";
  if (value === "yr") return "Yr";
  return null;
}

function parseFrequency(raw: string): { parsed: ParsedFrequency; errors: string[] } {
  const parsed: ParsedFrequency = {
    threshold_hours: null,
    threshold_cycles: null,
    threshold_calendar: null,
    calendar_unit: null,
    threshold_landings: null,
    threshold_rins: null,
    threshold_hobbs: null,
  };
  const errors: string[] = [];

  for (const match of raw.matchAll(TOKEN_PATTERN)) {
    const value = match[1];
    const unit = match[2];
    if (!value || !unit) continue;

    switch (unit.toLowerCase()) {
      case "h": {
        const intervalText = toIntervalText(value);
        if (!intervalText) {
          errors.push(`Invalid H value: ${value}`);
        } else {
          parsed.threshold_hours = intervalText;
        }
        break;
      }
      case "c": {
        const n = toRoundedInt(value);
        if (n === null) errors.push(`Invalid C value: ${value}`);
        else parsed.threshold_cycles = n;
        break;
      }
      case "l": {
        const n = toRoundedInt(value);
        if (n === null) errors.push(`Invalid L value: ${value}`);
        else parsed.threshold_landings = n;
        break;
      }
      case "ri": {
        const n = toRoundedInt(value);
        if (n === null) errors.push(`Invalid RI value: ${value}`);
        else parsed.threshold_rins = n;
        break;
      }
      case "ho": {
        const n = toRoundedInt(value);
        if (n === null) errors.push(`Invalid Ho value: ${value}`);
        else parsed.threshold_hobbs = n;
        break;
      }
      case "dy":
      case "mt":
      case "yr": {
        const n = toRoundedInt(value);
        const calendarUnit = normalizeCalendarUnit(unit);
        if (n === null || !calendarUnit) {
          errors.push(`Invalid ${unit} value: ${value}`);
        } else {
          parsed.threshold_calendar = n;
          parsed.calendar_unit = calendarUnit;
        }
        break;
      }
      default:
        break;
    }
  }

  return { parsed, errors };
}

async function setParsedStatus(
  supabase: any,
  frequencySequence: number,
  isParsedSuccess: boolean,
): Promise<string | null> {
  try {
    const { error } = await supabase
      .schema("flypal")
      .from("flypal_configured_directives")
      .update({ is_frequency_parsed_success: isParsedSuccess })
      .eq("frequency_sequence", frequencySequence);
    return error ? error.message : null;
  } catch (err: unknown) {
    return err instanceof Error ? err.message : String(err);
  }
}

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
    const batchSize = Number.isFinite(batchSizeRaw) && batchSizeRaw > 0
      ? Math.min(Math.floor(batchSizeRaw), 5000)
      : DEFAULT_BATCH_SIZE;

    let totalRows = 0;
    let parsedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const failures: Array<{ frequency_sequence: number; reason: string }> = [];
    let offset = 0;

    while (true) {
      const { data: rows, error } = await supabase
        .schema("flypal")
        .from("flypal_configured_directives")
        .select("*")
        .order("frequency_sequence", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!rows || rows.length === 0) break;

      totalRows += rows.length;

      for (const row of rows) {
        const sequence = Number(row.frequency_sequence);
        try {
          if (row.is_frequency_parsed_success === true) {
            skippedCount += 1;
            continue;
          }

          const sourceText = String((row as Record<string, unknown>).frequency ?? (row as Record<string, unknown>).frequecny ?? "").trim();
          if (!sourceText) {
            const markError = await setParsedStatus(supabase, sequence, false);
            if (markError) {
              failedCount += 1;
              if (failures.length < MAX_FAILURES_IN_RESPONSE) {
                failures.push({ frequency_sequence: sequence, reason: `Failed to mark parse status: ${markError}` });
              }
            } else {
              skippedCount += 1;
            }
            continue;
          }

          const { parsed, errors } = parseFrequency(sourceText);
          if (errors.length > 0) {
            const markError = await setParsedStatus(supabase, sequence, false);
            failedCount += 1;
            const reason = markError ? `${errors.join("; ")} | status update failed: ${markError}` : errors.join("; ");
            if (failures.length < MAX_FAILURES_IN_RESPONSE) {
              failures.push({
                frequency_sequence: sequence,
                reason,
              });
            }
            continue;
          }

          const { error: updateError } = await supabase
            .schema("flypal")
            .from("flypal_configured_directives")
            .update({ ...parsed, is_frequency_parsed_success: true })
            .eq("frequency_sequence", sequence);

          if (updateError) {
            const markError = await setParsedStatus(supabase, sequence, false);
            failedCount += 1;
            const reason = markError
              ? `${updateError.message} | status update failed: ${markError}`
              : updateError.message;
            if (failures.length < MAX_FAILURES_IN_RESPONSE) {
              failures.push({
                frequency_sequence: sequence,
                reason,
              });
            }
            continue;
          }

          parsedCount += 1;
        } catch (rowErr: unknown) {
          const rowMessage = rowErr instanceof Error ? rowErr.message : String(rowErr);
          await setParsedStatus(supabase, sequence, false);
          failedCount += 1;
          if (failures.length < MAX_FAILURES_IN_RESPONSE) {
            failures.push({
              frequency_sequence: sequence,
              reason: rowMessage,
            });
          }
          continue;
        }
      }

      offset += rows.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_rows: totalRows,
        parsed_rows: parsedCount,
        skipped_rows: skippedCount,
        failed_rows: failedCount,
        failures,
        failures_truncated: failedCount > failures.length,
        batch_size: batchSize,
      }),
      {
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.error("Failed to parse flypal.flypal_configured_directives.frequency", { error: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}, "flypal_configured_directives_parse_frequency");
