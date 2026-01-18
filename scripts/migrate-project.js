/**
 * Usage:
 *   # Dry run (show where export would be written, no changes applied)
 *   node scripts/migrate-project.js --dry-run [--skip-schema] [--skip-data]
 *
 *   # Full migration (schema + data + verification) using a source .env file
 *   node --env-file=./source.env scripts/migrate-project.js
 *
 * Environment variables (typically loaded from a .env file):
 *   Source DB (one of):
 *     - SOURCE_DB_URL
 *     - SOURCE_DB_CONNECTION_STRING
 *     - SUPABASE_DB_URL
 *     - SOURCE_DB_HOST + SOURCE_DB_PORT + SOURCE_DB_NAME + SOURCE_DB_USER + SOURCE_DB_PASSWORD
 *     - VITE_SUPABASE_URL / VITE_SUPABASE_PROJECT_ID + SOURCE_DB_PASSWORD
 *     - SOURCE_SUPABASE_URL + SOURCE_SUPABASE_PUBLISHABLE_KEY (REST export mode; imports via run-rest-import.sh)
 *   Target DB:
 *     - TARGET_DB_URL
 *     - TARGET_DB_CONNECTION_STRING
 *     - SUPABASE_DB_URL
 *
 * This script orchestrates:
 *   - Schema migration via scripts/check-migrations.sh (Supabase CLI db push)
 *   - Data export via scripts/pgdump-export.js (pg_dump)
 *   - Data import via psql
 *   - Row-count verification via supabase/migration-package/direct-migration/scripts/validate-migration.js
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: projectRoot, stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function migrateSchema() {
  const scriptPath = path.join(__dirname, 'check-migrations.sh');
  await runCommand('bash', [scriptPath]);
}

function buildPostgresUrlFromParts(prefix) {
  let host = process.env[`${prefix}_DB_HOST`];
  const port = process.env[`${prefix}_DB_PORT`] || '5432';
  const name = process.env[`${prefix}_DB_NAME`] || process.env[`${prefix}_DB_DATABASE`] || 'postgres';
  const user = process.env[`${prefix}_DB_USER`] || 'postgres';
  const password = process.env[`${prefix}_DB_PASSWORD`];

  if (!host) {
    const viteUrl = process.env.VITE_SUPABASE_URL;
    if (viteUrl) {
      try {
        const u = new URL(viteUrl);
        const projectHost = u.hostname.replace(/^db\./, '');
        host = `db.${projectHost}`;
      } catch {
      }
    }
  }

  if (!host && process.env.VITE_SUPABASE_PROJECT_ID) {
    host = `db.${process.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
  }

  if (!host || !name || !password) {
    return '';
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${name}`;
}

function resolveSourceDbUrl() {
  return (
    process.env.SOURCE_DB_CONNECTION_STRING ||
    process.env.SOURCE_DB_URL ||
    process.env.SUPABASE_DB_URL ||
    buildPostgresUrlFromParts('SOURCE') ||
    ''
  );
}

function resolveTargetDbUrl() {
  return (
    process.env.TARGET_DB_CONNECTION_STRING ||
    process.env.TARGET_DB_URL ||
    process.env.SUPABASE_DB_URL ||
    ''
  );
}

async function exportData(params = {}) {
  const dryRun = params.dryRun === true;
  const dbUrl = resolveSourceDbUrl();
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  if (dbUrl) {
    const outDir = 'migration-artifacts/pgdump';
    const fileName = `source-${ts}.sql`;
    const dumpPath = path.join(projectRoot, outDir, fileName);
    if (dryRun) {
      return { exportPath: dumpPath, mode: 'db' };
    }
    const scriptPath = path.join(projectRoot, 'scripts', 'pgdump-export.js');
    const args = [
      scriptPath,
      '--url',
      dbUrl,
      '--out-dir',
      outDir,
      '--file',
      fileName,
    ];
    await runCommand('node', args);
    return { exportPath: dumpPath, mode: 'db' };
  }

  const sourceUrl =
    process.env.SOURCE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const sourceAnon =
    process.env.SOURCE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '';

  if (!sourceUrl || !sourceAnon) {
    throw new Error(
      'No source DB URL resolved and no Supabase REST config found. Set SOURCE_DB_URL or SOURCE_SUPABASE_URL + SOURCE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY).',
    );
  }

  const exportScript = path.join(
    projectRoot,
    'supabase',
    'migration-package',
    'helpers',
    'export-rest.js',
  );

  const env = {
    ...process.env,
    SOURCE_SUPABASE_URL: sourceUrl,
    SOURCE_SUPABASE_PUBLISHABLE_KEY: sourceAnon,
  };

  const outDir = path.join(
    projectRoot,
    `migration-export-${ts}`,
  );

  if (dryRun) {
    return { exportPath: outDir, mode: 'rest' };
  }

  await runCommand('node', [exportScript], { env });
  return { exportPath: outDir, mode: 'rest' };
}

async function importData(params) {
  const exportPath = params.exportPath;
  const mode = params.mode || 'db';
  if (!exportPath) {
    throw new Error('exportPath is required for importData');
  }
  if (mode !== 'db') {
    console.log('REST export mode detected; running supabase/migration-package/run-rest-import.sh for CSV import');
    const scriptPath = path.join(
      projectRoot,
      'supabase',
      'migration-package',
      'run-rest-import.sh',
    );
    await runCommand('bash', [scriptPath]);
    return;
  }
  const targetConn = resolveTargetDbUrl();
  if (!targetConn) {
    throw new Error('Set TARGET_DB_CONNECTION_STRING or TARGET_DB_URL or SUPABASE_DB_URL for import');
  }
  const args = [targetConn, '-f', exportPath];
  await runCommand('psql', args);
}

async function verifyMigration() {
  const sourceConn = resolveSourceDbUrl();
  const targetConn = resolveTargetDbUrl();
  if (!sourceConn || !targetConn) {
    throw new Error(
      'Set SOURCE_DB_CONNECTION_STRING/SOURCE_DB_URL and TARGET_DB_CONNECTION_STRING/TARGET_DB_URL for verification',
    );
  }
  const scriptPath = path.join(
    projectRoot,
    'supabase',
    'migration-package',
    'direct-migration',
    'scripts',
    'validate-migration.js',
  );
  await runCommand('node', [scriptPath, sourceConn, targetConn]);
}

function parseOptionsFromArgs(argv) {
  const flags = new Set(argv.slice(2));
  return {
    dryRun: flags.has('--dry-run'),
    skipSchema: flags.has('--skip-schema'),
    skipData: flags.has('--skip-data'),
  };
}

async function runMigration(options) {
  try {
    if (!options.skipSchema && !options.dryRun) {
      console.log('Running schema migration');
      await migrateSchema();
    }
    let exportResult = null;
    if (!options.skipData) {
      console.log('Exporting data from source');
      exportResult = await exportData({ dryRun: options.dryRun });
      if (!options.dryRun) {
        console.log('Importing data into target');
        await importData({ exportPath: exportResult.exportPath, mode: exportResult.mode });
      } else {
        console.log(`Dry run: export would be written to ${exportResult.exportPath} (mode: ${exportResult.mode})`);
      }
    }
    if (!options.dryRun && (!exportResult || exportResult.mode === 'db')) {
      console.log('Verifying migration row counts');
      await verifyMigration();
    }
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

const options = parseOptionsFromArgs(process.argv);
runMigration(options);
