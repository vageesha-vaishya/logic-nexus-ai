import request from 'supertest';
import { createApp } from '../src/app.js';
import { buildInMemoryRtbfStore } from '../src/rtbf/store.js';
import { setRtbfStoreForTesting } from '../src/routes/rtbf.js';
import { setAuthLookupForTesting } from '../src/routes/invoke.js';

const app = createApp();
let store: ReturnType<typeof buildInMemoryRtbfStore>;

const TENANT_UUID = '00000000-0000-4000-8000-000000000001';
const USER_UUID = '00000000-0000-4000-8000-000000000002';

beforeAll(() => {
  setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
  store = buildInMemoryRtbfStore();
  setRtbfStoreForTesting(store);
});

afterAll(() => {
  setAuthLookupForTesting(null);
  setRtbfStoreForTesting(null);
});

beforeEach(() => store.clear());

describe('POST /v1/admin/right-to-be-forgotten', () => {
  it('200 + scrubs subject + returns counts (subject_type=party)', async () => {
    store.setResult({ scrubbed_invocations: 42, scrubbed_outcomes: 0, rtbf_log_id: 'log-1' });
    const res = await request(app).post('/v1/admin/right-to-be-forgotten').send({
      tenant_id: TENANT_UUID,
      subject_type: 'party',
      subject_id: 'acme-corp-12345',
      reason: 'customer requested deletion',
    });
    expect(res.status).toBe(200);
    expect(res.body.scrubbed_invocations).toBe(42);
    expect(res.body.scrubbed_outcomes).toBe(0);
    expect(res.body.rtbf_log_id).toBe('log-1');
    expect(res.body.subject_id_prefix).toBe('acme-cor…');
    expect(res.body.subject_id).toBeUndefined(); // full id NEVER echoed back

    expect(store.calls()).toHaveLength(1);
    expect(store.calls()[0]).toMatchObject({
      tenant_id: TENANT_UUID,
      subject_type: 'party',
      subject_id: 'acme-corp-12345',
      reason: 'customer requested deletion',
    });
  });

  it('200 + scrubs user subject (subject_id must be a uuid)', async () => {
    store.setResult({ scrubbed_invocations: 5, scrubbed_outcomes: 3, rtbf_log_id: 'log-2' });
    const res = await request(app).post('/v1/admin/right-to-be-forgotten').send({
      tenant_id: TENANT_UUID,
      subject_type: 'user',
      subject_id: USER_UUID,
    });
    expect(res.status).toBe(200);
    expect(res.body.scrubbed_outcomes).toBe(3);
  });

  it('400 when subject_type=user but subject_id is not a uuid', async () => {
    const res = await request(app).post('/v1/admin/right-to-be-forgotten').send({
      tenant_id: TENANT_UUID,
      subject_type: 'user',
      subject_id: 'not-a-uuid',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.message).toMatch(/uuid/);
    expect(store.calls()).toHaveLength(0);
  });

  it('400 when tenant_id is not a uuid', async () => {
    const res = await request(app).post('/v1/admin/right-to-be-forgotten').send({
      tenant_id: 'not-a-uuid',
      subject_type: 'party',
      subject_id: 'party-1',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/tenant_id/);
  });

  it('400 when subject_type missing', async () => {
    const res = await request(app).post('/v1/admin/right-to-be-forgotten').send({
      tenant_id: TENANT_UUID,
      subject_id: 'party-1',
    });
    expect(res.status).toBe(400);
  });

  it('400 when subject_id missing', async () => {
    const res = await request(app).post('/v1/admin/right-to-be-forgotten').send({
      tenant_id: TENANT_UUID,
      subject_type: 'party',
    });
    expect(res.status).toBe(400);
  });

  it('400 when subject_id too long', async () => {
    const res = await request(app).post('/v1/admin/right-to-be-forgotten').send({
      tenant_id: TENANT_UUID,
      subject_type: 'party',
      subject_id: 'x'.repeat(300),
    });
    expect(res.status).toBe(400);
  });

  it('idempotent: second call with same subject still 200 (store handles it)', async () => {
    store.setResult({ scrubbed_invocations: 0, scrubbed_outcomes: 0, rtbf_log_id: 'log-empty' });
    const res = await request(app).post('/v1/admin/right-to-be-forgotten').send({
      tenant_id: TENANT_UUID,
      subject_type: 'party',
      subject_id: 'already-scrubbed',
    });
    expect(res.status).toBe(200);
    expect(res.body.scrubbed_invocations).toBe(0);
  });
});
