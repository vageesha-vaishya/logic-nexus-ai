describe('resilience utilities', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.AMRO_DEPENDENCY_TIMEOUT_MS = '1000';
    process.env.AMRO_DEPENDENCY_MAX_RETRIES = '2';
    process.env.AMRO_DEPENDENCY_BASE_BACKOFF_MS = '1';
    process.env.AMRO_CIRCUIT_FAILURE_THRESHOLD = '2';
    process.env.AMRO_CIRCUIT_RESET_TIMEOUT_MS = '1000';
  });

  it('retries transient dependency failures and eventually succeeds', async () => {
    const { executeWithResilience } = await import('../src/utils/resilience');
    let attempts = 0;
    const result = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: 'test.retry',
        requestId: 'req-1',
        tenantId: 'tenant-1',
      },
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error('network issue');
        }
        return { ok: true, attempts };
      },
    );
    expect((result as { ok: boolean }).ok).toBe(true);
    expect(attempts).toBe(2);
  });

  it('opens circuit after threshold failures and short-circuits subsequent calls', async () => {
    process.env.AMRO_DEPENDENCY_MAX_RETRIES = '0';
    process.env.AMRO_CIRCUIT_FAILURE_THRESHOLD = '1';
    const { executeWithResilience } = await import('../src/utils/resilience');

    await expect(
      executeWithResilience(
        {
          dependency: 'supabase',
          operation: 'test.open-circuit',
          requestId: 'req-2',
        },
        async () => {
          throw new Error('network failure');
        },
      ),
    ).rejects.toMatchObject({ statusCode: 500 });

    await expect(
      executeWithResilience(
        {
          dependency: 'supabase',
          operation: 'test.open-circuit',
          requestId: 'req-3',
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toMatchObject({ code: 'CIRCUIT_OPEN', statusCode: 503 });
  });
});
