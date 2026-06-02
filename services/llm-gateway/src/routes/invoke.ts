// POST /v1/invoke — the heart of the gateway.
// P0: echo provider only. P1 adds resolver + real providers.
//
// Contract aligns with packages/llm-client/src/types.ts so the existing
// TS SDK (currently throws NOT_WIRED_MESSAGE) can be wired to this
// endpoint in P4 without contract changes.

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

import { resolveProvider } from '../providers/index.js';
import { GatewayError } from '../middleware/error.js';
import { logger } from '../utils/logger.js';
import type {
  InvokeRequest,
  InvokeResponse,
  ProviderContext,
} from '../types/gateway.types.js';
import { resolveProvider as cascadeResolve } from '../resolver/cascade.js';
import { ResolverError } from '../resolver/errors.js';
import { buildInMemoryStores } from '../resolver/inMemoryStores.js';
import { buildSupabaseStores } from '../resolver/supabaseStores.js';
import type { CallContext, ResolverStores } from '../resolver/types.js';
import { buildAuditPayload, buildInvocationWriter, type InvocationWriter } from '../audit/invocationWriter.js';
import { buildAuthLookup, type AuthLookup } from '../auth/serviceToken.js';
import { requireScope } from '../middleware/auth.js';
import { buildPolicyLookup, type PolicyLookup } from '../pii/policyLoader.js';
import { redactVariables, unredactText } from '../pii/redactor.js';
import { PiiPolicyError } from '../pii/types.js';
import { buildPromptStore, type PromptStore } from '../prompts/store.js';
import { pickBodyForProvider, renderPrompt } from '../prompts/renderer.js';
import { PromptError } from '../prompts/types.js';
import { buildExperimentStore, type ExperimentStore } from '../prompts/experimentStore.js';
import { pickVariant, experimentWarning } from '../prompts/experimentPicker.js';
import { buildBudgetStore, type BudgetStore } from '../budgets/store.js';
import { evaluateEnforcement } from '../budgets/enforcement.js';

export const invokeRouter = Router();

// Module-singleton resolver stores. Prefer Supabase when env vars
// are set; fall back to in-memory (file-or-embedded) otherwise. Tests
// inject custom stores via setResolverStoresForTesting().
let resolverStores: ResolverStores | null = null;
function getResolverStores(): ResolverStores {
  if (!resolverStores) {
    resolverStores = buildSupabaseStores() ?? buildInMemoryStores();
  }
  return resolverStores;
}

/** Test helper: inject custom stores. Production code never calls this. */
export function setResolverStoresForTesting(stores: ResolverStores | null): void {
  resolverStores = stores;
}

// Module-singleton audit-log writer. No-op when SUPABASE env unset.
let invocationWriter: InvocationWriter | null = null;
function getInvocationWriter(): InvocationWriter {
  if (!invocationWriter) invocationWriter = buildInvocationWriter();
  return invocationWriter;
}

/** Test helper: inject custom writer. Production code never calls this. */
export function setInvocationWriterForTesting(writer: InvocationWriter | null): void {
  invocationWriter = writer;
}

// Module-singleton auth lookup. Open-mode when nothing configured.
let authLookup: AuthLookup | null = null;
function getAuthLookup(): AuthLookup {
  if (!authLookup) authLookup = buildAuthLookup();
  return authLookup;
}

/** Cross-router accessor so other route modules can share the same lookup. */
export function getAuthLookupForApp(): AuthLookup {
  return getAuthLookup();
}

/** Test helper: inject custom auth lookup. Production code never calls this. */
export function setAuthLookupForTesting(lookup: AuthLookup | null): void {
  authLookup = lookup;
}

// Module-singleton PII policy lookup. Defaults to strict when no env.
let piiPolicyLookup: PolicyLookup | null = null;
function getPolicyLookup(): PolicyLookup {
  if (!piiPolicyLookup) piiPolicyLookup = buildPolicyLookup();
  return piiPolicyLookup;
}

/** Test helper: inject custom policy lookup. Production code never calls this. */
export function setPolicyLookupForTesting(lookup: PolicyLookup | null): void {
  piiPolicyLookup = lookup;
}

