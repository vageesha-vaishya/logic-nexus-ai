
export function downloadCSV(data: unknown[], filename: string) {
  if (!data || !data.length) return;

  const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
    return Object.keys(obj).reduce((acc: Record<string, unknown>, k: string) => {
      const value = obj[k];
      const pre = prefix.length ? prefix + '.' : '';
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(acc, flattenObject(value as Record<string, unknown>, pre + k));
      } else {
        acc[pre + k] = value;
      }
      return acc;
    }, {});
  };

  const flatData = data.map(item => flattenObject(item as Record<string, unknown>));
  const headers = Array.from(new Set(flatData.flatMap(Object.keys)));

  const csvContent = [
    headers.join(','),
    ...flatData.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
