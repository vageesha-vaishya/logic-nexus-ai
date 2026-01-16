#!/usr/bin/env node
/**
 * pg_dump Export Helper
 *
 * Usage (from project root):
 *   # Using SUPABASE_DB_URL from environment (recommended)
 *   # Example: postgresql://postgres:[PASSWORD]@db.pqulscbawoqzhqobwupu.supabase.co:5432/postgres
 *   export SUPABASE_DB_URL="postgres://postgres:[PASSWORD]@db.pqulscbawoqzhqobwupu.supabase.co:5432/postgres"
 *   npm run pgdump:export
 *
 *   # Custom output directory and filename
 *   npm run pgdump:export -- --out-dir backup/full --file full-backup.sql
 *
 *   # Data-only dump for public schema (no auth/storage)
 *   npm run pgdump:export -- --out-dir backup/data-only --file data-only.sql -- \
 *     --data-only \
 *     --schema=public \
 *     --exclude-schema=auth \
 *     --exclude-schema=storage
 *
 * The script will:
 *   - Run pg_dump against SUPABASE_DB_URL or the provided --url
 *   - Create the output directory if needed
 *   - Write the dump file with -f
 *   - Verify the file exists and has non-zero size
 *   - Exit with code 0 on success, non-zero on error
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function log(message) {
  process.stdout.write(`${message}\n`);
}

function logError(message) {
  process.stderr.write(`${message}\n`);
}

function parseArgs(argv) {
  const args = {
    url: process.env.SUPABASE_DB_URL || "",
    outDir: "backup",
    fileName: "",
    format: "plain",
    extra: [],
  };

  const raw = argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];
    if (arg === "--url" && raw[i + 1]) {
      args.url = raw[++i];
    } else if (arg === "--out-dir" && raw[i + 1]) {
      args.outDir = raw[++i];
    } else if (arg === "--file" && raw[i + 1]) {
      args.fileName = raw[++i];
    } else if (arg === "--format" && raw[i + 1]) {
      args.format = raw[++i];
    } else {
      args.extra.push(arg);
    }
  }

  if (!args.url) {
    throw new Error(
      "Database URL is required. Pass --url or set SUPABASE_DB_URL."
    );
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  if (!args.fileName) {
    args.fileName = `database_export_${ts}.sql`;
  }

  return args;
}

function ensureDirectory(dir) {
  return new Promise((resolve, reject) => {
    fs.mkdir(dir, { recursive: true }, (err) => {
      if (!err) return resolve();
      if (err.code === "EACCES") {
        return reject(
          new Error(`Permission denied creating directory: ${dir}`)
        );
      }
      reject(err);
    });
  });
}

function verifyFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        if (err.code === "ENOENT") {
          return reject(new Error(`Dump file not found at ${filePath}`));
        }
        return reject(err);
      }
      if (!stats.isFile()) {
        return reject(new Error(`Dump path is not a regular file: ${filePath}`));
      }
      if (stats.size === 0) {
        return reject(new Error(`Dump file is empty: ${filePath}`));
      }
      resolve(stats);
    });
  });
}

function analyzeDumpContent(filePath, args) {
  return new Promise((resolve) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        logError(`Skipping dump content analysis: ${err.message}`);
        return resolve();
      }
      if (!data || data.length === 0) {
        logError("Dump file is empty during content analysis.");
        return resolve();
      }
      if (data.length > 50 * 1024 * 1024) {
        log("Dump file larger than 50MB; skipping deep content analysis.");
        return resolve();
      }
      const hasCreateTable = /CREATE\s+TABLE\s+/i.test(data);
      const hasFunctions = /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+/i.test(data);
      const hasProcedures = /CREATE\s+(OR\s+REPLACE\s+)?PROCEDURE\s+/i.test(data);
      const hasEnums = /CREATE\s+TYPE\s+[^;]+AS\s+ENUM\s*\(/i.test(data);
      const hasPolicies = /CREATE\s+POLICY\s+/i.test(data);
      const hasRlsEnable = /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(data);
      const excludedAuth = args.extra.some((a) => a === "--exclude-schema=auth" || a === "--schema=public");
      log("pg_dump content summary:");
      log(`  Tables present:          ${hasCreateTable ? "yes" : "no"}`);
      log(`  Functions present:       ${hasFunctions ? "yes" : "no"}`);
      log(`  Procedures present:      ${hasProcedures ? "yes" : "no"}`);
      log(`  Enum types present:      ${hasEnums ? "yes" : "no"}`);
      log(`  RLS policies present:    ${hasPolicies ? "yes" : "no"}`);
      log(`  RLS enable statements:   ${hasRlsEnable ? "yes" : "no"}`);
      if (!hasPolicies && !hasRlsEnable) {
        log("Warning: No RLS policies or enable statements detected in dump.");
      }
      if (!hasEnums) {
        log("Warning: No enum type definitions detected in dump.");
      }
      if (excludedAuth) {
        log("Note: auth schema appears to be excluded by pg_dump arguments; auth.* objects will not be in this dump.");
      }
      resolve();
    });
  });
}

async function run() {
  const startedAt = Date.now();
  let args;

  try {
    args = parseArgs(process.argv);
  } catch (err) {
    logError(`Error: ${err.message}`);
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), args.outDir);
  const filePath = path.join(outDir, args.fileName);

  log(`Starting pg_dump export`);
  log(`  Database host: ${args.url.replace(/:\/\/([^:@]+)(:[0-9]+)?@/, "://[redacted]@")}`);
  log(`  Output dir:   ${outDir}`);
  log(`  Output file:  ${filePath}`);

  try {
    await ensureDirectory(outDir);
  } catch (err) {
    logError(`Failed to prepare output directory: ${err.message}`);
    process.exit(1);
  }

  const pgArgs = [];

  if (args.format === "plain") {
    pgArgs.push("--no-owner", "--no-privileges");
  }

  pgArgs.push("-f", filePath);

  if (args.extra.length > 0) {
    pgArgs.push(...args.extra);
  }

  pgArgs.push(args.url);

  log(`Executing: pg_dump ${pgArgs.join(" ")}`);

  const child = spawn("pg_dump", pgArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (data) => {
    if (data && data.length > 0) {
      log(data.toString());
    }
  });

  let stderrBuffer = "";

  child.stderr.on("data", (data) => {
    if (!data || data.length === 0) return;
    const text = data.toString();
    stderrBuffer += text;
    logError(text.trimEnd());
    if (text.includes("No space left on device")) {
      logError("Detected disk space issue while running pg_dump. Free disk space and retry.");
    }
    if (/\bfatal:\s+password authentication failed\b/i.test(text)) {
      logError("Authentication failed. Verify SUPABASE_DB_URL credentials or provided --url.");
    }
    if (/could not connect to server/i.test(text) || /could not translate host name/i.test(text)) {
      logError("Connection failed. Check network connectivity, host, port, and firewall rules.");
    }
    if (/permission denied for (schema|table|database)/i.test(text)) {
      logError("Permission issue detected. Ensure the database user has required privileges for pg_dump.");
    }
  });

  child.on("error", (err) => {
    if (err.code === "ENOENT") {
      logError(
        "pg_dump command not found. Ensure PostgreSQL client tools are installed and pg_dump is in PATH."
      );
    } else {
      logError(`Failed to start pg_dump: ${err.message}`);
    }
  });

  child.on("close", async (code) => {
    const durationMs = Date.now() - startedAt;
    if (code !== 0) {
      if (/signal: terminated/i.test(stderrBuffer) || /terminated by signal/i.test(stderrBuffer)) {
        logError("pg_dump terminated by signal. Possible causes: OOM, manual kill, or system limits.");
      }
      logError(`pg_dump exited with code ${code} after ${durationMs}ms.`);
      process.exit(code || 1);
    }

    try {
      const stats = await verifyFile(filePath);
      log(`Export completed in ${durationMs}ms.`);
      log(`Dump file size: ${stats.size} bytes.`);
      await analyzeDumpContent(filePath, args);
      process.exit(0);
    } catch (err) {
      logError(`Export finished but verification failed: ${err.message}`);
      process.exit(1);
    }
  });
}

run().catch((err) => {
  logError(`Unexpected error: ${err.message}`);
  process.exit(1);
});
