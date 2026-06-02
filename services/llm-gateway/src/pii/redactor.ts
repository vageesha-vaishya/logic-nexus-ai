// PII redactor. Walks the InvokeRequest.variables tree, replacing
// matched PII substrings in string values with stable tokens like
// <PII:EMAIL_1>. Returns:
//   - redacted: same shape, with strings rewritten
//   - replacements: token → plaintext mapping (for un-redaction on response)
//   - warnings: e.g. moderate-mode signal
//   - applied_kinds: which detectors fired at least once
//
// Object keys are NOT redacted (a field named "email" is a label, not
// PII content). Numbers/booleans/null pass through unchanged.

import { BUILT_IN_PATTERNS, patternsFor } from './patterns.js';
import {
  type BuiltInPiiKind,
  type CustomPattern,
  type RedactionReplacement,
  type RedactionResult,
  type TenantPiiPolicy,
  PiiPolicyError,
} from './types.js';

interface CompiledDetector {
  kind: string;
  regex: RegExp;
}

function compileCustomPattern(p: CustomPattern): CompiledDetector {
  try {
    const flags = (p.flags ?? 'g').includes('g') ? (p.flags ?? 'g') : `${p.flags ?? ''}g`;
    return { kind: p.name, regex: new RegExp(p.pattern, flags) };
  } catch (err) {
    throw new PiiPolicyError(
      'PII_PATTERN_INVALID',
      `invalid custom pattern "${p.name}": ${(err as Error).message}`,
      { pattern: p },
    );
  }
}

function compileDetectors(policy: TenantPiiPolicy): CompiledDetector[] {
  const detectors: CompiledDetector[] = [];
  const kinds = (policy.redact_kinds ?? []) as readonly BuiltInPiiKind[];
  for (const entry of patternsFor(kinds)) {
    detectors.push({ kind: entry.kind, regex: entry.build() });
  }
  for (const p of policy.custom_patterns ?? []) {
    detectors.push(compileCustomPattern(p));
  }
  return detectors;
}

interface MutableContext {
  detectors: CompiledDetector[];
  counters: Map<string, number>;
  replacements: RedactionReplacement[];
  applied: Set<string>;
}

function nextToken(ctx: MutableContext, kind: string): string {
  const upper = kind.toUpperCase();
  const next = (ctx.counters.get(kind) ?? 0) + 1;
  ctx.counters.set(kind, next);
  return `<PII:${upper}_${next}>`;
}

function redactString(input: string, ctx: MutableContext): string {
  // Apply each detector in turn. Replace by callback so we can record
  // the mapping. To handle overlapping matches conservatively, we
  // re-scan after each replacement.
  let output = input;
  for (const det of ctx.detectors) {
    const regex = new RegExp(det.regex.source, det.regex.flags);  // fresh state per pass
    output = output.replace(regex, (match) => {
      const token = nextToken(ctx, det.kind);
      ctx.replacements.push({ token, original: match, kind: det.kind });
      ctx.applied.add(det.kind);
      return token;
    });
  }
  return output;
}

function redactValue(value: unknown, ctx: MutableContext): unknown {
  if (typeof value === 'string') return redactString(value, ctx);
  if (Array.isArray(value)) return value.map((v) => redactValue(v, ctx));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Object keys are labels, not content. Don't redact them. Their
      // values are redacted recursively.
      out[k] = redactValue(v, ctx);
    }
    return out;
  }
  return value; // numbers, booleans, null, undefined unchanged
}

/**
 * Apply policy to variables. Pure function — no I/O.
 *
 * Throws PiiPolicyError('PII_PASS_THROUGH_NOT_CONSENTED') when
 * policy_kind='pass_through' but pii_pass_through_consented_at is null.
 */
export function redactVariables(
  variables: Record<string, unknown>,
  policy: TenantPiiPolicy,
): RedactionResult<Record<string, unknown>> {
  // Pass-through gate: require explicit consent. Otherwise fail closed.
  if (policy.policy_kind === 'pass_through') {
    if (!policy.pii_pass_through_consented_at) {
      throw new PiiPolicyError(
        'PII_PASS_THROUGH_NOT_CONSENTED',
        'tenant pii policy is pass_through but consent timestamp is missing',
        { tenant_id: policy.tenant_id },
      );
    }
    return {
      redacted: variables,
      replacements: [],
      warnings: ['pii_pass_through_consented'],
      applied_kinds: [],
    };
  }

  const ctx: MutableContext = {
    detectors: compileDetectors(policy),
    counters: new Map(),
    replacements: [],
    applied: new Set(),
  };
  const redacted = redactValue(variables, ctx) as Record<string, unknown>;

  const warnings: string[] = [];
  if (policy.policy_kind === 'moderate' && ctx.replacements.length > 0) {
    warnings.push('pii_moderate_mode_used');
  }

  return {
    redacted,
    replacements: ctx.replacements,
    warnings,
    applied_kinds: Array.from(ctx.applied),
  };
}

/**
 * Walk the provider response text and swap tokens back to plaintext
 * using the replacement map. Pure function. Only applied when
 * preserve_mapping is true.
 */
export function unredactText(text: string, replacements: RedactionReplacement[]): string {
  if (!text || replacements.length === 0) return text;
  let out = text;
  // Replace longer tokens first (so <PII:EMAIL_10> doesn't get
  // shadowed by <PII:EMAIL_1>).
  const sorted = [...replacements].sort((a, b) => b.token.length - a.token.length);
  for (const r of sorted) {
    out = out.split(r.token).join(r.original);
  }
  return out;
}

/** Test/inspection: which kinds the built-in catalog supports. */
export function listBuiltInKinds(): string[] {
  return BUILT_IN_PATTERNS.map((p) => p.kind);
}
