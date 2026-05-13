import type { CanvasInfrastructureConfig } from '../../domain/types';

export const defaultCanvasInfrastructureConfig: CanvasInfrastructureConfig = {
  serviceName: 'sos-services-canvas',
  defaultRegion: 'us-east',
  deploymentStrategy: 'blue_green',
  supportedLocales: ['en-US', 'en-GB', 'fr-FR', 'de-DE', 'ar-SA'],
  defaultLocale: 'en-US',
  authIssuer: 'https://auth.sos-services-canvas.local',
  authAudience: 'sos-services-canvas-api',
  gatewayRateLimitPolicy: {
    requestsPerSecond: 50,
    requestsPerMinute: 2000,
    requestsPerTenantPerMinute: 5000,
    burstLimit: 250,
  },
  gatewayCircuitBreakerPolicy: {
    failureThreshold: 5,
    recoveryTimeMs: 30000,
    halfOpenMaxCalls: 3,
  },
  compliance: {
    gdpr: true,
    soc2: true,
    hipaa: false,
    pciDss: true,
    retentionDays: 365,
    auditLoggingRequired: true,
  },
};
