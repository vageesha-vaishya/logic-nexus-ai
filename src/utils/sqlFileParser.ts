// SQL File Parser for pg_dump files
// Parses .sql files into categorized statements for import

export interface ParsedSqlFile {
  statements: string[];
  schemaStatements: string[];
  tableStatements: string[];
  dataStatements: string[];
  constraintStatements: string[];
  indexStatements: string[];
  functionStatements: string[];
  triggerStatements: string[];
  policyStatements: string[];
  sequenceStatements: string[];
  otherStatements: string[];
  warnings: string[];
  metadata: SqlFileMetadata;
}

export interface SqlFileMetadata {
  estimatedRowCount: number;
  tableNames: string[];
  schemaNames: string[];
  hasDropStatements: boolean;
  hasTransactionWrapper: boolean;
  hasCopyStatements: boolean;
  pgDumpVersion?: string;
  sourceDatabase?: string;
  exportDate?: string;
  totalStatements: number;
  fileSizeBytes: number;
}

export interface SqlParseProgress {
  bytesProcessed: number;
  totalBytes: number;
  statementsFound: number;
  currentLine: number;
  totalLines: number;
}

type StatementCategory = 
  | 'schema' 
  | 'table' 
  | 'data' 
  | 'constraint' 
  | 'index' 
  | 'function' 
  | 'trigger' 
  | 'policy' 
  | 'sequence' 
  | 'other';

/**
 * Parse a pg_dump SQL file into categorized statements
 */
export async function parseSqlFile(
  file: File,
  onProgress?: (progress: SqlParseProgress) => void
): Promise<ParsedSqlFile> {
  const text = await file.text();
  return parseSqlText(text, file.size, onProgress);
}

/**
 * Parse SQL text content into categorized statements
 */
export function parseSqlText(
  content: string,
  fileSizeBytes: number = content.length,
  onProgress?: (progress: SqlParseProgress) => void
): ParsedSqlFile {
  const result: ParsedSqlFile = {
    statements: [],
    schemaStatements: [],
    tableStatements: [],
    dataStatements: [],
    constraintStatements: [],
    indexStatements: [],
    functionStatements: [],
    triggerStatements: [],
    policyStatements: [],
    sequenceStatements: [],
    otherStatements: [],
    warnings: [],
    metadata: {
      estimatedRowCount: 0,
      tableNames: [],
      schemaNames: [],
      hasDropStatements: false,
      hasTransactionWrapper: false,
      hasCopyStatements: false,
      totalStatements: 0,
      fileSizeBytes,
    },
  };

  const lines = content.split('\n');
  const totalLines = lines.length;
  let currentStatement = '';
  let inDollarQuote = false;
  let dollarQuoteTag = '';
  let inCopyData = false;
  let lineNumber = 0;
  let bytesProcessed = 0;

  // Track unique table and schema names
  const tableNames = new Set<string>();
  const schemaNames = new Set<string>();

  for (const line of lines) {
    lineNumber++;
    bytesProcessed += line.length + 1; // +1 for newline

    // Report progress every 1000 lines
    if (onProgress && lineNumber % 1000 === 0) {
      onProgress({
        bytesProcessed,
        totalBytes: fileSizeBytes,
        statementsFound: result.statements.length,
        currentLine: lineNumber,
        totalLines,
      });
    }

    // Handle COPY data block ending
    if (inCopyData) {
      if (line === '\\.') {
        currentStatement += line + '\n';
        const stmt = currentStatement.trim();
        result.statements.push(stmt);
        result.dataStatements.push(stmt);
        currentStatement = '';
        inCopyData = false;
        
        // Count rows in COPY block
        const copyLines = stmt.split('\n').length - 2; // Exclude COPY and \. lines
        result.metadata.estimatedRowCount += Math.max(0, copyLines);
      } else {
        currentStatement += line + '\n';
      }
      continue;
    }

    // Skip comments (but extract metadata)
    if (line.startsWith('--')) {
      extractMetadataFromComment(line, result.metadata);
      continue;
    }

    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    // Handle dollar-quoted strings (for functions)
    const dollarMatch = line.match(/\$([a-zA-Z_]*)\$/);
    if (dollarMatch && !inDollarQuote) {
      inDollarQuote = true;
      dollarQuoteTag = dollarMatch[0];
    } else if (inDollarQuote && line.includes(dollarQuoteTag)) {
      // Count occurrences - if even, we're out of the quote
      const count = (line.match(new RegExp(escapeRegex(dollarQuoteTag), 'g')) || []).length;
      if (count % 2 === 1) {
        inDollarQuote = !inDollarQuote;
      }
    }

    currentStatement += line + '\n';

    // Check if statement is complete
    if (!inDollarQuote && line.trim().endsWith(';')) {
      const stmt = currentStatement.trim();
      
      // Handle COPY statement start
      if (isCopyFromStdin(stmt)) {
        inCopyData = true;
        result.metadata.hasCopyStatements = true;
        continue;
      }

      // Categorize and add statement
      const category = categorizeStatement(stmt);
      result.statements.push(stmt);
      
      switch (category) {
        case 'schema':
          result.schemaStatements.push(stmt);
          extractSchemaName(stmt, schemaNames);
          break;
        case 'table':
          result.tableStatements.push(stmt);
          extractTableName(stmt, tableNames);
          break;
        case 'data':
          result.dataStatements.push(stmt);
          result.metadata.estimatedRowCount += countInsertRows(stmt);
          break;
        case 'constraint':
          result.constraintStatements.push(stmt);
          break;
        case 'index':
          result.indexStatements.push(stmt);
          break;
        case 'function':
          result.functionStatements.push(stmt);
          break;
        case 'trigger':
          result.triggerStatements.push(stmt);
          break;
        case 'policy':
          result.policyStatements.push(stmt);
          break;
        case 'sequence':
          result.sequenceStatements.push(stmt);
          break;
        default:
          result.otherStatements.push(stmt);
      }

      // Check for potentially dangerous statements
      checkForWarnings(stmt, result.warnings, result.metadata);
      
      currentStatement = '';
    }
  }

  // Handle any remaining statement
  if (currentStatement.trim()) {
    result.warnings.push(`Incomplete statement at end of file: ${currentStatement.substring(0, 100)}...`);
  }

  // Finalize metadata
  result.metadata.tableNames = Array.from(tableNames);
  result.metadata.schemaNames = Array.from(schemaNames);
  result.metadata.totalStatements = result.statements.length;

  // Final progress update
  if (onProgress) {
    onProgress({
      bytesProcessed: fileSizeBytes,
      totalBytes: fileSizeBytes,
      statementsFound: result.statements.length,
      currentLine: totalLines,
      totalLines,
    });
  }

  return result;
}

