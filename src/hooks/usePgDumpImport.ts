import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ParsedSqlFile,
  extractTableSchemas,
  buildMissingColumnAlterStatements,
  TargetColumnInfo,
  TableSchemaDefinition,
} from '@/utils/sqlFileParser';
import { rewriteInsertsWithOnConflict } from '@/utils/pgDumpImportConflict';
import { ExternalDbConnection, ConnectionTestResult } from '@/components/dashboard/data-management/migration/ExternalDbConnectionForm';
import { ImportOptions } from '@/components/dashboard/data-management/migration/ImportOptionsPanel';

export enum PgDumpErrorCategory {
  CONNECTION_REFUSED = 101,
  AUTHENTICATION_FAILED = 102,
  DATABASE_NOT_FOUND = 103,
  PERMISSION_DENIED = 104,
  OBJECT_NOT_FOUND = 201,
  DEPENDENCY_MISSING = 202,
  CIRCULAR_DEPENDENCY = 203,
  INVALID_DEFINITION = 204,
  DATA_CORRUPTION = 301,
  ENCODING_MISMATCH = 302,
  CONSTRAINT_VIOLATION = 303,
  TYPE_MISMATCH = 304,
  DISK_FULL = 401,
  MEMORY_EXHAUSTED = 402,
  TIMEOUT_EXCEEDED = 403,
  LOCK_CONFLICT = 404,
  INVALID_SYNTAX = 501,
  UNBALANCED_QUOTES = 502,
  TRUNCATED_OUTPUT = 503,
  ENCODING_ERROR = 504,
  RLS_VIOLATION = 601,
}

export type PgDumpErrorSeverity = 'warning' | 'error' | 'fatal' | 'panic';

export interface PgDumpErrorClassification {
  category: PgDumpErrorCategory;
  severity: PgDumpErrorSeverity;
  code: number;
}

export function classifyPgDumpError(message: string): PgDumpErrorClassification {
  const text = message || '';
  const lower = text.toLowerCase();

  let category = PgDumpErrorCategory.INVALID_SYNTAX;
  let severity: PgDumpErrorSeverity = 'error';

  if (
    /could not connect to server/i.test(text) ||
    /connection refused/i.test(text) ||
    /connection reset/i.test(text)
  ) {
    category = PgDumpErrorCategory.CONNECTION_REFUSED;
    severity = 'fatal';
  } else if (
    /password authentication failed/i.test(text) ||
    /authentication failed/i.test(text) ||
    /no pg_hba\.conf entry/i.test(lower)
  ) {
    category = PgDumpErrorCategory.AUTHENTICATION_FAILED;
    severity = 'fatal';
  } else if (/database .* does not exist/i.test(text)) {
    category = PgDumpErrorCategory.DATABASE_NOT_FOUND;
    severity = 'fatal';
  } else if (
    /permission denied/i.test(text) ||
    /must be owner of/i.test(text) ||
    /must be superuser/i.test(text)
  ) {
    category = PgDumpErrorCategory.PERMISSION_DENIED;
    severity = 'error';
  } else if (
    /new row violates row-level security policy/i.test(text) ||
    /violates row-level security policy/i.test(text)
  ) {
    category = PgDumpErrorCategory.RLS_VIOLATION;
    severity = 'error';
  } else if (
    /relation .* does not exist/i.test(text) ||
    /table .* does not exist/i.test(text) ||
    /type .* does not exist/i.test(text)
  ) {
    category = PgDumpErrorCategory.OBJECT_NOT_FOUND;
    severity = 'error';
  } else if (
    /is not present in table/i.test(text) ||
    /still referenced from/i.test(text) ||
    /dependent objects exist/i.test(text)
  ) {
    category = PgDumpErrorCategory.DEPENDENCY_MISSING;
    severity = 'error';
  } else if (
    /violates foreign key constraint/i.test(text) ||
    /violates unique constraint/i.test(text) ||
    /violates check constraint/i.test(text) ||
    /violates not-null constraint/i.test(text)
  ) {
    category = PgDumpErrorCategory.CONSTRAINT_VIOLATION;
    severity = 'error';
  } else if (
    /invalid input syntax for type/i.test(text) ||
    /value too long for type/i.test(text) ||
    /integer out of range/i.test(text)
  ) {
    category = PgDumpErrorCategory.TYPE_MISMATCH;
    severity = 'error';
  } else if (
    /could not read block/i.test(text) ||
    /checksum mismatch/i.test(text) ||
    /corrupt/i.test(text)
  ) {
    category = PgDumpErrorCategory.DATA_CORRUPTION;
    severity = 'panic';
  } else if (/invalid byte sequence for encoding/i.test(text)) {
    category = PgDumpErrorCategory.ENCODING_MISMATCH;
    severity = 'error';
  } else if (/no space left on device/i.test(text)) {
    category = PgDumpErrorCategory.DISK_FULL;
    severity = 'fatal';
  } else if (
    /out of memory/i.test(text) ||
    /cannot allocate memory/i.test(text)
  ) {
    category = PgDumpErrorCategory.MEMORY_EXHAUSTED;
    severity = 'fatal';
  } else if (
    /statement timeout/i.test(text) ||
    /canceling statement due to statement timeout/i.test(text)
  ) {
    category = PgDumpErrorCategory.TIMEOUT_EXCEEDED;
    severity = 'error';
  } else if (
    /deadlock detected/i.test(text) ||
    /could not obtain lock/i.test(text) ||
    /canceling statement due to lock timeout/i.test(text)
  ) {
    category = PgDumpErrorCategory.LOCK_CONFLICT;
    severity = 'error';
  } else if (/syntax error at or near/i.test(text)) {
    category = PgDumpErrorCategory.INVALID_SYNTAX;
    severity = 'error';
  } else if (/duplicate key value violates unique constraint/i.test(text)) {
    category = PgDumpErrorCategory.CONSTRAINT_VIOLATION;
    severity = 'error';
  } else if (
    /session_replication_role/i.test(text) &&
    (/must be superuser/i.test(text) || /permission denied/i.test(text))
  ) {
    category = PgDumpErrorCategory.PERMISSION_DENIED;
    severity = 'error';
  } else if (/cannot alter type/i.test(text)) {
    category = PgDumpErrorCategory.INVALID_DEFINITION;
    severity = 'error';
  } else if (
    /unterminated quoted string/i.test(text) ||
    /unterminated dollar-quoted string/i.test(text)
  ) {
    category = PgDumpErrorCategory.UNBALANCED_QUOTES;
    severity = 'error';
  } else if (
    /unexpected end of file/i.test(text) ||
    /unexpected end of input/i.test(text)
  ) {
    category = PgDumpErrorCategory.TRUNCATED_OUTPUT;
    severity = 'error';
  } else if (/current transaction is aborted/i.test(text)) {
    category = PgDumpErrorCategory.CONSTRAINT_VIOLATION;
    severity = 'warning';
  }

  return {
    category,
    severity,
    code: category,
  };
}

export type ImportStatus = 
  | 'idle' 
  | 'parsing' 
  | 'validating' 
  | 'executing' 
  | 'completed' 
  | 'failed' 
  | 'paused'
  | 'cancelled';

export interface ImportProgress {
  currentBatch: number;
  totalBatches: number;
  statementsExecuted: number;
  statementsFailed: number;
  totalStatements: number;
  currentPhase: 'schema' | 'data' | 'constraints' | 'indexes' | 'functions' | 'policies' | 'other';
  elapsedMs: number;
  estimatedRemainingMs: number;
  bytesProcessed: number;
  totalBytes: number;
}

export interface ImportPhaseTiming {
  startTime: number;
  endTime: number;
  duration: number;
  executed: number;
  failed: number;
}

export interface ImportError {
  index: number;
  statement: string;
  error: string;
  timestamp: number;
  phase: string;
  category?: PgDumpErrorCategory;
  severity?: PgDumpErrorSeverity;
  code?: number;
}

export interface ImportMetrics {
  totalDuration: number;
  phases: Partial<Record<ImportProgress['currentPhase'], ImportPhaseTiming>>;
}

export function buildImportMetrics(
  importStartTime: number,
  importEndTime: number,
  phaseExecutions: Array<{
    name: ImportProgress['currentPhase'];
    startTime: number;
    endTime: number;
    executed: number;
    failed: number;
  }>
): ImportMetrics {
  const phases: Partial<Record<ImportProgress['currentPhase'], ImportPhaseTiming>> = {};

  for (const phase of phaseExecutions) {
    phases[phase.name] = {
      startTime: phase.startTime,
      endTime: phase.endTime,
      duration: phase.endTime - phase.startTime,
      executed: phase.executed,
      failed: phase.failed,
    };
  }

  return {
    totalDuration: importEndTime - importStartTime,
    phases,
  };
}

export interface ImportLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

