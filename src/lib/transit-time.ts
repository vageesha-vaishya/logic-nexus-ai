export function parseTransitTimeToHours(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().toLowerCase();
  if (!str) return null;

  let totalHours = 0;

  const dayMatch = str.match(/(\d+(?:\.\d+)?)\s*d/);
  const hourMatch = str.match(/(\d+(?:\.\d+)?)\s*h/);

  if (dayMatch || hourMatch) {
    if (dayMatch) {
      const days = parseFloat(dayMatch[1]);
      if (!isNaN(days) && days > 0) {
        totalHours += days * 24;
      }
    }

    if (hourMatch) {
      const hours = parseFloat(hourMatch[1]);
      if (!isNaN(hours) && hours > 0) {
        totalHours += hours;
      }
    }

    return totalHours > 0 ? Math.round(totalHours) : null;
  }

  const numberMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (!numberMatch) return null;

  const value = parseFloat(numberMatch[1]);
  if (isNaN(value) || value <= 0) return null;

  if (str.includes('day')) {
    return Math.round(value * 24);
  }

  if (str.includes('hour') || str.includes('hr') || str.includes('h')) {
    return Math.round(value);
  }

  return Math.round(value * 24);
}

export function parseTransitTimeToDays(val: string | number | null | undefined): number | null {
  const hours = parseTransitTimeToHours(val);
  if (hours === null) return null;
  const days = hours / 24;
  if (days <= 0) return null;
  return Math.max(1, Math.round(days));
}

