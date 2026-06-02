// §9.1.b — fine-tune submitter tests. OpenAI SDK mocked at the
// module boundary; covers pre-submit validation + happy path + the
// /v1/fine-tunes/:id/submit route.

import { jest } from '@jest/globals';
import request from 'supertest';

const mockJobsCreate = jest.fn();
jest.unstable_mockModule('openai', () => {
  class FakeOpenAI {
    public fineTuning = { jobs: { create: mockJobsCreate } };
    // Carry the chat client too so the rest of the gateway keeps
    // working when this test suite runs alongside chat-provider tests.
    public chat = { completions: { create: jest.fn(async () => ({})) } };
    public embeddings = { create: jest.fn(async () => ({ data: [], usage: { prompt_tokens: 0, total_tokens: 0 } })) };
    constructor(_o: { apiKey: string }) {}
  }
  return { __esModule: true, default: FakeOpenAI };
});

const { submitOpenAIFineTune, FineTuneSubmitError } = await import('../src/finetune/openaiSubmit.js');
const { buildInMemoryFineTuneStore } = await import('../src/finetune/store.js');
const { createApp } = await import('../src/app.js');
const { setFineTuneStoreForTesting } = await import('../src/routes/finetune.js');
const { setAuthLookupForTesting } = await import('../src/routes/invoke.js');

const TENANT_UUID = '00000000-0000-4000-8000-00000000ff77';

function jobShell(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inmem-ft-1',
    tenant_id: TENANT_UUID,
    provider_kind: 'openai' as const,
    base_model_id: 'gpt-4o-mini-2024-07-18',
    fine_tuned_model_id: null,
    provider_job_id: null,
    dataset_url: 'file-abc1234567',
    dataset_format: 'jsonl' as const,
    hyperparameters: {},
    status: 'queued' as const,
    status_message: null,
    result_metrics: {},
    created_by_user_id: null,
    created_at: '2026-06-03T00:00:00Z',
    updated_at: '2026-06-03T00:00:00Z',
    started_at: null,
    finished_at: null,
    cancelled_at: null,
    cancel_reason: null,
    ...overrides,
  };
}

describe('submitOpenAIFineTune (pure)', () => {
  beforeEach(() => {
    mockJobsCreate.mockReset();
    process.env.OPENAI_API_KEY = 'sk-test';
  });
  afterAll(() => { delete process.env.OPENAI_API_KEY; });

  it('happy path: passes model + training_file + hyperparameters; returns provider_job_id', async () => {
    mockJobsCreate.mockResolvedValue({
      id: 'ftjob-XYZ',
      model: 'gpt-4o-mini-2024-07-18',
    } as never);
    const job = jobShell({ hyperparameters: { n_epochs: 3, batch_size: 4 } });
    const result = await submitOpenAIFineTune(job);
    expect(result.provider_job_id).toBe('ftjob-XYZ');
    expect(result.effective_model_id).toBe('gpt-4o-mini-2024-07-18');
    const [args] = mockJobsCreate.mock.calls[0]!;
    expect(args).toMatchObject({
      model: 'gpt-4o-mini-2024-07-18',
      training_file: 'file-abc1234567',
      hyperparameters: { n_epochs: 3, batch_size: 4 },
    });
  });

  it('drops unknown hyperparameters before sending', async () => {
    mockJobsCreate.mockResolvedValue({ id: 'ftjob-1', model: 'm' } as never);
    const job = jobShell({ hyperparameters: { n_epochs: 1, fake_param: 'nope' } });
    await submitOpenAIFineTune(job);
    const [args] = mockJobsCreate.mock.calls[0]!;
    expect((args as { hyperparameters: Record<string, unknown> }).hyperparameters).toEqual({ n_epochs: 1 });
  });

  it('attaches suffix when provided, capped at 18 chars', async () => {
    mockJobsCreate.mockResolvedValue({ id: 'ftjob-1', model: 'm' } as never);
    await submitOpenAIFineTune(jobShell(), { suffix: 'a'.repeat(50) });
    const [args] = mockJobsCreate.mock.calls[0]!;
    expect((args as { suffix: string }).suffix).toHaveLength(18);
  });

  it('throws PROVIDER_NOT_CONFIGURED when OPENAI_API_KEY missing', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(submitOpenAIFineTune(jobShell())).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    });
  });

  it('refuses non-openai provider_kind', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    await expect(submitOpenAIFineTune(jobShell({ provider_kind: 'anthropic' as never }))).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    });
  });

  it('throws DATASET_REQUIRED when dataset_url is missing', async () => {
    await expect(submitOpenAIFineTune(jobShell({ dataset_url: null }))).rejects.toMatchObject({
      code: 'DATASET_REQUIRED',
    });
  });

  it('throws DATASET_REQUIRED when dataset_url is not an openai file id', async () => {
    await expect(submitOpenAIFineTune(jobShell({ dataset_url: 'gs://bucket/dataset.jsonl' }))).rejects.toMatchObject({
      code: 'DATASET_REQUIRED',
    });
  });

  it('wraps SDK errors as PROVIDER_UNAVAILABLE', async () => {
    mockJobsCreate.mockRejectedValue(new Error('rate limit'));
    await expect(submitOpenAIFineTune(jobShell())).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });
});

