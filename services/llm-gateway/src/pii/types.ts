// Types for the PII redaction layer. Per design §4.4.

export type PolicyKind = 'strict' | 'moderate' | 'pass_through' | 'custom';

/**
 * Built-in detector kinds. `custom` policies can add new ones via
 * TenantPiiPolicy.custom_patterns.
 */
export type BuiltInPiiKind =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'api_key'
  | 'ip_address';

export interface CustomPattern {
  name: string;
  pattern: string;            // a JS regex source (no slashes)
  flags?: string;             // e.g. 'gi' — implicit 'g' added if missing
}

export interface TenantPiiPolicy {
  tenant_id: string;
  policy_kind: PolicyKind;
  redact_kinds: BuiltInPiiKind[];
  custom_patterns: CustomPattern[];
  preserve_mapping: boolean;
  reject_on_unredactable: boolean;
  pii_pass_through_consented_at?: string | null;
}

/** Default applied when no row exists for a tenant. */
export const DEFAULT_STRICT_POLICY: Omit<TenantPiiPolicy, 'tenant_id'> = {
  policy_kind: 'strict',
  redact_kinds: ['email', 'phone', 'ssn', 'credit_card', 'api_key', 'ip_address'],
  custom_patterns: [],
  preserve_mapping: true,
  reject_on_unredactable: false,
  pii_pass_through_consented_at: null,
};

/** One token ↔ plaintext mapping captured during redaction. */
export interface RedactionReplacement {
  token: string;              // e.g. <PII:EMAIL_1>
  original: string;           // the matched plaintext
  kind: string;               // 'email' | 'phone' | … | custom-pattern.name
}

export interface RedactionResult<T> {
  redacted: T;
  replacements: RedactionReplacement[];
  warnings: string[];
  applied_kinds: string[];     // which kinds actually fired at least once
}

export class PiiPolicyError extends Error {
  constructor(
    public readonly code:
      | 'PII_PASS_THROUGH_NOT_CONSENTED'
      | 'PII_UNREDACTABLE'
      | 'PII_PATTERN_INVALID',
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PiiPolicyError';
  }
}