/**
 * Categorize a SQL statement
 */
function categorizeStatement(stmt: string): StatementCategory {
  const upper = stmt.toUpperCase();
  const firstWord = upper.split(/\s+/)[0];

  // Schema statements
  if (upper.includes('CREATE SCHEMA') || upper.includes('CREATE TYPE') || upper.includes('CREATE EXTENSION')) {
    return 'schema';
  }

  // Table statements
  if (upper.includes('CREATE TABLE') || upper.includes('CREATE UNLOGGED TABLE') || 
      upper.includes('CREATE TEMP TABLE') || upper.includes('CREATE TEMPORARY TABLE')) {
    return 'table';
  }

  // Sequence statements
  if (upper.includes('CREATE SEQUENCE') || upper.includes('ALTER SEQUENCE') ||
      (firstWord === 'SELECT' && upper.includes('SETVAL'))) {
    return 'sequence';
  }

  // Data statements
  if (firstWord === 'INSERT' || firstWord === 'COPY') {
    return 'data';
  }

  // Constraint statements
  if (upper.includes('ADD CONSTRAINT') || upper.includes('PRIMARY KEY') || 
      upper.includes('FOREIGN KEY') || upper.includes('UNIQUE')) {
    return 'constraint';
  }

  // Index statements
  if (upper.includes('CREATE INDEX') || upper.includes('CREATE UNIQUE INDEX')) {
    return 'index';
  }

  // Function statements
  if (upper.includes('CREATE FUNCTION') || upper.includes('CREATE OR REPLACE FUNCTION') ||
      upper.includes('CREATE PROCEDURE') || upper.includes('CREATE OR REPLACE PROCEDURE')) {
    return 'function';
  }

  // Trigger statements
  if (upper.includes('CREATE TRIGGER') || upper.includes('CREATE OR REPLACE TRIGGER')) {
    return 'trigger';
  }

  // Policy statements
  if (upper.includes('CREATE POLICY') || upper.includes('ALTER TABLE') && upper.includes('ROW LEVEL SECURITY')) {
    return 'policy';
  }

  return 'other';
}

