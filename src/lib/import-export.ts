import * as XLSX from 'xlsx';

export const parseFileRows = async (file: File): Promise<string[][]> => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    const text = await file.text();
    return text.split(/\r?\n/).map(l => l.split(',')).filter(r => r.some(v => v && v.trim().length));
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[];
    return (json || []).filter((r: any) => Array.isArray(r) && r.some((v: any) => v && String(v).trim().length)).map((r: any) => r.map((v: any) => String(v)));
  }
  throw new Error('Unsupported file type');
};

export const downloadErrorsCsv = (filename: string, headers: string[], rows: any[]) => {
  if (!rows?.length) return;
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportCsv = (filename: string, headers: string[], rows: any[]) => {
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportExcel = (filename: string, headers: string[], rows: any[]) => {
  const aoa = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, filename);
};

export const exportJsonTemplate = (filename: string, headers: string[]) => {
  const obj: Record<string, any> = {};
  headers.forEach(h => { obj[h] = ''; });
  const data = [obj];
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportJson = (filename: string, rows: any[]) => {
  const blob = new Blob([JSON.stringify(rows ?? [], null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};