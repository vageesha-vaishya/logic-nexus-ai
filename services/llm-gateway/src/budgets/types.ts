// Types for the budget + quota layer. Per design §4.2-4.3.

export type BudgetScopeKind = 'platform' | 'tenant' | 'tenant_feature' | 'franchisee';
export type PeriodKind = 'daily' | 'weekly' | 'monthly';

export interface BudgetCap {
  scope_kind: BudgetScopeKind;
  scope_id: string;
  period_kind: PeriodKind;
  limit_usd: number;
  warning_pct: number;
  hard_cap: boolean;
  tenant_paid_uncapped: boolean;
}

export interface QuotaCap {
  scope_kind: BudgetScopeKind;
  scope_id: string;
  period_kind: PeriodKind;
  limit_invocations: number | null;
  limit_tokens: number | null;
  hard_cap: boolean;
}

export interface CounterSnapshot {
  scope_kind: BudgetScopeKind;
  scope_id: string;
  period_kind: PeriodKind;
  period_started_at: string;
  spent_usd: number;
  invocations: number;
  tokens: number;
}

/** Result of a pre-call enforcement pass. */
export type EnforcementOutcome =
  | { kind: 'allow'; warnings: string[] }
  | {
      kind: 'reject';
      code: 'BUDGET_EXCEEDED' | 'QUOTA_EXCEEDED';
      scope_kind: BudgetScopeKind;
      scope_id: string;
      period_kind: PeriodKind;
      message: string;
      details: Record<string, unknown>;
    };

export class BudgetError extends Error {
  constructor(public readonly code: 'BUDGET_STORE_UNAVAILABLE', message: string) {
    super(message);
    this.name = 'BudgetError';
  }
}
