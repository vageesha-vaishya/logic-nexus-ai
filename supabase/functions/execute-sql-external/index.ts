import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | 'require' | 'prefer' | 'disable';
}

interface ExecuteRequest {
  action: 'test' | 'execute' | 'query';
  connection: ConnectionConfig;
  statements?: string[];
  query?: string;
  options?: {
    stopOnError?: boolean;
    useTransaction?: boolean;
    timeoutMs?: number;
    batchSize?: number;
  };
}

interface ExecuteResult {
  success: boolean;
  message: string;
  details?: {
    executed: number;
    failed: number;
    errors: Array<{ index: number; statement: string; error: string }>;
    duration: number;
  };
  data?: any[];
  connectionInfo?: {
    version: string;
    database: string;
    user: string;
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let pool: Pool | null = null;

  try {
    const body: ExecuteRequest = await req.json();
    const { action, connection, statements, query, options } = body;

    // Validate connection config
    if (!connection?.host || !connection?.database || !connection?.user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required connection parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build connection options
    const poolConfig = {
      hostname: connection.host,
      port: connection.port || 5432,
      database: connection.database,
      user: connection.user,
      password: connection.password || '',
      tls: connection.ssl === true || connection.ssl === 'require' ? { enabled: true } : { enabled: false },
      connection: {
        attempts: 3,
        interval: 500,
      },
    };

    console.log(`[execute-sql-external] Connecting to ${connection.host}:${connection.port}/${connection.database}`);
    
    pool = new Pool(poolConfig, 1);
    const client = await pool.connect();

    try {
      if (action === 'test') {
        // Test connection by running a simple query
        const result = await client.queryObject<{ version: string }>('SELECT version()');
        const version = result.rows[0]?.version || 'Unknown';
        
        console.log(`[execute-sql-external] Connection test successful: ${version.substring(0, 50)}...`);
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Connection successful',
            connectionInfo: {
              version: version,
              database: connection.database,
              user: connection.user,
            }
          } as ExecuteResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'query' && query) {
        // Execute a single query and return results
        const startTime = Date.now();
        const result = await client.queryObject(query);
        const duration = Date.now() - startTime;
        
        console.log(`[execute-sql-external] Query executed in ${duration}ms, rows: ${result.rows.length}`);
        
        return new Response(
          JSON.stringify({
            success: true,
            message: `Query executed successfully`,
            data: result.rows,
            details: {
              executed: 1,
              failed: 0,
              errors: [],
              duration,
            }
          } as ExecuteResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'execute' && statements && statements.length > 0) {
        const startTime = Date.now();
        const stopOnError = options?.stopOnError ?? false;
        const useTransaction = options?.useTransaction ?? true;
        const errors: Array<{ index: number; statement: string; error: string }> = [];
        let executed = 0;

        console.log(`[execute-sql-external] Executing ${statements.length} statements (transaction: ${useTransaction})`);

        if (useTransaction) {
          await client.queryObject('BEGIN');
        }

        try {
          for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i].trim();
            if (!stmt) continue;

            try {
              await client.queryObject(stmt);
              executed++;
            } catch (stmtError: any) {
              const errorMsg = stmtError.message || String(stmtError);
              errors.push({
                index: i,
                statement: stmt.substring(0, 200) + (stmt.length > 200 ? '...' : ''),
                error: errorMsg,
              });
              console.error(`[execute-sql-external] Statement ${i} failed: ${errorMsg}`);

              if (stopOnError) {
                if (useTransaction) {
                  await client.queryObject('ROLLBACK');
                }
                return new Response(
                  JSON.stringify({
                    success: false,
                    message: `Execution stopped at statement ${i}: ${errorMsg}`,
                    details: {
                      executed,
                      failed: errors.length,
                      errors,
                      duration: Date.now() - startTime,
                    }
                  } as ExecuteResult),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          }

          if (useTransaction) {
            await client.queryObject('COMMIT');
          }

          const duration = Date.now() - startTime;
          console.log(`[execute-sql-external] Completed: ${executed} executed, ${errors.length} failed in ${duration}ms`);

          return new Response(
            JSON.stringify({
              success: errors.length === 0,
              message: errors.length === 0 
                ? `Successfully executed ${executed} statements` 
                : `Executed ${executed} statements with ${errors.length} errors`,
              details: {
                executed,
                failed: errors.length,
                errors,
                duration,
              }
            } as ExecuteResult),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (txError: any) {
          if (useTransaction) {
            try {
              await client.queryObject('ROLLBACK');
            } catch {
              // Ignore rollback errors
            }
          }
          throw txError;
        }
      }

      return new Response(
        JSON.stringify({ success: false, message: 'Invalid action or missing parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[execute-sql-external] Error:', error);
    
    const errorMessage = error.message || String(error);
    let userMessage = 'Failed to execute SQL';
    
    // Provide more helpful error messages
    if (errorMessage.includes('connection refused') || errorMessage.includes('ECONNREFUSED')) {
      userMessage = 'Connection refused. Check that the host and port are correct and the database is accepting connections.';
    } else if (errorMessage.includes('authentication') || errorMessage.includes('password')) {
      userMessage = 'Authentication failed. Check your username and password.';
    } else if (errorMessage.includes('database') && errorMessage.includes('does not exist')) {
      userMessage = 'Database does not exist. Check the database name.';
    } else if (errorMessage.includes('timeout')) {
      userMessage = 'Connection timeout. The server may be slow or unreachable.';
    } else if (errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
      userMessage = 'SSL/TLS connection error. Try toggling the SSL option.';
    } else {
      userMessage = errorMessage;
    }

    return new Response(
      JSON.stringify({ success: false, message: userMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch {
        // Ignore pool cleanup errors
      }
    }
  }
});
