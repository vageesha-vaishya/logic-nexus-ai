/**
 * Per-tenant LLM-spend enforcement. Real implementation reads
 * `core.llm_budgets` + sums recent `core.llm_usage` rows; Phase 0
 * ships interfaces + an always-allow stub.
 *
 * Master §6.11 — soft threshold fires a notification, hard threshold
 * blocks. Plus per-feature caps and per-tenant rate-limit QPS.
 */

export type BudgetCheckResult =
  | { allow: true }
  | {
      allow: false;
      reason:
        | "monthly_budget_exceeded"
        | "feature_cap_exceeded"
        | "rate_limit_exceeded";
      detail: string;
      reset_at: string;
    };

export interface BudgetGuard {
  /**
   * Pre-flight check. estimated_cost_usd is a conservative upper bound
   * computed from prompt frontmatter (default model + max_tokens).
   */
  check(args: {
    tenant_id: string;
    feature: string;
    estimated_cost_usd: number;
  }): Promise<BudgetCheckResult>;

  /**
   * Called after the provider call to record actual spend. Idempotent
   * via the invocation_id key.
   */
  record(args: {
    tenant_id: string;
    feature: string;
    actual_cost_usd: number;
    invocation_id: string;
  }): Promise<void>;
}

/**
 * Phase 0 default: always allow, never record. Replaced by a
 * database-backed implementation in Phase 9.
 */
export class AllowAllBudgetGuard implements BudgetGuard {
  async check(): Promise<BudgetCheckResult> {
    return { allow: true };
  }
  async record(): Promise<void> {
    /* no-op */
  }
}

/**
 * Test helper — records every call into a queue so tests can assert
 * what was charged.
 */
export class MemoryBudgetGuard implements BudgetGuard {
  readonly recorded: Array<{
    tenant_id: string;
    feature: string;
    cost: number;
    invocation_id: string;
  }> = [];

  constructor(private readonly cap_usd_per_tenant: number = Infinity) {}

  async check(args: {
    tenant_id: string;
    feature: string;
    estimated_cost_usd: number;
  }): Promise<BudgetCheckResult> {
    const spentSoFar = this.recorded
      .filter((r) => r.tenant_id === args.tenant_id)
      .reduce((s, r) => s + r.cost, 0);
    if (spentSoFar + args.estimated_cost_usd > this.cap_usd_per_tenant) {
      return {
        allow: false,
        reason: "monthly_budget_exceeded",
        detail: `tenant ${args.tenant_id} would exceed cap ${this.cap_usd_per_tenant}`,
        reset_at: nextMonthStart(),
      };
    }
    return { allow: true };
  }

  async record(args: {
    tenant_id: string;
    feature: string;
    actual_cost_usd: number;
    invocation_id: string;
  }): Promise<void> {
    this.recorded.push({
      tenant_id: args.tenant_id,
      feature: args.feature,
      cost: args.actual_cost_usd,
      invocation_id: args.invocation_id,
    });
  }
}

function nextMonthStart(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
