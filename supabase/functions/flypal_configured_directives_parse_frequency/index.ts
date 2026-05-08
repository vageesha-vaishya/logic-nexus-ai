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

interface ParsedEffectiveFrom {
  effective_from_2_actual_end_hours: string | null;
  effective_from_2_actual_end_date: string | null;
}

interface ParsedCurrent {
  current_2_aircraft_current_flight_hours: string | null;
  current_2_aircraft_current_landings: number | null;
  current_2_aircraft_current_reading_date: string | null;
}

const TOKEN_PATTERN = /(\d+(?::\d{1,2})?|\d+(?:\.\d+)?)\s*(Ho|RI|Dy|Mt|Yr|L|C|H)\b/gi;
const EFFECTIVE_FROM_HOURS_PATTERN = /^(\d+(?::\d{1,2})?|\d+(?:\.\d+)?)\s*H$/i;
const EFFECTIVE_FROM_DATE_PATTERN = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/;
const CURRENT_LANDINGS_PATTERN = /^(\d+(?:\.\d+)?)\s*L$/i;
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

function parseDdMmmYyyyToIso(value: string): string | null {
  const m = value.match(EFFECTIVE_FROM_DATE_PATTERN);
  if (!m) return null;

  const day = Number(m[1]);
  const monRaw = (m[2] ?? "").toLowerCase();
  const year = Number(m[3]);
  if (!Number.isFinite(day) || !Number.isFinite(year) || day < 1 || day > 31) return null;

  const monthMap: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };

  const month = monthMap[monRaw];
  if (!month) return null;

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseEffectiveFrom(raw: string): {
  hasInput: boolean;
  parsed: ParsedEffectiveFrom;
  errors: string[];
} {
  const normalized = raw.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return {
      hasInput: false,
      parsed: {
        effective_from_2_actual_end_hours: null,
        effective_from_2_actual_end_date: null,
      },
      errors: [],
    };
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed: ParsedEffectiveFrom = {
    effective_from_2_actual_end_hours: null,
    effective_from_2_actual_end_date: null,
  };
  const errors: string[] = [];

  for (const line of lines) {
    const hoursMatch = line.match(EFFECTIVE_FROM_HOURS_PATTERN);
    if (hoursMatch?.[1]) {
      const intervalText = toIntervalText(hoursMatch[1]);
      if (!intervalText) {
        errors.push(`Invalid effective_from hours value: ${hoursMatch[1]}`);
      } else {
        parsed.effective_from_2_actual_end_hours = intervalText;
      }
      continue;
    }

    const isoDate = parseDdMmmYyyyToIso(line);
    if (isoDate) {
      parsed.effective_from_2_actual_end_date = isoDate;
      continue;
    }

    errors.push(`Invalid effective_from value: ${line}`);
  }

  return {
    hasInput: true,
    parsed,
    errors,
  };
}

