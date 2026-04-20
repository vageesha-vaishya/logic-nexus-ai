const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toNumber(value: string): number {
  return Number.parseInt(value, 10);
}

export function isValidIsoDateString(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!ISO_DATE_PATTERN.test(trimmed)) return false;
  const [yearRaw, monthRaw, dayRaw] = trimmed.split('-');
  const year = toNumber(yearRaw);
  const month = toNumber(monthRaw);
  const day = toNumber(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() + 1 === month &&
    utcDate.getUTCDate() === day
  );
}

function toIsoEpoch(value: string): number | null {
  if (!isValidIsoDateString(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = toNumber(yearRaw);
  const month = toNumber(monthRaw);
  const day = toNumber(dayRaw);
  return Date.UTC(year, month - 1, day);
}

export function compareIsoDateStrings(left: string, right: string): number {
  const leftEpoch = toIsoEpoch(String(left || '').trim());
  const rightEpoch = toIsoEpoch(String(right || '').trim());
  if (leftEpoch === null || rightEpoch === null) return 0;
  return leftEpoch - rightEpoch;
}

export function formatDateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeIsoDateInput(value: string): string | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  return isValidIsoDateString(trimmed) ? trimmed : null;
}
