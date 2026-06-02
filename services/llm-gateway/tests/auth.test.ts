import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  setAuthLookupForTesting,
  setInvocationWriterForTesting,
  setResolverStoresForTesting,
} from '../src/routes/invoke.js';
import { buildInMemoryStoresFromObject } from '../src/resolver/inMemoryStores.js';
import type { AuthLookup, AuthResult } from '../src/auth/serviceToken.js';

const validBody = {
  tenant_id: '00000000-0000-4000-8000-000000000001',
  module: 'compliance',
  feature: 'screening.hit_reasoning',
  prompt_key: 'compliance.screening.hit_reasoning',
  variables: { party: { name: 'ACME', country: 'US' } },
};

beforeAll(() => {
  setResolverStoresForTesting(
    buildInMemoryStoresFromObject({
      provider_configs: [
        { scope_kind: 'platform_default', scope_id: '*', provider_kind: 'echo',
          model_id: 'echo-v1', is_pin: false, billing_mode: 'platform_paid' },
      ],
      provider_models: [{ provider_kind: 'echo', model_id: 'echo-v1', capabilities: ['json_mode'] }],
      egress_policy: [{ provider_kind: 'echo', allowed_regions: ['us-east'] }],
    }),
  );
  setInvocationWriterForTesting(() => undefined);
});

afterAll(() => {
  setResolverStoresForTesting(null);
  setInvocationWriterForTesting(null);
  setAuthLookupForTesting(null);
});

afterEach(() => {
  setAuthLookupForTesting(null);
});

const app = createApp();

const fakeLookup = (rows: Record<string, AuthResult>): AuthLookup => async (plaintext: string) => {
  return rows[plaintext] ?? { authenticated: false, reason: 'token not found' };
};

describe('service-token auth — enforced mode', () => {
  beforeEach(() => {
    setAuthLookupForTesting(
      fakeLookup({
        'good-token-with-invoke': {
          authenticated: true,
          token_id: 'tok-1',
          platform_id: 'logic-nexus-ai',
          token_prefix: 'good-token-',
          scopes: ['invoke'],
        },
        'good-token-no-scope': {
          authenticated: true,
          token_id: 'tok-2',
          platform_id: 'logic-nexus-ai',
          token_prefix: 'good-token-',
          scopes: ['read_usage'],
        },
        'good-token-for-aviation': {
          authenticated: true,
          token_id: 'tok-3',
          platform_id: 'aviation-ai-pro',
          token_prefix: 'good-token-',
          scopes: ['invoke'],
        },
      }),
    );
  });

  it('401 when no Authorization header', async () => {
    const res = await request(app).post('/v1/invoke').send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401 when token unknown', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .set('Authorization', 'Bearer not-a-real-token')
      .send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('403 when token lacks the invoke scope', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .set('Authorization', 'Bearer good-token-no-scope')
      .send(validBody);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.details).toMatchObject({
      required_scope: 'invoke',
      token_scopes: ['read_usage'],
    });
  });

  it('200 when token has invoke scope', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .set('Authorization', 'Bearer good-token-with-invoke')
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.provider_kind).toBe('echo');
  });

  it('403 when X-Platform-Id mismatches token platform_id', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .set('Authorization', 'Bearer good-token-with-invoke')
      .set('X-Platform-Id', 'aviation-ai-pro')
      .send(validBody);
    expect(res.status).toBe(403);
    expect(res.body.error.details).toMatchObject({
      header_platform_id: 'aviation-ai-pro',
      token_platform_id: 'logic-nexus-ai',
    });
  });

  it('200 when X-Platform-Id matches token platform_id', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .set('Authorization', 'Bearer good-token-for-aviation')
      .set('X-Platform-Id', 'aviation-ai-pro')
      .send(validBody);
    expect(res.status).toBe(200);
  });

  it('Bearer header is case-insensitive', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .set('Authorization', 'bearer good-token-with-invoke')
      .send(validBody);
    expect(res.status).toBe(200);
  });
});

describe('service-token auth — open mode', () => {
  beforeEach(() => {
    const openLookup: AuthLookup = async () => ({ authenticated: true, open_mode: true });
    setAuthLookupForTesting(openLookup);
  });

  it('200 without any Authorization header', async () => {
    const res = await request(app).post('/v1/invoke').send(validBody);
    expect(res.status).toBe(200);
  });

  it('200 with arbitrary Authorization header (skipped scope check)', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .set('Authorization', 'Bearer literally-anything')
      .send(validBody);
    expect(res.status).toBe(200);
  });
});
