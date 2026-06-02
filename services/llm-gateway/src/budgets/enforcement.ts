// Pure-function enforcement: given the caps + counters for all applicable
// scopes, decide if this call should be allowed.
//
// Cap stack (most-specific to broadest):
//   tenant_feature  →  tenant  →  franchisee  →  platform
// At each scope, evaluate both the budget_cap ($) and the quota_cap
// (invocations + tokens). First hard_cap hit wins; warnings accumulate
// for soft warnings (≥ warning_pct of limit_usd).
//
// Note: this is the PRE-call check (current_spent < limit). The
// per-call cost isn't known yet — we can't reject "this call would
// push you over"; we reject "you already are over". Combined with a
// reasonable per-call cap on max_tokens, that's good enough until P5
// adds the predictive-billing pass.

import type { BudgetCap, CounterSnapshot, EnforcementOutcome, QuotaCap } from './types.js';

export interface EnforcementInput {
  /** Caps in priority order (most-specific first). Missing scopes simply skip. */
  caps: BudgetCap[];
  /** Quotas in priority order (most-specific first). */
  quotas: QuotaCap[];
  /** Counter snapshot keyed by `${scope_kind}::${scope_id}::${period_kind}`. */
  counters: Map<string, CounterSnapshot>;
  /** True for billing_mode='tenant_paid' calls (BYO-key). */
  billing_mode_tenant_paid: boolean;
}

function counterKey(scope_kind: string, scope_id: string, period_kind: string): string {
  return `${scope_kind}::${scope_id}::${period_kind}`;
}

/** Pure function — no I/O. */
export function evaluateEnforcement(input: EnforcementInput): EnforcementOutcome {
  const warnings: string[] = [];

  // Budget caps ($).
  for (const cap of input.caps) {
    if (cap.tenant_paid_uncapped && input.billing_mode_tenant_paid) continue;
    if (cap.limit_usd <= 0) continue;

    const snap = input.counters.get(counterKey(cap.scope_kind, cap.scope_id, cap.period_kind));
    const spent = snap?.spent_usd ?? 0;

    if (cap.hard_cap && spent >= cap.limit_usd) {
      return {
        kind: 'reject',
        code: 'BUDGET_EXCEEDED',
        scope_kind: cap.scope_kind,
        scope_id: cap.scope_id,
        period_kind: cap.period_kind,
        message: `${cap.scope_kind}/${cap.scope_id} exceeded ${cap.period_kind} budget`,
        details: { limit_usd: cap.limit_usd, spent_usd: spent, period_kind: cap.period_kind },
      };
    }

    const pct = spent / cap.limit_usd;
    if (pct >= cap.warning_pct / 100) {
      warnings.push(
        `budget_warning:${cap.scope_kind}:${cap.period_kind}:${Math.round(pct * 100)}%_of_${cap.limit_usd}`,
      );
    }
  }

  // Quota caps (invocations + tokens).
  for (const quota of input.quotas) {
    const snap = input.counters.get(counterKey(quota.scope_kind, quota.scope_id, quota.period_kind));
    const invocations = snap?.invocations ?? 0;
    const tokens = snap?.tokens ?? 0;

    if (quota.limit_invocations != null && quota.hard_cap && invocations >= quota.limit_invocations) {
      return {
        kind: 'reject',
        code: 'QUOTA_EXCEEDED',
        scope_kind: quota.scope_kind,
        scope_id: quota.scope_id,
        period_kind: quota.period_kind,
        message: `${quota.scope_kind}/${quota.scope_id} exceeded ${quota.period_kind} invocation quota`,
        details: { limit_invocations: quota.limit_invocations, invocations, period_kind: quota.period_kind },
      };
    }

    if (quota.limit_tokens != null && quota.hard_cap && tokens >= quota.limit_tokens) {
      return {
        kind: 'reject',
        code: 'QUOTA_EXCEEDED',
        scope_kind: quota.scope_kind,
        scope_id: quota.scope_id,
        period_kind: quota.period_kind,
        message: `${quota.scope_kind}/${quota.scope_id} exceeded ${quota.period_kind} token quota`,
        details: { limit_tokens: quota.limit_tokens, tokens, period_kind: quota.period_kind },
      };
    }
  }

  return { kind: 'allow', warnings };
}

/** Order scope_kinds for cap stacking. Most-specific first. */
export function scopeOrder(): readonly BudgetCap['scope_kind'][] {
  return ['tenant_feature', 'tenant', 'franchisee', 'platform'] as const;
}

/** Compute the scope_id for a given (kind, tenant_id, feature, franchisee_id). */
export function scopeIdFor(
  kind: BudgetCap['scope_kind'],
  tenant_id: string,
  feature: string,
  franchisee_id?: string,
): string {
  switch (kind) {
    case 'platform':
      return '*';
    case 'tenant':
      return tenant_id;
    case 'tenant_feature':
      return `${tenant_id}::${feature}`;
    case 'franchisee':
      return franchisee_id ?? '';
  }
}
