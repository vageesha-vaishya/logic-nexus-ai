import type {
  AuthTokenClaims,
  EventEnvelope,
  FranchiseContext,
  GatewayRateLimitPolicy,
  TenantContext,
} from '../../domain/types';
import type {
  CachePort,
  EventBusPort,
  FranchiseRepositoryPort,
  JwtProviderPort,
  LoggerPort,
  NotificationPort,
  OidcProviderPort,
  PaymentGatewayPort,
  PolicyEnginePort,
  RateLimiterPort,
  TenantRepositoryPort,
  TimeProviderPort,
} from '../../application/ports';

export class InMemoryLogger implements LoggerPort {
  info(_message: string, _metadata?: Record<string, unknown>): void {}
  warn(_message: string, _metadata?: Record<string, unknown>): void {}
  error(_message: string, _metadata?: Record<string, unknown>): void {}
}

export class SystemTimeProvider implements TimeProviderPort {
  nowEpochSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }
  nowIsoString(): string {
    return new Date().toISOString();
  }
}

export class InMemoryJwtProvider implements JwtProviderPort {
  async issue(claims: AuthTokenClaims): Promise<string> {
    return Buffer.from(JSON.stringify(claims)).toString('base64url');
  }

  async verify(token: string): Promise<AuthTokenClaims> {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    return JSON.parse(decoded) as AuthTokenClaims;
  }
}

export class StaticOidcProvider implements OidcProviderPort {
  async exchangeAuthorizationCode(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    return {
      accessToken: `oidc_access_${code}`,
      refreshToken: `oidc_refresh_${code}`,
    };
  }
}

export class SimplePolicyEngine implements PolicyEnginePort {
  async hasPermission(claims: AuthTokenClaims, permission: string): Promise<boolean> {
    return claims.permissions.includes(permission);
  }
}

export class InMemoryTenantRepository implements TenantRepositoryPort {
  constructor(private readonly tenants: TenantContext[]) {}

  async getById(tenantId: string): Promise<TenantContext | null> {
    return this.tenants.find((tenant) => tenant.tenantId === tenantId) ?? null;
  }
}

export class InMemoryFranchiseRepository implements FranchiseRepositoryPort {
  constructor(private readonly franchises: FranchiseContext[]) {}

  async getById(franchiseId: string): Promise<FranchiseContext | null> {
    return this.franchises.find((franchise) => franchise.franchiseId === franchiseId) ?? null;
  }

  async listChildren(franchiseId: string): Promise<FranchiseContext[]> {
    return this.franchises.filter((franchise) => franchise.parentFranchiseId === franchiseId);
  }
}

export class InMemoryRateLimiter implements RateLimiterPort {
  private readonly requests = new Map<string, { minuteWindowEpoch: number; count: number }>();

  async isAllowed(subjectKey: string, policy: GatewayRateLimitPolicy): Promise<boolean> {
    const nowMinute = Math.floor(Date.now() / 60000);
    const current = this.requests.get(subjectKey);
    if (!current || current.minuteWindowEpoch !== nowMinute) {
      this.requests.set(subjectKey, { minuteWindowEpoch: nowMinute, count: 1 });
      return true;
    }

    if (current.count >= policy.requestsPerMinute) {
      return false;
    }

    current.count += 1;
    this.requests.set(subjectKey, current);
    return true;
  }
}

export class InMemoryEventBus implements EventBusPort {
  readonly events: EventEnvelope[] = [];

  async publish<TPayload>(event: EventEnvelope<TPayload>): Promise<void> {
    this.events.push(event as EventEnvelope);
  }
}

export class InMemoryCache implements CachePort {
  private readonly map = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.map.get(key) as T | undefined) ?? null;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }
}

export class DummyPaymentGateway implements PaymentGatewayPort {
  readonly provider = 'custom' as const;

  async tokenize(paymentMethodReference: string): Promise<{ token: string; expiresAt: string }> {
    return {
      token: `tok_${paymentMethodReference}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async charge(input: {
    token: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ id: string; status: string }> {
    return {
      id: `pay_${input.idempotencyKey}`,
      status: input.amount > 0 ? 'succeeded' : 'failed',
    };
  }
}

export class InMemoryNotifier implements NotificationPort {
  async send(_channel: 'email' | 'sms' | 'push' | 'in_app', _payload: Record<string, unknown>): Promise<{ messageId: string }> {
    return { messageId: crypto.randomUUID() };
  }
}
