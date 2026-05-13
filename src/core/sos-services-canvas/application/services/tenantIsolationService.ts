import { TenantIsolationViolationError } from '../../domain/errors';
import type { TenantContext } from '../../domain/types';
import type { CachePort, LoggerPort, TenantRepositoryPort } from '../ports';

export interface TenantIsolationServiceDependencies {
  tenantRepository: TenantRepositoryPort;
  cache: CachePort;
  logger: LoggerPort;
}

export class TenantIsolationService {
  constructor(private readonly deps: TenantIsolationServiceDependencies) {}

  async resolveTenantContext(tenantId: string): Promise<TenantContext> {
    const cacheKey = `canvas:tenant:${tenantId}`;
    const cached = await this.deps.cache.get<TenantContext>(cacheKey);
    if (cached) {
      return cached;
    }

    const tenant = await this.deps.tenantRepository.getById(tenantId);
    if (!tenant) {
      throw new TenantIsolationViolationError({ tenantId, reason: 'tenant_not_found' });
    }

    await this.deps.cache.set(cacheKey, tenant, 120);
    return tenant;
  }

  enforceIsolation(requestTenantId: string, subjectTenantId: string): void {
    if (requestTenantId !== subjectTenantId) {
      this.deps.logger.warn('Tenant isolation policy blocked cross-tenant request', {
        requestTenantId,
        subjectTenantId,
      });
      throw new TenantIsolationViolationError({
        requestTenantId,
        subjectTenantId,
        reason: 'cross_tenant_request',
      });
    }
  }
}
