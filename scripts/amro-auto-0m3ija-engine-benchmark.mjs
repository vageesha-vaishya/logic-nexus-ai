import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const parseArg = (name, fallback) => {
  const flag = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(flag));
  if (!arg) return fallback;
  return arg.slice(flag.length);
};

const iterations = Number(parseArg('iterations', '5'));
const tenantId = parseArg('tenant-id', null);
const franchiseId = parseArg('franchise-id', null);

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error('iterations must be a positive number');
}

const timed = async (label, fn) => {
  const started = performance.now();
  const result = await fn();
  const ended = performance.now();
  return { label, ms: Number((ended - started).toFixed(2)), result };
};

const runSeedIteration = async (iterationNo) => {
  const { data, error } = await supabase.rpc('seed_auto_0m3ija_engine_dataset', {
    p_tenant_id: tenantId,
    p_franchise_id: franchiseId,
    p_actor_user_id: null,
    p_force: true,
  });

  if (error) {
    throw new Error(`seed_auto_0m3ija_engine_dataset failed on iteration ${iterationNo}: ${error.message}`);
  }

  return data;
};

const fetchQueryMetrics = async (resolvedTenantId, aircraftId) => {
  const queries = [];

  queries.push(
    await timed('engine_parameter_history_range_scan', async () =>
      supabase
        .from('engine_parameter_history')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', resolvedTenantId)
        .eq('aircraft_id', aircraftId)
    )
  );

  queries.push(
    await timed('maintenance_events_status_breakdown', async () =>
      supabase
        .from('maintenance_events')
        .select('event_status')
        .eq('tenant_id', resolvedTenantId)
        .eq('aircraft_id', aircraftId)
        .limit(500)
    )
  );

  queries.push(
    await timed('asset_health_signals_time_window', async () =>
      supabase
        .from('asset_health_signals')
        .select('signal_type, signal_timestamp, value_numeric')
        .eq('tenant_id', resolvedTenantId)
        .eq('aircraft_id', aircraftId)
        .order('signal_timestamp', { ascending: false })
        .limit(200)
    )
  );

  return queries.map((entry) => ({
    label: entry.label,
    latencyMs: entry.ms,
    error: entry.result.error?.message ?? null,
    rowCount:
      Array.isArray(entry.result.data) ? entry.result.data.length : (entry.result.count ?? null),
  }));
};

const summarize = (values) => {
  const ordered = [...values].sort((a, b) => a - b);
  const total = ordered.reduce((sum, value) => sum + value, 0);
  const avg = total / ordered.length;
  const pct = (ratio) => {
    const idx = Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1);
    return ordered[Math.max(idx, 0)];
  };

  return {
    minMs: Number(ordered[0].toFixed(2)),
    maxMs: Number(ordered[ordered.length - 1].toFixed(2)),
    avgMs: Number(avg.toFixed(2)),
    p95Ms: Number(pct(0.95).toFixed(2)),
    p99Ms: Number(pct(0.99).toFixed(2)),
  };
};

const run = async () => {
  const iterationResults = [];

  for (let index = 1; index <= iterations; index += 1) {
    const runResult = await timed(`seed_iteration_${index}`, async () => runSeedIteration(index));
    iterationResults.push({
      iterationNo: index,
      durationMs: runResult.ms,
      seedResult: runResult.result,
    });
  }

  const successfulSeeds = iterationResults.filter((entry) => entry.seedResult && !entry.seedResult.skipped);
  const referenceSeed = successfulSeeds.at(-1)?.seedResult ?? iterationResults.at(-1)?.seedResult;

  if (!referenceSeed?.tenant_id || !referenceSeed?.aircraft_id) {
    throw new Error('Benchmark aborted: seed RPC did not return tenant_id/aircraft_id');
  }

  const queryMetrics = await fetchQueryMetrics(referenceSeed.tenant_id, referenceSeed.aircraft_id);

  const durationSummary = summarize(iterationResults.map((entry) => entry.durationMs));
  const avgPerAircraftMs = durationSummary.avgMs;
  const projected10kMs = avgPerAircraftMs * 10000;

  const report = {
    generatedAt: new Date().toISOString(),
    seedLabel: 'AUTO-0M3IJA',
    runConfig: { iterations, tenantId, franchiseId },
    seedSummary: {
      tenantId: referenceSeed.tenant_id,
      franchiseId: referenceSeed.franchise_id,
      aircraftId: referenceSeed.aircraft_id,
      componentCount: referenceSeed.component_count,
      parameterCount: referenceSeed.parameter_count,
      maintenanceCount: referenceSeed.maintenance_count,
      performanceCount: referenceSeed.performance_count,
    },
    executionMetrics: {
      ...durationSummary,
      iterations: iterationResults,
      projectedScale: {
        aircraftRecords: 10000,
        estimatedTotalMs: Number(projected10kMs.toFixed(2)),
        estimatedTotalMinutes: Number((projected10kMs / 60000).toFixed(2)),
      },
    },
    queryMetrics,
  };

  const reportDir = path.resolve(process.cwd(), 'artifacts/mro/analysis');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.resolve(reportDir, 'auto-0m3ija-engine-benchmark-report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Benchmark report generated: ${reportPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
