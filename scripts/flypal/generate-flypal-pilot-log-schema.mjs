import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import Papa from 'papaparse';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const RESERVED_WORDS = new Set([
  'user',
  'order',
  'group',
  'default',
  'table',
  'select',
  'from',
  'where',
  'limit',
]);

const csvPath = process.argv[2] || path.resolve(
  process.cwd(),
  'tmp',
  'Rep1174308083 copy.csv',
);

if (!fs.existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`);
  process.exit(1);
}

const csvContent = fs.readFileSync(csvPath, 'utf8');
const parsed = Papa.parse(csvContent, { header: false, skipEmptyLines: true });

if (parsed.errors.length > 0) {
  console.error('CSV parse error(s):', parsed.errors);
  process.exit(1);
}

const rows = parsed.data;
if (!rows.length) {
  console.error('CSV has no rows.');
  process.exit(1);
}

const rawHeaders = rows[0].map((value) => String(value ?? '').trim());
const dataRows = rows.slice(1);

const toSnake = (input) => input
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .replace(/_{2,}/g, '_');

const sanitizeHeader = (header, index) => {
  const normalized = toSnake(header) || `column_${index + 1}`;
  if (RESERVED_WORDS.has(normalized)) return `${normalized}_col`;
  return normalized;
};

const isInteger = (value) => /^-?\d+$/.test(value);
const isDuration = (value) => /^\d{1,3}:\d{2}$/.test(value);
const isUtcDateTime = (value) => /^\d{2}-[A-Za-z]{3}-\d{4}\s\d{2}:\d{2}$/.test(value);

const inferType = (values) => {
  const meaningful = values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);

  if (!meaningful.length) return 'text';
  if (meaningful.every((value) => isInteger(value))) return 'integer';
  if (meaningful.every((value) => isDuration(value))) return 'interval';
  if (meaningful.every((value) => isUtcDateTime(value))) return 'timestamptz';
  return 'text';
};

const sanitizedHeaders = rawHeaders.map((header, index) => sanitizeHeader(header, index));
const duplicateCheck = new Set();
const uniqueHeaders = sanitizedHeaders.map((header) => {
  if (!duplicateCheck.has(header)) {
    duplicateCheck.add(header);
    return header;
  }
  let suffix = 2;
  while (duplicateCheck.has(`${header}_${suffix}`)) suffix += 1;
  const candidate = `${header}_${suffix}`;
  duplicateCheck.add(candidate);
  return candidate;
});

const inferred = uniqueHeaders.map((columnName, index) => {
  const values = dataRows.map((row) => row[index]);
  return {
    source: rawHeaders[index],
    column: columnName,
    type: inferType(values),
  };
});

const ddlHash = crypto
  .createHash('sha256')
  .update(JSON.stringify(inferred))
  .digest('hex')
  .slice(0, 16);

console.log(`CSV: ${csvPath}`);
console.log(`Rows (excluding header): ${dataRows.length}`);
console.log(`Schema signature: ${ddlHash}`);
console.log('\nColumn Mapping and Type Inference');
console.table(inferred);

console.log('\nSuggested column DDL:');
for (const item of inferred) {
  console.log(`  ${item.column} ${item.type}, -- from "${item.source}"`);
}
