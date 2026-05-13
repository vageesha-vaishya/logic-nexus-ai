import { CircuitBreakerOpenError } from '../../domain/errors';
import type { CircuitBreakerPolicy, GatewayRateLimitPolicy } from '../../domain/types';
import type { LoggerPort, RateLimiterPort, TimeProviderPort } from '../ports';

interface CircuitState {
  openUntilEpochMs: number;
  failures: number;
}

export interface GatewayPolicyServiceDependencies {
  rateLimiter: RateLimiterPort;
  logger: LoggerPort;
  timeProvider: TimeProviderPort;
  defaultRateLimitPolicy: GatewayRateLimitPolicy;
  defaultCircuitBreakerPolicy: CircuitBreakerPolicy;
}

export class GatewayPolicyService {
  private readonly stateByService = new Map<string, CircuitState>();

  constructor(private readonly deps: GatewayPolicyServiceDependencies) {}

  async assertRateLimit(subjectKey: string, policy?: GatewayRateLimitPolicy): Promise<void> {
    const isAllowed = await this.deps.rateLimiter.isAllowed(subjectKey, policy ?? this.deps.defaultRateLimitPolicy);
    if (!isAllowed) {
      throw new Error('Rate limit exceeded');
    }
  }

  assertCircuitClosed(serviceName: string, policy?: CircuitBreakerPolicy): void {
    const breakerPolicy = policy ?? this.deps.defaultCircuitBreakerPolicy;
    const state = this.stateByService.get(serviceName);
    const nowMs = this.deps.timeProvider.nowEpochSeconds() * 1000;

    if (state && state.openUntilEpochMs > nowMs) {
      throw new CircuitBreakerOpenError(serviceName, { openUntilEpochMs: state.openUntilEpochMs });
    }

    if (state && state.openUntilEpochMs <= nowMs) {
      this.stateByService.set(serviceName, { ...state, failures: 0, openUntilEpochMs: 0 });
      this.deps.logger.info('Circuit breaker moved to closed state', { serviceName });
    }

    if (breakerPolicy.halfOpenMaxCalls <= 0) {
      throw new Error('halfOpenMaxCalls must be greater than zero');
    }
  }

  registerServiceFailure(serviceName: string, policy?: CircuitBreakerPolicy): void {
    const breakerPolicy = policy ?? this.deps.defaultCircuitBreakerPolicy;
    const nowMs = this.deps.timeProvider.nowEpochSeconds() * 1000;
    const current = this.stateByService.get(serviceName) ?? { failures: 0, openUntilEpochMs: 0 };
    const updatedFailures = current.failures + 1;

    if (updatedFailures >= breakerPolicy.failureThreshold) {
      const openUntilEpochMs = nowMs + breakerPolicy.recoveryTimeMs;
      this.stateByService.set(serviceName, { failures: updatedFailures, openUntilEpochMs });
      this.deps.logger.warn('Circuit breaker opened', { serviceName, openUntilEpochMs, failures: updatedFailures });
      return;
    }

    this.stateByService.set(serviceName, { failures: updatedFailures, openUntilEpochMs: 0 });
  }
}
