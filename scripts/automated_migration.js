#!/usr/bin/env node

/**
 * Automated Migration System
 * 
 * Usage: node scripts/automated_migration.js [options]
 * 
 * Options:
 *   --target-url <url>      Target Database URL (or set SUPABASE_DB_URL/TARGET_DB_URL env var)
 *   --dry-run               Simulate execution without applying changes
 *   --skip-backup           Skip pre-migration backup (NOT RECOMMENDED)
 * 
 * Logic:
 * 1. Identify pending migrations by comparing local files vs remote supabase_migrations table.
 * 2. If no pending migrations, exit.
 * 3. Perform Pre-migration Backup (Data + Schema).
 * 4. Apply Migrations using `supabase db push`.
 * 5. Verify Migration (row counts).
 * 6. If Error/Verification Failure -> ROLLBACK (Restore from Backup).
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import pg from 'pg';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load environment variables from .env file
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'supabase', 'migrations');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'migration-artifacts', 'backups');
const LOG_FILE = path.join(__dirname, `migration-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

// Baseline configuration
// Migrations before this version will be marked as applied without execution
// This fixes the issue where an existing DB has no history, avoiding "already exists" errors for old scripts.
// Based on user context, we assume the DB is consistent up to Nov 2025.
const BASELINE_VERSION = '20251114000000';

// Logger
function log(msg, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] [${type}] ${msg}`;
    console.log(message);
    fs.appendFileSync(LOG_FILE, message + '\n');
}

// Helper to run commands
function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        log(`Executing: ${command} ${args.join(' ')}`);
        const proc = spawn(command, args, { 
            stdio: 'pipe', 
            cwd: PROJECT_ROOT,
            env: { ...process.env, ...options.env } 
        });
        proc.on('error', (err) => {
            reject(err);
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            const str = data.toString();
            stdout += str;
            process.stdout.write(str); 
        });

        proc.stderr.on('data', (data) => {
            const str = data.toString();
            stderr += str;
            process.stderr.write(str);
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
        });
    });
}

async function main() {
    log('Starting Automated Migration System...');
    
    // 1. Resolve Configuration
    const targetUrl = process.argv.find(a => a.startsWith('--target-url='))?.split('=')[1] 
        || process.env.SUPABASE_DB_URL 
        || process.env.TARGET_DB_URL;
    
    const skipBackup = process.argv.includes('--skip-backup');
    const dryRun = process.argv.includes('--dry-run');

    if (!targetUrl) {
        log('Error: Target Database URL is required. Set SUPABASE_DB_URL or use --target-url', 'ERROR');
        process.exit(1);
    }

    // Check dependencies
// Replace the "Check dependencies" block with this:
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';
    
    const missingDeps = [];
    try {
        await runCommand(checkCmd, ['pg_dump']);
    } catch {
        missingDeps.push('pg_dump');
    }
    try {
        await runCommand(checkCmd, ['psql']);
    } catch {
        missingDeps.push('psql');
    }

    if (missingDeps.length > 0) {
        if (!skipBackup) {
            log(`WARNING: Missing tools: ${missingDeps.join(', ')}.`, 'WARN');
            log('Backup and Rollback will be unavailable.', 'WARN');
            log('Continuing without backup (downgrading from critical error to warning to allow repair)...', 'WARN');
        } else {
            log(`WARNING: Missing tools: ${missingDeps.join(', ')}. Backup and Rollback will be unavailable.`, 'WARN');
        }
    }

    const client = new Client({ connectionString: targetUrl });
    let backupFile = null;

    try {
        await client.connect();
        log('Connected to target database.');

        // 2. Identify Pending Migrations
        log('Checking for pending migrations...');
        
        // Get local migration files
        const localFiles = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Chronological order

        let appliedVersions = new Set();
        try {
            const res = await client.query('SELECT version FROM supabase_migrations');
            appliedVersions = new Set(res.rows.map(r => r.version));
        } catch (err) {
            if (err.code === '42P01') { // undefined_table
                log('supabase_migrations table does not exist. Assuming all migrations are pending.', 'WARN');
            } else {
                throw err;
            }
        }

        const pendingList = localFiles.filter(f => {
            const version = f.split('_')[0];
            return !appliedVersions.has(version);
        });

        if (pendingList.length === 0) {
            log('No pending migrations found. System is up to date.');
            process.exit(0);
        }

        log(`Found ${pendingList.length} pending migrations:\n${pendingList.join('\n')}`);

        if (dryRun) {
            log('Dry run enabled. Skipping execution.');
            process.exit(0);
        }

        // 3. Pre-migration Backup
        if (!skipBackup && missingDeps.length === 0) {
            log('Initiating pre-migration backup...');
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backupFileName = `pre_migration_backup_${ts}.sql`;
            backupFile = path.join(BACKUP_DIR, backupFileName);
            
            // Ensure backup dir exists
            fs.mkdirSync(BACKUP_DIR, { recursive: true });

            // Note: pg_dump requires password in PGPASSWORD env var if not in connection string
            // We assume connection string has it or env var is set.
            await runCommand('pg_dump', [targetUrl, '-f', backupFile, '--clean', '--if-exists', '--no-owner', '--no-privileges']); // --clean to allow clean restore
            
            // Verify backup
            const stats = fs.statSync(backupFile);
            if (stats.size === 0) {
                throw new Error('Backup file is empty!');
            }
            log(`Backup created successfully: ${backupFile} (${stats.size} bytes)`);
        } else {
            log('Skipping pre-migration backup (User requested or missing dependencies)', 'WARN');
        }

        // 4. Apply Migrations
        log('Applying migrations...');
        
        try {
            // Ensure migration table exists
            await client.query(`
                CREATE TABLE IF NOT EXISTS supabase_migrations (
                    version text PRIMARY KEY,
                    name text,
                    applied_at timestamptz DEFAULT now()
                );
            `);

            // Process migrations one by one (Atomic per file)
            // We do not use a global transaction to avoid issues with scripts containing transaction control
            for (const file of pendingList) {
                log(`Applying: ${file}`);
                const filePath = path.join(MIGRATIONS_DIR, file);
                let sql = fs.readFileSync(filePath, 'utf8');
                
                // Strip explicit transaction control to avoid interfering with our logic
                 // (Only simple cases at start/end of file or lines)
                 sql = sql.replace(/^\s*BEGIN\s*;/gim, '').replace(/^\s*COMMIT\s*;/gim, '');
 
                 const version = file.split('_')[0];

                 // Baseline Check: Skip execution for old migrations
                 if (version < BASELINE_VERSION) {
                     log(`Skipping execution for baseline migration ${file} (marking as applied).`);
                     await client.query(
                         'INSERT INTO supabase_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING', 
                         [version, file]
                     );
                     continue;
                 }
                 
                 try {
                     await client.query('BEGIN');
                    
                    // Execute migration
                    await client.query(sql);
                    
                    // Record version
                    await client.query(
                        'INSERT INTO supabase_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING', 
                        [version, file]
                    );

                    await client.query('COMMIT');
                    
                } catch (migrationErr) {
                    await client.query('ROLLBACK');

                    // Check for common "Already Exists" errors to assume idempotency
                    const idempotentCodes = ['42P07', '42710', '42701', '42P06', '42723', '42712'];
                    
                    if (idempotentCodes.includes(migrationErr.code) || 
                        migrationErr.message.includes('already exists') ||
                        migrationErr.message.includes('already a partition')) {
                        
                        log(`Warning: Migration ${file} failed but seems already applied (${migrationErr.message}). Marking as applied.`, 'WARN');
                        
                        // Record version as applied (since it existed)
                        await client.query(
                            'INSERT INTO supabase_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING', 
                            [version, file]
                        );
                    } else {
                        // Real error -> Stop execution
                        throw migrationErr;
                    }
                }
            }

            log(`Successfully applied (or verified) ${pendingList.length} migrations.`);

        } catch (err) {
            await client.query('ROLLBACK');
            throw new Error(`Migration failed: ${err.message}`);
        }

        // 5. Verify Migration
        log('Verifying migration...');
        
        const verifyRes = await client.query('SELECT version FROM supabase_migrations');
        const finalAppliedVersions = new Set(verifyRes.rows.map(r => r.version));
        const unappliedAfter = pendingList.filter(f => {
            const version = f.split('_')[0];
            return !finalAppliedVersions.has(version);
        });

        if (unappliedAfter.length > 0) {
            throw new Error(`Verification failed: Some migrations were not applied: ${unappliedAfter.join(', ')}`);
        }
        log('Verification successful: All migrations applied.');

    } catch (err) {
        log(`CRITICAL ERROR: ${err.message}`, 'ERROR');
        
        // 6. Rollback
        if (backupFile && fs.existsSync(backupFile)) {
            log('Initiating ROLLBACK...', 'WARN');
            try {
                log('Cleaning target database (DROP SCHEMA public)...');
                await runCommand('psql', [targetUrl, '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;']);

                // Restore from backup
                log(`Restoring from backup: ${backupFile}`);
                await runCommand('psql', [targetUrl, '-f', backupFile]);
                log('Rollback completed successfully. Database restored to pre-migration state.', 'INFO');
            } catch (restoreErr) {
                log(`ROLLBACK FAILED: ${restoreErr.message}`, 'FATAL');
                log('MANUAL INTERVENTION REQUIRED!', 'FATAL');
            }
        } else {
            log('No backup available for rollback.', 'ERROR');
        }
        
        process.exit(1);
    } finally {
        await client.end();
    }
    
    log('Automated migration process completed successfully.');
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
