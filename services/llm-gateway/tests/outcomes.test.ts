// Pure-function + route-level tests for outcome capture.

import request from 'supertest';
import { createApp } from '../src/app.js';
import { buildOutcomeRecord, buildInMemoryOutcomeStore } from '../src/outcomes/store.js';
import type { Outcome, OutcomeContext } from '../src/outcomes/types.js';
import { setOutcomeStoreForTesting } from '../src/routes/outcomes.js';
import { setAuthLookupForTesting } from '../src/routes/invoke.js';

const baseCtx: OutcomeContext = {
  tenant_id: 'tenant-A',
  prompt_key: 'compliance.screening.hit_reasoning',
  prompt_version_id: 'ver-1',
  experiment_id: 'exp-1',
  variant_label: 'b',
};

describe('buildOutcomeRecord — pure shape', () => {
  it('records accepted outcome with user_id, no edited_output', () => {
    const r = buildOutcomeRecord('inv-1', { kind: 'accepted', user_id: 'u1', notes: 'looked good' }, baseCtx);
    expect(r).toMatchObject({
      invocation_id: 'inv-1',
      tenant_id: 'tenant-A',
      prompt_key: 'compliance.screening.hit_reasoning',
      prompt_version_id: 'ver-1',
      experiment_id: 'exp-1',
      variant_label: 'b',
      kind: 'accepted',
      user_id: 'u1',
      notes: 'looked good',
      source: 'sdk',
    });
    expect(r.edited_output).toBeUndefined();
  });

  it('records accepted_after_edit with edited_output', () => {
    const edited = { verdict: 'true_positive', confidence: 0.95 };
    const r = buildOutcomeRecord(
      'inv-2',
      { kind: 'accepted_after_edit', user_id: 'u2', edited_output: edited },
      baseCtx,
    );
    expect(r.kind).toBe('accepted_after_edit');
    expect(r.edited_output).toEqual(edited);
  });

  it('records overridden with edited_output', () => {
    const r = buildOutcomeRecord(
      'inv-3',
      { kind: 'overridden', user_id: 'u3', edited_output: 'manual override' },
      baseCtx,
    );
    expect(r.kind).toBe('overridden');
    expect(r.edited_output).toBe('manual override');
  });

  it('records rejected with user_id but no edited_output', () => {
    const r = buildOutcomeRecord('inv-4', { kind: 'rejected', user_id: 'u4', notes: 'wrong' }, baseCtx);
    expect(r.kind).toBe('rejected');
    expect(r.user_id).toBe('u4');
    expect(r.edited_output).toBeUndefined();
  });

  it('records ignored without user_id', () => {
    const r = buildOutcomeRecord('inv-5', { kind: 'ignored' }, baseCtx);
    expect(r.kind).toBe('ignored');
    expect(r.user_id).toBeUndefined();
  });

  it('passes through tenant/prompt/experiment context unchanged', () => {
    const r = buildOutcomeRecord('inv-6', { kind: 'ignored' }, {
      tenant_id: 'tX',
      prompt_key: null,
      prompt_version_id: null,
      experiment_id: null,
      variant_label: null,
    });
    expect(r.tenant_id).toBe('tX');
    expect(r.prompt_key).toBeNull();
    expect(r.experiment_id).toBeNull();
  });

  it('source override sticks', () => {
    const r = buildOutcomeRecord('inv-7', { kind: 'ignored' }, baseCtx, 'admin_ui');
    expect(r.source).toBe('admin_ui');
  });
});

describe('POST /v1/outcomes — route', () => {
  let store: ReturnType<typeof buildInMemoryOutcomeStore>;
  const app = createApp();

  beforeAll(() => {
    setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
    store = buildInMemoryOutcomeStore();
    setOutcomeStoreForTesting(store);
  });

  afterAll(() => {
    setAuthLookupForTesting(null);
    setOutcomeStoreForTesting(null);
  });

  beforeEach(() => {
    store.clear();
  });

  it('201 + records the row when invocation context exists', async () => {
    store.setContext('inv-A', baseCtx);
    const res = await request(app).post('/v1/outcomes').send({
      invocation_id: 'inv-A',
      outcome: { kind: 'accepted', user_id: 'u1' },
    });
    expect(res.status).toBe(201);
    expect(res.body.invocation_id).toBe('inv-A');
    expect(res.body.kind).toBe('accepted');
    expect(res.body.outcome_id).toMatch(/^inmem-outcome-/);

    const persisted = store.list();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      invocation_id: 'inv-A',
      tenant_id: 'tenant-A',
      experiment_id: 'exp-1',
      variant_label: 'b',
      kind: 'accepted',
      user_id: 'u1',
    });
  });

  it('404 INVOCATION_NOT_FOUND when invocation_id unknown', async () => {
    const res = await request(app).post('/v1/outcomes').send({
      invocation_id: 'nonexistent',
      outcome: { kind: 'ignored' },
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVOCATION_NOT_FOUND');
  });

  it('400 when invocation_id missing', async () => {
    const res = await request(app).post('/v1/outcomes').send({
      outcome: { kind: 'ignored' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('400 when outcome.kind invalid', async () => {
    store.setContext('inv-X', baseCtx);
    const res = await request(app).post('/v1/outcomes').send({
      invocation_id: 'inv-X',
      outcome: { kind: 'pondered' },
    });
    expect(res.status).toBe(400);
  });

  it('400 when accepted_after_edit missing edited_output', async () => {
    store.setContext('inv-Y', baseCtx);
    const res = await request(app).post('/v1/outcomes').send({
      invocation_id: 'inv-Y',
      outcome: { kind: 'accepted_after_edit', user_id: 'u1' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/edited_output/);
  });

  it('400 when non-ignored outcome missing user_id', async () => {
    store.setContext('inv-Z', baseCtx);
    const res = await request(app).post('/v1/outcomes').send({
      invocation_id: 'inv-Z',
      outcome: { kind: 'accepted' },  // missing user_id
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/user_id/);
  });

  it('ignored kind does NOT require user_id', async () => {
    store.setContext('inv-W', baseCtx);
    const res = await request(app).post('/v1/outcomes').send({
      invocation_id: 'inv-W',
      outcome: { kind: 'ignored', notes: 'skip' },
    });
    expect(res.status).toBe(201);
  });
});
