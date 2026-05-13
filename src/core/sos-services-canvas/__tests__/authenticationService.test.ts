import { describe, expect, it } from 'vitest';
import { AuthenticationService } from '../application/services/authenticationService';
import { InMemoryJwtProvider, SimplePolicyEngine, StaticOidcProvider } from '../infrastructure/adapters/inMemoryAdapters';

const fixedTimeProvider = {
  nowEpochSeconds: () => 1000,
  nowIsoString: () => '1970-01-01T00:16:40.000Z',
};

describe('AuthenticationService', () => {
  it('issues and authorizes a valid service token', async () => {
    const service = new AuthenticationService({
      jwtProvider: new InMemoryJwtProvider(),
      oidcProvider: new StaticOidcProvider(),
      policyEngine: new SimplePolicyEngine(),
      timeProvider: fixedTimeProvider,
      issuer: 'test-issuer',
      audience: 'test-audience',
      defaultTokenLifetimeSeconds: 300,
    });

    const token = await service.issueServiceToken({
      userId: 'user-1',
      tenantId: 'tenant-1',
      roles: ['tenant_admin'],
      permissions: ['tenant.read'],
    });

    const claims = await service.authorize(token, 'tenant.read');
    expect(claims.sub).toBe('user-1');
    expect(claims.tenantId).toBe('tenant-1');
  });

  it('rejects authorization when permission is missing', async () => {
    const service = new AuthenticationService({
      jwtProvider: new InMemoryJwtProvider(),
      oidcProvider: new StaticOidcProvider(),
      policyEngine: new SimplePolicyEngine(),
      timeProvider: fixedTimeProvider,
      issuer: 'test-issuer',
      audience: 'test-audience',
    });

    const token = await service.issueServiceToken({
      userId: 'user-1',
      tenantId: 'tenant-1',
      roles: ['tenant_viewer'],
      permissions: [],
    });

    await expect(service.authorize(token, 'tenant.read')).rejects.toThrow('Unauthorized action');
  });
});