// Module-singleton prompt store. P3.2: invoke reads from this to pre-render
// the prompt body. Same store instance is shared with /v1/prompts/* routes.
let invokePromptStore: PromptStore | null = null;
function getInvokePromptStore(): PromptStore {
  if (!invokePromptStore) invokePromptStore = buildPromptStore();
  return invokePromptStore;
}

/** Test helper: inject a custom prompt store into the invoke pipeline. */
export function setInvokePromptStoreForTesting(store: PromptStore | null): void {
  invokePromptStore = store;
}

// Module-singleton experiment store. P3.3.
let invokeExperimentStore: ExperimentStore | null = null;
function getExperimentStore(): ExperimentStore {
  if (!invokeExperimentStore) invokeExperimentStore = buildExperimentStore();
  return invokeExperimentStore;
}

/** Test helper: inject custom experiment store. */
export function setExperimentStoreForTesting(store: ExperimentStore | null): void {
  invokeExperimentStore = store;
}

// Module-singleton budget store. P2.3.
let invokeBudgetStore: BudgetStore | null = null;
function getBudgetStore(): BudgetStore {
  if (!invokeBudgetStore) invokeBudgetStore = buildBudgetStore();
  return invokeBudgetStore;
}

/** Test helper: inject custom budget store. */
export function setBudgetStoreForTesting(store: BudgetStore | null): void {
  invokeBudgetStore = store;
}

