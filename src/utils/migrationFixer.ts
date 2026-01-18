/**
 * Migration Fixer Utility
 * Automatically fixes common SQL migration issues before pushing to target DB
 */

export interface MigrationFile {
  name: string;
  sql: string;
}

export interface MigrationIssue {
  file: string;
  line?: number;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  fixed: boolean;
}

export interface FixResult {
  original: string;
  fixed: string;
  issues: MigrationIssue[];
}

/**
 * Fixes common SQL migration issues
 */
export function fixMigrationSql(sql: string, fileName: string): FixResult {
  const issues: MigrationIssue[] = [];
  let fixed = sql;

  // 1. Remove standalone BEGIN; statements
  const beginMatches = fixed.match(/^BEGIN;\s*$/gim);
  if (beginMatches) {
    issues.push({
      file: fileName,
      issue: `Found ${beginMatches.length} standalone BEGIN; statement(s)`,
      severity: 'warning',
      fixed: true
    });
    fixed = fixed.replace(/^BEGIN;\s*$/gim, '');
    fixed = fixed.replace(/^begin;\s*$/gim, '');
  }

  // 2. Remove standalone COMMIT; statements
  const commitMatches = fixed.match(/^COMMIT;\s*$/gim);
  if (commitMatches) {
    issues.push({
      file: fileName,
      issue: `Found ${commitMatches.length} standalone COMMIT; statement(s)`,
      severity: 'warning',
      fixed: true
    });
    fixed = fixed.replace(/^COMMIT;\s*$/gim, '');
    fixed = fixed.replace(/^commit;\s*$/gim, '');
  }

  // 3. Remove standalone ROLLBACK; statements
  const rollbackMatches = fixed.match(/^ROLLBACK;\s*$/gim);
  if (rollbackMatches) {
    issues.push({
      file: fileName,
      issue: `Found ${rollbackMatches.length} standalone ROLLBACK; statement(s)`,
      severity: 'warning',
      fixed: true
    });
    fixed = fixed.replace(/^ROLLBACK;\s*$/gim, '');
    fixed = fixed.replace(/^rollback;\s*$/gim, '');
  }

  // 4. Fix search_path with extensions schema
  if (fixed.match(/SET search_path\s*=\s*public\s*,\s*extensions/gi)) {
    issues.push({
      file: fileName,
      issue: 'Found invalid search_path including extensions schema',
      severity: 'error',
      fixed: true
    });
    fixed = fixed.replace(
      /SET search_path\s*=\s*public\s*,\s*extensions/gi, 
      'SET search_path = public'
    );
  }

  // 5. Remove COMMIT/ROLLBACK inside function bodies (outside exception blocks)
  // This is a simplistic fix - in practice we need to be more careful
  const funcBodyCommit = /(\$\$[\s\S]*?)(\n\s*commit;\s*\n)([\s\S]*?\$\$)/gi;
  if (fixed.match(funcBodyCommit)) {
    issues.push({
      file: fileName,
      issue: 'Found COMMIT inside function body',
      severity: 'error',
      fixed: true
    });
    fixed = fixed.replace(funcBodyCommit, '$1\n$3');
  }

  const funcBodyRollback = /(\$\$[\s\S]*?)(\n\s*rollback;\s*\n)([\s\S]*?\$\$)/gi;
  if (fixed.match(funcBodyRollback)) {
    issues.push({
      file: fileName,
      issue: 'Found ROLLBACK inside function body (outside exception handler)',
      severity: 'error',
      fixed: true
    });
    fixed = fixed.replace(funcBodyRollback, '$1\n$3');
  }

  // 6. Check for missing search_path in SECURITY DEFINER functions
  const securityDefinerFuncs = fixed.match(/SECURITY DEFINER(?![\s\S]*?SET search_path)/gi);
  if (securityDefinerFuncs) {
    issues.push({
      file: fileName,
      issue: `Found ${securityDefinerFuncs.length} SECURITY DEFINER function(s) without SET search_path`,
      severity: 'warning',
      fixed: false // Can't auto-fix this reliably
    });
  }

  // Clean up multiple blank lines
  fixed = fixed.replace(/\n{3,}/g, '\n\n');
  
  return {
    original: sql,
    fixed: fixed.trim(),
    issues
  };
}

/**
 * Analyzes all migrations and returns issues
 */
export function analyzeMigrations(migrations: MigrationFile[]): {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  issues: MigrationIssue[];
} {
  const allIssues: MigrationIssue[] = [];
  
  for (const migration of migrations) {
    const result = fixMigrationSql(migration.sql, migration.name);
    allIssues.push(...result.issues);
  }

  return {
    totalIssues: allIssues.length,
    errorCount: allIssues.filter(i => i.severity === 'error').length,
    warningCount: allIssues.filter(i => i.severity === 'warning').length,
    issues: allIssues
  };
}

/**
 * Fixes all migrations and returns fixed versions
 */
export function fixAllMigrations(migrations: MigrationFile[]): {
  fixed: MigrationFile[];
  issues: MigrationIssue[];
} {
  const fixedMigrations: MigrationFile[] = [];
  const allIssues: MigrationIssue[] = [];
  
  for (const migration of migrations) {
    const result = fixMigrationSql(migration.sql, migration.name);
    fixedMigrations.push({
      name: migration.name,
      sql: result.fixed
    });
    allIssues.push(...result.issues);
  }

  return {
    fixed: fixedMigrations,
    issues: allIssues
  };
}
