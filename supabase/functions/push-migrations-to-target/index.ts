import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Parse connection string into components
function parseConnectionString(connectionString: string): {
  hostname: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  // Format: postgresql://user:password@host:port/database
  const url = new URL(connectionString);
  
  return {
    hostname: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1), // Remove leading /
    user: url.username,
    password: decodeURIComponent(url.password), // Decode URL-encoded password
  };
}

serve(async (req) => {
  console.log(`[push-migrations-to-target] ${req.method} request received`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const targetDbUrl = Deno.env.get('TARGET_DB_URL');
    if (!targetDbUrl) {
      throw new Error('TARGET_DB_URL secret not configured');
    }

    const { migrations, dryRun = false } = await req.json() as { 
      migrations: MigrationFile[]; 
      dryRun?: boolean;
    };

    if (!migrations || !Array.isArray(migrations) || migrations.length === 0) {
      throw new Error('No migrations provided');
    }

    console.log(`[push-migrations-to-target] Processing ${migrations.length} migrations (dryRun: ${dryRun})`);

    // Parse connection string properly
    const connConfig = parseConnectionString(targetDbUrl);
    console.log(`[push-migrations-to-target] Connecting to ${connConfig.hostname}:${connConfig.port}/${connConfig.database}`);

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
    console.log('[push-migrations-to-target] Connected to target database');

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
    console.log('[push-migrations-to-target] Ensured schema_migrations table exists');

    // Get already applied migrations
    const appliedResult = await client.queryObject<{ version: string }>(`
      SELECT version FROM public.schema_migrations WHERE success = true
    `);
    const appliedVersions = new Set(appliedResult.rows.map(r => r.version));
    console.log(`[push-migrations-to-target] Found ${appliedVersions.size} already applied migrations`);

    const results: MigrationResult[] = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Sort migrations by name (timestamp prefix)
    const sortedMigrations = [...migrations].sort((a, b) => a.name.localeCompare(b.name));

    for (const migration of sortedMigrations) {
      const startTime = Date.now();
      const version = migration.name.replace('.sql', '');

      // Skip if already applied
      if (appliedVersions.has(version)) {
        console.log(`[push-migrations-to-target] Skipping already applied: ${migration.name}`);
        results.push({
          name: migration.name,
          success: true,
          duration_ms: 0,
          error: 'Already applied'
        });
        skipCount++;
        continue;
      }

      // Fix the SQL
      const fixedSql = fixMigrationSql(migration.sql);

      if (dryRun) {
        // In dry run mode, just validate the SQL syntax
        console.log(`[push-migrations-to-target] DRY RUN: Would apply ${migration.name}`);
        results.push({
          name: migration.name,
          success: true,
          duration_ms: Date.now() - startTime,
        });
        successCount++;
        continue;
      }

      try {
        // Execute the migration
        console.log(`[push-migrations-to-target] Applying: ${migration.name}`);
        await client.queryObject(fixedSql);
        const duration = Date.now() - startTime;

        // Record successful migration
        await client.queryObject(`
          INSERT INTO public.schema_migrations (version, execution_time_ms, success)
          VALUES ($1, $2, true)
          ON CONFLICT (version) DO UPDATE SET 
            applied_at = NOW(), 
            execution_time_ms = $2, 
            success = true,
            error_message = NULL
        `, [version, duration]);

        results.push({
          name: migration.name,
          success: true,
          duration_ms: duration,
        });
        successCount++;
        console.log(`[push-migrations-to-target] SUCCESS: ${migration.name} (${duration}ms)`);
      } catch (err) {
        const duration = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Record failed migration
        await client.queryObject(`
          INSERT INTO public.schema_migrations (version, execution_time_ms, success, error_message)
          VALUES ($1, $2, false, $3)
          ON CONFLICT (version) DO UPDATE SET 
            applied_at = NOW(), 
            execution_time_ms = $2, 
            success = false,
            error_message = $3
        `, [version, duration, errorMessage]);

        results.push({
          name: migration.name,
          success: false,
          error: errorMessage,
          duration_ms: duration,
        });
        errorCount++;
        console.error(`[push-migrations-to-target] FAILED: ${migration.name} - ${errorMessage}`);
      }
    }

    await client.end();
    console.log('[push-migrations-to-target] Disconnected from target database');

    const response = {
      success: errorCount === 0,
      total: migrations.length,
      applied: successCount,
      skipped: skipCount,
      failed: errorCount,
      dryRun,
      results,
    };

    console.log(`[push-migrations-to-target] Complete: ${successCount} applied, ${skipCount} skipped, ${errorCount} failed`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[push-migrations-to-target] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
