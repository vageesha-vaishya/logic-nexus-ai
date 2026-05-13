export type CanvasRegion = 'us-east' | 'us-west' | 'eu-central' | 'ap-south';

export type TenantIsolationMode = 'shared_schema' | 'dedicated_database';

export type ServiceProtocol = 'rest' | 'grpc' | 'event';

export type PaymentGatewayProvider = 'stripe' | 'adyen' | 'braintree' | 'custom';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export type DeploymentStrategy = 'rolling' | 'blue_green' | 'canary';

export interface AuthTokenClaims {
  sub: string;
  tenantId: string;
  franchiseId?: string;
  roles: string[];
  permissions: string[];
  exp: number;
  iat: number;
  iss: string;
  aud: string;
}

export interface RoleDefinition {
  roleKey: string;
  description: string;
  permissions: string[];
  scope: 'platform' | 'tenant' | 'franchise';
}

export interface TenantContext {
  tenantId: string;
  tenantKey: string;
  isolationMode: TenantIsolationMode;
  dataResidencyRegion: CanvasRegion;
  shardKey: string;
}

export interface FranchiseContext {
  franchiseId: string;
  tenantId: string;
  parentFranchiseId?: string;
  hierarchyPath: string[];
  locale: string;
  currencyCode: string;
}

export interface GatewayRateLimitPolicy {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerTenantPerMinute: number;
  burstLimit: number;
}

export interface CircuitBreakerPolicy {
  failureThreshold: number;
  recoveryTimeMs: number;
  halfOpenMaxCalls: number;
}

export interface EventEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  eventName: string;
  eventVersion: string;
  tenantId: string;
  franchiseId?: string;
  occurredAt: string;
  correlationId: string;
  payload: TPayload;
}

export interface CompliancePolicy {
  gdpr: boolean;
  soc2: boolean;
  hipaa: boolean;
  pciDss: boolean;
  retentionDays: number;
  auditLoggingRequired: boolean;
}

export interface CachePolicy {
  ttlSeconds: number;
  staleWhileRevalidateSeconds: number;
  keyPrefix: string;
}

export interface CanvasInfrastructureConfig {
  serviceName: string;
  defaultRegion: CanvasRegion;
  deploymentStrategy: DeploymentStrategy;
  supportedLocales: string[];
  defaultLocale: string;
  authIssuer: string;
  authAudience: string;
  gatewayRateLimitPolicy: GatewayRateLimitPolicy;
  gatewayCircuitBreakerPolicy: CircuitBreakerPolicy;
  compliance: CompliancePolicy;
}
