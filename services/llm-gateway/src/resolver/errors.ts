// Resolver-specific errors. The route layer translates these to
// HTTP responses via the gateway error envelope (§2.4).

export class ResolverError extends Error {
  constructor(
    public readonly code:
      | 'PROVIDER_NOT_CONFIGURED'
      | 'EGRESS_FORBIDDEN'
      | 'MODEL_CAPABILITY_MISMATCH'
      | 'MODEL_DEPRECATED',
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ResolverError';
  }
}