function mapPiiError(err: PiiPolicyError): GatewayError {
  const status =
    err.code === 'PII_PASS_THROUGH_NOT_CONSENTED' ? 422 :
    err.code === 'PII_UNREDACTABLE' ? 422 :
    err.code === 'PII_PATTERN_INVALID' ? 500 :
    500;
  return new GatewayError(err.code, err.message, status, err.details);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function validateInvokeRequest(raw: unknown): InvokeRequest {
  if (!raw || typeof raw !== 'object') {
    throw new GatewayError('INVALID_REQUEST', 'body must be a JSON object', 400);
  }
  const r = raw as Record<string, unknown>;
  const tenant_id = asString(r.tenant_id);
  const module_ = asString(r.module);
  const feature = asString(r.feature);
  const prompt_key = asString(r.prompt_key);

  const missing: string[] = [];
  if (!tenant_id) missing.push('tenant_id');
  if (!module_) missing.push('module');
  if (!feature) missing.push('feature');
  if (!prompt_key) missing.push('prompt_key');
  if (missing.length) {
    throw new GatewayError('INVALID_REQUEST', `missing required fields: ${missing.join(', ')}`, 400, { missing });
  }

  const variables = (r.variables ?? {}) as Record<string, unknown>;
  if (variables === null || typeof variables !== 'object' || Array.isArray(variables)) {
    throw new GatewayError('INVALID_REQUEST', 'variables must be an object', 400);
  }

  const subject = r.subject as InvokeRequest['subject'] | undefined;
  if (subject != null) {
    if (typeof subject !== 'object' || !asString((subject as { type?: unknown }).type) || !asString((subject as { id?: unknown }).id)) {
      throw new GatewayError('INVALID_REQUEST', 'subject must be {type, id} when present', 400);
    }
  }

  const options = (r.options ?? undefined) as InvokeRequest['options'];
  const required_capabilities = r.required_capabilities as string[] | undefined;

  return {
    tenant_id: tenant_id!,
    module: module_!,
    feature: feature!,
    prompt_key: prompt_key!,
    variables,
    subject,
    options,
    required_capabilities,
  };
}

function readCallContext(req: Request): CallContext {
  return {
    user_id: (req.header('x-user-id') ?? undefined) as string | undefined,
    franchisee_id: (req.header('x-franchisee-id') ?? undefined) as string | undefined,
    domain_id: (req.header('x-domain-id') ?? undefined) as string | undefined,
    tenant_residency: (req.header('x-tenant-residency') ?? undefined) as string | undefined,
  };
}

function mapResolverError(err: ResolverError): GatewayError {
  const status =
    err.code === 'EGRESS_FORBIDDEN' || err.code === 'MODEL_CAPABILITY_MISMATCH' ? 422 :
    err.code === 'PROVIDER_NOT_CONFIGURED' ? 503 :
    500;
  return new GatewayError(err.code, err.message, status, err.details);
}

invokeRouter.post('/invoke', requireScope('invoke', getAuthLookup), async (req: Request, res: Response, next: NextFunction) => {
  // Express 4 doesn't auto-forward async errors to the error middleware,
  // so we wrap the whole handler in try/catch + next(err).
  try {
    const startedAt = performance.now();
    const invocation_id = randomUUID();
    const requestId = req.requestId;

    const parsed = validateInvokeRequest(req.body);
    const callCtx = readCallContext(req);

    // ── Per-tenant PII redaction (pre-egress) ──
    const piiPolicy = await getPolicyLookup()(parsed.tenant_id);
    let piiResult;
    try {
      piiResult = redactVariables(parsed.variables, piiPolicy);
    } catch (err) {
      if (err instanceof PiiPolicyError) throw mapPiiError(err);
      throw err;
    }
    // Replace variables on the request with the redacted clone before
    // it touches the provider.
    const safeRequest = { ...parsed, variables: piiResult.redacted };

    // ── 6-layer cascade resolution ──
    let resolved;
    try {
      resolved = await cascadeResolve(safeRequest, callCtx, getResolverStores());
    } catch (err) {
      if (err instanceof ResolverError) throw mapResolverError(err);
      throw err;
    }

    // ── Budget + quota enforcement (P2.3) ──
    // Load cap stack + current-period counters. Reject 429
    // BUDGET_EXCEEDED / QUOTA_EXCEEDED on first hard-cap hit. Warnings
    // (≥ warning_pct utilization) flow into the response.
    const budgetSnapshot = await getBudgetStore().loadEnforcementSnapshot({
      tenant_id: safeRequest.tenant_id,
      feature: safeRequest.feature,
      franchisee_id: callCtx.franchisee_id,
    });
    const enforcement = evaluateEnforcement({
      caps: budgetSnapshot.caps,
      quotas: budgetSnapshot.quotas,
      counters: budgetSnapshot.counters,
      billing_mode_tenant_paid: resolved.billing_mode === 'tenant_paid',
    });
    const budgetWarnings: string[] = [];
    if (enforcement.kind === 'reject') {
      throw new GatewayError(enforcement.code, enforcement.message, 429, {
        scope_kind: enforcement.scope_kind,
        scope_id: enforcement.scope_id,
        period_kind: enforcement.period_kind,
        ...enforcement.details,
      });
    }
    budgetWarnings.push(...enforcement.warnings);

    const provider = resolveProvider(resolved.provider_kind);

    // ── Prompt resolution (P3.2) ──
    // Look up the registered prompt for this key. If found, render the
    // body with the (redacted) variables and pass to the provider via
    // ctx.rendered_body. If not registered (PROMPT_NOT_FOUND), fall back
    // to the adapter's internal scaffold — preserves backwards compat
    // with callers that haven't migrated their prompts yet.
    let rendered_body: string | undefined;
    let prompt_version_id: string | undefined;
    let prompt_version_number: number | undefined;
    let experiment_id: string | undefined;
    let variant_label: 'a' | 'b' | undefined;
    const promptWarnings: string[] = [];
    try {
      const { active_version } = await getInvokePromptStore().getActive(safeRequest.prompt_key);
      let chosen_version = active_version;

      // ── A/B experiment override (P3.3) ──
      // If an active experiment exists for this prompt_key, deterministically
      // pick a variant based on hash(invocation_id) and swap if it's variant_b.
      const experiment = await getExperimentStore().getActiveFor(safeRequest.prompt_key);
      if (experiment) {
        const pick = pickVariant(experiment, invocation_id);
        experiment_id = experiment.id;
        variant_label = pick.variant_label;
        if (pick.variant_version_id !== active_version.id) {
          try {
            chosen_version = await getInvokePromptStore().getVersionById(pick.variant_version_id);
          } catch (err) {
            if (err instanceof PromptError) {
              promptWarnings.push(`experiment_variant_missing:${pick.variant_version_id}`);
            } else {
              throw err;
            }
          }
        }
        promptWarnings.push(experimentWarning(pick));
      }

      const body = pickBodyForProvider(
        chosen_version.body,
        chosen_version.body_variants,
        resolved.provider_kind,
      );
      const renderResult = renderPrompt(body, safeRequest.variables);
      rendered_body = renderResult.rendered;
      prompt_version_id = chosen_version.id;
      prompt_version_number = chosen_version.version_number;
      if (renderResult.missing_paths.length > 0) {
        promptWarnings.push(`prompt_missing_variables:${renderResult.missing_paths.join(',')}`);
      }
    } catch (err) {
      if (err instanceof PromptError && (err.code === 'PROMPT_NOT_FOUND' || err.code === 'PROMPT_NO_ACTIVE_VERSION')) {
        promptWarnings.push('prompt_not_registered_using_scaffold');
      } else {
        throw err;
      }
    }

    const ctx: ProviderContext = {
      invocation_id,
      model_id: resolved.model_id,
      started_at: startedAt,
      request_id: requestId,
      rendered_body,
      prompt_version_id,
      prompt_version_number,
    };

    // Provider sees redacted variables ONLY — never the plaintext.
    const result = await provider.invoke(safeRequest, ctx);
    const latency_ms = Math.round(performance.now() - startedAt);

    // Optional un-redaction of provider text output. Applies only when
    // preserve_mapping is on AND we actually redacted something AND the
    // output has a `text` field we can rewrite.
    let finalOutput = result.output;
    if (
      piiPolicy.preserve_mapping &&
      piiResult.replacements.length > 0 &&
      finalOutput &&
      typeof finalOutput === 'object' &&
      'text' in (finalOutput as Record<string, unknown>) &&
      typeof (finalOutput as { text: unknown }).text === 'string'
    ) {
      finalOutput = {
        ...(finalOutput as Record<string, unknown>),
        text: unredactText((finalOutput as { text: string }).text, piiResult.replacements),
      };
    }

    const combinedWarnings = [
      ...(result.warnings ?? []),
      ...piiResult.warnings,
      ...(piiResult.applied_kinds.length > 0
        ? [`pii_redacted:${piiResult.applied_kinds.join(',')}`]
        : []),
      ...promptWarnings,
      ...budgetWarnings,
    ];

    const body: InvokeResponse = {
      invocation_id,
      output: finalOutput,
      cache_hit: false,
      model_used: result.model_used || resolved.model_id,
      provider_kind: resolved.provider_kind,
      usage: result.usage,
      cost_usd: result.cost_usd,
      latency_ms,
      warnings: combinedWarnings.length > 0 ? combinedWarnings : undefined,
      scaffold_phase: 'P0',
    };

    logger.info('invoke completed', {
      request_id: requestId,
      invocation_id,
      tenant_id: parsed.tenant_id,
      prompt_key: parsed.prompt_key,
      provider_kind: resolved.provider_kind,
      resolved_scope_kind: resolved.resolved_scope_kind,
      resolved_scope_id: resolved.resolved_scope_id,
      model_used: body.model_used,
      latency_ms,
    });

    res.json(body);

    // Fire-and-forget budget counter increment (P2.3). Failures land
    // in logs only; never crash the caller.
    void getBudgetStore()
      .incrementCounters({
        tenant_id: safeRequest.tenant_id,
        feature: safeRequest.feature,
        franchisee_id: callCtx.franchisee_id,
        spent_usd: result.cost_usd,
        invocations: 1,
        tokens: result.usage.total_tokens,
      })
      .catch((err: unknown) => {
        logger.warn('budget counter increment failed', {
          invocation_id,
          err: err instanceof Error ? err.message : String(err),
        });
      });

    // Fire-and-forget audit log AFTER response — never blocks the client.
    // We pass the REDACTED request so any PII never lands in the audit
    // table either. The redaction itself is captured as warnings.
    getInvocationWriter()(
      buildAuditPayload({
        invocation_id,
        request_id: requestId,
        request: safeRequest,
        resolved,
        usage: result.usage,
        cost_usd: result.cost_usd,
        latency_ms,
        warnings: combinedWarnings,
        experiment_id,
        variant_label,
        prompt_version_id,
      }),
    );
  } catch (err) {
    next(err);
  }
});
