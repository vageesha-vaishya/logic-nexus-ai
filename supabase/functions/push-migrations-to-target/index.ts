// @ts-ignore
import { Client } from "postgres";
import { serveWithLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';

declare const Deno: any;

interface MigrationFile {
  name: string;
  sql: string;
}

interface MigrationResult {
  name: string;
  success: boolean;
  error?: string;
  duration_ms: number;
}

// Remove explicit BEGIN/COMMIT statements that cause issues
function fixMigrationSql(sql: string): string {
  let fixed = sql;
  
  // Remove standalone BEGIN; statements (but not BEGIN inside function bodies)
  fixed = fixed.replace(/^BEGIN;\s*$/gim, '');
  fixed = fixed.replace(/^begin;\s*$/gim, '');
  
  // Remove standalone COMMIT; statements (but not inside exception blocks)
  fixed = fixed.replace(/^COMMIT;\s*$/gim, '');
  fixed = fixed.replace(/^commit;\s*$/gim, '');
  
  // Remove standalone ROLLBACK; statements outside exception handlers
  fixed = fixed.replace(/^ROLLBACK;\s*$/gim, '');
  fixed = fixed.replace(/^rollback;\s*$/gim, '');
  
  // Fix search_path = public, extensions to just public
  fixed = fixed.replace(/SET search_path\s*=\s*public\s*,\s*extensions/gi, 'SET search_path = public');
  
  // Fix function bodies with COMMIT/ROLLBACK inside (need to be smarter here)
  fixed = fixed.replace(/(\$\$[\s\S]*?)(\n\s*commit;\s*\n)([\s\S]*?\$\$)/gi, '$1\n$3');
  fixed = fixed.replace(/(\$\$[\s\S]*?)(\n\s*rollback;\s*\n)([\s\S]*?\$\$)/gi, '$1\n$3');
  
  return fixed.trim();
}

// Split SQL into individual statements for batch execution
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  
  const lines = sql.split('\n');
  
  for (const line of lines) {
    // Check for dollar quote start/end
    const dollarMatch = line.match(/(\$[a-zA-Z_]*\$)/g);
    if (dollarMatch) {
      for (const match of dollarMatch) {
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = match;
        } else if (match === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
      }
    }
    
    current += line + '\n';
    
    // If not in dollar quote and line ends with semicolon, it's end of statement
    if (!inDollarQuote && line.trim().endsWith(';')) {
      const stmt = current.trim();
      if (stmt && !stmt.match(/^--/) && stmt !== ';') {
        statements.push(stmt);
      }
      current = '';
    }
  }
  
  // Handle any remaining content
  if (current.trim()) {
    statements.push(current.trim());
}

  return statements;
}

function normalizePassword(raw: string): string {
  const trimmed = raw.trim();
  // Users sometimes paste URL-encoded passwords (e.g. %23%21%40...).
  // Try to decode safely; if decoding fails, fall back to the raw value.
  try {
    const decoded = decodeURIComponent(trimmed);
    return decoded;
  } catch {
    return trimmed;
  }
}