/**
 * Check if a statement is COPY ... FROM stdin
 */
function isCopyFromStdin(stmt: string): boolean {
  const upper = stmt.toUpperCase();
  return upper.startsWith('COPY ') && upper.includes('FROM STDIN');
}

/**
 * Extract metadata from pg_dump comments
 */
function extractMetadataFromComment(line: string, metadata: SqlFileMetadata): void {
  if (line.includes('PostgreSQL database dump')) {
    const versionMatch = line.match(/PostgreSQL (\d+\.\d+)/);
    if (versionMatch) {
      metadata.pgDumpVersion = versionMatch[1];
    }
  }
  
  if (line.includes('Dumped from database version')) {
    const versionMatch = line.match(/version (\d+\.\d+)/);
    if (versionMatch) {
      metadata.sourceDatabase = `PostgreSQL ${versionMatch[1]}`;
    }
  }
  
  if (line.includes('Started on')) {
    const dateMatch = line.match(/Started on (.+)$/);
    if (dateMatch) {
      metadata.exportDate = dateMatch[1].trim();
    }
  }
}

/**
 * Extract table name from CREATE TABLE statement
 */
function extractTableName(stmt: string, tableNames: Set<string>): void {
  const match = stmt.match(/CREATE\s+(?:UNLOGGED\s+)?(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?/i);
  if (match) {
    const schema = match[1] || 'public';
    const table = match[2];
    tableNames.add(`${schema}.${table}`);
  }
}

/**
 * Extract schema name from CREATE SCHEMA statement
 */
function extractSchemaName(stmt: string, schemaNames: Set<string>): void {
  const match = stmt.match(/CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/i);
  if (match) {
    schemaNames.add(match[1]);
  }
}

/**
 * Count rows in an INSERT statement
 */
function countInsertRows(stmt: string): number {
  const upper = stmt.toUpperCase();
  if (!upper.startsWith('INSERT')) return 0;
  
  // Count VALUES clauses
  const valuesMatches = stmt.match(/\)\s*,\s*\(/g);
  return (valuesMatches?.length || 0) + 1;
}

/**
 * Check for potentially dangerous statements
 */
function checkForWarnings(stmt: string, warnings: string[], metadata: SqlFileMetadata): void {
  const upper = stmt.toUpperCase();
  
  if (upper.includes('DROP TABLE') || upper.includes('DROP SCHEMA') || upper.includes('DROP DATABASE')) {
    metadata.hasDropStatements = true;
    if (!warnings.includes('File contains DROP statements that will delete existing data')) {
      warnings.push('File contains DROP statements that will delete existing data');
    }
  }
  
  if (upper.startsWith('BEGIN') || upper.includes('START TRANSACTION')) {
    metadata.hasTransactionWrapper = true;
  }
  
  if (upper.includes('TRUNCATE')) {
    if (!warnings.includes('File contains TRUNCATE statements')) {
      warnings.push('File contains TRUNCATE statements');
    }
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get a preview of the SQL file (first N lines)
 */
export function getSqlPreview(content: string, maxLines: number = 50): string {
  const lines = content.split('\n').slice(0, maxLines);
  return lines.join('\n');
}

/**
 * Estimate processing time based on file size and statement count
 */
export function estimateProcessingTime(metadata: SqlFileMetadata): number {
  // Rough estimate: 10 statements per second, 1MB per 2 seconds
  const byStatements = (metadata.totalStatements / 10) * 1000;
  const bySize = (metadata.fileSizeBytes / (1024 * 1024)) * 2000;
  return Math.max(byStatements, bySize, 5000); // Minimum 5 seconds
}

/**
 * Validate SQL file before import
 */
export function validateSqlFile(parsed: ParsedSqlFile): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (parsed.statements.length === 0) {
    issues.push('No SQL statements found in file');
  }
  
  if (parsed.metadata.hasDropStatements) {
    issues.push('File contains DROP statements - existing data may be deleted');
  }
  
  if (parsed.warnings.length > 0) {
    issues.push(...parsed.warnings);
  }
  
  return {
    isValid: issues.length === 0 || !parsed.metadata.hasDropStatements,
    issues,
  };
}
