import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ParsedSqlFile } from '@/utils/sqlFileParser';
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

  const addLog = useCallback((level: ImportLog['level'], message: string, details?: string) => {
    setLogs(prev => [...prev, { timestamp: Date.now(), level, message, details }]);
  }, []);

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
      const batch = statements.slice(start, end);

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

        const result = data;
        executed += result.details?.executed || 0;
        failed += result.details?.failed || 0;

        if (result.details?.errors) {
          for (const err of result.details.errors) {
            newErrors.push({
              index: start + err.index,
              statement: err.statement,
              error: err.error,
              timestamp: Date.now(),
              phase,
            });
          }
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
    setStatus('executing');
    setErrors([]);
    setLogs([]);
    setSummary(null);
    pauseRef.current = false;
    cancelRef.current = false;
    startTimeRef.current = Date.now();

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

      if (options.executionOrder === 'schema-first') {
        phases = [
          { name: 'schema', statements: [...parsed.schemaStatements, ...parsed.tableStatements, ...parsed.sequenceStatements] },
          { name: 'data', statements: parsed.dataStatements },
          { name: 'constraints', statements: parsed.constraintStatements },
          { name: 'indexes', statements: parsed.indexStatements },
          { name: 'functions', statements: [...parsed.functionStatements, ...parsed.triggerStatements] },
          { name: 'policies', statements: parsed.policyStatements },
        ];
      } else if (options.executionOrder === 'data-first') {
        phases = [
          { name: 'schema', statements: [...parsed.schemaStatements, ...parsed.tableStatements, ...parsed.sequenceStatements] },
          { name: 'data', statements: parsed.dataStatements },
          { name: 'indexes', statements: parsed.indexStatements },
          { name: 'constraints', statements: parsed.constraintStatements },
          { name: 'functions', statements: [...parsed.functionStatements, ...parsed.triggerStatements] },
          { name: 'policies', statements: parsed.policyStatements },
        ];
      } else {
        // file-order
        phases = [
          { name: 'other', statements: parsed.statements },
        ];
      }

      const allErrors: ImportError[] = [];

      for (const phase of phases) {
        if (phase.statements.length === 0) continue;

        addLog('info', `Starting phase: ${phase.name}`, `${phase.statements.length} statements`);

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
    reset,
    canStart: status === 'idle' || status === 'completed' || status === 'failed' || status === 'cancelled',
    canPause: status === 'executing',
    canResume: status === 'paused',
    canCancel: status === 'executing' || status === 'paused',
  };
}
