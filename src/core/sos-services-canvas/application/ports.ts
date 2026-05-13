import type {
  AuthTokenClaims,
  EventEnvelope,
  FranchiseContext,
  GatewayRateLimitPolicy,
  PaymentGatewayProvider,
  TenantContext,
} from '../domain/types';

export interface LoggerPort {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface MetricsPort {
  increment(metricName: string, tags?: Record<string, string>): void;
  observe(metricName: string, value: number, tags?: Record<string, string>): void;
}

export interface TimeProviderPort {
  nowEpochSeconds(): number;
  nowIsoString(): string;
}

export interface JwtProviderPort {
  issue(claims: AuthTokenClaims): Promise<string>;
  verify(token: string): Promise<AuthTokenClaims>;
}

export interface OidcProviderPort {
  exchangeAuthorizationCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string }>;
}

export interface PolicyEnginePort {
  hasPermission(claims: AuthTokenClaims, permission: string, context?: Record<string, unknown>): Promise<boolean>;
}

export interface TenantRepositoryPort {
  getById(tenantId: string): Promise<TenantContext | null>;
}

export interface FranchiseRepositoryPort {
  getById(franchiseId: string): Promise<FranchiseContext | null>;
  listChildren(franchiseId: string): Promise<FranchiseContext[]>;
}

export interface RateLimiterPort {
  isAllowed(subjectKey: string, policy: GatewayRateLimitPolicy): Promise<boolean>;
}

export interface EventBusPort {
  publish<TPayload>(event: EventEnvelope<TPayload>): Promise<void>;
}

export interface CachePort {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface PaymentGatewayPort {
  provider: PaymentGatewayProvider;
  tokenize(paymentMethodReference: string): Promise<{ token: string; expiresAt: string }>;
  charge(input: { token: string; amount: number; currency: string; idempotencyKey: string }): Promise<{ id: string; status: string }>;
}

export interface NotificationPort {
  send(channel: 'email' | 'sms' | 'push' | 'in_app', payload: Record<string, unknown>): Promise<{ messageId: string }>;
}
