// §9.1.c — fine-tune status-polling worker tests.
// Status fetcher mocks OpenAI's retrieve at the SDK boundary; worker is
// exercised against the in-memory store so we can assert end-to-end
// status transitions.

import { jest } from '@jest/globals';
import request from 'supertest';

const mockJobsRetrieve = jest.fn();
jest.unstable_mockModule('openai', () => {
  class FakeOpenAI {
    public fineTuning = { jobs: { retrieve: mockJobsRetrieve, create: jest.fn() } };
    public chat = { completions: { create: jest.fn(async () => ({})) } };
    public embeddings = { create: jest.fn(async () => ({ data: [], usage: { prompt_tokens: 0, total_tokens: 0 } })) };
    constructor(_o: { apiKey: string }) {}
  }
  return { __esModule: true, default: FakeOpenAI };
});

const { fetchOpenAIFineTuneStatus, mapOpenAIStatus, FineTuneStatusError } =
  await import('../src/finetune/openaiStatus.js');
const { buildInMemoryFineTuneStore } = await import('../src/finetune/store.js');
const { runPollTick } = await import('../src/finetune/pollWorker.js');
const { createApp } = await import('../src/app.js');
const { setFineTuneStoreForTesting } = await import('../src/routes/finetune.js');
const { setAuthLookupForTesting } = await import('../src/routes/invoke.js');

const TENANT_UUID = '00000000-0000-4000-8000-00000000ff77';

describe('mapOpenAIStatus', () => {
  it('maps the documented OpenAI states', () => {
    expect(mapOpenAIStatus('validating_files')).toBe('preparing');
    expect(mapOpenAIStatus('queued')).toBe('preparing');
    expect(mapOpenAIStatus('running')).toBe('training');
    expect(mapOpenAIStatus('succeeded')).toBe('succeeded');
    expect(mapOpenAIStatus('failed')).toBe('failed');
    expect(mapOpenAIStatus('cancelled')).toBe('cancelled');
  });
  it('falls back to preparing on unknown / null', () => {
    expect(mapOpenAIStatus(null)).toBe('preparing');
    expect(mapOpenAIStatus('weird_new_state')).toBe('preparing');
  });
});

describe('fetchOpenAIFineTuneStatus', () => {
  beforeEach(() => {
    mockJobsRetrieve.mockReset();
    process.env.OPENAI_API_KEY = 'sk-test';
  });
  afterAll(() => { delete process.env.OPENAI_API_KEY; });

  it('returns a normalized patch on succeeded jobs', async () => {
    mockJobsRetrieve.mockResolvedValue({
      id: 'ftjob-1',
      status: 'succeeded',
      fine_tuned_model: 'ft:gpt-4o-mini:tenant-A:abc',
      trained_tokens: 12345,
      result_files: ['file-result-1'],
      finished_at: 1717000000,
    } as never);
    const patch = await fetchOpenAIFineTuneStatus('ftjob-1');
    expect(patch.status).toBe('succeeded');
    expect(patch.fine_tuned_model_id).toBe('ft:gpt-4o-mini:tenant-A:abc');
    expect(patch.result_metrics).toMatchObject({
      trained_tokens: 12345,
      result_files: ['file-result-1'],
      provider_finished_at: 1717000000,
    });
  });

  it('captures error.message into status_message on failed jobs', async () => {
    mockJobsRetrieve.mockResolvedValue({
      id: 'ftjob-2',
      status: 'failed',
      error: { message: 'training file too small' },
    } as never);
    const patch = await fetchOpenAIFineTuneStatus('ftjob-2');
    expect(patch.status).toBe('failed');
    expect(patch.status_message).toBe('training file too small');
  });

  it('throws PROVIDER_NOT_CONFIGURED without OPENAI_API_KEY', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(fetchOpenAIFineTuneStatus('ftjob-x')).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    });
  });

  it('maps 404 SDK errors to JOB_NOT_FOUND', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockJobsRetrieve.mockRejectedValue(Object.assign(new Error('Fine-tuning job not found'), { status: 404 }));
    await expect(fetchOpenAIFineTuneStatus('ftjob-missing')).rejects.toMatchObject({
      code: 'JOB_NOT_FOUND',
    });
  });

  it('maps generic SDK errors to PROVIDER_UNAVAILABLE', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockJobsRetrieve.mockRejectedValue(new Error('rate limit'));
    await expect(fetchOpenAIFineTuneStatus('ftjob-y')).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });
});

