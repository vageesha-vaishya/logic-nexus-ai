import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const lldPathCandidates = [
  path.resolve(repoRoot, 'docs/AMRO_LOW_LEVEL_DESIGN.md'),
  path.resolve(repoRoot, 'docs/AMRO/AMRO_LOW_LEVEL_DESIGN.md')
];
const lldPath = lldPathCandidates.find((candidate) => fs.existsSync(candidate));
const migrations = [
  path.resolve(repoRoot, 'supabase/migrations/20260319143000_create_amro_schema.sql'),
  path.resolve(repoRoot, 'supabase/migrations/20260319143100_create_amro_audit_schema.sql'),
  path.resolve(repoRoot, 'supabase/migrations/20260322150000_amro_expanded_schema_controls.sql'),
  path.resolve(repoRoot, 'supabase/migrations/20260324170000_amro_master_data_entity_structure_repairs.sql')
];
const reportDir = path.resolve(repoRoot, 'artifacts/mro/analysis');
const reportPath = path.resolve(reportDir, 'amro-db-docs-compliance-report.json');
const strictMode = process.argv.includes('--strict') && !process.argv.includes('--report-only');

const normalizeToken = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/\(\s*/g, '(')
    .replace(/\s*\)/g, ')');

const normalizeType = (value) =>
  normalizeToken(value)
    .replace(/\bpublic\./g, '')
    .replace(/\bwithout time zone\b/g, '')
    .replace(/\bwith time zone\b/g, 'tz')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeDefault = (value) =>
  normalizeToken(value)
    .replace(/::[\w\.]+/g, '')
    .replace(/^null$/g, '—');

const parseActualTables = (sqlText) => {
  const tables = new Map();
  const tableRegex = /CREATE TABLE IF NOT EXISTS\s+([\w\.]+)\s*\(([\s\S]*?)\);/g;
  const alterAddColumnRegex = /ALTER TABLE\s+([\w\.]+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)\s+([^;]+);/g;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(sqlText))) {
    const tableName = tableMatch[1];
    const body = tableMatch[2];
    const columns = new Map();

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('--')) {
        continue;
      }
      if (/^(PRIMARY|CONSTRAINT|UNIQUE|CHECK|FOREIGN)\b/i.test(line)) {
        continue;
      }
      if (!/^[a-zA-Z_]\w*\s+/.test(line)) {
        continue;
      }
      const cleanedLine = line.replace(/\s+--.*$/, '').replace(/,\s*$/, '');
      const [columnName, ...specParts] = cleanedLine.split(/\s+/);
      const spec = specParts.join(' ');
      const keywordIndex = spec.search(/\s(?:not null|null|default|references|check|unique|primary key)\b/i);
      const dataType = keywordIndex === -1 ? spec : spec.slice(0, keywordIndex);
      const defaultMatch = spec.match(/\bDEFAULT\s+(.+?)(?=\s(?:REFERENCES|CHECK|UNIQUE|PRIMARY KEY)\b|$)/i);
      const isPrimaryKey = /\bPRIMARY KEY\b/i.test(spec);

      columns.set(columnName, {
        type: normalizeType(dataType.replace(/,\s*$/, '')),
        nullable: !/\bNOT NULL\b/i.test(spec) && !isPrimaryKey,
        defaultValue: normalizeDefault(defaultMatch ? defaultMatch[1] : '—')
      });
    }

    tables.set(tableName, { columns });
  }

  let alterMatch;
  while ((alterMatch = alterAddColumnRegex.exec(sqlText))) {
    const tableName = alterMatch[1];
    const columnName = alterMatch[2];
    const spec = alterMatch[3].trim();
    const table = tables.get(tableName);
    if (!table) {
      continue;
    }
    const keywordIndex = spec.search(/\s(?:not null|null|default|references|check|unique|primary key)\b/i);
    const dataType = keywordIndex === -1 ? spec : spec.slice(0, keywordIndex);
    const defaultMatch = spec.match(/\bDEFAULT\s+(.+?)(?=\s(?:REFERENCES|CHECK|UNIQUE|PRIMARY KEY)\b|$)/i);
    const isPrimaryKey = /\bPRIMARY KEY\b/i.test(spec);

    table.columns.set(columnName, {
      type: normalizeType(dataType.replace(/,\s*$/, '')),
      nullable: !/\bNOT NULL\b/i.test(spec) && !isPrimaryKey,
      defaultValue: normalizeDefault(defaultMatch ? defaultMatch[1] : '—')
    });
  }

  return tables;
};

