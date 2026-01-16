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

export interface ImportError {
  index: number;
  statement: string;
  error: string;
  timestamp: number;
  phase: string;
}

export interface ImportLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

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
}

export interface UsePgDumpImportReturn {
  status: ImportStatus;
  progress: ImportProgress | null;
  errors: ImportError[];
  logs: ImportLog[];
  summary: ImportSummary | null;
  
  testConnection: (connection: ExternalDbConnection) => Promise<ConnectionTestResult>;
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
  
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const appliedChangesRef = useRef<{ forward: string[]; rollback: string[]; summary: string; phase: string; timestamp: number }[]>([]);
  const conflictTargetsRef = useRef<Map<string, string[]>>(new Map());

  const addLog = useCallback((level: ImportLog['level'], message: string, details?: string) => {
    setLogs(prev => [...prev, { timestamp: Date.now(), level, message, details }]);
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

    const missingTableStatements: string[] = [];
    const missingTableNames = new Set<string>();

    for (const stmt of parsed.tableStatements) {
      const match = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([A-Za-z0-9_]+)"?\.)?"?([A-Za-z0-9_]+)"?/i);
      if (!match) continue;
      const schema = match[1] || 'public';
      const table = match[2];
      const key = `${schema}.${table}`;
      if (!existingTableSet.has(key)) {
        missingTableStatements.push(stmt);
        missingTableNames.add(key);
      }
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
    const batchSize = options.batchSize || 100;
    const totalBatches = Math.ceil(statements.length / batchSize);
    const newErrors: ImportError[] = [];
    let executed = 0;
    let failed = 0;

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      // Check for pause/cancel
      while (pauseRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (cancelRef.current) {
        addLog('warn', 'Import cancelled by user');
        throw new Error('Import cancelled');
      }

      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, statements.length);
        let batch = statements.slice(start, end);
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

        if (error) throw error;

        const result = data as any;

        if (!result?.success) {
          const msg = result?.message || 'Remote execution failed';
          addLog('error', `Batch ${batchIndex + 1} failed: ${msg}`);
          
          // If no details are available, it's a connection/system error
          if (!result?.details) {
            if (options.stopOnFirstError) {
              throw new Error(msg);
            }
            failed += batch.length;
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
              addLog('error', `Stmt ${err.index + 1}: ${err.error}`, `Statement: ${err.statement}`);
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
                addLog('error', `Stmt ${err.index + 1}: ${err.error}`);
              });
            }
          }

          for (const err of errList) {
            newErrors.push({
              index: start + err.index,
              statement: err.statement,
              error: err.error,
              timestamp: Date.now(),
              phase,
            });
          }
        }

        if (!result?.success && options.stopOnFirstError) {
          throw new Error(result?.message || 'Remote execution failed');
        }

        // Update progress
        const elapsed = Date.now() - startTimeRef.current;
        const statementsPerMs = (phaseStats.executed + executed) / elapsed;
        const remaining = statements.length - (batchIndex + 1) * batchSize;
        
        setProgress(prev => prev ? {
          ...prev,
          currentBatch: batchIndex + 1,
          totalBatches,
          statementsExecuted: prev.statementsExecuted + (result.details?.executed || 0),
          statementsFailed: prev.statementsFailed + (result.details?.failed || 0),
          currentPhase: phase,
          elapsedMs: elapsed,
          estimatedRemainingMs: statementsPerMs > 0 ? remaining / statementsPerMs : 0,
        } : null);

        addLog('info', `Batch ${batchIndex + 1}/${totalBatches} completed (${phase})`, 
          `${result.details?.executed || 0} executed, ${result.details?.failed || 0} failed`);

      } catch (err: any) {
        addLog('error', `Batch ${batchIndex + 1} failed: ${err.message}`);
        
        if (options.stopOnFirstError) {
          throw err;
        }
        
        failed += batch.length;
      }
    }

    return { executed, failed, errors: newErrors };
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
      // Determine execution order
      let phases: Array<{ name: ImportProgress['currentPhase']; statements: string[] }> = [];

      const reorderDataStatements = (stmts: string[]): string[] => {
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

      if (options.executionOrder === 'schema-first') {
        phases = [
          { name: 'schema', statements: [...parsed.schemaStatements, ...parsed.tableStatements, ...parsed.sequenceStatements] },
          { name: 'data', statements: (options.dataReorderHeuristics ? reorderDataStatements(parsed.dataStatements) : parsed.dataStatements) },
          { name: 'constraints', statements: parsed.constraintStatements },
          { name: 'indexes', statements: parsed.indexStatements },
          { name: 'functions', statements: [...parsed.functionStatements, ...parsed.triggerStatements] },
          { name: 'policies', statements: parsed.policyStatements },
        ];
      } else if (options.executionOrder === 'data-first') {
        phases = [
          { name: 'schema', statements: [...parsed.schemaStatements, ...parsed.tableStatements, ...parsed.sequenceStatements] },
          { name: 'data', statements: (options.dataReorderHeuristics ? reorderDataStatements(parsed.dataStatements) : parsed.dataStatements) },
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
      for (const phase of phases) {
        const before = phase.statements.length;
        const filtered = filterAuthSchemaDDL(phase.statements);
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
        rewriteInsertsWithOnConflict(stmts, mode, conflictTargetsRef.current);

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

      const allErrors: ImportError[] = [];

      for (const phase of phases) {
        if (phase.statements.length === 0) continue;

        addLog('info', `Starting phase: ${phase.name}`, `${phase.statements.length} statements`);
        if (phase.name === 'data' && options.dataReorderHeuristics) {
          addLog('info', 'Data reordering applied', 'Heuristic ordering enabled (parents before children)');
        }

        const result = await executeStatements(
          phase.statements,
          connection,
          options,
          phase.name,
          phaseStats[phase.name as keyof typeof phaseStats] || { executed: 0, failed: 0 }
        );

        if (phaseStats[phase.name as keyof typeof phaseStats]) {
          phaseStats[phase.name as keyof typeof phaseStats] = {
            executed: result.executed,
            failed: result.failed,
          };
        }

        allErrors.push(...result.errors);

        addLog(result.failed > 0 ? 'warn' : 'success', 
          `Phase ${phase.name} completed`,
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

      const importSummary: ImportSummary = {
        status: totalFailed === 0 ? 'success' : totalExecuted > 0 ? 'partial' : 'failed',
        startTime: startTimeRef.current,
        endTime,
        duration: endTime - startTimeRef.current,
        statementsExecuted: totalExecuted,
        statementsFailed: totalFailed,
        errors: allErrors,
        phases: phaseStats,
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
    testConnection,
    startImport,
    pauseImport,
    resumeImport,
    cancelImport,
    rollbackAlignment,
    reset,
    canStart: status === 'idle' || status === 'completed' || status === 'failed' || status === 'cancelled',
    canPause: status === 'executing',
    canResume: status === 'paused',
    canCancel: status === 'executing' || status === 'paused',
  };
}