export const reorderDataStatementsForImport = (
  stmts: string[],
  constraintStatements: string[],
  log?: (level: ImportLog['level'], message: string, details?: string) => void
): string[] => {
  const extractTarget = (s: string): string | null => {
    const m = s.match(/INSERT\s+INTO\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"/i);
    if (m) {
      const schema = (m[1] || 'public').toLowerCase();
      const table = (m[2] || '').toLowerCase();
      return `${schema}.${table}`;
    }
    return null;
  };
  const priority: string[] = [
    'auth.users',
    'public.tenants',
    'public.profiles',
    'public.accounts',
    'public.contacts',
    'public.leads',
    'public.opportunities',
    'public.queues',
    'public.queue_members',
    'public.email_accounts',
    'public.emails',
    'public.activities',
    'public.segment_members',
  ];
  const buckets = new Map<string, string[]>();
  const rest: string[] = [];
  const tables = new Set<string>();
  for (const s of stmts) {
    const ref = extractTarget(s);
    if (ref) {
      tables.add(ref);
      if (!buckets.has(ref)) buckets.set(ref, []);
      buckets.get(ref)!.push(s);
    } else {
      rest.push(s);
    }
  }
  const deps = new Map<string, Set<string>>();
  const childrenByParent = new Map<string, Set<string>>();
  const missingTableEdges = new Set<string>();
  const addEdge = (child: string, parent: string) => {
    if (!tables.has(child) || !tables.has(parent)) return;
    if (!deps.has(child)) deps.set(child, new Set());
    deps.get(child)!.add(parent);
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, new Set());
    childrenByParent.get(parent)!.add(child);
  };
  let edgeCount = 0;
  let totalFkEdges = 0;
  let usedFkEdges = 0;
  const fkRegex =
    /ALTER\s+TABLE\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?[\s\S]*?FOREIGN\s+KEY\s*\([^)]+\)\s+REFERENCES\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"/gi;
  for (const stmt of constraintStatements) {
    let m: RegExpExecArray | null;
    while ((m = fkRegex.exec(stmt)) !== null) {
      totalFkEdges++;
      const childSchema = (m[1] || 'public').toLowerCase();
      const childTable = (m[2] || '').toLowerCase();
      const parentSchema = (m[3] || 'public').toLowerCase();
      const parentTable = (m[4] || '').toLowerCase();
      if (!childTable || !parentTable) continue;
      const childRef = `${childSchema}.${childTable}`;
      const parentRef = `${parentSchema}.${parentTable}`;
      if (childRef === parentRef) continue;
      if (!tables.has(childRef) || !tables.has(parentRef)) {
        missingTableEdges.add(`${childRef} -> ${parentRef}`);
        continue;
      }
      addEdge(childRef, parentRef);
      edgeCount++;
      usedFkEdges++;
    }
  }
  if (totalFkEdges > 0) {
    if (log) {
      log(
        'info',
        'Analyzed foreign key relationships for data ordering',
        `edges=${totalFkEdges}, applied=${usedFkEdges}, missingTables=${missingTableEdges.size}`
      );
    }
    if (missingTableEdges.size > 0 && log) {
      const sample = Array.from(missingTableEdges).slice(0, 20);
      log(
        'warn',
        'Some foreign key relationships reference tables without data statements',
        sample.join('; ')
      );
    }
  }
  const tableList = Array.from(tables);
  const indegree = new Map<string, number>();
  for (const t of tableList) {
    indegree.set(t, 0);
  }
  for (const [child, parents] of deps) {
    for (const parent of parents) {
      if (!indegree.has(child)) continue;
      indegree.set(child, (indegree.get(child) || 0) + 1);
    }
  }
  const orderedTables: string[] = [];
  if (edgeCount > 0) {
    const priorityIndex = new Map<string, number>();
    priority.forEach((name, idx) => {
      priorityIndex.set(name, idx);
    });
    const queue: string[] = [];
    for (const [t, deg] of indegree) {
      if (deg === 0) {
        queue.push(t);
      }
    }
    queue.sort((a, b) => {
      const pa = priorityIndex.has(a) ? priorityIndex.get(a)! : Number.MAX_SAFE_INTEGER;
      const pb = priorityIndex.has(b) ? priorityIndex.get(b)! : Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    });
    const seen = new Set<string>();
    while (queue.length > 0) {
      const t = queue.shift()!;
      if (seen.has(t)) continue;
      seen.add(t);
      orderedTables.push(t);
      const children = childrenByParent.get(t);
      if (children) {
        for (const child of children) {
          if (!indegree.has(child)) continue;
          const d = (indegree.get(child) || 0) - 1;
          indegree.set(child, d);
          if (d === 0) {
            queue.push(child);
          }
        }
        queue.sort((a, b) => {
          const pa = priorityIndex.has(a) ? priorityIndex.get(a)! : Number.MAX_SAFE_INTEGER;
          const pb = priorityIndex.has(b) ? priorityIndex.get(b)! : Number.MAX_SAFE_INTEGER;
          if (pa !== pb) return pa - pb;
          return a.localeCompare(b);
        });
      }
    }
    if (orderedTables.length !== tableList.length && log) {
      const unresolved = tableList.filter(t => !orderedTables.includes(t));
      if (unresolved.length > 0) {
        log(
          'warn',
          'Foreign key dependency graph not fully resolved for data reordering',
          `unresolvedTables=${unresolved.join(', ')}`
        );
      }
    }
  }
  if (orderedTables.length === 0) {
    const presentPriority = priority.filter(ref => buckets.has(ref));
    const remaining = tableList.filter(ref => !presentPriority.includes(ref));
    orderedTables.push(...presentPriority, ...remaining);
  }
  const ordered: string[] = [];
  for (const ref of orderedTables) {
    const b = buckets.get(ref);
    if (b && b.length > 0) ordered.push(...b);
  }
  ordered.push(...rest);
  return ordered;
};

export interface ImportSummary {
  status: 'success' | 'partial' | 'failed';
  startTime: number;
  endTime: number;
  duration: number;
  statementsExecuted: number;
  statementsFailed: number;
  errors: ImportError[];
  phases: {
    schema: { executed: number; failed: number };
    data: { executed: number; failed: number };
    constraints: { executed: number; failed: number };
    indexes: { executed: number; failed: number };
    functions: { executed: number; failed: number };
    policies: { executed: number; failed: number };
  };
  metrics?: ImportMetrics;
}

export interface VerificationResult {
  table: string;
  expected: number;
  actual: number;
  match: boolean;
  checksum?: string;
  orphanCheck?: {
    hasOrphans: boolean;
    orphanCount: number;
    constraintName?: string;
  };
}

export interface UsePgDumpImportReturn {
  status: ImportStatus;
  progress: ImportProgress | null;
  errors: ImportError[];
  logs: ImportLog[];
  summary: ImportSummary | null;
  verificationResults: VerificationResult[];
  isVerifying: boolean;
  
  testConnection: (connection: ExternalDbConnection) => Promise<ConnectionTestResult>;
  verifyIntegrity: (connection: ExternalDbConnection, parsed: ParsedSqlFile) => Promise<void>;
  startImport: (
    parsed: ParsedSqlFile,
    connection: ExternalDbConnection,
    options: ImportOptions
  ) => Promise<void>;
  pauseImport: () => void;
  resumeImport: () => void;
  cancelImport: () => void;
  reset: () => void;
  rollbackAlignment: (connection: ExternalDbConnection) => Promise<void>;
  rerunFailedBatches: (connection: ExternalDbConnection) => Promise<void>;
  clearCheckpoint: () => void;
  
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
}

