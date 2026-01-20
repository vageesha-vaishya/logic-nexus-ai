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
  connection?: ConnectionConfig;
  useLocalDb?: boolean;
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

  // Security Check: Only allow requests with Service Role Key
  const serviceRoleKey = Deno.env.get("PRIVATE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  const isServiceRole = authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey);

  if (!isServiceRole) {
    return new Response(JSON.stringify({ error: "Unauthorized: Service Role Key required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let pool: Pool | null = null;
  let client: any | null = null;

  try {
    const body: ExecuteRequest = await req.json();
    const { action, connection, statements, query, options } = body;



    // Build connection options
    let poolConfig: any;
    if (body.useLocalDb) {
        // Use SUPABASE_DB_URL from environment
        const dbUrl = Deno.env.get("SUPABASE_DB_URL");
        if (!dbUrl) {
             throw new Error("SUPABASE_DB_URL not found in environment");
        }
        poolConfig = dbUrl;
        console.log(`[execute-sql-external] Connecting to local DB`);
    } else {
        if (!connection?.host || !connection?.database || !connection?.user) {
          console.warn('[execute-sql-external] Missing connection parameters', {
            hasHost: !!connection?.host,
            hasDatabase: !!connection?.database,
            hasUser: !!connection?.user,
          });
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Missing required connection parameters',
              code: 'MISSING_CONNECTION_PARAMETERS',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        poolConfig = {
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
    }
    
    pool = new Pool(poolConfig, 1);
    client = await pool.connect();

    try {
      if (action === 'test') {
        // Test connection by running a simple query
        const result = await client.queryObject('SELECT version()');
        const version = (result.rows[0] as { version?: string })?.version || 'Unknown';
        
        console.log(`[execute-sql-external] Connection test successful: ${version.substring(0, 50)}...`);
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Connection successful',
            connectionInfo: {
              version: version,
              database: connection?.database || 'local',
              user: connection?.user || 'service_role',
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
              const rawError = stmtError.message || String(stmtError);
              let errorMsg = rawError;

              if (rawError.includes('duplicate key value violates unique constraint "accounts_pkey"')) {
                errorMsg = `${rawError} (duplicate primary key in accounts; ensure IDs are unique before import)`;
              }

              errors.push({
                index: i,
                statement: stmt.substring(0, 200) + (stmt.length > 200 ? '...' : ''),
                error: errorMsg,
              });
              console.error(`[execute-sql-external] Statement ${i} failed: ${errorMsg}`);

              if (stopOnError || useTransaction) {
                if (useTransaction) {
                  await client.queryObject('ROLLBACK');
                }
                const duration = Date.now() - startTime;
                return new Response(
                  JSON.stringify({
                    success: false,
                    message: `Execution stopped at statement ${i}: ${errorMsg}`,
                    details: {
                      executed,
                      failed: errors.length,
                      errors,
                      duration,
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

      console.warn('[execute-sql-external] Invalid action or missing parameters', {
        action,
        hasStatements: !!statements && statements.length > 0,
        hasQuery: !!query,
      });
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid action or missing parameters',
          code: 'INVALID_ACTION',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } finally {
      if (client) {
        client.release();
      }
    }

  } catch (error: any) {
    console.error('[execute-sql-external] Error:', error);
    
    const errorMessage = error.message || String(error);
    let userMessage = 'Failed to execute SQL';
    let code = 'UNKNOWN_ERROR';
    
    if (errorMessage.includes('connection refused') || errorMessage.includes('ECONNREFUSED')) {
      userMessage = 'Connection refused. Check that the host and port are correct and the database is accepting connections.';
      code = 'CONNECTION_REFUSED';
    } else if (errorMessage.includes('failed to lookup address information') || errorMessage.includes('Name or service not known')) {
      userMessage = 'Hostname could not be resolved. Verify that the database host is correct and DNS is configured.';
      code = 'DNS_LOOKUP_FAILED';
    } else if (errorMessage.includes('authentication') || errorMessage.includes('password')) {
      userMessage = 'Authentication failed. Check your username and password.';
      code = 'AUTHENTICATION_FAILED';
    } else if (errorMessage.includes('database') && errorMessage.includes('does not exist')) {
      userMessage = 'Database does not exist. Check the database name.';
      code = 'DATABASE_NOT_FOUND';
    } else if (errorMessage.includes('timeout')) {
      userMessage = 'Connection timeout. The server may be slow or unreachable.';
      code = 'CONNECTION_TIMEOUT';
    } else if (errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
      userMessage = 'SSL/TLS connection error. Try toggling the SSL option.';
      code = 'SSL_ERROR';
    } else {
      userMessage = errorMessage;
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: userMessage,
        error: errorMessage,
        code,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch {
        console.warn('[execute-sql-external] Failed to close connection pool');
      }
    }
  }
});
