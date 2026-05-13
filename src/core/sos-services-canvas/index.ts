import { AuthenticationService } from './application/services/authenticationService';
import { EventAndIntegrationService } from './application/services/eventAndIntegrationService';
import { FranchiseService } from './application/services/franchiseService';
import { GatewayPolicyService } from './application/services/gatewayPolicyService';
import { TenantIsolationService } from './application/services/tenantIsolationService';
import {
  DummyPaymentGateway,
  InMemoryCache,
  InMemoryEventBus,
  InMemoryFranchiseRepository,
  InMemoryJwtProvider,
  InMemoryLogger,
  InMemoryNotifier,
  InMemoryRateLimiter,
  InMemoryTenantRepository,
  SimplePolicyEngine,
  StaticOidcProvider,
  SystemTimeProvider,
} from './infrastructure/adapters/inMemoryAdapters';
import { defaultCanvasInfrastructureConfig } from './infrastructure/config/defaultCanvasConfig';
import { createCanvasApiHandlers } from './presentation/http/canvasApiHandlers';

export * from './application/ports';
export * from './application/services/authenticationService';
export * from './application/services/eventAndIntegrationService';
export * from './application/services/franchiseService';
export * from './application/services/gatewayPolicyService';
export * from './application/services/tenantIsolationService';
export * from './domain/errors';
export * from './domain/types';
export * from './infrastructure/adapters/inMemoryAdapters';
export * from './infrastructure/config/defaultCanvasConfig';
export * from './presentation/http/canvasApiHandlers';

export function createCanvasModule() {
  const logger = new InMemoryLogger();
  const timeProvider = new SystemTimeProvider();
  const cache = new InMemoryCache();
  const eventBus = new InMemoryEventBus();
  const paymentGateway = new DummyPaymentGateway();
  const notifier = new InMemoryNotifier();

  const tenantRepository = new InMemoryTenantRepository([
    {
      tenantId: 'tenant-demo',
      tenantKey: 'demo',
      isolationMode: 'shared_schema',
      dataResidencyRegion: 'us-east',
      shardKey: 'tenant-demo',
    },
  ]);

  const franchiseRepository = new InMemoryFranchiseRepository([
    {
      franchiseId: 'franchise-root',
      tenantId: 'tenant-demo',
      hierarchyPath: ['franchise-root'],
      locale: 'en-US',
      currencyCode: 'USD',
    },
  ]);

  const authService = new AuthenticationService({
    jwtProvider: new InMemoryJwtProvider(),
    oidcProvider: new StaticOidcProvider(),
    policyEngine: new SimplePolicyEngine(),
    timeProvider,
    issuer: defaultCanvasInfrastructureConfig.authIssuer,
    audience: defaultCanvasInfrastructureConfig.authAudience,
  });

  const tenantIsolationService = new TenantIsolationService({
    tenantRepository,
    cache,
    logger,
  });

  const franchiseService = new FranchiseService({
    franchiseRepository,
  });

  const gatewayPolicyService = new GatewayPolicyService({
    rateLimiter: new InMemoryRateLimiter(),
    logger,
    timeProvider,
    defaultRateLimitPolicy: defaultCanvasInfrastructureConfig.gatewayRateLimitPolicy,
    defaultCircuitBreakerPolicy: defaultCanvasInfrastructureConfig.gatewayCircuitBreakerPolicy,
  });

  const integrationsService = new EventAndIntegrationService({
    eventBus,
    paymentGateways: [paymentGateway],
    notifier,
  });

  const apiHandlers = createCanvasApiHandlers({
    authService,
    tenantIsolationService,
  });

  return {
    config: defaultCanvasInfrastructureConfig,
    services: {
      authService,
      tenantIsolationService,
      franchiseService,
      gatewayPolicyService,
      integrationsService,
    },
    adapters: {
      logger,
      cache,
      eventBus,
      paymentGateway,
      notifier,
      tenantRepository,
      franchiseRepository,
    },
    apiHandlers,
  };
}