describe('runPollTick', () => {
  function seed(store: ReturnType<typeof buildInMemoryFineTuneStore>) {
    return store.create({
      tenant_id: TENANT_UUID,
      provider_kind: 'openai',
      base_model_id: 'gpt-4o-mini',
      dataset_url: 'file-abc1234567',
    });
  }

  it('flips preparing → training when fetcher returns training', async () => {
    const store = buildInMemoryFineTuneStore();
    const job = await seed(store);
    await store.markPreparing({ id: job.id, provider_job_id: 'ftjob-1' });

    const tick = await runPollTick({
      store,
      fetchers: { openai: async () => ({ status: 'training', status_message: 'running' }) },
    });
    expect(tick.scanned).toBe(1);
    expect(tick.updated).toBe(1);
    const after = await store.get(job.id);
    expect(after?.status).toBe('training');
  });

  it('persists fine_tuned_model_id + result_metrics on succeeded', async () => {
    const store = buildInMemoryFineTuneStore();
    const job = await seed(store);
    await store.markPreparing({ id: job.id, provider_job_id: 'ftjob-2' });

    await runPollTick({
      store,
      fetchers: {
        openai: async () => ({
          status: 'succeeded',
          fine_tuned_model_id: 'ft:gpt-4o-mini:tenant-A:abc',
          result_metrics: { trained_tokens: 999 },
        }),
      },
    });
    const after = await store.get(job.id);
    expect(after?.status).toBe('succeeded');
    expect(after?.fine_tuned_model_id).toBe('ft:gpt-4o-mini:tenant-A:abc');
    expect(after?.result_metrics).toMatchObject({ trained_tokens: 999 });
    expect(after?.finished_at).toBeTruthy();
  });

  it('refuses to overwrite a terminal job (idempotent)', async () => {
    const store = buildInMemoryFineTuneStore();
    const job = await seed(store);
    await store.markPreparing({ id: job.id, provider_job_id: 'ftjob-3' });
    await store.applyProviderStatus(job.id, { status: 'succeeded' });

    // Now even if the fetcher said "training" — store guard should hold.
    await runPollTick({
      store,
      fetchers: { openai: async () => ({ status: 'training' }) },
    });
    const after = await store.get(job.id);
    expect(after?.status).toBe('succeeded');
  });

  it('skips jobs whose provider has no fetcher registered', async () => {
    const store = buildInMemoryFineTuneStore();
    const j = await store.create({
      tenant_id: TENANT_UUID,
      provider_kind: 'mistral',
      base_model_id: 'mistral-small',
      dataset_url: 'file-xyz',
    });
    await store.markPreparing({ id: j.id, provider_job_id: 'mistral-1' });

    const tick = await runPollTick({ store, fetchers: { /* none */ } });
    expect(tick.scanned).toBe(1);
    expect(tick.skipped).toBe(1);
    expect(tick.updated).toBe(0);
  });

  it('flips to failed when the provider lost the job (JOB_NOT_FOUND)', async () => {
    const store = buildInMemoryFineTuneStore();
    const job = await seed(store);
    await store.markPreparing({ id: job.id, provider_job_id: 'ftjob-gone' });

    const tick = await runPollTick({
      store,
      fetchers: {
        openai: async () => {
          throw new FineTuneStatusError('JOB_NOT_FOUND', 'No such fine-tune job');
        },
      },
    });
    expect(tick.errors).toHaveLength(1);
    const after = await store.get(job.id);
    expect(after?.status).toBe('failed');
    expect(after?.status_message).toMatch(/provider lost the job/);
  });

  it('captures transient errors without flipping status', async () => {
    const store = buildInMemoryFineTuneStore();
    const job = await seed(store);
    await store.markPreparing({ id: job.id, provider_job_id: 'ftjob-4' });

    await runPollTick({
      store,
      fetchers: {
        openai: async () => {
          throw new FineTuneStatusError('PROVIDER_UNAVAILABLE', 'rate limit');
        },
      },
    });
    const after = await store.get(job.id);
    expect(after?.status).toBe('preparing');
  });

  it('listInFlight filters out terminal + jobs without provider_job_id', async () => {
    const store = buildInMemoryFineTuneStore();
    // queued — no provider_job_id yet
    await seed(store);
    // in-flight
    const j2 = await seed(store);
    await store.markPreparing({ id: j2.id, provider_job_id: 'ftjob-A' });
    // terminal
    const j3 = await seed(store);
    await store.markPreparing({ id: j3.id, provider_job_id: 'ftjob-B' });
    await store.applyProviderStatus(j3.id, { status: 'failed' });

    const inFlight = await store.listInFlight();
    expect(inFlight.map(j => j.id)).toEqual([j2.id]);
  });
});

describe('POST /v1/fine-tunes/poll (route)', () => {
  const app = createApp();
  const store = buildInMemoryFineTuneStore();

  beforeAll(() => {
    setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
    setFineTuneStoreForTesting(store);
  });
  afterAll(() => {
    setAuthLookupForTesting(null);
    setFineTuneStoreForTesting(null);
  });
  beforeEach(() => { store.clear(); });

  it('returns 200 + tick counts even when nothing is in flight', async () => {
    const res = await request(app).post('/v1/fine-tunes/poll').send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scanned: 0, updated: 0, unchanged: 0 });
  });
});
