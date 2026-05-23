import { logger } from './logger.js';

type CircuitState = 'closed' | 'open' | 'half_open';

type ResilienceOptions = {
  timeoutMs: number;
  maxRetries: number;
  baseBackoffMs: number;
  circuitFailureThreshold: number;
  circuitResetTimeoutMs: number;
};

type OperationContext = {
  dependency: string;
  operation: string;
  requestId?: string;
  tenantId?: string;
};

type AlertRecord = {
  dependency: string;
  operation: string;
  statusCode: number;
  message: string;
  requestId?: string;
  tenantId?: string;
  occurredAt: string;
};

type ResilienceError = Error & {
  statusCode: number;
  code: string;
  retryable: boolean;
};

const state = {
  circuitState: 'closed' as CircuitState,
  consecutiveFailures: 0,
  lastFailureAt: 0,
  halfOpenProbeInFlight: false,
  totalFailures: 0,
  totalSuccesses: 0,
  alerts: [] as AlertRecord[],
};

const options: ResilienceOptions = {
  timeoutMs: Number(process.env.AMRO_DEPENDENCY_TIMEOUT_MS || 4500),
  maxRetries: Number(process.env.AMRO_DEPENDENCY_MAX_RETRIES || 2),
  baseBackoffMs: Number(process.env.AMRO_DEPENDENCY_BASE_BACKOFF_MS || 150),
  circuitFailureThreshold: Number(process.env.AMRO_CIRCUIT_FAILURE_THRESHOLD || 5),
  circuitResetTimeoutMs: Number(process.env.AMRO_CIRCUIT_RESET_TIMEOUT_MS || 30000),
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createResilienceError(message: string, statusCode: number, code: string, retryable: boolean): ResilienceError {
  const error = new Error(message) as ResilienceError;
  error.statusCode = statusCode;
  error.code = code;
  error.retryable = retryable;
  return error;
}

function classifyError(error: unknown): ResilienceError {
  const statusCode = Number((error as { statusCode?: unknown } | null)?.statusCode || 500);
  const code = String((error as { code?: unknown } | null)?.code || 'DEPENDENCY_ERROR');
  const message = String((error as { message?: unknown } | null)?.message || 'Dependency operation failed');
  const normalized = message.toLowerCase();
  if (statusCode >= 500) {
    return createResilienceError(message, statusCode, code, true);
  }
  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return createResilienceError(message, 504, 'DEPENDENCY_TIMEOUT', true);
  }
  if (normalized.includes('network') || normalized.includes('socket') || normalized.includes('econn') || normalized.includes('fetch failed')) {
    return createResilienceError(message, 503, 'DEPENDENCY_NETWORK_ERROR', true);
  }
  if (normalized.includes('schema cache') || normalized.includes('could not find the table') || normalized.includes('does not exist')) {
    return createResilienceError(message, 503, 'DEPENDENCY_SCHEMA_UNAVAILABLE', true);
  }
  return createResilienceError(message, statusCode >= 400 && statusCode < 500 ? statusCode : 500, code, false);
}

function emitAlert(context: OperationContext, error: ResilienceError): void {
  const alert: AlertRecord = {
    dependency: context.dependency,
    operation: context.operation,
    statusCode: error.statusCode,
    message: error.message,
    requestId: context.requestId,
    tenantId: context.tenantId,
    occurredAt: new Date().toISOString(),
  };
  state.alerts.unshift(alert);
  if (state.alerts.length > 50) {
    state.alerts = state.alerts.slice(0, 50);
  }
  logger.error('[Resilience] dependency alert', alert);
}

function isCircuitOpen(now: number): boolean {
  if (state.circuitState !== 'open') return false;
  const elapsed = now - state.lastFailureAt;
  if (elapsed >= options.circuitResetTimeoutMs) {
    state.circuitState = 'half_open';
    state.halfOpenProbeInFlight = false;
    return false;
  }
  return true;
}

async function executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(createResilienceError('Dependency request timed out', 504, 'DEPENDENCY_TIMEOUT', true));
      }, options.timeoutMs);
    });
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function executeWithResilience<T>(
  context: OperationContext,
  operation: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  if (isCircuitOpen(now)) {
    throw createResilienceError(
      `${context.dependency} circuit breaker is open`,
      503,
      'CIRCUIT_OPEN',
      true,
    );
  }
  if (state.circuitState === 'half_open') {
    if (state.halfOpenProbeInFlight) {
      throw createResilienceError(
        `${context.dependency} circuit breaker is probing`,
        503,
        'CIRCUIT_HALF_OPEN',
        true,
      );
    }
    state.halfOpenProbeInFlight = true;
  }

  let attempt = 0;
  let lastError: ResilienceError | null = null;
  while (attempt <= options.maxRetries) {
    try {
      const result = await executeWithTimeout(operation);
      state.totalSuccesses += 1;
      state.consecutiveFailures = 0;
      state.circuitState = 'closed';
      state.halfOpenProbeInFlight = false;
      return result;
    } catch (error) {
      const classified = classifyError(error);
      lastError = classified;
      state.totalFailures += 1;
      state.consecutiveFailures += 1;
      state.lastFailureAt = Date.now();
      if (state.consecutiveFailures >= options.circuitFailureThreshold) {
        state.circuitState = 'open';
        state.halfOpenProbeInFlight = false;
        emitAlert(context, classified);
      }
      const canRetry = classified.retryable && attempt < options.maxRetries;
      if (!canRetry) break;
      const backoff = options.baseBackoffMs * 2 ** attempt;
      const jitter = Math.floor(Math.random() * Math.max(20, options.baseBackoffMs));
      await wait(backoff + jitter);
      attempt += 1;
    }
  }
  state.halfOpenProbeInFlight = false;
  throw lastError || createResilienceError('Dependency failure', 503, 'DEPENDENCY_ERROR', true);
}

export function getResilienceStatus(): {
  circuitState: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: number;
  timeoutMs: number;
  maxRetries: number;
  baseBackoffMs: number;
  circuitFailureThreshold: number;
  circuitResetTimeoutMs: number;
  totalFailures: number;
  totalSuccesses: number;
  recentAlerts: AlertRecord[];
} {
  return {
    circuitState: state.circuitState,
    consecutiveFailures: state.consecutiveFailures,
    lastFailureAt: state.lastFailureAt,
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
    baseBackoffMs: options.baseBackoffMs,
    circuitFailureThreshold: options.circuitFailureThreshold,
    circuitResetTimeoutMs: options.circuitResetTimeoutMs,
    totalFailures: state.totalFailures,
    totalSuccesses: state.totalSuccesses,
    recentAlerts: [...state.alerts],
  };
}
