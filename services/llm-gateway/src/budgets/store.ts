// Budget store. Fetches the cap stack + current counters for a call,
// and increments counters post-call. Postgres-backed in prod;
// in-memory in dev / jest (same credential-deferred pattern).

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import type {
  BudgetCap,
  CounterSnapshot,
  PeriodKind,
  QuotaCap,
} from './types.js';
import { scopeIdFor, scopeOrder, type EnforcementInput } from './enforcement.js';

export interface BudgetStore {
  /**
   * Returns the cap stack + counters for a given (tenant, feature[, franchisee]).
   * The counters Map uses keys `${scope_kind}::${scope_id}::${period_kind}`.
   */
  loadEnforcementSnapshot(args: {
    tenant_id: string;
    feature: string;
    franchisee_id?: string;
    now?: Date;
  }): Promise<Pick<EnforcementInput, 'caps' | 'quotas' | 'counters'>>;

  /**
   * Increment counters at every applicable scope. Called fire-and-forget
   * after a successful invoke. The caller passes the *resolved* cost +
   * usage numbers and the budget scopes the caps actually applied to.
   */
  incrementCounters(args: {
    tenant_id: string;
    feature: string;
    franchisee_id?: string;
    spent_usd: number;
    invocations: number;
    tokens: number;
    now?: Date;
  }): Promise<void>;
}

function readEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function periodStart(period_kind: PeriodKind, now: Date): Date {
  const d = new Date(now);
  if (period_kind === 'daily') {
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  if (period_kind === 'weekly') {
    // ISO week (Mon start) — match SQL date_trunc('week', …)
    const day = d.getUTCDay();
    const offset = day === 0 ? 6 : day - 1; // Sunday → 6, Monday → 0
    d.setUTCDate(d.getUTCDate() - offset);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  // monthly
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function counterKey(scope_kind: string, scope_id: string, period_kind: string): string {
  return `${scope_kind}::${scope_id}::${period_kind}`;
}

interface InMemoryState {
  caps: BudgetCap[];
  quotas: QuotaCap[];
  counters: Map<string, CounterSnapshot>;
}

// ── In-memory implementation ─────────────────────────────────────────

export function buildInMemoryBudgetStore(): BudgetStore & {
  setCap(cap: BudgetCap): void;
  setQuota(quota: QuotaCap): void;
  setCounter(snap: CounterSnapshot): void;
  clear(): void;
  listCounters(): CounterSnapshot[];
} {
  const state: InMemoryState = {
    caps: [],
    quotas: [],
    counters: new Map(),
  };

  function applicableCaps(tenant_id: string, feature: string, franchisee_id?: string): BudgetCap[] {
    const out: BudgetCap[] = [];
    for (const kind of scopeOrder()) {
      const scope_id = scopeIdFor(kind, tenant_id, feature, franchisee_id);
      if (kind === 'franchisee' && !franchisee_id) continue;
      const matching = state.caps.filter((c) => c.scope_kind === kind && c.scope_id === scope_id);
      out.push(...matching);
    }
    return out;
  }

  function applicableQuotas(tenant_id: string, feature: string, franchisee_id?: string): QuotaCap[] {
    const out: QuotaCap[] = [];
    for (const kind of scopeOrder()) {
      const scope_id = scopeIdFor(kind, tenant_id, feature, franchisee_id);
      if (kind === 'franchisee' && !franchisee_id) continue;
      const matching = state.quotas.filter((q) => q.scope_kind === kind && q.scope_id === scope_id);
      out.push(...matching);
    }
    return out;
  }

  return {
    async loadEnforcementSnapshot(args) {
      const caps = applicableCaps(args.tenant_id, args.feature, args.franchisee_id);
      const quotas = applicableQuotas(args.tenant_id, args.feature, args.franchisee_id);

      const counters = new Map<string, CounterSnapshot>();
      for (const cap of caps) {
        const k = counterKey(cap.scope_kind, cap.scope_id, cap.period_kind);
        const snap = state.counters.get(k);
        if (snap) counters.set(k, snap);
      }
      for (const quota of quotas) {
        const k = counterKey(quota.scope_kind, quota.scope_id, quota.period_kind);
        const snap = state.counters.get(k);
        if (snap) counters.set(k, snap);
      }

      return { caps, quotas, counters };
    },
    async incrementCounters(args) {
      const now = args.now ?? new Date();
      const caps = applicableCaps(args.tenant_id, args.feature, args.franchisee_id);
      const quotas = applicableQuotas(args.tenant_id, args.feature, args.franchisee_id);
      const allScopes = new Map<string, { scope_kind: BudgetCap['scope_kind']; scope_id: string; period_kind: PeriodKind }>();
      for (const c of caps) allScopes.set(counterKey(c.scope_kind, c.scope_id, c.period_kind),
        { scope_kind: c.scope_kind, scope_id: c.scope_id, period_kind: c.period_kind });
      for (const q of quotas) allScopes.set(counterKey(q.scope_kind, q.scope_id, q.period_kind),
        { scope_kind: q.scope_kind, scope_id: q.scope_id, period_kind: q.period_kind });

      for (const { scope_kind, scope_id, period_kind } of allScopes.values()) {
        const ps = periodStart(period_kind, now);
        const k = counterKey(scope_kind, scope_id, period_kind);
        const existing = state.counters.get(k);
        if (existing && new Date(existing.period_started_at).getTime() === ps.getTime()) {
          existing.spent_usd += args.spent_usd;
          existing.invocations += args.invocations;
          existing.tokens += args.tokens;
        } else {
          state.counters.set(k, {
            scope_kind,
            scope_id,
            period_kind,
            period_started_at: ps.toISOString(),
            spent_usd: args.spent_usd,
            invocations: args.invocations,
            tokens: args.tokens,
          });
        }
      }
    },
    setCap(cap) {
      const idx = state.caps.findIndex(
        (c) => c.scope_kind === cap.scope_kind && c.scope_id === cap.scope_id && c.period_kind === cap.period_kind,
      );
      if (idx >= 0) state.caps[idx] = cap;
      else state.caps.push(cap);
    },
    setQuota(quota) {
      const idx = state.quotas.findIndex(
        (q) => q.scope_kind === quota.scope_kind && q.scope_id === quota.scope_id && q.period_kind === quota.period_kind,
      );
      if (idx >= 0) state.quotas[idx] = quota;
      else state.quotas.push(quota);
    },
    setCounter(snap) {
      state.counters.set(counterKey(snap.scope_kind, snap.scope_id, snap.period_kind), snap);
    },
    clear() {
      state.caps.length = 0;
      state.quotas.length = 0;
      state.counters.clear();
    },
    listCounters() {
      return Array.from(state.counters.values());
    },
  };
}

// ── Supabase-backed implementation ───────────────────────────────────

export function buildSupabaseBudgetStore(): BudgetStore | null {
  const env = readEnv();
  if (!env) return null;
  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' },
  });
  logger.info('budget store: supabase initialized', { url_host: new URL(env.url).host });

  function scopeKeysFor(tenant_id: string, feature: string, franchisee_id?: string) {
    const scopes: { scope_kind: BudgetCap['scope_kind']; scope_id: string }[] = [
      { scope_kind: 'tenant_feature', scope_id: scopeIdFor('tenant_feature', tenant_id, feature) },
      { scope_kind: 'tenant',         scope_id: scopeIdFor('tenant',         tenant_id, feature) },
      { scope_kind: 'platform',       scope_id: '*' },
    ];
    if (franchisee_id) {
      scopes.splice(2, 0, { scope_kind: 'franchisee', scope_id: franchisee_id });
    }
    return scopes;
  }

  return {
    async loadEnforcementSnapshot(args) {
      const scopes = scopeKeysFor(args.tenant_id, args.feature, args.franchisee_id);
      const scopeKindSet = scopes.map((s) => s.scope_kind);
      const scopeIdSet = scopes.map((s) => s.scope_id);

      const [capsRes, quotasRes] = await Promise.all([
        client.from('budget_caps')
          .select('scope_kind, scope_id, period_kind, limit_usd, warning_pct, hard_cap, tenant_paid_uncapped')
          .in('scope_kind', scopeKindSet)
          .in('scope_id', scopeIdSet),
        client.from('quota_caps')
          .select('scope_kind, scope_id, period_kind, limit_invocations, limit_tokens, hard_cap')
          .in('scope_kind', scopeKindSet)
          .in('scope_id', scopeIdSet),
      ]);
      if (capsRes.error) logger.warn('budget_caps lookup error', { err: capsRes.error.message });
      if (quotasRes.error) logger.warn('quota_caps lookup error', { err: quotasRes.error.message });

      const caps = ((capsRes.data ?? []) as BudgetCap[]).filter((c) =>
        scopes.some((s) => s.scope_kind === c.scope_kind && s.scope_id === c.scope_id),
      );
      const quotas = ((quotasRes.data ?? []) as QuotaCap[]).filter((q) =>
        scopes.some((s) => s.scope_kind === q.scope_kind && s.scope_id === q.scope_id),
      );

      // Counters: fetch current-period rows for every relevant (scope, period_kind).
      const now = args.now ?? new Date();
      const counters = new Map<string, CounterSnapshot>();
      const interesting = new Set<string>();
      for (const c of caps) interesting.add(counterKey(c.scope_kind, c.scope_id, c.period_kind));
      for (const q of quotas) interesting.add(counterKey(q.scope_kind, q.scope_id, q.period_kind));

      for (const key of interesting) {
        const [scope_kind, scope_id, period_kind] = key.split('::') as [BudgetCap['scope_kind'], string, PeriodKind];
        const period_started_at = periodStart(period_kind, now).toISOString();
        const { data, error } = await client.from('budget_counters')
          .select('scope_kind, scope_id, period_kind, period_started_at, spent_usd, invocations, tokens')
          .eq('scope_kind', scope_kind)
          .eq('scope_id', scope_id)
          .eq('period_kind', period_kind)
          .eq('period_started_at', period_started_at)
          .maybeSingle();
        if (!error && data) counters.set(key, data as CounterSnapshot);
      }

      return { caps, quotas, counters };
    },

    async incrementCounters(args) {
      const scopes = scopeKeysFor(args.tenant_id, args.feature, args.franchisee_id);
      const now = args.now ?? new Date();
      const period_kinds: PeriodKind[] = ['daily', 'weekly', 'monthly'];

      // Increment every (scope, period) combination — over-shoots a bit
      // but keeps the logic simple. Production tuning can prune by
      // checking which caps actually exist.
      for (const s of scopes) {
        for (const period_kind of period_kinds) {
          const ps = periodStart(period_kind, now).toISOString();
          const { error } = await client.rpc('increment_budget_counter', {
            p_scope_kind: s.scope_kind,
            p_scope_id: s.scope_id,
            p_period_kind: period_kind,
            p_period_started_at: ps,
            p_spent_usd: args.spent_usd,
            p_invocations: args.invocations,
            p_tokens: args.tokens,
          });
          if (error) {
            logger.warn('increment_budget_counter failed', {
              scope_kind: s.scope_kind, scope_id: s.scope_id, period_kind, err: error.message,
            });
          }
        }
      }
    },
  };
}

export function buildBudgetStore(): BudgetStore {
  return buildSupabaseBudgetStore() ?? buildInMemoryBudgetStore();
}

// Re-export period helpers for tests.
export { periodStart, counterKey };
