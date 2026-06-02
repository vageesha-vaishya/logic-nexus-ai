// Types for the outcomes layer. Per design §6.6.

export type OutcomeKind =
  | 'accepted'
  | 'accepted_after_edit'
  | 'rejected'
  | 'overridden'
  | 'ignored';

export type OutcomeSource = 'sdk' | 'admin_ui' | 'cron' | 'test';

/** Mirrors the Outcome union in packages/llm-client/src/types.ts. */
export type Outcome =
  | { kind: 'accepted'; user_id: string; notes?: string }
  | { kind: 'accepted_after_edit'; user_id: string; edited_output: unknown; notes?: string }
  | { kind: 'rejected'; user_id: string; notes?: string }
  | { kind: 'overridden'; user_id: string; edited_output: unknown; notes?: string }
  | { kind: 'ignored'; notes?: string };

/** What we persist to gateway.outcomes. */
export interface OutcomeRecord {
  id?: string;
  invocation_id: string;
  tenant_id: string;
  prompt_key?: string | null;
  prompt_version_id?: string | null;
  experiment_id?: string | null;
  variant_label?: 'a' | 'b' | null;
  kind: OutcomeKind;
  user_id?: string | null;
  edited_output?: unknown;
  notes?: string | null;
  source?: OutcomeSource;
}

export class OutcomeError extends Error {
  constructor(
    public readonly code:
      | 'INVOCATION_NOT_FOUND'
      | 'OUTCOME_STORE_UNAVAILABLE',
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'OutcomeError';
  }
}
