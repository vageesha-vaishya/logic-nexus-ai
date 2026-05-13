export class CanvasDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CanvasDomainError';
  }
}

export class UnauthorizedCanvasActionError extends CanvasDomainError {
  constructor(action: string, metadata?: Record<string, unknown>) {
    super(`Unauthorized action: ${action}`, 'CANVAS_UNAUTHORIZED_ACTION', metadata);
    this.name = 'UnauthorizedCanvasActionError';
  }
}

export class TenantIsolationViolationError extends CanvasDomainError {
  constructor(metadata?: Record<string, unknown>) {
    super('Tenant isolation boundary violation detected', 'CANVAS_TENANT_ISOLATION_VIOLATION', metadata);
    this.name = 'TenantIsolationViolationError';
  }
}

export class CircuitBreakerOpenError extends CanvasDomainError {
  constructor(serviceName: string, metadata?: Record<string, unknown>) {
    super(`Circuit breaker is open for service ${serviceName}`, 'CANVAS_CIRCUIT_BREAKER_OPEN', metadata);
    this.name = 'CircuitBreakerOpenError';
  }
}
