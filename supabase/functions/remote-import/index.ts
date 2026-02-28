// @ts-ignore Supabase Edge runtime provides this module at deploy time
import { Logger, serveWithLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

declare const Deno: any;

type RemoteConnection = {
  host: string;
  key: string;
  database: string;
  schema: string;
  timeoutMs?: number;
  ssl?: boolean;
};

type RemoteImportRequest = {
  connection: RemoteConnection;
  tables: Record<string, any[]>;
  dryRun?: boolean;
  selectedTables?: string[];
};

type RemoteImportSummary = {
  status: 'success' | 'partial' | 'failed';
  totalTables: number;
  totalRows: number;
  importedTables: string[];
  failedTables: string[];
  errors: string[];
  mode?: 'dry-run' | 'live';
  estimatedDurationMs?: number;
  validationReports?: Array<{
    table: string;
    wouldInsert: number;
    violations?: string[];
  }>;
};

// @ts-ignore Supabase Edge runtime provides Deno global
serveWithLogger(async (req, logger, supabase) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth validation
  const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify platform_admin role
  // We use the 'supabase' client provided by serveWithLogger which is a service role client
  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'platform_admin').maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Forbidden: platform_admin required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: RemoteImportRequest;
  try {
    const json = await req.json();
    body = json as RemoteImportRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { connection, tables, dryRun, selectedTables } = body;

  if (!connection || !connection.host || !connection.key) {
    return new Response(JSON.stringify({ error: 'Missing connection.host or connection.key' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!tables || typeof tables !== 'object') {
    return new Response(JSON.stringify({ error: 'Missing tables payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const allEntries = Object.entries(tables).filter(([, rows]) => Array.isArray(rows));

  let tableEntries = allEntries;
  if (Array.isArray(selectedTables) && selectedTables.length > 0) {
    const selectedSet = new Set(selectedTables);
    tableEntries = allEntries.filter(([name]) => selectedSet.has(name));
  }

  if (tableEntries.length === 0) {
    return new Response(JSON.stringify({ error: 'No table arrays found in payload after selection' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const summary: RemoteImportSummary = {
    status: 'failed',
    totalTables: tableEntries.length,
    totalRows: 0,
    importedTables: [],
    failedTables: [],
    errors: [],
    mode: dryRun ? 'dry-run' : 'live',
    estimatedDurationMs: undefined,
    validationReports: [],
  };

  const startedAt = Date.now();

  try {
    const remoteUrl = connection.host;
    const remoteKey = connection.key;

    // Use the injected supabase client for the target database if it's internal, 
    // but here we are connecting to a REMOTE Supabase instance.
    // However, the prompt says "remove redundant createClient calls".
    // In this specific case, remote-import NEEDS to create a client for the EXTERNAL database.
    // So we keep createClient but ensure it's used correctly.
    
    const remote = createClient(remoteUrl, remoteKey, {
      db: {
        schema: connection.schema || 'public',
      },
      global: {
        headers: {
          'x-import-source': 'remote-import',
        },
      },
    });

    logger.info('Starting remote import', {
      host: connection.host,
      schema: connection.schema || 'public',
      tables: tableEntries.length,
    });

    if (dryRun) {
      const rpcPayload = {
        tables: Object.fromEntries(tableEntries),
        schema: connection.schema || 'public',
      };

      let handledByRpc = false;

      try {
        const { data, error } = await remote.rpc('logic_nexus_import_dry_run', rpcPayload as any);
        if (!error && data && typeof data === 'object') {
          const result = data as any;
          summary.status = result.status ?? 'success';
          summary.totalTables =
            typeof result.totalTables === 'number'
              ? result.totalTables
              : tableEntries.length;
          summary.totalRows =
            typeof result.totalRows === 'number'
              ? result.totalRows
              : tableEntries.reduce((sum, [, rows]) => sum + (Array.isArray(rows) ? (rows as any[]).length : 0), 0);
          summary.importedTables = Array.isArray(result.importedTables)
            ? result.importedTables
            : tableEntries.map(([name]) => name);
          summary.failedTables = Array.isArray(result.failedTables) ? result.failedTables : [];
          summary.errors = Array.isArray(result.errors) ? result.errors : [];
          summary.mode = 'dry-run';
          summary.estimatedDurationMs =
            typeof result.estimatedDurationMs === 'number'
              ? result.estimatedDurationMs
              : Date.now() - startedAt;
          handledByRpc = true;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Dry-run RPC failed', { error: message });
      }

      if (!handledByRpc) {
        for (const [tableName, rows] of tableEntries) {
          const typedRows = rows as any[];
          if (!Array.isArray(typedRows) || typedRows.length === 0) {
            continue;
          }

          logger.info('Validating table', { table: tableName, rows: typedRows.length });

          try {
            const { error } = await remote.from(tableName).select('*', { head: true, count: 'exact' } as any);
            if (error) {
              summary.failedTables.push(tableName);
              summary.errors.push(`Table ${tableName}: ${error.message}`);
              summary.validationReports?.push({
                table: tableName,
                wouldInsert: typedRows.length,
                violations: [error.message],
              });
              continue;
            }
            summary.importedTables.push(tableName);
            summary.totalRows += typedRows.length;
            summary.validationReports?.push({
              table: tableName,
              wouldInsert: typedRows.length,
              violations: [],
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Table validation failed', { table: tableName, error: message });
            if (!summary.failedTables.includes(tableName)) {
              summary.failedTables.push(tableName);
            }
            summary.errors.push(`Table ${tableName}: ${message}`);
            summary.validationReports?.push({
              table: tableName,
              wouldInsert: typedRows.length,
              violations: [message],
            });
          }
        }

        if (summary.failedTables.length === 0) {
          summary.status = 'success';
        } else if (summary.importedTables.length === 0) {
          summary.status = 'failed';
        } else {
          summary.status = 'partial';
        }

        summary.mode = 'dry-run';
        summary.estimatedDurationMs = Date.now() - startedAt;
      }

      logger.info('Remote dry-run completed', {
        status: summary.status,
        importedTables: summary.importedTables.length,
        failedTables: summary.failedTables.length,
        totalRows: summary.totalRows,
      });

      return new Response(JSON.stringify(summary), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const [tableName, rows] of tableEntries) {
      const typedRows = rows as any[];
      if (!Array.isArray(typedRows) || typedRows.length === 0) {
        continue;
      }

      logger.info('Importing table', { table: tableName, rows: typedRows.length });

      try {
        const batchSize = 500;
        let importedForTable = 0;

        for (let i = 0; i < typedRows.length; i += batchSize) {
          const batch = typedRows.slice(i, i + batchSize);
          const cleaned = batch.map((row) => {
            const copy: Record<string, any> = {};
            Object.entries(row as Record<string, any>).forEach(([key, value]) => {
              if (value === null || value === undefined) {
                copy[key] = value;
              } else if (typeof value === 'string' && value.length > 10000) {
                copy[key] = value.slice(0, 10000);
              } else {
                copy[key] = value;
              }
            });
            return copy;
          });

          const { error } = await remote.from(tableName).insert(cleaned);
          if (error) {
            logger.error('Insert failed for batch', { table: tableName, error });
            summary.errors.push(`Table ${tableName}: ${error.message}`);
            summary.failedTables.push(tableName);
            throw new Error(`Insert failed for table ${tableName}: ${error.message}`);
          }

          importedForTable += batch.length;
        }

        summary.importedTables.push(tableName);
        summary.totalRows += importedForTable;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Table import failed', { table: tableName, error: message });
        if (!summary.failedTables.includes(tableName)) {
          summary.failedTables.push(tableName);
        }
        summary.errors.push(`Table ${tableName}: ${message}`);
      }
    }

    if (summary.failedTables.length === 0) {
      summary.status = 'success';
    } else if (summary.importedTables.length === 0) {
      summary.status = 'failed';
    } else {
      summary.status = 'partial';
    }

    summary.mode = 'live';
    summary.estimatedDurationMs = Date.now() - startedAt;

    logger.info('Remote import completed', {
      status: summary.status,
      importedTables: summary.importedTables.length,
      failedTables: summary.failedTables.length,
      totalRows: summary.totalRows,
    });

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error('Remote import failed', { error: message });
    summary.status = 'failed';
    summary.errors.push(message);
    return new Response(JSON.stringify(summary), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, "remote-import");
