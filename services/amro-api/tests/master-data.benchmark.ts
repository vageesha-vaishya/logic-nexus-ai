type BenchmarkConfig = {
  endpoint: string;
  token: string;
  tenantId: string;
  userId: string;
  concurrency: number;
  totalRequests: number;
};

type Sample = {
  latencyMs: number;
  statusCode: number;
};

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function resolveConfig(): BenchmarkConfig {
  const endpoint = String(process.env.AMRO_BENCHMARK_ENDPOINT || 'http://localhost:3001/api/v2/amro/master-data/aircraft?page=1&page_size=25');
  const token = String(process.env.AMRO_BENCHMARK_TOKEN || '');
  const tenantId = String(process.env.AMRO_BENCHMARK_TENANT_ID || '');
  const userId = String(process.env.AMRO_BENCHMARK_USER_ID || 'benchmark-user');
  const concurrency = Math.max(1, Number(process.env.AMRO_BENCHMARK_CONCURRENCY || 20));
  const totalRequests = Math.max(concurrency, Number(process.env.AMRO_BENCHMARK_REQUESTS || 400));
  return { endpoint, token, tenantId, userId, concurrency, totalRequests };
}

async function runRequest(config: BenchmarkConfig): Promise<Sample> {
  const headers: Record<string, string> = {
    'x-tenant-id': config.tenantId,
  };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  } else {
    headers['x-user-id'] = config.userId;
  }
  const startedAt = performance.now();
  const response = await fetch(config.endpoint, {
    method: 'GET',
    headers,
  });
  const latencyMs = performance.now() - startedAt;
  await response.text();
  return {
    latencyMs,
    statusCode: response.status,
  };
}

async function runBenchmark(config: BenchmarkConfig): Promise<void> {
  if (!config.tenantId) {
    throw new Error('AMRO_BENCHMARK_TENANT_ID is required');
  }

  const samples: Sample[] = [];
  const startedAt = performance.now();
  let completed = 0;

  async function worker(): Promise<void> {
    while (completed < config.totalRequests) {
      const requestIndex = completed;
      completed += 1;
      if (requestIndex >= config.totalRequests) return;
      const sample = await runRequest(config);
      samples.push(sample);
    }
  }

  await Promise.all(Array.from({ length: config.concurrency }, () => worker()));
  const totalDurationMs = performance.now() - startedAt;
  const latencyValues = samples.map((sample) => sample.latencyMs);
  const successCount = samples.filter((sample) => sample.statusCode >= 200 && sample.statusCode < 300).length;
  const failureCount = samples.length - successCount;
  const rps = samples.length > 0 ? (samples.length / totalDurationMs) * 1000 : 0;

  const report = {
    endpoint: config.endpoint,
    concurrency: config.concurrency,
    totalRequests: samples.length,
    successCount,
    failureCount,
    throughputRps: Number(rps.toFixed(2)),
    latencyMs: {
      min: Number(Math.min(...latencyValues).toFixed(2)),
      p50: Number(percentile(latencyValues, 50).toFixed(2)),
      p95: Number(percentile(latencyValues, 95).toFixed(2)),
      p99: Number(percentile(latencyValues, 99).toFixed(2)),
      max: Number(Math.max(...latencyValues).toFixed(2)),
    },
    statusCodes: samples.reduce<Record<string, number>>((acc, sample) => {
      const key = String(sample.statusCode);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failureCount > 0) {
    process.exitCode = 1;
  }
}

runBenchmark(resolveConfig()).catch((error) => {
  process.stderr.write(`${String((error as Error).message || error)}\n`);
  process.exit(1);
});
