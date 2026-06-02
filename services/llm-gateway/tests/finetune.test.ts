import request from 'supertest';
import { createApp } from '../src/app.js';
import { buildInMemoryFineTuneStore } from '../src/finetune/store.js';
import { setFineTuneStoreForTesting } from '../src/routes/finetune.js';
import { setAuthLookupForTesting } from '../src/routes/invoke.js';

const app = createApp();
const TENANT_UUID = '00000000-0000-4000-8000-00000000ff01';
let store: ReturnType<typeof buildInMemoryFineTuneStore>;

beforeAll(() => {
  setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
  store = buildInMemoryFineTuneStore();
  setFineTuneStoreForTesting(store);
});

afterAll(() => {
  setAuthLookupForTesting(null);
  setFineTuneStoreForTesting(null);
});

beforeEach(() => store.clear());

describe('POST /v1/fine-tunes', () => {
  it('201 + creates a queued job', async () => {
    const res = await request(app).post('/v1/fine-tunes').send({
      tenant_id: TENANT_UUID,
      provider_kind: 'openai',
      base_model_id: 'gpt-4o-mini',
      dataset_url: 'gs://bucket/dataset.jsonl',
      dataset_format: 'jsonl',
      hyperparameters: { n_epochs: 3 },
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^inmem-ft-/);
    expect(res.body.status).toBe('queued');
    expect(res.body.tenant_id).toBe(TENANT_UUID);
    expect(res.body.provider_kind).toBe('openai');
    expect(res.body.base_model_id).toBe('gpt-4o-mini');
    expect(res.body.hyperparameters).toEqual({ n_epochs: 3 });
    expect(store.list()).toHaveLength(1);
  });

  it('400 when tenant_id missing or not a uuid', async () => {
    const res = await request(app).post('/v1/fine-tunes').send({
      provider_kind: 'openai',
      base_model_id: 'gpt-4o-mini',
    });
    expect(res.status).toBe(400);
  });

  it('400 when provider_kind unknown', async () => {
    const res = await request(app).post('/v1/fine-tunes').send({
      tenant_id: TENANT_UUID,
      provider_kind: 'rogue',
      base_model_id: 'x',
    });
    expect(res.status).toBe(400);
  });

  it('400 when base_model_id missing', async () => {
    const res = await request(app).post('/v1/fine-tunes').send({
      tenant_id: TENANT_UUID,
      provider_kind: 'openai',
    });
    expect(res.status).toBe(400);
  });

  it('400 when dataset_format invalid', async () => {
    const res = await request(app).post('/v1/fine-tunes').send({
      tenant_id: TENANT_UUID,
      provider_kind: 'openai',
      base_model_id: 'gpt-4o-mini',
      dataset_format: 'xml',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/fine-tunes/:id', () => {
  it('200 returns the job row', async () => {
    const create = await request(app).post('/v1/fine-tunes').send({
      tenant_id: TENANT_UUID, provider_kind: 'openai', base_model_id: 'gpt-4o-mini',
    });
    const id = create.body.id;
    const res = await request(app).get(`/v1/fine-tunes/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.status).toBe('queued');
  });

  it('404 when id unknown', async () => {
    const res = await request(app).get('/v1/fine-tunes/inmem-ft-does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('POST /v1/fine-tunes/:id/cancel', () => {
  it('200 flips status to cancelled with reason', async () => {
    const create = await request(app).post('/v1/fine-tunes').send({
      tenant_id: TENANT_UUID, provider_kind: 'openai', base_model_id: 'gpt-4o-mini',
    });
    const id = create.body.id;
    const res = await request(app).post(`/v1/fine-tunes/${id}/cancel`).send({ reason: 'budget exceeded' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.cancel_reason).toBe('budget exceeded');
    expect(res.body.cancelled_at).toBeTruthy();
  });

  it('idempotent: second cancel on an already-cancelled job returns the same state', async () => {
    const create = await request(app).post('/v1/fine-tunes').send({
      tenant_id: TENANT_UUID, provider_kind: 'openai', base_model_id: 'gpt-4o-mini',
    });
    const id = create.body.id;
    const first = await request(app).post(`/v1/fine-tunes/${id}/cancel`).send({});
    const second = await request(app).post(`/v1/fine-tunes/${id}/cancel`).send({ reason: 'ignored' });
    expect(first.body.cancelled_at).toBe(second.body.cancelled_at); // unchanged
    expect(second.body.cancel_reason).toBe(first.body.cancel_reason); // unchanged
  });

  it('404 when id unknown', async () => {
    const res = await request(app).post('/v1/fine-tunes/inmem-ft-does-not-exist/cancel').send({});
    expect(res.status).toBe(404);
  });
});
