// §10 W3C trace propagation: parse traceparent, attach to req, surface
// in response header + audit payload.

import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  setAuthLookupForTesting,
  setInvocationWriterForTesting,
} from '../src/routes/invoke.js';
import type { InvocationAuditPayload } from '../src/audit/invocationWriter.js';

const TRACE_ID_VALID = '4bf92f3577b34da6a3ce929d0e0e4736';
const SPAN_ID_VALID  = '00f067aa0ba902b7';
const TRACEPARENT_VALID = `00-${TRACE_ID_VALID}-${SPAN_ID_VALID}-01`;

const validBody = () => ({
  tenant_id: '00000000-0000-4000-8000-000000000001',
  module: 'mod',
  feature: 'feat',
  prompt_key: 'mod.feat',
  variables: {},
});

let captured: InvocationAuditPayload[];
const app = createApp();

beforeAll(() => {
  setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
});
afterAll(() => {
  setAuthLookupForTesting(null);
  setInvocationWriterForTesting(null);
});
beforeEach(() => {
  captured = [];
  setInvocationWriterForTesting((p) => { captured.push(p); });
});

describe('§10 — trace propagation', () => {
  it('uses traceparent trace_id when provided', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .set('traceparent', TRACEPARENT_VALID)
      .send(validBody());
    expect(res.status).toBe(200);
    expect(res.headers['x-trace-id']).toBe(TRACE_ID_VALID);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.trace_id).toBe(TRACE_ID_VALID);
  });

  it('generates a fresh trace_id when no traceparent is sent', async () => {
    const res = await request(app).post('/v1/invoke').send(validBody());
    expect(res.status).toBe(200);
    const tid = res.headers['x-trace-id'];
    expect(tid).toMatch(/^[0-9a-f]{32}$/);
    expect(tid).not.toBe(TRACE_ID_VALID);
    expect(captured[0]?.trace_id).toBe(tid);
  });

  it('ignores malformed traceparent and falls back to fresh id', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .set('traceparent', 'not-a-valid-header')
      .send(validBody());
    expect(res.status).toBe(200);
    expect(res.headers['x-trace-id']).toMatch(/^[0-9a-f]{32}$/);
    expect(res.headers['x-trace-id']).not.toBe('not-a-valid-header');
  });

  it('rejects all-zero trace_id (spec: invalid)', async () => {
    const tp = `00-${'0'.repeat(32)}-${SPAN_ID_VALID}-01`;
    const res = await request(app).post('/v1/invoke').set('traceparent', tp).send(validBody());
    expect(res.status).toBe(200);
    expect(res.headers['x-trace-id']).toMatch(/^[0-9a-f]{32}$/);
    expect(res.headers['x-trace-id']).not.toMatch(/^0+$/);
  });

  it('rejects unsupported traceparent version', async () => {
    const tp = `99-${TRACE_ID_VALID}-${SPAN_ID_VALID}-01`;
    const res = await request(app).post('/v1/invoke').set('traceparent', tp).send(validBody());
    expect(res.headers['x-trace-id']).not.toBe(TRACE_ID_VALID);
  });

  it('rejects wrong-length trace_id', async () => {
    const tp = `00-abc-${SPAN_ID_VALID}-01`;
    const res = await request(app).post('/v1/invoke').set('traceparent', tp).send(validBody());
    expect(res.headers['x-trace-id']).not.toBe('abc');
    expect(res.headers['x-trace-id']).toMatch(/^[0-9a-f]{32}$/);
  });

  it('response always includes x-trace-id alongside x-correlation-id', async () => {
    const res = await request(app).post('/v1/invoke').send(validBody());
    expect(res.headers['x-trace-id']).toBeTruthy();
    expect(res.headers['x-correlation-id']).toBeTruthy();
    expect(res.headers['x-trace-id']).not.toBe(res.headers['x-correlation-id']);
  });

  it('healthz also gets a trace_id header', async () => {
    const res = await request(app).get('/healthz').set('traceparent', TRACEPARENT_VALID);
    expect(res.headers['x-trace-id']).toBe(TRACE_ID_VALID);
  });
});
