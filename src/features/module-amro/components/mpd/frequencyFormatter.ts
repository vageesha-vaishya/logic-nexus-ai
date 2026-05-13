export type ThresholdFrequencyRecord = {
  interval_hours?: unknown;
  interval_cycles?: unknown;
  interval_months?: unknown;
  calendar_unit?: unknown;
  threshold_landings?: unknown;
  threshold_rins?: unknown;
  threshold_hobbs?: unknown;
};

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function formatValue(value: unknown): string {
  return String(value).trim();
}

export function formatThresholdFrequency(record: ThresholdFrequencyRecord): string {
  const parts: string[] = [];

  if (isPresent(record.interval_hours)) {
    parts.push(`${formatValue(record.interval_hours)} H`);
  }
  if (isPresent(record.interval_cycles)) {
    parts.push(`${formatValue(record.interval_cycles)} C`);
  }
  if (isPresent(record.interval_months)) {
    const calendarUnit = isPresent(record.calendar_unit) ? formatValue(record.calendar_unit) : '';
    parts.push(
      calendarUnit
        ? `${formatValue(record.interval_months)} ${calendarUnit}`
        : formatValue(record.interval_months),
    );
  }
  if (isPresent(record.threshold_landings)) {
    parts.push(`${formatValue(record.threshold_landings)} L`);
  }
  if (isPresent(record.threshold_rins)) {
    parts.push(`${formatValue(record.threshold_rins)} RI`);
  }
  if (isPresent(record.threshold_hobbs)) {
    parts.push(`${formatValue(record.threshold_hobbs)} HOB`);
  }

  return parts.join(', ');
}