function parseCurrent(raw: string): {
  hasInput: boolean;
  parsed: ParsedCurrent;
  errors: string[];
} {
  const normalized = raw.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return {
      hasInput: false,
      parsed: {
        current_2_aircraft_current_flight_hours: null,
        current_2_aircraft_current_landings: null,
        current_2_aircraft_current_reading_date: null,
      },
      errors: [],
    };
  }

  const tokens = normalized
    .split(/[,\n]/)
    .map((token) => token.trim())
    .filter(Boolean);
  const parsed: ParsedCurrent = {
    current_2_aircraft_current_flight_hours: null,
    current_2_aircraft_current_landings: null,
    current_2_aircraft_current_reading_date: null,
  };
  const errors: string[] = [];

  for (const token of tokens) {
    const hoursMatch = token.match(EFFECTIVE_FROM_HOURS_PATTERN);
    if (hoursMatch?.[1]) {
      const intervalText = toIntervalText(hoursMatch[1]);
      if (!intervalText) {
        errors.push(`Invalid current hours value: ${hoursMatch[1]}`);
      } else {
        parsed.current_2_aircraft_current_flight_hours = intervalText;
      }
      continue;
    }

    const landingsMatch = token.match(CURRENT_LANDINGS_PATTERN);
    if (landingsMatch?.[1]) {
      const landings = toRoundedInt(landingsMatch[1]);
      if (landings === null) {
        errors.push(`Invalid current landings value: ${landingsMatch[1]}`);
      } else {
        parsed.current_2_aircraft_current_landings = landings;
      }
      continue;
    }

    const isoDate = parseDdMmmYyyyToIso(token);
    if (isoDate) {
      parsed.current_2_aircraft_current_reading_date = isoDate;
      continue;
    }

    errors.push(`Invalid current value: ${token}`);
  }

  return {
    hasInput: true,
    parsed,
    errors,
  };
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
          const effectiveFromRaw = String((row as Record<string, unknown>).effective_from ?? "").trim();
          const {
            hasInput: hasEffectiveFromInput,
            parsed: parsedEffectiveFrom,
            errors: effectiveFromErrors,
          } = parseEffectiveFrom(effectiveFromRaw);
          const hasEffectiveFromTargetData = Boolean(
            (row as Record<string, unknown>).effective_from_2_actual_end_hours ||
            (row as Record<string, unknown>).effective_from_2_actual_end_date,
          );
          const currentRaw = String((row as Record<string, unknown>).current ?? "").trim();
          const {
            hasInput: hasCurrentInput,
            parsed: parsedCurrent,
            errors: currentErrors,
          } = parseCurrent(currentRaw);
          const hasCurrentTargetData = Boolean(
            (row as Record<string, unknown>).current_2_aircraft_current_flight_hours ||
            (row as Record<string, unknown>).current_2_aircraft_current_landings ||
            (row as Record<string, unknown>).current_2_aircraft_current_reading_date,
          );

          if (row.is_frequency_parsed_success === true) {
            const shouldProcessEffectiveFrom = hasEffectiveFromInput && !hasEffectiveFromTargetData;
            const shouldProcessCurrent = hasCurrentInput && !hasCurrentTargetData;
            if (!shouldProcessEffectiveFrom && !shouldProcessCurrent) {
              skippedCount += 1;
              continue;
            }

            if (effectiveFromErrors.length > 0) {
              failedCount += 1;
              if (failures.length < MAX_FAILURES_IN_RESPONSE) {
                failures.push({
                  frequency_sequence: sequence,
                  reason: effectiveFromErrors.join("; "),
                });
              }
              continue;
            }
            if (currentErrors.length > 0) {
              failedCount += 1;
              if (failures.length < MAX_FAILURES_IN_RESPONSE) {
                failures.push({
                  frequency_sequence: sequence,
                  reason: currentErrors.join("; "),
                });
              }
              continue;
            }

            const { error: effectiveUpdateError } = await supabase
              .schema("flypal")
              .from("flypal_configured_directives")
              .update({
                ...(shouldProcessEffectiveFrom
                  ? {
                    effective_from_2_actual_end_hours: parsedEffectiveFrom.effective_from_2_actual_end_hours,
                    effective_from_2_actual_end_date: parsedEffectiveFrom.effective_from_2_actual_end_date,
                  }
                  : {}),
                ...(shouldProcessCurrent
                  ? {
                    current_2_aircraft_current_flight_hours: parsedCurrent.current_2_aircraft_current_flight_hours,
                    current_2_aircraft_current_landings: parsedCurrent.current_2_aircraft_current_landings,
                    current_2_aircraft_current_reading_date: parsedCurrent.current_2_aircraft_current_reading_date,
                  }
                  : {}),
              })
              .eq("frequency_sequence", sequence);

            if (effectiveUpdateError) {
              failedCount += 1;
              if (failures.length < MAX_FAILURES_IN_RESPONSE) {
                failures.push({
                  frequency_sequence: sequence,
                  reason: effectiveUpdateError.message,
                });
              }
              continue;
            }

            parsedCount += 1;
            continue;
          }

          if (effectiveFromErrors.length > 0) {
            const markError = await setParsedStatus(supabase, sequence, false);
            failedCount += 1;
            const reason = markError
              ? `${effectiveFromErrors.join("; ")} | status update failed: ${markError}`
              : effectiveFromErrors.join("; ");
            if (failures.length < MAX_FAILURES_IN_RESPONSE) {
              failures.push({
                frequency_sequence: sequence,
                reason,
              });
            }
            continue;
          }
          if (currentErrors.length > 0) {
            const markError = await setParsedStatus(supabase, sequence, false);
            failedCount += 1;
            const reason = markError
              ? `${currentErrors.join("; ")} | status update failed: ${markError}`
              : currentErrors.join("; ");
            if (failures.length < MAX_FAILURES_IN_RESPONSE) {
              failures.push({
                frequency_sequence: sequence,
                reason,
              });
            }
            continue;
          }

          if ((hasEffectiveFromInput && !hasEffectiveFromTargetData) || (hasCurrentInput && !hasCurrentTargetData)) {
            const { error: effectiveUpdateError } = await supabase
              .schema("flypal")
              .from("flypal_configured_directives")
              .update({
                ...(hasEffectiveFromInput && !hasEffectiveFromTargetData
                  ? {
                    effective_from_2_actual_end_hours: parsedEffectiveFrom.effective_from_2_actual_end_hours,
                    effective_from_2_actual_end_date: parsedEffectiveFrom.effective_from_2_actual_end_date,
                  }
                  : {}),
                ...(hasCurrentInput && !hasCurrentTargetData
                  ? {
                    current_2_aircraft_current_flight_hours: parsedCurrent.current_2_aircraft_current_flight_hours,
                    current_2_aircraft_current_landings: parsedCurrent.current_2_aircraft_current_landings,
                    current_2_aircraft_current_reading_date: parsedCurrent.current_2_aircraft_current_reading_date,
                  }
                  : {}),
              })
              .eq("frequency_sequence", sequence);
            if (effectiveUpdateError) {
              failedCount += 1;
              if (failures.length < MAX_FAILURES_IN_RESPONSE) {
                failures.push({
                  frequency_sequence: sequence,
                  reason: effectiveUpdateError.message,
                });
              }
              continue;
            }
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

          const updatePayload: Record<string, unknown> = {
            ...parsed,
            is_frequency_parsed_success: true,
          };
          if (hasEffectiveFromInput) {
            updatePayload.effective_from_2_actual_end_hours = parsedEffectiveFrom.effective_from_2_actual_end_hours;
            updatePayload.effective_from_2_actual_end_date = parsedEffectiveFrom.effective_from_2_actual_end_date;
          }
          if (hasCurrentInput) {
            updatePayload.current_2_aircraft_current_flight_hours = parsedCurrent.current_2_aircraft_current_flight_hours;
            updatePayload.current_2_aircraft_current_landings = parsedCurrent.current_2_aircraft_current_landings;
            updatePayload.current_2_aircraft_current_reading_date = parsedCurrent.current_2_aircraft_current_reading_date;
          }

          const { error: updateError } = await supabase
            .schema("flypal")
            .from("flypal_configured_directives")
            .update(updatePayload)
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
