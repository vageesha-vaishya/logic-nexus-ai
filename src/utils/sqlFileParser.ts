// SQL File Parser for pg_dump files
// Parses .sql files into categorized statements for import
//
import { findDollarQuoteBlocks } from "./pgDumpExport";

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
  // Integrity fields
  isComplete: boolean;
  hasProperEnding: boolean;
  incompleteStatement?: string;
  truncatedTableName?: string;
  integrityIssues: FileIntegrityIssue[];
  repairSuggestions: RepairSuggestion[];
}

export interface FileIntegrityIssue {
  type: 'truncated_statement' | 'missing_terminator' | 'incomplete_copy' | 'unclosed_quote' | 'unclosed_parenthesis' | 'unexpected_eof' | 'missing_completion_marker';
  severity: 'error' | 'warning' | 'info';
  description: string;
  lineNumber?: number;
  context?: string;
  affectedTable?: string;
}

export interface RepairSuggestion {
  type: 'add_terminator' | 'remove_incomplete' | 'close_copy_block' | 'close_parenthesis' | 'close_quote' | 'regenerate_dump';
  description: string;
  automatable: boolean;
  repairFunction?: () => string;
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
      isComplete: true,
      hasProperEnding: false,
      integrityIssues: [],
      repairSuggestions: [],
    },
  };

  // Check for pg_dump completion markers
  const hasCompletionMarker = content.includes('PostgreSQL database dump complete') || 
                               content.includes('-- Completed on');
  result.metadata.hasProperEnding = hasCompletionMarker;
  
  if (!hasCompletionMarker) {
    result.metadata.integrityIssues.push({
      type: 'missing_completion_marker',
      severity: 'warning',
      description: 'File does not contain pg_dump completion marker. The dump may have been interrupted during creation.',
    });
    result.metadata.repairSuggestions.push({
      type: 'regenerate_dump',
      description: 'Regenerate the pg_dump file ensuring the process completes successfully. Use: pg_dump -Fp --no-owner dbname > dump.sql',
      automatable: false,
    });
  }

  const lines = content.split('\n');
  const totalLines = lines.length;
  let currentStatement = '';
  let inCopyData = false;
  let lineNumber = 0;
  let bytesProcessed = 0;
  let offset = 0;

  const dollarBlocks = findDollarQuoteBlocks(content);

  // Track unique table and schema names
  const tableNames = new Set<string>();
  const schemaNames = new Set<string>();

  for (const line of lines) {
    lineNumber++;
    bytesProcessed += line.length + 1; // +1 for newline
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset += line.length + 1;

    const activeDollarBlock = dollarBlocks.find(
      (b) =>
        lineEnd > b.startIndex &&
        lineStart >= b.startIndex &&
        (b.endIndex ?? fileSizeBytes) >= lineStart
    );
    const inDollarBlock = !!activeDollarBlock;

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

    currentStatement += line + '\n';

    // Check if statement is complete
    if (!inDollarBlock && line.trim().endsWith(';')) {
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

  // Handle any remaining statement (incomplete/truncated)
  if (currentStatement.trim()) {
    const trimmedStmt = currentStatement.trim();
    result.metadata.isComplete = false;
    result.metadata.incompleteStatement = trimmedStmt.substring(0, 500);
    
    // Detect what type of statement is incomplete
    const stmtUpper = trimmedStmt.toUpperCase();
    let affectedTable: string | undefined;
    
    // Try to extract table name from incomplete statement
    const tableMatch = trimmedStmt.match(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|COPY)\s+(?:"?(\w+)"?\.)?"?(\w+)"?/i);
    if (tableMatch) {
      affectedTable = tableMatch[2];
      result.metadata.truncatedTableName = `${tableMatch[1] || 'public'}.${tableMatch[2]}`;
    }
    
    // Create detailed integrity issue
    const integrityIssue: FileIntegrityIssue = {
      type: 'truncated_statement',
      severity: 'error',
      description: `Incomplete SQL statement at end of file`,
      lineNumber: lineNumber,
      context: trimmedStmt.substring(0, 200) + (trimmedStmt.length > 200 ? '...' : ''),
      affectedTable,
    };
    
    // Determine specific issue type and repair suggestions
    const unclosedBlock = dollarBlocks.find(b => !b.isComplete);
    if (unclosedBlock) {
      integrityIssue.type = 'unclosed_quote';
      integrityIssue.description = `Unclosed dollar-quoted string (${unclosedBlock.tag})`;
      result.metadata.repairSuggestions.push({
        type: 'close_quote',
        description: `Add closing ${unclosedBlock.tag} and semicolon to complete the statement`,
        automatable: true,
        repairFunction: () => trimmedStmt + `\n${unclosedBlock.tag};`,
      });
    } else if (inCopyData) {
      integrityIssue.type = 'incomplete_copy';
      integrityIssue.description = `COPY data block not properly terminated with \\.`;
      result.metadata.repairSuggestions.push({
        type: 'close_copy_block',
        description: 'Add \\. on a new line to terminate the COPY data block',
        automatable: true,
        repairFunction: () => trimmedStmt + '\n\\.',
      });
    } else if (countUnbalancedParentheses(trimmedStmt) > 0) {
      integrityIssue.type = 'unclosed_parenthesis';
      const unclosed = countUnbalancedParentheses(trimmedStmt);
      integrityIssue.description = `Statement has ${unclosed} unclosed parenthesis(es)`;
      result.metadata.repairSuggestions.push({
        type: 'close_parenthesis',
        description: `Add ${unclosed} closing parenthesis(es) and semicolon`,
        automatable: true,
        repairFunction: () => trimmedStmt + ')'.repeat(unclosed) + ';',
      });
    } else {
      integrityIssue.type = 'missing_terminator';
      integrityIssue.description = 'Statement missing semicolon terminator';
      result.metadata.repairSuggestions.push({
        type: 'add_terminator',
        description: 'Add semicolon to complete the statement (may result in invalid SQL)',
        automatable: true,
        repairFunction: () => trimmedStmt + ';',
      });
    }
    
    result.metadata.integrityIssues.push(integrityIssue);
    
    // Add option to skip the incomplete statement
    result.metadata.repairSuggestions.push({
      type: 'remove_incomplete',
      description: 'Skip the incomplete statement during import (some data may be lost)',
      automatable: true,
    });
    
    // Add user-friendly warning
    result.warnings.push(
      `Incomplete statement at end of file (line ${lineNumber}): ` +
      `${stmtUpper.split(/\s+/).slice(0, 3).join(' ')}... ` +
      (affectedTable ? `affecting table "${affectedTable}"` : '')
    );
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
 * Count unbalanced parentheses in a statement
 */
function countUnbalancedParentheses(stmt: string): number {
  let count = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < stmt.length; i++) {
    const char = stmt[i];
    const prevChar = i > 0 ? stmt[i - 1] : '';
    
    // Handle string literals
    if ((char === "'" || char === '"') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }
    
    if (!inString) {
      if (char === '(') count++;
      else if (char === ')') count--;
    }
  }
  
  return Math.max(0, count);
}

/**
 * Validate SQL file before import
 */
export function validateSqlFile(parsed: ParsedSqlFile): { isValid: boolean; issues: string[]; canProceed: boolean; requiresRepair: boolean } {
  const issues: string[] = [];
  let canProceed = true;
  let requiresRepair = false;
  
  if (parsed.statements.length === 0) {
    issues.push('No SQL statements found in file');
    canProceed = false;
  }
  
  if (parsed.metadata.hasDropStatements) {
    issues.push('File contains DROP statements - existing data may be deleted');
  }
  
  if (!parsed.metadata.isComplete) {
    issues.push(`File appears to be truncated or incomplete`);
    if (parsed.metadata.truncatedTableName) {
      issues.push(`Affected table: ${parsed.metadata.truncatedTableName}`);
    }
    requiresRepair = true;
  }
  
  if (!parsed.metadata.hasProperEnding) {
    issues.push('File missing pg_dump completion marker - dump may have been interrupted');
  }
  
  // Add integrity issues
  for (const issue of parsed.metadata.integrityIssues) {
    if (issue.severity === 'error') {
      issues.push(`ERROR: ${issue.description}`);
    } else if (issue.severity === 'warning') {
      issues.push(`WARNING: ${issue.description}`);
    }
  }
  
  if (parsed.warnings.length > 0) {
    issues.push(...parsed.warnings);
  }
  
  return {
    isValid: parsed.metadata.isComplete && !parsed.metadata.hasDropStatements,
    issues,
    canProceed,
    requiresRepair,
  };
}

/**
 * Attempt to repair an incomplete SQL file
 */
export function repairSqlFile(
  content: string, 
  parsed: ParsedSqlFile, 
  options: { 
    skipIncomplete?: boolean; 
    autoClose?: boolean;
  } = {}
): { repairedContent: string; repairsApplied: string[]; success: boolean } {
  const repairsApplied: string[] = [];
  let repairedContent = content;
  
  if (!parsed.metadata.incompleteStatement) {
    return { repairedContent: content, repairsApplied: [], success: true };
  }
  
  if (options.skipIncomplete) {
    // Remove the incomplete statement from the end
    const incompleteStmt = parsed.metadata.incompleteStatement;
    const lastIndex = repairedContent.lastIndexOf(incompleteStmt.substring(0, 100));
    if (lastIndex > -1) {
      repairedContent = repairedContent.substring(0, lastIndex).trim();
      repairsApplied.push('Removed incomplete statement from end of file');
    }
  } else if (options.autoClose) {
    // Try to auto-close the statement
    for (const suggestion of parsed.metadata.repairSuggestions) {
      if (suggestion.automatable && suggestion.repairFunction) {
        const incompleteStmt = parsed.metadata.incompleteStatement;
        const lastIndex = repairedContent.lastIndexOf(incompleteStmt.substring(0, 100));
        if (lastIndex > -1) {
          const repairedStmt = suggestion.repairFunction();
          repairedContent = repairedContent.substring(0, lastIndex) + repairedStmt;
          repairsApplied.push(suggestion.description);
          break;
        }
      }
    }
  }
  
  return {
    repairedContent,
    repairsApplied,
    success: repairsApplied.length > 0,
  };
}

/**
 * Check file integrity and provide detailed diagnostics
 */
export function checkFileIntegrity(content: string, fileSize: number): FileIntegrityReport {
  const report: FileIntegrityReport = {
    isLikelyComplete: true,
    expectedSize: null,
    actualSize: fileSize,
    issues: [],
    recommendations: [],
  };
  
  // Check for proper pg_dump header
  if (!content.includes('PostgreSQL database dump')) {
    report.issues.push('File does not appear to be a valid pg_dump output');
    report.recommendations.push('Ensure the file was created using pg_dump command');
  }
  
  // Check for completion marker
  if (!content.includes('PostgreSQL database dump complete') && !content.includes('-- Completed on')) {
    report.isLikelyComplete = false;
    report.issues.push('Missing dump completion marker');
    report.recommendations.push(
      'The pg_dump process may have been interrupted. Check:',
      '  1. Disk space was available during dump creation',
      '  2. Network connection was stable (if remote)',
      '  3. No timeout occurred during the dump',
      '  4. The source database was accessible throughout'
    );
  }
  
  // Check for abrupt file ending
  const lastChars = content.slice(-100).trim();
  const endsWithSemicolon = lastChars.endsWith(';');
  const endsWithComment = lastChars.endsWith('--') || /--[^\n]*$/.test(lastChars);
  const endsWithCopyTerminator = lastChars.endsWith('\\.');
  
  if (!endsWithSemicolon && !endsWithComment && !endsWithCopyTerminator) {
    report.isLikelyComplete = false;
    report.issues.push('File ends with incomplete content');
  }
  
  // Check for version compatibility hints
  const versionMatch = content.match(/-- Dumped from database version (\d+)/);
  if (versionMatch) {
    const sourceVersion = parseInt(versionMatch[1]);
    report.recommendations.push(
      `Source database: PostgreSQL ${sourceVersion}`,
      'Ensure target database version is >= source version for compatibility'
    );
  }
  
  return report;
}

export interface FileIntegrityReport {
  isLikelyComplete: boolean;
  expectedSize: number | null;
  actualSize: number;
  issues: string[];
  recommendations: string[];
}