describe('POST /v1/fine-tunes/:id/submit (route)', () => {
  const app = createApp();
  const store = buildInMemoryFineTuneStore();

  beforeAll(() => {
    setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
    setFineTuneStoreForTesting(store);
    process.env.OPENAI_API_KEY = 'sk-test';
  });
  afterAll(() => {
    setAuthLookupForTesting(null);
    setFineTuneStoreForTesting(null);
    delete process.env.OPENAI_API_KEY;
  });
  beforeEach(() => { store.clear(); mockJobsCreate.mockReset(); });

  it('200 + flips status queued → preparing + records provider_job_id', async () => {
    const create = await request(app).post('/v1/fine-tunes').send({
      tenant_id: TENANT_UUID,
      provider_kind: 'openai',
      base_model_id: 'gpt-4o-mini-2024-07-18',
      dataset_url: 'file-abc1234567',
    });
    const id = create.body.id;

    mockJobsCreate.mockResolvedValue({
      id: 'ftjob-real',
      model: 'gpt-4o-mini-2024-07-18:tenant-A:abc',
    } as never);

    const res = await request(app).post(`/v1/fine-tunes/${id}/submit`).send({});
    expect(res.status).toBe(200);
    expect(res.body.provider_job_id).toBe('ftjob-real');
    expect(res.body.job.status).toBe('preparing');
    expect(res.body.job.provider_job_id).toBe('ftjob-real');
    expect(res.body.job.started_at).toBeTruthy();
  });

  it('409 when job not in queued state', async () => {
    const create = await request(app).post('/v1/fine-tunes').send({
      tenant_id: TENANT_UUID,
      provider_kind: 'openai',
      base_model_id: 'gpt-4o-mini',
      dataset_url: 'file-abc1234567',
    });
    const id = create.body.id;
    // Cancel it first
    await request(app).post(`/v1/fine-tunes/${id}/cancel`).send({});
    const res = await request(app).post(`/v1/fine-tunes/${id}/submit`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.details).toMatchObject({ current_status: 'cancelled' });
  });

  it('400 + INVALID_REQUEST when dataset_url is not an openai file id', async () => {
    const create = await request(app).post('/v1/fine-tunes').send({
      tenant_id: TENANT_UUID,
      provider_kind: 'openai',
      base_model_id: 'gpt-4o-mini',
      dataset_url: 'gs://bucket/data.jsonl',
    });
    const id = create.body.id;
    const res = await request(app).post(`/v1/fine-tunes/${id}/submit`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.details?.submitter_code).toBe('DATASET_REQUIRED');
  });

  it('404 when job not found', async () => {
    const res = await request(app).post('/v1/fine-tunes/inmem-nope/submit').send({});
    expect(res.status).toBe(404);
  });
});