export function usePgDumpImport(): UsePgDumpImportReturn {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const operationIdRef = useRef<string | null>(null);
  const appliedChangesRef = useRef<{ forward: string[]; rollback: string[]; summary: string; phase: string; timestamp: number }[]>([]);
  const conflictTargetsRef = useRef<Map<string, string[]>>(new Map());
  const failedBatchesRef = useRef<Array<{
    phase: ImportProgress['currentPhase'];
    batchIndex: number;
    statements: string[];
    failedCount: number;
  }>>([]);

  const addLog = useCallback((level: ImportLog['level'], message: string, details?: string) => {
    setLogs(prev => [...prev, { timestamp: Date.now(), level, message, details }]);
  }, []);

  const saveCheckpoint = useCallback((phase: ImportProgress['currentPhase'], batch: number, totalBatches: number) => {
    if (!operationIdRef.current) return;
    try {
      const payload = {
        id: operationIdRef.current,
        phase,
        batch,
        totalBatches,
        timestamp: Date.now(),
        metrics: summary ? { executed: summary.statementsExecuted, failed: summary.statementsFailed } : undefined,
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('pgdump.import.checkpoint', JSON.stringify(payload));
      }
    } catch {}
  }, []);

  const persistCheckpoint = useCallback(async (phase: ImportProgress['currentPhase'], batch: number, totalBatches: number) => {
    try {
      const opId = operationIdRef.current;
      if (!opId) return;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      await (supabase as any).from('import_checkpoints').upsert({
        operation_id: opId,
        phase,
        batch,
        total_batches: totalBatches,
        user_id: userId,
        executed_count: progress?.statementsExecuted ?? null,
        failed_count: progress?.statementsFailed ?? null,
        created_at: new Date().toISOString(),
      });
    } catch {}
  }, []);
  const validateAndPrepareSchema = useCallback(async (
    parsed: ParsedSqlFile,
    connection: ExternalDbConnection,
    options?: ImportOptions
  ) => {
    addLog('info', 'Starting schema validation and alignment');

    const cfg = options?.alignmentConfig;
    const allowedSchemas = (cfg?.allowedSchemas && cfg.allowedSchemas.length > 0) ? cfg.allowedSchemas : ['public'];
    const excludedSchemas = cfg?.excludedSchemas || [];
    const allowedTables = cfg?.allowedTables || [];
    const excludedTables = cfg?.excludedTables || [];
    const maxRowEstimate = cfg?.maxRowEstimateForAlter ?? 10_000_000;
    const criticalTables = new Set(cfg?.criticalTables || []);
    const requiredNotNullSet = new Set(cfg?.requiredNotNullColumns || []);
    const heuristics = cfg?.heuristics || {
      allowNotNullWhenDefault: true,
      allowNotNullWhenNoNulls: true,
      backfillWithDefault: true,
    };

    const { data, error } = await supabase.functions.invoke('execute-sql-external', {
      body: {
        action: 'query',
        connection: {
          host: connection.host,
          port: connection.port,
          database: connection.database,
          user: connection.user,
          password: connection.password,
          ssl: connection.ssl,
        },
        query: `
          SELECT
            table_schema AS schema_name,
            table_name,
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        `,
      },
    });

    if (error) {
      addLog('error', 'Schema introspection failed', error.message || String(error));
      throw error;
    }

    const result = data as any;
    if (!result?.success) {
      const message = result?.message || 'Schema introspection failed';
      addLog('error', 'Schema introspection failed', message);
      throw new Error(message);
    }

    const rows = Array.isArray(result.data) ? result.data : [];

    const targetColumnDetails = new Map<string, { column: string; isNullable: boolean }[]>();
    for (const r of rows as any[]) {
      const schemaName = r.schema_name || r.table_schema || 'public';
      const tableName = r.table_name;
      const columnName = r.column_name;
      const isNullable = String(r.is_nullable || '').toUpperCase() === 'YES';
      if (!schemaName || !tableName || !columnName) continue;
      const key = `${schemaName}.${tableName}`;
      let cols = targetColumnDetails.get(key);
      if (!cols) {
        cols = [];
        targetColumnDetails.set(key, cols);
      }
      cols.push({ column: columnName, isNullable });
    }

    const targetColumns: TargetColumnInfo[] = rows.map((r: any) => ({
      schema_name: r.schema_name || r.table_schema || 'public',
      table_name: r.table_name,
      column_name: r.column_name,
    }));

    try {
      const { data: relCheckData, error: relCheckError } = await supabase.functions.invoke('execute-sql-external', {
        body: {
          action: 'query',
          connection: {
            host: connection.host,
            port: connection.port,
            database: connection.database,
            user: connection.user,
            password: connection.password,
            ssl: connection.ssl,
          },
          query: `
            SELECT
              EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'profiles'
              ) AS has_profiles,
              EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'auth' AND table_name = 'users'
              ) AS has_auth_users,
              EXISTS (
                SELECT 1
                FROM information_schema.table_constraints tc
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                  AND tc.table_name = 'profiles'
                  AND tc.constraint_name = 'profiles_id_fkey'
              ) AS has_profiles_fk
          `,
        },
      });

      if (relCheckError) {
        addLog('warn', 'Pre-import foreign key introspection for profiles failed', relCheckError.message || String(relCheckError));
      } else {
        const relResult = relCheckData as any;
        const rowsRel = Array.isArray(relResult?.data) ? relResult.data : [];
        const rel = rowsRel[0] || {};
        const hasProfiles = !!rel.has_profiles;
        const hasAuthUsers = !!rel.has_auth_users;
        const hasProfilesFk = !!rel.has_profiles_fk;

        if (hasProfiles && hasAuthUsers && hasProfilesFk) {
          const { data: orphanData, error: orphanError } = await supabase.functions.invoke('execute-sql-external', {
            body: {
              action: 'query',
              connection: {
                host: connection.host,
                port: connection.port,
                database: connection.database,
                user: connection.user,
                password: connection.password,
                ssl: connection.ssl,
              },
              query: `
                SELECT COUNT(*)::bigint AS missing_count
                FROM public.profiles p
                LEFT JOIN auth.users u ON p.id = u.id
                WHERE p.id IS NOT NULL AND u.id IS NULL
              `,
            },
          });

          if (orphanError) {
            addLog('warn', 'Pre-import foreign key check for profiles/auth.users failed', orphanError.message || String(orphanError));
          } else {
            const orphanResult = orphanData as any;
            const rowsOrphan = Array.isArray(orphanResult?.data) ? orphanResult.data : [];
            const missingCount = rowsOrphan.length > 0 ? Number(rowsOrphan[0].missing_count || 0) : 0;
            if (missingCount > 0) {
              addLog(
                'error',
                'Pre-import foreign key validation failed for profiles',
                `Detected ${missingCount} profile record(s) whose id has no matching auth.users row`
              );
              throw new Error(
                `Foreign key validation failed for profiles_id_fkey: ${missingCount} orphan profile id(s) referencing missing auth.users rows`
              );
            } else {
              addLog(
                'info',
                'Pre-import foreign key validation passed for profiles',
                'All profile ids have matching auth.users rows'
              );
            }
          }
        }
      }
    } catch (relErr: any) {
      addLog('warn', 'Pre-import foreign key validation for profiles skipped', relErr.message || String(relErr));
    }

    let sourceSchemas = extractTableSchemas(parsed);

    const schemaByKey = new Map<string, TableSchemaDefinition>();
    for (const def of sourceSchemas) {
      schemaByKey.set(`${def.schema}.${def.table}`, def);
    }

    const insertRegex = /INSERT\s+INTO\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?\s*\(([^)]+)\)/i;
    for (const stmt of parsed.dataStatements) {
      const m = insertRegex.exec(stmt);
      if (!m) continue;
      const schema = m[1] || 'public';
      const table = m[2];
      const colsPart = m[3];
      const key = `${schema}.${table}`;
      let def = schemaByKey.get(key);
      if (!def) {
        def = { schema, table, columns: [] };
        schemaByKey.set(key, def);
        sourceSchemas.push(def);
      }
      const existingCols = new Set(def.columns.map(c => c.column));
      const cols = colsPart.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      for (const colName of cols) {
        if (!colName || existingCols.has(colName)) continue;
        def.columns.push({
          schema,
          table,
          column: colName,
          dataType: 'text',
          isNullable: true,
        });
        existingCols.add(colName);
      }
    }

    const existingTableSet = new Set<string>(
      rows.map((r: any) => `${r.schema_name || r.table_schema || 'public'}.${r.table_name}`)
    );

    const autoCreateEnabled = options?.autoCreateMissingTables ?? true;
    const autoSchemas = options?.autoCreateMissingTablesSchemas && options.autoCreateMissingTablesSchemas.length > 0
      ? options.autoCreateMissingTablesSchemas
      : ['public'];
    const autoTables = new Set(
      (options?.autoCreateMissingTablesTables ?? [])
        .map(name => name.toLowerCase())
    );

    const isTableAllowedForAutoCreate = (schema: string, table: string) => {
      const full = `${schema}.${table}`.toLowerCase();
      const schemaOk = autoSchemas.some(s => schema.match(new RegExp(`^${s.replace(/\*/g, '.*')}$`)));
      const tableOk = autoTables.size === 0 || autoTables.has(full);
      return schemaOk && tableOk;
    };

    const missingTableStatements: string[] = [];
    const missingTableNames = new Set<string>();

    const sanitizeColumnTypeForAutoCreate = (rawType: string): string => {
      const type = (rawType || '').trim();
      if (!type) return 'text';

      const lower = type.toLowerCase();

      const builtin = new Set([
        'bigint',
        'boolean',
        'bool',
        'bytea',
        'date',
        'double precision',
        'integer',
        'int',
        'json',
        'jsonb',
        'numeric',
        'decimal',
        'real',
        'smallint',
        'text',
        'time without time zone',
        'time with time zone',
        'timestamp without time zone',
        'timestamp with time zone',
        'timestamp',
        'timestamptz',
        'uuid',
        'varchar',
        'character varying',
      ]);

      const isBuiltin = (t: string): boolean => {
        const trimmed = t.trim().toLowerCase();
        if (builtin.has(trimmed)) return true;
        if (trimmed.endsWith('[]')) {
          const base = trimmed.slice(0, -2).trim();
          return builtin.has(base);
        }
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          const inner = trimmed.slice(1, -1);
          return builtin.has(inner.toLowerCase());
        }
        return false;
      };

      if (isBuiltin(type)) {
        return type;
      }

      if (lower.includes('.')) {
        const base = lower.split('.').pop() || '';
        if (builtin.has(base)) {
          return base;
        }
      }

      if (lower.endsWith('[]')) {
        return 'text[]';
      }

      return 'text';
    };

    if (autoCreateEnabled) {
      for (const def of sourceSchemas) {
        const key = `${def.schema}.${def.table}`;
        if (existingTableSet.has(key)) continue;
        if (missingTableNames.has(key)) continue;
        if (!def.columns || def.columns.length === 0) continue;
        if (!isTableAllowedForAutoCreate(def.schema, def.table)) continue;
        const colDefs = def.columns.map(col => {
          const type = sanitizeColumnTypeForAutoCreate(col.dataType || 'text');
          const nullPart = col.isNullable ? '' : ' NOT NULL';
          return `"${col.column}" ${type}${nullPart}`;
        });
        const stmt = `CREATE TABLE IF NOT EXISTS "${def.schema}"."${def.table}" (\n  ${colDefs.join(',\n  ')}\n);`;
        missingTableStatements.push(stmt);
        missingTableNames.add(key);
      }

      if (missingTableStatements.length > 0) {
        addLog(
          'info',
          'Detected missing tables in target database',
          `Creating ${missingTableStatements.length} tables: ${Array.from(missingTableNames).join(', ')}`
        );

        const { data: createData, error: createError } = await supabase.functions.invoke('execute-sql-external', {
          body: {
            action: 'execute',
            connection: {
              host: connection.host,
              port: connection.port,
              database: connection.database,
              user: connection.user,
              password: connection.password,
              ssl: connection.ssl,
            },
            statements: missingTableStatements,
            options: {
              stopOnError: true,
              useTransaction: true,
              timeoutMs: 600000,
            },
          },
        });

        if (createError) {
          addLog('error', 'Failed to create missing tables', createError.message || String(createError));
          throw createError;
        }

        const createResult = createData as any;
        if (!createResult?.success) {
          const message = createResult?.message || 'Failed to create missing tables';
          addLog('error', 'Failed to create missing tables', message);
          if (createResult?.details?.errors && Array.isArray(createResult.details.errors) && createResult.details.errors.length > 0) {
            const first = createResult.details.errors[0];
            addLog('error', 'First table creation error', `${first.error}\nStatement: ${first.statement}`);
          }
          throw new Error(message);
        }

        addLog(
          'success',
          'Missing table creation completed',
          `Created ${missingTableStatements.length} tables from dump definition`
        );
      }
    }

    // Restrict by schema/table config
    sourceSchemas = sourceSchemas.filter((def: TableSchemaDefinition) => {
      const schemaOk =
        (allowedSchemas.length === 0 || allowedSchemas.some(s => def.schema.match(new RegExp(`^${s.replace(/\*/g, '.*')}$`)))) &&
        (excludedSchemas.length === 0 || !excludedSchemas.some(s => def.schema.match(new RegExp(`^${s.replace(/\*/g, '.*')}$`))));
      const fullName = `${def.schema}.${def.table}`;
      const tableOk =
        (allowedTables.length === 0 || allowedTables.includes(fullName)) &&
        (excludedTables.length === 0 || !excludedTables.includes(fullName)) &&
        !criticalTables.has(fullName);
      return schemaOk && tableOk;
    });

    // Fetch table row estimates to skip gigantic tables if configured
    const { data: tblEstData, error: tblEstErr } = await supabase.functions.invoke('execute-sql-external', {
      body: {
        action: 'query',
        connection: {
          host: connection.host,
          port: connection.port,
          database: connection.database,
          user: connection.user,
          password: connection.password,
          ssl: connection.ssl,
        },
        query: `
          SELECT n.nspname AS schema_name, c.relname AS table_name, c.reltuples::bigint AS row_estimate
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        `,
      },
    });
    if (tblEstErr) {
      addLog('warn', 'Failed to fetch table estimates', tblEstErr.message || String(tblEstErr));
    }
    const rowEstimateMap = new Map<string, number>();
    if (tblEstData?.data && Array.isArray(tblEstData.data)) {
      for (const r of tblEstData.data as any[]) {
        rowEstimateMap.set(`${r.schema_name}.${r.table_name}`, Number(r.row_estimate || 0));
      }
    }
    sourceSchemas = sourceSchemas.filter(def => {
      const estimate = rowEstimateMap.get(`${def.schema}.${def.table}`) ?? 0;
      return estimate <= maxRowEstimate;
    });

    const relaxNotNullStatements: string[] = [];
    const relaxNotNullRollback: string[] = [];
    const relaxNotNullSummary: string[] = [];

    const sourceColumnMap = new Map<string, Set<string>>();
    for (const def of sourceSchemas) {
      const key = `${def.schema}.${def.table}`;
      const cols = new Set<string>();
      for (const col of def.columns) {
        cols.add(col.column);
      }
      sourceColumnMap.set(key, cols);
    }

    for (const def of sourceSchemas) {
      const key = `${def.schema}.${def.table}`;
      const requiredCols = sourceColumnMap.get(key);
      if (!requiredCols) continue;
      const targetCols = targetColumnDetails.get(key);
      if (!targetCols) continue;
      if (criticalTables.has(key)) continue;

      for (const col of targetCols) {
        if (requiredCols.has(col.column)) continue;
        if (col.isNullable) continue;
        const fqCol = `${def.schema}.${def.table}.${col.column}`;
        if (requiredNotNullSet.has(fqCol)) continue;
        relaxNotNullStatements.push(
          `ALTER TABLE "${def.schema}"."${def.table}" ALTER COLUMN "${col.column}" DROP NOT NULL;`
        );
        relaxNotNullRollback.push(
          `ALTER TABLE "${def.schema}"."${def.table}" ALTER COLUMN "${col.column}" SET NOT NULL;`
        );
        relaxNotNullSummary.push(`Drop NOT NULL for extra column: ${fqCol}`);
      }
    }

    if (relaxNotNullStatements.length > 0) {
      addLog('info', 'Relaxing NOT NULL on extra columns', relaxNotNullSummary.join('\n'));
      const { data: relaxData, error: relaxError } = await supabase.functions.invoke('execute-sql-external', {
        body: {
          action: 'execute',
          connection: {
            host: connection.host,
            port: connection.port,
            database: connection.database,
            user: connection.user,
            password: connection.password,
            ssl: connection.ssl,
          },
          statements: relaxNotNullStatements,
          options: {
            stopOnError: true,
            useTransaction: true,
            timeoutMs: 60000,
          },
        },
      });
      if (relaxError) {
        addLog(
          'error',
          'Failed to relax NOT NULL constraints for extra columns',
          relaxError.message || String(relaxError)
        );
        throw relaxError;
      }
      const relaxResult = relaxData as any;
      if (!relaxResult?.success) {
        const message = relaxResult?.message || 'Failed to relax NOT NULL constraints for extra columns';
        addLog('error', 'Failed to relax NOT NULL constraints for extra columns', message);
        if (
          relaxResult?.details?.errors &&
          Array.isArray(relaxResult.details.errors) &&
          relaxResult.details.errors.length > 0
        ) {
          const first = relaxResult.details.errors[0];
          addLog('error', 'First constraint relaxation error', `${first.error}\nStatement: ${first.statement}`);
        }
        throw new Error(message);
      }
      appliedChangesRef.current.push({
        forward: relaxNotNullStatements,
        rollback: relaxNotNullRollback,
        summary: relaxNotNullSummary.join('\n'),
        phase: 'schema-relax-not-null',
        timestamp: Date.now(),
      });
    }

    try {
      const { data: pkData, error: pkError } = await supabase.functions.invoke('execute-sql-external', {
        body: {
          action: 'query',
          connection: {
            host: connection.host,
            port: connection.port,
            database: connection.database,
            user: connection.user,
            password: connection.password,
            ssl: connection.ssl,
          },
          query: `
            SELECT
              tc.table_schema,
              tc.table_name,
              kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
             AND tc.table_name = kcu.table_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
          `,
        },
      });
      if (pkError) {
        addLog('warn', 'Failed to fetch primary key metadata for conflict handling', pkError.message || String(pkError));
      } else {
        const pkMap = new Map<string, string[]>();
        const rowsPk = Array.isArray((pkData as any)?.data) ? (pkData as any).data : [];
        for (const r of rowsPk as any[]) {
          const schemaName = (r.table_schema || 'public').toLowerCase();
          const tableName = (r.table_name || '').toLowerCase();
          const colName = r.column_name;
          if (!schemaName || !tableName || !colName) continue;
          const key = `${schemaName}.${tableName}`;
          if (!pkMap.has(key)) pkMap.set(key, []);
          pkMap.get(key)!.push(colName);
        }
        conflictTargetsRef.current = pkMap;
      }
    } catch (pkErr: any) {
      addLog('warn', 'Unexpected error while fetching primary key metadata', pkErr.message || String(pkErr));
    }
    const plan = buildMissingColumnAlterStatements(sourceSchemas, targetColumns);

    if (plan.statements.length === 0) {
      addLog('info', 'Schema validation completed', 'No missing columns detected');
      return;
    }

    const tablesTouched = new Set(plan.missingColumns.map(c => `${c.schema}.${c.table}`));
    addLog('info', 'Schema differences detected', `Adding ${plan.missingColumns.length} missing columns across ${tablesTouched.size} tables`);

    // Build enhanced statements with defaults and optional backfill (Stage 1)
    const stage1Statements: string[] = [];
    const stage1Summary: string[] = [];
    const stage1Rollback: string[] = [];
    for (const col of plan.missingColumns) {
      const fq = `${col.schema}.${col.table}.${col.column}`;
      const normalizedType = typeof col.dataType === 'string' ? col.dataType.trim() : '';
      const safeType = /^ARRAY$/i.test(normalizedType)
        ? 'text[]'
        : /^USER-DEFINED$/i.test(normalizedType)
          ? 'text'
          : (normalizedType || 'text');
      const baseAdd = `ALTER TABLE "${col.schema}"."${col.table}" ADD COLUMN "${col.column}" ${safeType}`;
      const hasArrayDefault =
        typeof col.defaultValue === 'string' && /\bARRAY\b/i.test(col.defaultValue);

      if (col.defaultValue && !hasArrayDefault) {
        stage1Statements.push(`${baseAdd} DEFAULT ${col.defaultValue};`);
        stage1Summary.push(`ADD COLUMN with DEFAULT: ${fq}`);
        if (heuristics.backfillWithDefault) {
          stage1Statements.push(
            `UPDATE "${col.schema}"."${col.table}" SET "${col.column}" = ${col.defaultValue} WHERE "${col.column}" IS NULL;`
          );
          stage1Summary.push(`Backfill with DEFAULT: ${fq}`);
        }
      } else {
        stage1Statements.push(`${baseAdd};`);
        stage1Summary.push(
          hasArrayDefault
            ? `ADD COLUMN (array, default skipped): ${fq}`
            : `ADD COLUMN (nullable): ${fq}`
        );
      }
      stage1Rollback.push(`ALTER TABLE "${col.schema}"."${col.table}" DROP COLUMN "${col.column}";`);
    }

    addLog('info', 'Applying Stage 1 schema changes', stage1Summary.join('\n'));

    const { data: execData1, error: execError1 } = await supabase.functions.invoke('execute-sql-external', {
      body: {
        action: 'execute',
        connection: {
          host: connection.host,
          port: connection.port,
          database: connection.database,
          user: connection.user,
          password: connection.password,
          ssl: connection.ssl,
        },
        statements: stage1Statements,
        options: {
          stopOnError: true,
          useTransaction: true,
          timeoutMs: 60000,
        },
      },
    });
    if (execError1) {
      addLog('error', 'Failed to apply Stage 1 schema changes', execError1.message || String(execError1));
      throw execError1;
    }
    const execResult1 = execData1 as any;
    if (!execResult1?.success) {
      const message = execResult1?.message || 'Failed to apply Stage 1 schema changes';
      addLog('error', 'Failed to apply Stage 1 schema changes', message);
      if (execResult1?.details?.errors && Array.isArray(execResult1.details.errors) && execResult1.details.errors.length > 0) {
        const first = execResult1.details.errors[0];
        addLog('error', 'First schema change error', `${first.error}\nStatement: ${first.statement}`);
      }
      throw new Error(message);
    }
    appliedChangesRef.current.push({
      forward: stage1Statements,
      rollback: stage1Rollback,
      summary: stage1Summary.join('\n'),
      phase: 'schema-stage1',
      timestamp: Date.now(),
    });

    // Monitoring: Check NULL counts post-backfill, then apply NOT NULL (Stage 2)
    const stage2Statements: string[] = [];
    const stage2Summary: string[] = [];
    const stage2Applied: { schema: string; table: string; column: string }[] = [];
    for (const col of plan.missingColumns) {
      const fqCol = `${col.schema}.${col.table}.${col.column}`;
      const requiresNotNull = requiredNotNullSet.has(fqCol);
      const considerNotNull =
        requiresNotNull ||
        (heuristics.allowNotNullWhenDefault && !!col.defaultValue);

      if (!considerNotNull) {
        continue;
      }

      let nullCount = Number.NaN;
      const { data: qData, error: qErr } = await supabase.functions.invoke('execute-sql-external', {
        body: {
          action: 'query',
          connection: {
            host: connection.host,
            port: connection.port,
            database: connection.database,
            user: connection.user,
            password: connection.password,
            ssl: connection.ssl,
          },
          query: `SELECT COUNT(*)::bigint AS cnt FROM "${col.schema}"."${col.table}" WHERE "${col.column}" IS NULL`,
        },
      });
      if (qErr) {
        addLog('warn', `Heuristic check failed for ${fqCol}`, qErr.message || String(qErr));
        continue;
      }
      const qRes = qData as any;
      if (qRes?.success && Array.isArray(qRes?.data) && qRes.data.length > 0) {
        nullCount = Number(qRes.data[0]?.cnt ?? 0);
      } else {
        addLog('warn', `Heuristic query returned no data for ${fqCol}`);
        continue;
      }

      if (nullCount === 0 || (heuristics.allowNotNullWhenNoNulls && nullCount === 0)) {
        stage2Statements.push(
          `ALTER TABLE "${col.schema}"."${col.table}" ALTER COLUMN "${col.column}" SET NOT NULL;`
        );
        stage2Summary.push(`SET NOT NULL: ${fqCol} (nulls=${nullCount})`);
        stage2Applied.push({ schema: col.schema, table: col.table, column: col.column });
      } else if (requiresNotNull) {
        addLog('warn', `Required NOT NULL skipped due to ${nullCount} NULLs in ${fqCol}`);
      } else {
        addLog('info', `NOT NULL not applied: ${fqCol} (nulls=${nullCount})`);
      }
    }

    if (stage2Statements.length > 0) {
      addLog('info', 'Applying Stage 2 constraints', stage2Summary.join('\n'));
      const { data: execData2, error: execError2 } = await supabase.functions.invoke('execute-sql-external', {
        body: {
          action: 'execute',
          connection: {
            host: connection.host,
            port: connection.port,
            database: connection.database,
            user: connection.user,
            password: connection.password,
            ssl: connection.ssl,
          },
          statements: stage2Statements,
          options: {
            stopOnError: true,
            useTransaction: true,
            timeoutMs: 60000,
          },
        },
      });
      if (execError2) {
        addLog('error', 'Failed to apply Stage 2 constraints', execError2.message || String(execError2));
        throw execError2;
      }
      const execResult2 = execData2 as any;
      if (!execResult2?.success) {
        const message = execResult2?.message || 'Failed to apply Stage 2 constraints';
        addLog('error', 'Failed to apply Stage 2 constraints', message);
        throw new Error(message);
      }
      const stage2Rollback = stage2Applied.map(c => `ALTER TABLE "${c.schema}"."${c.table}" ALTER COLUMN "${c.column}" DROP NOT NULL;`);
      appliedChangesRef.current.push({
        forward: stage2Statements,
        rollback: stage2Rollback,
        summary: stage2Summary.join('\n'),
        phase: 'schema-stage2',
        timestamp: Date.now(),
      });
    }

    addLog('info', 'Schema alignment completed', `Applied ${stage1Statements.length} changes; ${stage2Statements.length} constraints`);

    const { data: verifyData, error: verifyError } = await supabase.functions.invoke('execute-sql-external', {
      body: {
        action: 'query',
        connection: {
          host: connection.host,
          port: connection.port,
          database: connection.database,
          user: connection.user,
          password: connection.password,
          ssl: connection.ssl,
        },
        query: `
          SELECT
            table_schema AS schema_name,
            table_name,
            column_name
          FROM information_schema.columns
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        `,
      },
    });

    if (verifyError) {
      addLog('error', 'Post-alignment schema verification failed', verifyError.message || String(verifyError));
      throw verifyError;
    }

    const verifyResult = verifyData as any;
    if (!verifyResult?.success) {
      const message = verifyResult?.message || 'Post-alignment schema verification failed';
      addLog('error', 'Post-alignment schema verification failed', message);
      throw new Error(message);
    }

    const verifyRows = Array.isArray(verifyResult.data) ? verifyResult.data : [];
    const verifyTargetColumns: TargetColumnInfo[] = verifyRows.map((r: any) => ({
      schema_name: r.schema_name || r.table_schema || 'public',
      table_name: r.table_name,
      column_name: r.column_name,
    }));

    const verifyPlan = buildMissingColumnAlterStatements(sourceSchemas, verifyTargetColumns);
    if (verifyPlan.missingColumns.length > 0) {
      const sample = verifyPlan.missingColumns.slice(0, 10).map(col => `${col.schema}.${col.table}.${col.column}`);
      const sampleList = sample.join(', ');
      addLog(
        'error',
        'Post-alignment schema verification failed',
        `Target database is still missing ${verifyPlan.missingColumns.length} column(s). Sample: ${sampleList}`
      );
      throw new Error('Schema verification failed: target database is still missing columns required by dump file');
    }

    addLog('success', 'Post-alignment schema verification passed', 'All required columns are present in target tables');
  }, [addLog]);

  const testConnection = useCallback(async (connection: ExternalDbConnection): Promise<ConnectionTestResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('execute-sql-external', {
        body: {
          action: 'test',
          connection: {
            host: connection.host,
            port: connection.port,
            database: connection.database,
            user: connection.user,
            password: connection.password,
            ssl: connection.ssl,
          },
        },
      });

      if (error) throw error;
      return data as ConnectionTestResult;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Connection test failed',
        code: 'CLIENT_ERROR',
        error: err.message,
      };
    }
  }, []);

      const executeStatements = useCallback(async (
    statements: string[],
    connection: ExternalDbConnection,
    options: ImportOptions,
    phase: ImportProgress['currentPhase'],
    phaseStats: { executed: number; failed: number }
  ): Promise<{ executed: number; failed: number; errors: ImportError[] }> => {
    let effectiveBatch = options.batchSize || 100;
    const adaptive = options.adaptiveBatching ?? { enabled: false };
    const minBatch = adaptive.minBatchSize ?? 50;
    const maxBatch = adaptive.maxBatchSize ?? 300;
    const targetLatency = adaptive.targetLatencyMs ?? 1200;
    const errorThreshold = adaptive.errorRateThreshold ?? 0.05;
    const retryAttempts = adaptive.retryAttempts ?? 0;
    const backoffMs = adaptive.backoffMs ?? 500;
    const batchSize = effectiveBatch;
    const newErrors: ImportError[] = [];
    let executed = 0;
    let failed = 0;
    let currentIndex = 0;
    let batchIndex = 0;

    while (currentIndex < statements.length) {
      // Check for pause/cancel
      while (pauseRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (cancelRef.current) {
        addLog('warn', 'Import cancelled by user');
        throw new Error('Import cancelled');
      }

      // Calculate estimated total batches dynamically based on current batch size
      const remaining = statements.length - currentIndex;
      const remainingBatches = Math.ceil(remaining / effectiveBatch);
      const estimatedTotalBatches = batchIndex + remainingBatches;

      const end = Math.min(currentIndex + effectiveBatch, statements.length);
        let batch = statements.slice(currentIndex, end);
        if (phase === 'data' && (options.disableConstraintsDuringData ?? false)) {
          const prep = [
            'SET CONSTRAINTS ALL DEFERRED;',
            'SET LOCAL session_replication_role = replica;',
          ];
          const post = [
            'SET CONSTRAINTS ALL IMMEDIATE;',
            'SET LOCAL session_replication_role = origin;',
          ];
          batch = [...prep, ...batch, ...post];
        }

      try {
        let attempt = 0;
        let lastError: any = null;
        let lastResult: any = null;
        do {
          const t0 = Date.now();
        const { data, error } = await supabase.functions.invoke('execute-sql-external', {
          body: {
            action: 'execute',
            connection: {
              host: connection.host,
              port: connection.port,
              database: connection.database,
              user: connection.user,
              password: connection.password,
              ssl: connection.ssl,
            },
            statements: batch,
            options: {
              stopOnError: options.stopOnFirstError,
              useTransaction: options.useTransactions,
              timeoutMs: 60000,
            },
          },
        });

          if (error) {
            lastError = error;
          } else {
            lastResult = data;
          }
          const t1 = Date.now();
          const latencyMs = t1 - t0;
          if (adaptive.enabled) {
            if (latencyMs > targetLatency && effectiveBatch > minBatch) {
              effectiveBatch = Math.max(minBatch, Math.floor(effectiveBatch * 0.8));
              addLog('info', 'Adaptive batching: decreased batch size', `latency=${latencyMs}ms, newBatch=${effectiveBatch}`);
            } else if (latencyMs < targetLatency * 0.6 && effectiveBatch < maxBatch) {
              effectiveBatch = Math.min(maxBatch, Math.ceil(effectiveBatch * 1.2));
              addLog('info', 'Adaptive batching: increased batch size', `latency=${latencyMs}ms, newBatch=${effectiveBatch}`);
            }
          }
          if (lastError && attempt < retryAttempts) {
            addLog('warn', `Retrying batch ${batchIndex + 1} (${phase}) due to transient error`, String(lastError));
            await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
            attempt++;
          } else {
            break;
          }
        } while (attempt <= retryAttempts);
        if (lastError) throw lastError;

        const result = lastResult as any;

        if (!result?.success) {
          const msg = result?.message || 'Remote execution failed';
          addLog('error', `Batch ${batchIndex + 1} failed: ${msg}`);
          
          // If no details are available, it's a connection/system error
          if (!result?.details) {
            if (options.stopOnFirstError) {
              throw new Error(msg);
            }
            failed += batch.length;
            failedBatchesRef.current.push({
              phase,
              batchIndex,
              statements: batch,
              failedCount: batch.length,
            });
            currentIndex = end;
            batchIndex++;
            continue;
          }
        }

        executed += result.details?.executed || 0;
        failed += result.details?.failed || 0;

        if (result.details?.errors) {
          const errList = result.details.errors as Array<{ index: number; statement: string; error: string }>;
          if (errList.length > 0) {
            const abortedErrors = errList.filter(e => e.error.includes('current transaction is aborted'));
            const fkErrors = errList.filter(e => /violates foreign key constraint/i.test(e.error));
            const rootErrors = errList.filter(
              e => !e.error.includes('current transaction is aborted')
            );
            const limit = 3;
            rootErrors.slice(0, limit).forEach(err => {
              const classification = classifyPgDumpError(err.error);
              addLog(
                'error',
                `Stmt ${err.index + 1} [${classification.severity.toUpperCase()} ${classification.code}]: ${err.error}`,
                `Statement: ${err.statement}`
              );
            });
            if (rootErrors.length > limit) {
              addLog('error', `...and ${rootErrors.length - limit} more specific errors`);
            }
            if (fkErrors.length > 0) {
              const sample = fkErrors[0];
              addLog(
                'error',
                'Detected foreign key violations while inserting data',
                sample.error
              );
              if (phase === 'data' && options.useTransactions) {
                addLog(
                  'warn',
                  'Data batch rolled back due to foreign key violations',
                  'Review parent/child table ordering and source data integrity, then re-run import'
                );
              }
            }
            if (abortedErrors.length > 0) {
              addLog(
                'warn',
                `${abortedErrors.length} statements failed because the transaction was aborted by a previous error.`
              );
            }
            if (rootErrors.length === 0 && abortedErrors.length === 0) {
              errList.slice(0, 3).forEach(err => {
                const classification = classifyPgDumpError(err.error);
                addLog(
                  'error',
                  `Stmt ${err.index + 1} [${classification.severity.toUpperCase()} ${classification.code}]: ${err.error}`
                );
              });
            }
          }

          for (const err of errList) {
            const classification = classifyPgDumpError(err.error);
            newErrors.push({
              index: currentIndex + err.index,
              statement: err.statement,
              error: err.error,
              timestamp: Date.now(),
              phase,
              category: classification.category,
              severity: classification.severity,
              code: classification.code,
            });
          }
          
          if (adaptive.enabled) {
            const errorRate = (result.details?.failed || 0) / Math.max(1, (result.details?.executed || 0) + (result.details?.failed || 0));
            if (errorRate > errorThreshold && effectiveBatch > minBatch) {
              effectiveBatch = Math.max(minBatch, Math.floor(effectiveBatch * 0.7));
              addLog('warn', 'Adaptive batching: reduced due to error rate', `errorRate=${(errorRate*100).toFixed(1)}%, newBatch=${effectiveBatch}`);
            }
          }

          failedBatchesRef.current.push({
            phase,
            batchIndex,
            statements: batch,
            failedCount: result.details?.failed ?? batch.length,
          });
        }

        if (!result?.success && options.stopOnFirstError) {
          throw new Error(result?.message || 'Remote execution failed');
        }

        // Update progress
        const elapsed = Date.now() - startTimeRef.current;
        const statementsPerMs = (phaseStats.executed + executed) / Math.max(1, elapsed);
        const remainingStmts = statements.length - end;
        
        setProgress(prev => prev ? {
          ...prev,
          currentBatch: batchIndex + 1,
          totalBatches: estimatedTotalBatches,
          statementsExecuted: prev.statementsExecuted + (result.details?.executed || 0),
          statementsFailed: prev.statementsFailed + (result.details?.failed || 0),
          currentPhase: phase,
          elapsedMs: elapsed,
          estimatedRemainingMs: statementsPerMs > 0 ? remainingStmts / statementsPerMs : 0,
        } : null);

        addLog('info', `Batch ${batchIndex + 1}/${estimatedTotalBatches} completed (${phase})`, 
          `${result.details?.executed || 0} executed, ${result.details?.failed || 0} failed`);

        if (options.enableCheckpoint) {
          saveCheckpoint(phase, batchIndex + 1, estimatedTotalBatches);
          await persistCheckpoint(phase, batchIndex + 1, estimatedTotalBatches);
        }
      } catch (err: any) {
        const sample = batch[0] || '';
        const details = sample
          ? `Error: ${err.message}; Sample statement: ${sample.slice(0, 500)}`
          : err.message || 'Unknown error';
        addLog(
          'error',
          `Batch ${batchIndex + 1}/${estimatedTotalBatches} failed (${phase})`,
          details
        );
        
        if (options.stopOnFirstError) {
          throw err;
        }
        
        failed += batch.length;
        failedBatchesRef.current.push({
          phase,
          batchIndex,
          statements: batch,
          failedCount: batch.length,
        });
        if (adaptive.enabled && effectiveBatch > minBatch) {
          effectiveBatch = Math.max(minBatch, Math.floor(effectiveBatch * 0.6));
          addLog('warn', 'Adaptive batching: aggressive reduction after failure', `newBatch=${effectiveBatch}`);
        }
      }
      
      currentIndex = end;
      batchIndex++;
    }

    return { executed, failed, errors: newErrors };
  }, [addLog]);

  const verifyIntegrity = useCallback(async (
    connection: ExternalDbConnection,
    parsed: ParsedSqlFile
  ) => {
    setIsVerifying(true);
    setVerificationResults([]);
    addLog('info', 'Starting integrity verification');

    try {
      const results: VerificationResult[] = [];
      const tables = Object.entries(parsed.metadata.rowCountByTable || {});
      const tableKeys = new Set(tables.map(([key]) => key));

      // 1. Get Actual Row Counts and Checksums
      // Process in chunks of 5 to avoid overwhelming the connection
      for (let i = 0; i < tables.length; i += 5) {
        const batch = tables.slice(i, i + 5);
        await Promise.all(batch.map(async ([key, expected]) => {
          const parts = key.split('.');
          const schema = parts.length > 1 ? parts[0] : 'public';
          const table = parts.length > 1 ? parts[1] : parts[0];
          
          try {
            // Combined query for count and checksum (limit 50 sample for checksum)
            const query = `
              WITH sample AS (
                SELECT t.*::text as row_text 
                FROM "${schema}"."${table}" t 
                LIMIT 50
              )
              SELECT 
                (SELECT count(*) FROM "${schema}"."${table}") as c,
                (SELECT md5(string_agg(row_text, '')) FROM sample) as chk
            `;

            const { data, error } = await supabase.functions.invoke('execute-sql-external', {
              body: {
                action: 'query',
                connection: {
                  host: connection.host,
                  port: connection.port,
                  database: connection.database,
                  user: connection.user,
                  password: connection.password,
                  ssl: connection.ssl,
                },
                query: query
              }
            });
            
            if (error) throw error;
            const row = data?.[0];
            const actual = parseInt(row?.c || '0', 10);
            const checksum = row?.chk || undefined;
            
            results.push({
              table: key,
              expected,
              actual,
              match: expected === actual,
              checksum
            });
          } catch (err: any) {
            addLog('error', `Failed to verify count for ${key}`, err.message);
            results.push({
              table: key,
              expected,
              actual: -1,
              match: false
            });
          }
        }));
      }

      // 2. FK Integrity Sweep
      addLog('info', 'Checking foreign key constraints...');
      
      const schemas = new Set(tables.map(([key]) => {
         const parts = key.split('.');
         return parts.length > 1 ? parts[0] : 'public';
      }));
      const schemaList = Array.from(schemas).map(s => `'${s}'`).join(',');
      
      if (schemaList) {
        const fkQuery = `
          SELECT
              tc.table_schema,
              tc.table_name,
              kcu.column_name,
              ccu.table_schema AS foreign_table_schema,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name,
              tc.constraint_name
          FROM
              information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema IN (${schemaList})
        `;

        const { data: fks, error: fkError } = await supabase.functions.invoke('execute-sql-external', {
          body: {
            action: 'query',
            connection: {
               host: connection.host,
               port: connection.port,
               database: connection.database,
               user: connection.user,
               password: connection.password,
               ssl: connection.ssl,
            },
            query: fkQuery
          }
        });

        if (fkError) {
          addLog('warn', 'Failed to fetch FK constraints for verification', fkError.message);
        } else if (fks) {
          // Filter FKs for tables we care about
          const relevantFks = fks.filter((fk: any) => {
            const key = `${fk.table_schema}.${fk.table_name}`;
            const keyNoSchema = fk.table_name;
            return tableKeys.has(key) || tableKeys.has(keyNoSchema);
          });

          for (const fk of relevantFks) {
             const tableKey = `${fk.table_schema}.${fk.table_name}`;
             const resIndex = results.findIndex(r => r.table === tableKey || r.table === fk.table_name);
             if (resIndex === -1 || results[resIndex].actual <= 0) continue;

             const q = `
               SELECT count(*) as c
               FROM "${fk.table_schema}"."${fk.table_name}" t
               WHERE "${fk.column_name}" IS NOT NULL
               AND NOT EXISTS (
                 SELECT 1 FROM "${fk.foreign_table_schema}"."${fk.foreign_table_name}" f
                 WHERE f."${fk.foreign_column_name}" = t."${fk.column_name}"
               )
             `;
             
             try {
               const { data: orphanData, error: orphanError } = await supabase.functions.invoke('execute-sql-external', {
                 body: {
                   action: 'query',
                   connection: {
                      host: connection.host,
                      port: connection.port,
                      database: connection.database,
                      user: connection.user,
                      password: connection.password,
                      ssl: connection.ssl,
                   },
                   query: q
                 }
               });
               
               if (!orphanError && orphanData?.[0]) {
                 const count = parseInt(orphanData[0].c, 10);
                 if (count > 0) {
                   const existing = results[resIndex].orphanCheck;
                   results[resIndex].orphanCheck = {
                     hasOrphans: true,
                     orphanCount: (existing?.orphanCount || 0) + count,
                     constraintName: existing?.constraintName 
                        ? `${existing.constraintName}, ${fk.constraint_name}` 
                        : fk.constraint_name
                   };
                   
                   addLog('warn', `Integrity violation in ${tableKey}`, `${count} orphans found for ${fk.constraint_name}`);
                 }
               }
             } catch (e) {
               console.error('Orphan check failed', e);
             }
          }
        }
      }

      setVerificationResults(results);
      addLog('success', 'Verification completed');
    } catch (err: any) {
      addLog('error', 'Verification failed', err.message || String(err));
    } finally {
      setIsVerifying(false);
    }
  }, [addLog]);

  const startImport = useCallback(async (
    parsed: ParsedSqlFile,
    connection: ExternalDbConnection,
    options: ImportOptions
  ) => {
    setStatus('validating');
    setErrors([]);
    setLogs([]);
    setSummary(null);
    pauseRef.current = false;
    cancelRef.current = false;
    startTimeRef.current = Date.now();
    operationIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await validateAndPrepareSchema(parsed, connection, options);
    } catch (err: any) {
      setStatus('failed');
      addLog('error', 'Schema validation failed', err.message || String(err));
      return;
    }

    setStatus('executing');

    const phaseStats = {
      schema: { executed: 0, failed: 0 },
      data: { executed: 0, failed: 0 },
      constraints: { executed: 0, failed: 0 },
      indexes: { executed: 0, failed: 0 },
      functions: { executed: 0, failed: 0 },
      policies: { executed: 0, failed: 0 },
    };

    const phaseExecutions: Array<{
      name: ImportProgress['currentPhase'];
      startTime: number;
      endTime: number;
      executed: number;
      failed: number;
    }> = [];

    // Calculate total statements
    const totalStatements = 
      parsed.schemaStatements.length +
      parsed.tableStatements.length +
      parsed.dataStatements.length +
      parsed.constraintStatements.length +
      parsed.indexStatements.length +
      parsed.functionStatements.length +
      parsed.policyStatements.length +
      parsed.triggerStatements.length +
      parsed.sequenceStatements.length;

    if (parsed.dataStatements.length === 0 && parsed.metadata.estimatedRowCount > 0) {
      addLog(
        'warn',
        'No data statements detected in parsed SQL',
        `Estimated rows from file: ${parsed.metadata.estimatedRowCount}`
      );
    } else {
      addLog('info', 'Data statements detected', `Count: ${parsed.dataStatements.length}`);
    }

    setProgress({
      currentBatch: 0,
      totalBatches: Math.ceil(totalStatements / options.batchSize),
      statementsExecuted: 0,
      statementsFailed: 0,
      totalStatements,
      currentPhase: 'schema',
      elapsedMs: 0,
      estimatedRemainingMs: 0,
      bytesProcessed: 0,
      totalBytes: parsed.metadata.fileSizeBytes,
    });

    addLog('info', 'Starting import', `${totalStatements} statements to execute`);

    try {
      let phases: Array<{ name: ImportProgress['currentPhase']; statements: string[] }> = [];

      const reorderDataStatements = (stmts: string[]): string[] => {
        const extractTarget = (s: string): string | null => {
          // Fixed regex to handle optional quotes and schema
          const m = s.match(/INSERT\s+INTO\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?/i);
          if (m) {
            const schema = (m[1] || 'public').toLowerCase();
            const table = (m[2] || '').toLowerCase();
            return `${schema}.${table}`;
          }
          return null;
        };
        const priority: string[] = [
          'auth.users',
          'public.tenants',
          'public.profiles',
          'public.accounts',
          'public.contacts',
          'public.leads',
          'public.opportunities',
          'public.queues',
          'public.queue_members',
          'public.email_accounts',
          'public.emails',
          'public.activities',
          'public.segment_members',
        ];
        const buckets = new Map<string, string[]>();
        const rest: string[] = [];
        const tables = new Set<string>();
        for (const s of stmts) {
          const ref = extractTarget(s);
          if (ref) {
            tables.add(ref);
            if (!buckets.has(ref)) buckets.set(ref, []);
            buckets.get(ref)!.push(s);
          } else {
            rest.push(s);
          }
        }
        const deps = new Map<string, Set<string>>();
        const childrenByParent = new Map<string, Set<string>>();
        const missingTableEdges = new Set<string>();
        const addEdge = (child: string, parent: string) => {
          if (!tables.has(child) || !tables.has(parent)) return;
          if (!deps.has(child)) deps.set(child, new Set());
          deps.get(child)!.add(parent);
          if (!childrenByParent.has(parent)) childrenByParent.set(parent, new Set());
          childrenByParent.get(parent)!.add(child);
        };
        let edgeCount = 0;
        let totalFkEdges = 0;
        let usedFkEdges = 0;
        const fkRegex =
          /ALTER\s+TABLE\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?[\s\S]*?FOREIGN\s+KEY\s*\([^)]+\)\s+REFERENCES\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"/gi;
        for (const stmt of parsed.constraintStatements) {
          let m: RegExpExecArray | null;
          while ((m = fkRegex.exec(stmt)) !== null) {
            totalFkEdges++;
            const childSchema = (m[1] || 'public').toLowerCase();
            const childTable = (m[2] || '').toLowerCase();
            const parentSchema = (m[3] || 'public').toLowerCase();
            const parentTable = (m[4] || '').toLowerCase();
            if (!childTable || !parentTable) continue;
            const childRef = `${childSchema}.${childTable}`;
            const parentRef = `${parentSchema}.${parentTable}`;
            if (childRef === parentRef) continue;
            if (!tables.has(childRef) || !tables.has(parentRef)) {
              missingTableEdges.add(`${childRef} -> ${parentRef}`);
              continue;
            }
            addEdge(childRef, parentRef);
            edgeCount++;
            usedFkEdges++;
          }
        }
        if (totalFkEdges > 0) {
          addLog(
            'info',
            'Analyzed foreign key relationships for data ordering',
            `edges=${totalFkEdges}, applied=${usedFkEdges}, missingTables=${missingTableEdges.size}`
          );
          if (missingTableEdges.size > 0) {
            const sample = Array.from(missingTableEdges).slice(0, 20);
            addLog(
              'warn',
              'Some foreign key relationships reference tables without data statements',
              sample.join('; ')
            );
          }
        }
        const tableList = Array.from(tables);
        const indegree = new Map<string, number>();
        for (const t of tableList) {
          indegree.set(t, 0);
        }
        for (const [child, parents] of deps) {
          for (const parent of parents) {
            if (!indegree.has(child)) continue;
            indegree.set(child, (indegree.get(child) || 0) + 1);
          }
        }
        const orderedTables: string[] = [];
        if (edgeCount > 0) {
          const priorityIndex = new Map<string, number>();
          priority.forEach((name, idx) => {
            priorityIndex.set(name, idx);
          });
          const queue: string[] = [];
          for (const [t, deg] of indegree) {
            if (deg === 0) {
              queue.push(t);
            }
          }
          queue.sort((a, b) => {
            const pa = priorityIndex.has(a) ? priorityIndex.get(a)! : Number.MAX_SAFE_INTEGER;
            const pb = priorityIndex.has(b) ? priorityIndex.get(b)! : Number.MAX_SAFE_INTEGER;
            if (pa !== pb) return pa - pb;
            return a.localeCompare(b);
          });
          const seen = new Set<string>();
          while (queue.length > 0) {
            const t = queue.shift()!;
            if (seen.has(t)) continue;
            seen.add(t);
            orderedTables.push(t);
            const children = childrenByParent.get(t);
            if (children) {
              for (const child of children) {
                if (!indegree.has(child)) continue;
                const d = (indegree.get(child) || 0) - 1;
                indegree.set(child, d);
                if (d === 0) {
                  queue.push(child);
                }
              }
              queue.sort((a, b) => {
                const pa = priorityIndex.has(a) ? priorityIndex.get(a)! : Number.MAX_SAFE_INTEGER;
                const pb = priorityIndex.has(b) ? priorityIndex.get(b)! : Number.MAX_SAFE_INTEGER;
                if (pa !== pb) return pa - pb;
                return a.localeCompare(b);
              });
            }
          }
          if (orderedTables.length !== tableList.length) {
            const unresolved = tableList.filter(t => !orderedTables.includes(t));
            if (unresolved.length > 0) {
              addLog(
                'warn',
                'Foreign key dependency graph not fully resolved for data reordering',
                `unresolvedTables=${unresolved.join(', ')}`
              );
            }
          }
        }
        if (orderedTables.length === 0) {
          const presentPriority = priority.filter(ref => buckets.has(ref));
          const remaining = tableList.filter(ref => !presentPriority.includes(ref));
          orderedTables.push(...presentPriority, ...remaining);
        }
        const ordered: string[] = [];
        for (const ref of orderedTables) {
          const b = buckets.get(ref);
          if (b && b.length > 0) ordered.push(...b);
        }
        ordered.push(...rest);
        return ordered;
      };

      const filterCopyFromStdin = (stmts: string[]) => {
        const copyRegex = /^\s*COPY\s+.+\s+FROM\s+STDIN;/i;
        const filtered = stmts.filter(s => !copyRegex.test(s));
        if (filtered.length < stmts.length) {
          const skipped = stmts.length - filtered.length;
          addLog(
            'warn',
            'Skipping COPY FROM STDIN statements',
            `${skipped} COPY block(s) will be skipped; re-export using INSERT format (pg_dump --inserts) or the built-in export tool to import data rows.`
          );
        }
        return filtered;
      };

      if (options.executionOrder === 'schema-first') {
        phases = [
          { name: 'schema', statements: [...parsed.schemaStatements, ...parsed.tableStatements, ...parsed.sequenceStatements] },
          { name: 'data', statements: filterCopyFromStdin(options.dataReorderHeuristics ? reorderDataStatements(parsed.dataStatements) : parsed.dataStatements) },
          { name: 'constraints', statements: parsed.constraintStatements },
          { name: 'indexes', statements: parsed.indexStatements },
          { name: 'functions', statements: [...parsed.functionStatements, ...parsed.triggerStatements] },
          { name: 'policies', statements: parsed.policyStatements },
        ];
      } else if (options.executionOrder === 'data-first') {
        phases = [
          { name: 'schema', statements: [...parsed.schemaStatements, ...parsed.tableStatements, ...parsed.sequenceStatements] },
          { name: 'data', statements: filterCopyFromStdin(options.dataReorderHeuristics ? reorderDataStatements(parsed.dataStatements) : parsed.dataStatements) },
          { name: 'indexes', statements: parsed.indexStatements },
          { name: 'constraints', statements: parsed.constraintStatements },
          { name: 'functions', statements: [...parsed.functionStatements, ...parsed.triggerStatements] },
          { name: 'policies', statements: parsed.policyStatements },
        ];
      } else {
        phases = [
          { name: 'other', statements: parsed.statements },
        ];
      }

      const filterAuthSchemaDDL = (stmts: string[]) =>
        stmts.filter(s => {
          const upper = s.toUpperCase();
          if (!/\bCREATE\b|\bALTER\b|\bDROP\b/.test(upper)) return true;
          if (/"auth"\./i.test(s) || /\bauth\./i.test(s)) return false;
          return true;
        });

      const cfgDrop = options.dropIfExistsConfig;
      const safeSchemas = cfgDrop?.safeSchemas && cfgDrop.safeSchemas.length > 0 ? cfgDrop.safeSchemas : ['public'];
      const allowDrop = cfgDrop?.allowSchemaDrop ?? false;
      const cascade = cfgDrop?.cascade ?? false;

      const rewriteDropStatements = (stmts: string[]) =>
        stmts.map(s => {
          const upper = s.toUpperCase();
          if (!/\bDROP\s+(TABLE|INDEX|SEQUENCE|VIEW)\b/.test(upper)) return s;

          const m = /DROP\s+(TABLE|INDEX|SEQUENCE|VIEW)\s+(IF\s+EXISTS\s+)?("?[A-Za-z0-9_]+"?)\.\s*("?[A-Za-z0-9_]+"?)/i.exec(s);
          if (!m) return s;

          const objectType = m[1].toLowerCase();
          const hasIfExists = !!m[2];
          const schemaRaw = m[3];
          const nameRaw = m[4];

          const schemaName = schemaRaw.replace(/^"|"$/g, '');
          const isSafeSchema = safeSchemas.includes(schemaName);

          if (!allowDrop || !isSafeSchema) {
            return s;
          }

          const qualified = `${schemaRaw}.${nameRaw}`;
          const baseKeyword = objectType === 'index' ? 'DROP INDEX' : `DROP ${objectType.toUpperCase()}`;
          const ifExistsPart = hasIfExists ? 'IF EXISTS ' : 'IF EXISTS ';
          const cascadePart = cascade ? ' CASCADE' : '';

          return `${baseKeyword} ${ifExistsPart}${qualified}${cascadePart};`;
        });
      for (const phase of phases) {
        const before = phase.statements.length;
        const filteredRaw =
          phase.name === 'data' ? phase.statements : filterAuthSchemaDDL(phase.statements);
        const filtered = rewriteDropStatements(filteredRaw);
        if (filtered.length < before) {
          addLog('warn', `Filtered auth schema DDL in phase ${phase.name}`, `${before - filtered.length} statements skipped`);
        }
        phase.statements = filtered;
      }

      const ownershipStatements: string[] = [];
      const filterOwnershipSensitive = (stmts: string[]) =>
        stmts.filter(s => {
          const referencesAudit = /(?:"audit_log_entries"|\baudit_log_entries\b)/i.test(s);
          const isOwnership =
            /\bALTER\s+TABLE\b[\s\S]*\bOWNER\s+TO\b/i.test(s) ||
            /\bCOMMENT\s+ON\s+TABLE\b/i.test(s) ||
            /\bGRANT\b/i.test(s) ||
            /\bREVOKE\b/i.test(s) ||
            /\bALTER\s+TABLE\b[\s\S]*\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(s) ||
            /\bALTER\s+TABLE\b[\s\S]*\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(s);
          if (referencesAudit || isOwnership) {
            ownershipStatements.push(s);
            return false;
          }
          return true;
        });
      for (const phase of phases) {
        const before = phase.statements.length;
        phase.statements = filterOwnershipSensitive(phase.statements);
        const after = phase.statements.length;
        if (after < before) {
          addLog('warn', `Filtered ownership-sensitive statements in phase ${phase.name}`, `${before - after} statements skipped`);
        }
      }

      const sanitizeTypes = (stmts: string[]) =>
        stmts.map(s =>
          s
            .replace(/\bUSER-DEFINED\b/gi, 'text')
            .replace(/\bARRAY\b(?!\[)/gi, 'text[]')
        );
      for (const phase of phases) {
        const sanitized = sanitizeTypes(phase.statements);
        if (sanitized.some((v, i) => v !== phase.statements[i])) {
          addLog('info', `Sanitized type placeholders in phase ${phase.name}`);
          phase.statements = sanitized;
        }
      }

      const rewriteInsertOnConflict = (stmts: string[], mode: ImportOptions['onConflict']) =>
        rewriteInsertsWithOnConflict(stmts, mode, conflictTargetsRef.current, options.onConflictOverrides);

      for (const phase of phases) {
        const before = phase.statements.length;
        const rewritten = rewriteInsertOnConflict(phase.statements, options.onConflict);
        if (rewritten.some((v, i) => v !== phase.statements[i])) {
          const rewrittenCount = rewritten.filter((v, i) => v !== phase.statements[i]).length;
          const modeText =
            options.onConflict === 'skip'
              ? 'ON CONFLICT DO NOTHING'
              : options.onConflict === 'update'
                ? 'ON CONFLICT DO UPDATE'
                : 'ON CONFLICT handling';
          addLog('info', `Applied ${modeText} to INSERT statements`, `Rewrote ${rewrittenCount} statements in phase ${phase.name}`);
          phase.statements = rewritten;
        }
      }

      if (options.resumeFrom) {
        const targetIndex = phases.findIndex(p => p.name === options.resumeFrom!.phase);
        if (targetIndex >= 0) {
          for (let i = 0; i < targetIndex; i++) {
            phases[i].statements = [];
          }
          const skipCount = (options.batchSize || 100) * Math.max(0, options.resumeFrom!.batchIndex);
          phases[targetIndex].statements = phases[targetIndex].statements.slice(skipCount);
          addLog('info', 'Resuming import from checkpoint', `phase=${options.resumeFrom.phase}, batchIndex=${options.resumeFrom.batchIndex}`);
        }
      }

      const allErrors: ImportError[] = [];

      for (const phase of phases) {
        if (phase.statements.length === 0) continue;

        const phaseStart = Date.now();

        addLog('info', `Starting phase: ${phase.name}`, `${phase.statements.length} statements`);
        if (phase.name === 'data' && options.dataReorderHeuristics) {
          addLog('info', 'Data reordering applied', 'Heuristic ordering enabled (parents before children)');
        }

        let result: { executed: number; failed: number; errors: ImportError[] };
        if (phase.name === 'data' && (options.concurrency ?? 1) > 1) {
          const workers = Math.max(1, options.concurrency ?? 1);
          const per = Math.ceil(phase.statements.length / workers);
          const slices: string[][] = [];
          for (let i = 0; i < phase.statements.length; i += per) {
            slices.push(phase.statements.slice(i, i + per));
          }
          const results = await Promise.all(
            slices.map(stmts =>
              executeStatements(
                stmts,
                connection,
                options,
                phase.name,
                { executed: 0, failed: 0 }
              )
            )
          );
          result = results.reduce(
            (acc, r) => ({
              executed: acc.executed + r.executed,
              failed: acc.failed + r.failed,
              errors: acc.errors.concat(r.errors),
            }),
            { executed: 0, failed: 0, errors: [] as ImportError[] }
          );
          addLog('info', 'Parallel data import enabled', `Concurrency: ${workers}, slices: ${slices.length}`);
        } else {
          result = await executeStatements(
            phase.statements,
            connection,
            options,
            phase.name,
            phaseStats[phase.name as keyof typeof phaseStats] || { executed: 0, failed: 0 }
          );
        }

        const phaseEnd = Date.now();

        if (phaseStats[phase.name as keyof typeof phaseStats]) {
          phaseStats[phase.name as keyof typeof phaseStats] = {
            executed: result.executed,
            failed: result.failed,
          };
        }

        phaseExecutions.push({
          name: phase.name,
          startTime: phaseStart,
          endTime: phaseEnd,
          executed:
            phaseStats[phase.name as keyof typeof phaseStats]?.executed ?? result.executed,
          failed:
            phaseStats[phase.name as keyof typeof phaseStats]?.failed ?? result.failed,
        });

        allErrors.push(...result.errors);

        const phaseSeconds = Math.round((phaseEnd - phaseStart) / 1000);

        addLog(
          result.failed > 0 ? 'warn' : 'success',
          `Phase ${phase.name} completed in ${phaseSeconds}s`,
          `${result.executed} executed, ${result.failed} failed`
        );
      }

      try {
        const { data: fkData, error: fkError } = await supabase.functions.invoke('execute-sql-external', {
          body: {
            action: 'query',
            connection: {
              host: connection.host,
              port: connection.port,
              database: connection.database,
              user: connection.user,
              password: connection.password,
              ssl: connection.ssl,
            },
            query: `
              SELECT
                (SELECT COUNT(*)::numeric FROM public.leads l
                  LEFT JOIN public.profiles p ON l.owner_id = p.id
                  WHERE l.owner_id IS NOT NULL AND p.id IS NULL) AS leads_missing_owners,
                (SELECT COUNT(*)::numeric FROM public.leads WHERE owner_id IS NOT NULL) AS total_leads_with_owner,
                (SELECT COUNT(*)::numeric FROM public.activities a
                  LEFT JOIN public.leads l2 ON a.lead_id = l2.id
                  WHERE a.lead_id IS NOT NULL AND l2.id IS NULL) AS activities_missing_leads,
                (SELECT COUNT(*)::numeric FROM public.activities WHERE lead_id IS NOT NULL) AS total_activities_with_lead
            `,
          },
        });
        if (fkError) {
          addLog(
            'warn',
            'Post-import foreign key verification failed',
            fkError.message || String(fkError)
          );
        } else {
          type FkVerificationRow = {
            leads_missing_owners?: number | string | null;
            total_leads_with_owner?: number | string | null;
            activities_missing_leads?: number | string | null;
            total_activities_with_lead?: number | string | null;
          };
          type FkVerificationResult = {
            success?: boolean;
            message?: string;
            data?: unknown;
          };
          const result = (fkData as FkVerificationResult) || {};
          if (!result.success) {
            addLog(
              'warn',
              'Post-import foreign key verification failed',
              result.message || 'Unknown error'
            );
          } else {
            const rows = Array.isArray(result.data) ? (result.data as FkVerificationRow[]) : [];
            const row: FkVerificationRow = rows[0] || {};
            const leadsMissingOwners = Number(row.leads_missing_owners ?? 0);
            const totalLeadsWithOwner = Number(row.total_leads_with_owner ?? 0);
            const activitiesMissingLeads = Number(row.activities_missing_leads ?? 0);
            const totalActivitiesWithLead = Number(row.total_activities_with_lead ?? 0);
            if (leadsMissingOwners > 0 || activitiesMissingLeads > 0) {
              addLog(
                'warn',
                'Post-import FK verification found orphan references',
                `leads.owner_id: ${leadsMissingOwners}/${totalLeadsWithOwner}; activities.lead_id: ${activitiesMissingLeads}/${totalActivitiesWithLead}`
              );
            } else {
              addLog(
                'success',
                'Post-import FK verification passed for leads.owner_id and activities.lead_id'
              );
            }
          }
        }
      } catch (fkCheckErr: unknown) {
        const msg = fkCheckErr instanceof Error ? fkCheckErr.message : String(fkCheckErr);
        addLog(
          'warn',
          'Post-import foreign key verification encountered an unexpected error',
          msg
        );
      }

      setErrors(allErrors);

      const endTime = Date.now();
      const totalExecuted = Object.values(phaseStats).reduce((sum, p) => sum + p.executed, 0);
      const totalFailed = Object.values(phaseStats).reduce((sum, p) => sum + p.failed, 0);
      const metrics = buildImportMetrics(startTimeRef.current, endTime, phaseExecutions);

      const importSummary: ImportSummary = {
        status: totalFailed === 0 ? 'success' : totalExecuted > 0 ? 'partial' : 'failed',
        startTime: startTimeRef.current,
        endTime,
        duration: endTime - startTimeRef.current,
        statementsExecuted: totalExecuted,
        statementsFailed: totalFailed,
        errors: allErrors,
        phases: phaseStats,
        metrics,
      };

      setSummary(importSummary);
      setStatus('completed');
      addLog('success', 'Import completed', 
        `${totalExecuted} statements executed, ${totalFailed} failed in ${Math.round((endTime - startTimeRef.current) / 1000)}s`
      );

      if (ownershipStatements.length > 0 && (options.postImportOwnershipEnabled ?? false)) {
        const subset = (options.postImportOwnershipTables ?? []).map(s => s.toLowerCase());
        const extractTableRef = (s: string): string | null => {
          const alterMatch = s.match(/ALTER\s+TABLE\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?/i);
          const commentMatch = s.match(/COMMENT\s+ON\s+TABLE\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?/i);
          const grantMatch = s.match(/\bON\s+TABLE\s+(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?/i);
          const m = alterMatch || commentMatch || grantMatch;
          if (m) {
            const schema = (m[1] || 'public').toLowerCase();
            const table = (m[2] || '').toLowerCase();
            return `${schema}.${table}`;
          }
          return null;
        };
        const selected = subset.length === 0
          ? ownershipStatements
          : ownershipStatements.filter(s => {
              const ref = extractTableRef(s);
              return ref ? subset.includes(ref) : false;
            });

        if (selected.length === 0) {
          addLog('warn', 'Skipping post-import ownership changes', 'No statements matched selected tables');
        } else {
        const privUser = (import.meta as any).env?.VITE_POST_IMPORT_DB_USER;
        const privPassword = (import.meta as any).env?.VITE_POST_IMPORT_DB_PASSWORD;
        if (privUser && privPassword) {
          addLog('info', 'Starting post-import ownership changes', `${selected.length} statements`);
          const { data: ownData, error: ownErr } = await supabase.functions.invoke('execute-sql-external', {
            body: {
              action: 'execute',
              connection: {
                host: connection.host,
                port: connection.port,
                database: connection.database,
                user: privUser,
                password: privPassword,
                ssl: connection.ssl,
              },
              statements: selected,
              options: {
                stopOnError: true,
                useTransaction: true,
                timeoutMs: 60000,
              },
            },
          });
          if (ownErr) {
            addLog('error', 'Post-import ownership changes failed', ownErr.message || String(ownErr));
          } else {
            const ownResult = ownData as any;
            if (ownResult?.success) {
              addLog('success', 'Post-import ownership changes applied', `${selected.length} statements`);
            } else {
              addLog('error', 'Post-import ownership changes failed', ownResult?.message || 'Unknown error');
            }
          }
        } else {
          addLog('warn', 'Skipping post-import ownership changes', 'Privileged DB credentials not configured');
        }
        }
      }
    } catch (err: any) {
      if (err.message === 'Import cancelled') {
        setStatus('cancelled');
      } else {
        setStatus('failed');
        addLog('error', 'Import failed', err.message);
      }
    }
  }, [addLog, executeStatements]);

  const pauseImport = useCallback(() => {
    pauseRef.current = true;
    setStatus('paused');
    addLog('info', 'Import paused');
  }, [addLog]);

  const resumeImport = useCallback(() => {
    pauseRef.current = false;
    setStatus('executing');
    addLog('info', 'Import resumed');
  }, [addLog]);

  const cancelImport = useCallback(() => {
    cancelRef.current = true;
    pauseRef.current = false;
    addLog('warn', 'Cancelling import...');
  }, [addLog]);

  const rerunFailedBatches = useCallback(async (connection: ExternalDbConnection) => {
    const failed = [...failedBatchesRef.current];
    if (failed.length === 0) {
      addLog('info', 'No failed batches to re-run');
      return;
    }

    addLog('info', `Re-running ${failed.length} failed batches`);

    const stillFailed: typeof failed = [];
    let recoveredBatches = 0;
    let recoveredStatements = 0;
    const phaseDeltas: Partial<Record<ImportProgress['currentPhase'], number>> = {};

    for (const fb of failed) {
      try {
        const { data, error } = await supabase.functions.invoke('execute-sql-external', {
          body: {
            action: 'execute',
            connection: {
              host: connection.host,
              port: connection.port,
              database: connection.database,
              user: connection.user,
              password: connection.password,
              ssl: connection.ssl,
            },
            statements: fb.statements,
            options: {
              stopOnError: false,
              useTransaction: true,
              timeoutMs: 60000,
            },
          },
        });

        if (error) {
          throw error;
        }

        const result = data as any;
        if (!result?.success) {
          throw new Error(result?.message || 'Re-run failed');
        }

        if (result.details?.failed > 0) {
          throw new Error(`Batch re-run had ${result.details.failed} failed statements`);
        }

        const recoveredForBatch = fb.failedCount ?? fb.statements.length;
        recoveredBatches++;
        recoveredStatements += recoveredForBatch;
        phaseDeltas[fb.phase] = (phaseDeltas[fb.phase] ?? 0) + recoveredForBatch;

        addLog(
          'success',
          `Re-ran failed batch ${fb.batchIndex + 1} (${fb.phase})`,
          `${recoveredForBatch} statements recovered`
        );
      } catch (err: any) {
        addLog(
          'error',
          `Failed to re-run batch ${fb.batchIndex + 1} (${fb.phase})`,
          err?.message || String(err)
        );
        stillFailed.push(fb);
      }
    }

    failedBatchesRef.current = stillFailed;

    if (recoveredStatements > 0) {
      addLog(
        'success',
        `Recovered ${recoveredStatements} statements across ${recoveredBatches} batches. ${stillFailed.length} batches still failing.`
      );

      setSummary(prev => {
        if (!prev) return prev;

        const updatedPhases = { ...prev.phases };
        (Object.entries(phaseDeltas) as [ImportProgress['currentPhase'], number][]).forEach(
          ([phase, delta]) => {
            const key = phase as keyof typeof updatedPhases;
            const existing = updatedPhases[key];
            if (!existing) return;
            updatedPhases[key] = {
              executed: existing.executed + delta,
              failed: Math.max(0, existing.failed - delta),
            };
          }
        );

        const newFailed = Math.max(0, prev.statementsFailed - recoveredStatements);
        const newExecuted = prev.statementsExecuted + recoveredStatements;
        const newStatus =
          newFailed === 0 ? 'success' : newExecuted > 0 ? 'partial' : 'failed';

        return {
          ...prev,
          status: newStatus,
          statementsFailed: newFailed,
          statementsExecuted: newExecuted,
          phases: updatedPhases,
        };
      });
    }
  }, [addLog, setSummary]);

  const clearCheckpoint = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pgdump.import.checkpoint');
      }
      addLog('info', 'Local checkpoints cleared');
    } catch {}
  }, [addLog]);

  const rollbackAlignment = useCallback(async (connection: ExternalDbConnection) => {
    const changes = [...appliedChangesRef.current];
    if (changes.length === 0) {
      addLog('info', 'No alignment changes to rollback');
      return;
    }
    const statements = changes.flatMap(c => c.rollback).reverse();
    addLog('warn', 'Starting rollback of schema alignment', `${statements.length} statements`);
    addLog('info', 'Rollback plan', statements.join('\n'));
    const { data, error } = await supabase.functions.invoke('execute-sql-external', {
      body: {
        action: 'execute',
        connection: {
          host: connection.host,
          port: connection.port,
          database: connection.database,
          user: connection.user,
          password: connection.password,
          ssl: connection.ssl,
        },
        statements,
        options: {
          stopOnError: true,
          useTransaction: true,
          timeoutMs: 60000,
        },
      },
    });
    if (error) {
      addLog('error', 'Rollback failed', error.message || String(error));
      throw error;
    }
    const result = data as any;
    if (!result?.success) {
      const message = result?.message || 'Rollback failed';
      addLog('error', 'Rollback failed', message);
      throw new Error(message);
    }
    appliedChangesRef.current = [];
    addLog('success', 'Rollback completed');
  }, [addLog]);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(null);
    setErrors([]);
    setLogs([]);
    setSummary(null);
    pauseRef.current = false;
    cancelRef.current = false;
  }, []);

  return {
    status,
    progress,
    errors,
    logs,
    summary,
    verificationResults,
    isVerifying,
    testConnection,
    verifyIntegrity,
    startImport,
    pauseImport,
    resumeImport,
    cancelImport,
    rollbackAlignment,
    rerunFailedBatches,
    clearCheckpoint,
    reset,
    canStart: status === 'idle' || status === 'completed' || status === 'failed' || status === 'cancelled',
    canPause: status === 'executing',
    canResume: status === 'paused',
    canCancel: status === 'executing' || status === 'paused',
  };
}