// Parse connection string into components
function parseConnectionString(connectionString: string): {
  hostname: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  // Clean the connection string - remove any shell variable assignment
  let cleanUrl = connectionString.trim();

  // Handle NEW_DB_URL="..." or similar patterns
  if (cleanUrl.match(/^[A-Z_]+=["']?/)) {
    // Extract everything after the first = sign
    const eqIdx = cleanUrl.indexOf('=');
    cleanUrl = cleanUrl.substring(eqIdx + 1);
  }

  // Remove any surrounding quotes
  cleanUrl = cleanUrl.replace(/^["']|["']$/g, '').trim();

  // Ensure it starts with postgresql:// or postgres://
  if (!cleanUrl.startsWith('postgresql://') && !cleanUrl.startsWith('postgres://')) {
    throw new Error(
      `Invalid connection string format. Expected postgresql:// or postgres:// but got: ${cleanUrl.substring(0, 20)}...`
    );
  }

  // Format: postgresql://user:password@host:port/database
  const url = new URL(cleanUrl);

  const result = {
    hostname: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1), // Remove leading /
    user: url.username,
    password: normalizePassword(url.password),
  };

  if (!result.hostname || !result.database || !result.user) {
    throw new Error(
      `Invalid connection parameters: hostname=${result.hostname}, database=${result.database}, user=${result.user}`
    );
  }

  return result;
}

serveWithLogger(async (req, logger, supabase) => {
  const corsHeaders = getCorsHeaders(req);
  logger.info(`[push-migrations-to-target] ${req.method} request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth validation
  const { user, error: authError } = await requireAuth(req, logger);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: authError || 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify platform_admin role
  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'platform_admin').maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Forbidden: platform_admin required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as { 
      migrations: MigrationFile[]; 
      dryRun?: boolean;
      connectionString?: string;
      host?: string;
      port?: number;
      database?: string;
      user?: string;
      password?: string;
    };
    
    const { migrations, dryRun = false } = body;

    let connConfig: {
      hostname: string;
      port: number;
      database: string;
      user: string;
      password: string;
    };

    // Priority 1: Explicit connection parameters
    if (body.host && body.database && body.user && body.password) {
      connConfig = {
        hostname: body.host,
        port: body.port || 5432,
        database: body.database,
        user: body.user,
        password: normalizePassword(body.password),
      };
      logger.info(`[push-migrations-to-target] Using explicit connection params`);
    }
    // Priority 2: Connection string from request
    else if (body.connectionString) {
      connConfig = parseConnectionString(body.connectionString);
      logger.info(`[push-migrations-to-target] Using connection string from request`);
    }
    // Priority 3: Environment variable
    else {
      const targetDbUrl = Deno.env.get('TARGET_DB_URL');
      if (!targetDbUrl) {
        throw new Error('No connection provided. Pass host/database/user/password params, connectionString, or configure TARGET_DB_URL secret');
      }
      connConfig = parseConnectionString(targetDbUrl);
      logger.info(`[push-migrations-to-target] Using TARGET_DB_URL from environment`);
    }

    if (!migrations || !Array.isArray(migrations) || migrations.length === 0) {
      throw new Error('No migrations provided');
    }

    logger.info(`[push-migrations-to-target] Processing ${migrations.length} migrations (dryRun: ${dryRun})`);
    logger.info(`[push-migrations-to-target] Connecting to ${connConfig.hostname}:${connConfig.port}/${connConfig.database}`);

    // Connect to target database with explicit options
    const client = new Client({
      hostname: connConfig.hostname,
      port: connConfig.port,
      database: connConfig.database,
      user: connConfig.user,
      password: connConfig.password,
      tls: { enabled: true, enforce: false },
    });
    
    await client.connect();
    logger.info('[push-migrations-to-target] Connected to target database');

    // Create schema_migrations table if not exists
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW(),
        execution_time_ms INTEGER,
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT
      )
    `);

    // Track resumable progress for large migrations
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS public.schema_migration_progress (
        version TEXT PRIMARY KEY,
        next_index INTEGER NOT NULL DEFAULT 0,
        total_statements INTEGER,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    logger.info('[push-migrations-to-target] Ensured migration tracking tables exist');

    const batchSize = Math.max(1, Math.min(200, Number((body as any).batchSize ?? 50)));

    // Sort migrations by name (timestamp prefix)
    const sortedMigrations = [...migrations].sort((a, b) => a.name.localeCompare(b.name));
    const versions = sortedMigrations.map((m) => m.name.replace(/\.sql$/i, ''));

    // Fetch state from target DB
    const appliedResult = await client.queryObject<{ version: string }>(
      `SELECT version FROM public.schema_migrations WHERE success = true AND version = ANY($1::text[])`,
      [versions]
    );
    const appliedVersions = new Set(appliedResult.rows.map((r: { version: string }) => r.version));

    const failedResult = await client.queryObject<{ version: string; error_message: string | null }>(
      `SELECT version, error_message FROM public.schema_migrations WHERE success = false AND version = ANY($1::text[])`,
      [versions]
    );
    const failedMap = new Map<string, string>(
      failedResult.rows.map((r: { version: string; error_message: string | null }) => [
        r.version,
        r.error_message ?? 'Migration failed',
      ])
    );

    const progressResult = await client.queryObject<{ version: string; next_index: number; total_statements: number | null }>(
      `SELECT version, next_index, total_statements FROM public.schema_migration_progress WHERE version = ANY($1::text[])`,
      [versions]
    );
    const progressMap = new Map<string, { version: string; next_index: number; total_statements: number | null }>(
      progressResult.rows.map((r: { version: string; next_index: number; total_statements: number | null }) => [
        r.version,
        r,
      ])
    );

    logger.info(
      `[push-migrations-to-target] State: applied=${appliedVersions.size}, failed=${failedMap.size}, in_progress=${progressMap.size}`
    );

    // If any migration already failed, stop early (user needs to fix the SQL / state)
    if (!dryRun && failedMap.size > 0) {
      const results: MigrationResult[] = sortedMigrations.map((m) => {
        const version = m.name.replace(/\.sql$/i, '');
        if (appliedVersions.has(version)) {
          return { name: m.name, success: true, duration_ms: 0, error: 'Already applied' };
        }
        if (failedMap.has(version)) {
          return { name: m.name, success: false, duration_ms: 0, error: failedMap.get(version) };
        }
        if (progressMap.has(version)) {
          return { name: m.name, success: true, duration_ms: 0, error: 'In progress' };
        }
        return { name: m.name, success: true, duration_ms: 0, error: 'Pending' };
      });

      await client.end();

      return new Response(
        JSON.stringify({
          success: false,
          total: migrations.length,
          applied: appliedVersions.size,
          skipped: 0,
          failed: failedMap.size,
          dryRun,
          results,
          error: 'At least one migration previously failed. Fix it (or reset the target DB) before continuing.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // DRY RUN: only report status and statement counts for each migration (no execution)
    if (dryRun) {
      const results: MigrationResult[] = [];
      for (const migration of sortedMigrations) {
        const version = migration.name.replace(/\.sql$/i, '');

        if (appliedVersions.has(version)) {
          results.push({ name: migration.name, success: true, duration_ms: 0, error: 'Already applied' });
          continue;
        }

        const fixedSql = fixMigrationSql(migration.sql);
        const statements = splitSqlStatements(fixedSql);
        results.push({
          name: migration.name,
          success: true,
          duration_ms: 0,
          error: `Would apply (${statements.length} statements)`,
        });
      }

      await client.end();

      return new Response(
        JSON.stringify({
          success: true,
          total: migrations.length,
          applied: appliedVersions.size,
          skipped: 0,
          failed: 0,
          dryRun,
          results,
          in_progress: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // EXECUTION MODE: apply at most ONE migration chunk per invocation (prevents WORKER_LIMIT)
    let progress:
      | { version: string; statement_index: number; statement_total: number; percent: number }
      | undefined;

    let worked = false;

    for (const migration of sortedMigrations) {
      const startTime = Date.now();
      const version = migration.name.replace(/\.sql$/i, '');

      if (appliedVersions.has(version)) continue;
      if (failedMap.has(version)) continue;

      const fixedSql = fixMigrationSql(migration.sql);
      const statements = splitSqlStatements(fixedSql);

      const existingProgress = progressMap.get(version);
      const startIndex = Math.max(0, existingProgress?.next_index ?? 0);
      const totalStatements = statements.length;
      const endIndex = Math.min(totalStatements, startIndex + batchSize);

      logger.info(
        `[push-migrations-to-target] Applying chunk: ${migration.name} statements ${startIndex + 1}-${endIndex}/${totalStatements} (batchSize=${batchSize})`
      );

      try {
        for (let i = startIndex; i < endIndex; i++) {
          const stmt = statements[i];
          if (!stmt || !stmt.trim()) continue;
          await client.queryObject(stmt);
        }

        const duration = Date.now() - startTime;

        // Update progress
        await client.queryObject(
          `
          INSERT INTO public.schema_migration_progress (version, next_index, total_statements, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (version) DO UPDATE SET
            next_index = EXCLUDED.next_index,
            total_statements = COALESCE(public.schema_migration_progress.total_statements, EXCLUDED.total_statements),
            updated_at = NOW()
        `,
          [version, endIndex, totalStatements]
        );

        if (endIndex >= totalStatements) {
          // Mark migration complete
          await client.queryObject(`DELETE FROM public.schema_migration_progress WHERE version = $1`, [version]);

          await client.queryObject(
            `
            INSERT INTO public.schema_migrations (version, execution_time_ms, success)
            VALUES ($1, $2, true)
            ON CONFLICT (version) DO UPDATE SET
              applied_at = NOW(),
              execution_time_ms = $2,
              success = true,
              error_message = NULL
          `,
            [version, duration]
          );

          appliedVersions.add(version);
          logger.info(`[push-migrations-to-target] COMPLETE: ${migration.name} (${totalStatements} statements)`);
        }

        progress = {
          version,
          statement_index: endIndex,
          statement_total: totalStatements,
          percent: totalStatements === 0 ? 100 : Math.round((endIndex / totalStatements) * 100),
        };

        worked = true;
      } catch (err) {
        const duration = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        await client.queryObject(
          `
          INSERT INTO public.schema_migrations (version, execution_time_ms, success, error_message)
          VALUES ($1, $2, false, $3)
          ON CONFLICT (version) DO UPDATE SET
            applied_at = NOW(),
            execution_time_ms = $2,
            success = false,
            error_message = $3
        `,
          [version, duration, errorMessage]
        );

        failedMap.set(version, errorMessage);

        logger.error(`[push-migrations-to-target] FAILED: ${migration.name} - ${errorMessage}`);
        break;
      }

      // only one chunk per call
      break;
    }

    // Recompute final status after this chunk
    const stillPending = versions.some((v) => !appliedVersions.has(v) && !failedMap.has(v));
    const results: MigrationResult[] = sortedMigrations.map((m) => {
      const version = m.name.replace(/\.sql$/i, '');
      if (appliedVersions.has(version)) return { name: m.name, success: true, duration_ms: 0, error: 'Applied' };
      if (failedMap.has(version)) return { name: m.name, success: false, duration_ms: 0, error: failedMap.get(version) };
      if (progressMap.has(version) || (progress && progress.version === version)) return { name: m.name, success: true, duration_ms: 0, error: 'In progress' };
      return { name: m.name, success: true, duration_ms: 0, error: 'Pending' };
    });

    await client.end();
    logger.info('[push-migrations-to-target] Disconnected from target database');

    const response = {
      success: failedMap.size === 0 && !stillPending,
      total: migrations.length,
      applied: appliedVersions.size,
      skipped: 0,
      failed: failedMap.size,
      dryRun,
      results,
      in_progress: stillPending && failedMap.size === 0,
      progress,
      worked,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    logger.error('[push-migrations-to-target] Error:', { error: error instanceof Error ? error.message : String(error) });

    let message = error instanceof Error ? error.message : String(error);
    if (message.includes('password authentication failed')) {
      message +=
        ' Hint: make sure you entered the database password (not an API key). If you copied it from a URL, it may be URL-encoded (e.g. %40 means @) — paste the real decoded password. Also ensure the username matches the host type (pooler hosts often require a different username format).';
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}, "push-migrations-to-target");
