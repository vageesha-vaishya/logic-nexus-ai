const fs = require('fs');

const filePath =
  '/Users/vims/Downloads/Development Projects/Trae/SOS Logistics Pro/logic-nexus-ai/tmp/flypal/SID_ServiceInspectionDirectives/01_ScreenDump_Directive BELL 407_full.csv';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

function escapeCell(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function stringifyCsv(rows) {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\n');
}

const input = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCsv(input);

for (const r of rows) {
  while (r.length < 9) r.push('');
}

const counts = new Map();
for (const r of rows) {
  const key = JSON.stringify(r.slice(1, 9));
  counts.set(key, (counts.get(key) || 0) + 1);
}

let markedTotal = 0;
let newlyUpdated = 0;
let duplicateGroups = 0;
for (const value of counts.values()) {
  if (value > 1) duplicateGroups += 1;
}

for (const r of rows) {
  const key = JSON.stringify(r.slice(1, 9));
  if ((counts.get(key) || 0) > 1) {
    markedTotal += 1;
    if (r[0] !== 'D') newlyUpdated += 1;
    r[0] = 'D';
  }
}

fs.writeFileSync(filePath, stringifyCsv(rows), 'utf8');

console.log(`Total rows: ${rows.length}`);
console.log(`Rows marked as D: ${markedTotal}`);
console.log(`Rows newly updated to D: ${newlyUpdated}`);
console.log(`Duplicate groups (B..I): ${duplicateGroups}`);