const parseDocumentedTables = (lldText) => {
  const tables = new Map();
  const headerRegex = /####\s+28\.2\.\d+\s+`([^`]+)`([\s\S]*?)(?=\n####\s+28\.2\.\d+\s+`|\n###\s+28\.3|\n##\s+29\.)/g;
  let sectionMatch;

  while ((sectionMatch = headerRegex.exec(lldText))) {
    const tableName = sectionMatch[1];
    const sectionBody = sectionMatch[2];
    const columnRegex = /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(Yes|No)\s*\|\s*`?([^|`]+?)`?\s*\|/gm;
    const columns = new Map();
    let columnMatch;

    while ((columnMatch = columnRegex.exec(sectionBody))) {
      const [, columnName, typeValue, nullableValue, defaultValue] = columnMatch;
      columns.set(columnName, {
        type: normalizeType(typeValue),
        nullable: nullableValue === 'Yes',
        defaultValue: normalizeDefault(defaultValue || '—')
      });
    }

    const requiredMarkers = [
      '- Purpose:',
      '- Primary key:',
      '- Security considerations:',
      '- Indexes:'
    ];
    const missingMarkers = requiredMarkers.filter((marker) => !sectionBody.includes(marker));

    tables.set(tableName, {
      columns,
      missingMarkers
    });
  }

  return tables;
};

const sqlText = migrations.map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');
if (!lldPath) {
  throw new Error(
    `AMRO LLD file not found. Checked: ${lldPathCandidates.join(', ')}`
  );
}

const lldText = fs.readFileSync(lldPath, 'utf8');
const actualTables = parseActualTables(sqlText);
const documentedTables = parseDocumentedTables(lldText);
const issues = [];

for (const tableName of actualTables.keys()) {
  if (!documentedTables.has(tableName)) {
    issues.push(`Missing table documentation for ${tableName}`);
  }
}

for (const tableName of documentedTables.keys()) {
  if (!actualTables.has(tableName)) {
    issues.push(`Table documented but not present in AMRO schema migrations: ${tableName}`);
  }
}

for (const [tableName, actual] of actualTables.entries()) {
  const documented = documentedTables.get(tableName);
  if (!documented) {
    continue;
  }

  if (documented.missingMarkers.length > 0) {
    issues.push(`Missing required documentation blocks for ${tableName}: ${documented.missingMarkers.join(', ')}`);
  }

  for (const [columnName, actualColumn] of actual.columns.entries()) {
    const documentedColumn = documented.columns.get(columnName);
    if (!documentedColumn) {
      issues.push(`Missing column documentation for ${tableName}.${columnName}`);
      continue;
    }

    if (actualColumn.type !== documentedColumn.type) {
      issues.push(
        `Column type mismatch ${tableName}.${columnName}: schema=${actualColumn.type} docs=${documentedColumn.type}`
      );
    }

    if (actualColumn.nullable !== documentedColumn.nullable) {
      issues.push(
        `Column nullability mismatch ${tableName}.${columnName}: schema=${actualColumn.nullable} docs=${documentedColumn.nullable}`
      );
    }

    if (actualColumn.defaultValue !== documentedColumn.defaultValue) {
      issues.push(
        `Column default mismatch ${tableName}.${columnName}: schema=${actualColumn.defaultValue} docs=${documentedColumn.defaultValue}`
      );
    }
  }

  for (const columnName of documented.columns.keys()) {
    if (!actual.columns.has(columnName)) {
      issues.push(`Column documented but not present in schema: ${tableName}.${columnName}`);
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  strictMode,
  compliant: issues.length === 0,
  tableCount: actualTables.size,
  documentedTableCount: documentedTables.size,
  issues
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

if (report.compliant) {
  console.log(`AMRO database documentation compliance passed. Report: ${reportPath}`);
  process.exit(0);
}

console.error(`AMRO database documentation compliance failed with ${issues.length} issue(s).`);
for (const issue of issues) {
  console.error(`- ${issue}`);
}
console.error(`Report: ${reportPath}`);
process.exit(strictMode ? 1 : 0);
