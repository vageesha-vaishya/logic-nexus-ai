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
}

const TOKEN_PATTERN = /(\d+(?::\d{1,2})?|\d+(?:\.\d+)?)\s*(Ho|RI|Dy|Mt|Yr|L|C|H)\b/gi;

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
    const { data, error } = await supabase
      .from("directive_frequency_temp")
      .select("*")
      .order("frequency_sequence", { ascending: true });

    if (error) throw error;

    const rows = data || [];
    let parsedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const failures: Array<{ frequency_sequence: number; reason: string }> = [];

    for (const row of rows) {
      const sequence = Number(row.frequency_sequence);
      const sourceText = String((row as Record<string, unknown>).frequency ?? (row as Record<string, unknown>).frequecny ?? "").trim();

      if (!sourceText) {
        skippedCount += 1;
        continue;
      }

      const { parsed, errors } = parseFrequency(sourceText);
      if (errors.length > 0) {
        failedCount += 1;
        failures.push({
          frequency_sequence: sequence,
          reason: errors.join("; "),
        });
        continue;
      }

      const { error: updateError } = await supabase
        .from("directive_frequency_temp")
        .update(parsed)
        .eq("frequency_sequence", sequence);

      if (updateError) {
        failedCount += 1;
        failures.push({
          frequency_sequence: sequence,
          reason: updateError.message,
        });
        continue;
      }

      parsedCount += 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_rows: rows.length,
        parsed_rows: parsedCount,
        skipped_rows: skippedCount,
        failed_rows: failedCount,
        failures,
      }),
      {
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.error("Failed to parse directive_frequency_temp.frequency", { error: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}, "parse-directive-frequency-temp");
