import { redactVariables, unredactText, listBuiltInKinds } from '../src/pii/redactor.js';
import {
  type TenantPiiPolicy,
  DEFAULT_STRICT_POLICY,
  PiiPolicyError,
} from '../src/pii/types.js';

function policy(overrides: Partial<TenantPiiPolicy> = {}): TenantPiiPolicy {
  return { tenant_id: 'tenant-A', ...DEFAULT_STRICT_POLICY, ...overrides };
}

describe('redactVariables — built-in detectors', () => {
  it('redacts email', () => {
    const r = redactVariables({ note: 'reach me at alice@example.com today' }, policy());
    expect((r.redacted.note as string)).toMatch(/<PII:EMAIL_1>/);
    expect(r.replacements).toEqual([
      { token: '<PII:EMAIL_1>', original: 'alice@example.com', kind: 'email' },
    ]);
    expect(r.applied_kinds).toContain('email');
  });

  it('redacts phone (US format)', () => {
    const r = redactVariables({ msg: 'call 415-555-1234 or +1 (212) 555-9999' }, policy());
    expect((r.redacted.msg as string)).toMatch(/<PII:PHONE_1>/);
    expect((r.redacted.msg as string)).toMatch(/<PII:PHONE_2>/);
    expect(r.applied_kinds).toContain('phone');
  });

  it('redacts ssn', () => {
    const r = redactVariables({ id: 'SSN 123-45-6789 on file' }, policy());
    expect((r.redacted.id as string)).toBe('SSN <PII:SSN_1> on file');
    expect(r.replacements[0]).toMatchObject({ kind: 'ssn', original: '123-45-6789' });
  });

  it('redacts credit_card', () => {
    const r = redactVariables({ pay: 'card 4532 1234 5678 9010 active' }, policy());
    expect((r.redacted.pay as string)).toMatch(/<PII:CREDIT_CARD_1>/);
  });

  it('redacts api_key (sk-ant-, sk-, lngw_, AWS, Google)', () => {
    const inputs = [
      'sk-ant-1234567890abcdef-vault',
      'sk-1234567890abcdefABCDEF',
      'lngw_AbCd1234567890_-_xyz789',
      'AKIA1234567890123456',
      'AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0',
    ];
    for (const input of inputs) {
      const r = redactVariables({ k: input }, policy());
      expect((r.redacted.k as string)).toMatch(/^<PII:API_KEY_\d+>$/);
    }
  });

  it('redacts ip_address (IPv4)', () => {
    const r = redactVariables({ from: 'origin 192.168.1.42 hit gateway' }, policy());
    expect((r.redacted.from as string)).toMatch(/<PII:IP_ADDRESS_1>/);
  });

  it('numbers + booleans + null pass through unchanged', () => {
    const input = { age: 42, active: true, deleted: null, tags: ['a', 'b'] };
    const r = redactVariables(input, policy());
    expect(r.redacted).toEqual(input);
    expect(r.replacements).toEqual([]);
  });

  it('object keys are NOT redacted (labels, not content)', () => {
    const r = redactVariables({ 'alice@example.com': 'plain' }, policy());
    // key preserved as-is; value plain (no email there)
    expect(Object.keys(r.redacted)).toEqual(['alice@example.com']);
    expect(r.replacements).toEqual([]);
  });

  it('nested objects and arrays are walked recursively', () => {
    const r = redactVariables(
      { party: { name: 'ACME', contact: { email: 'a@b.com' }, phones: ['415-555-1234', '212-555-9999'] } },
      policy(),
    );
    const party = (r.redacted.party as { name: string; contact: { email: string }; phones: string[] });
    expect(party.contact.email).toMatch(/<PII:EMAIL_1>/);
    expect(party.phones[0]).toMatch(/<PII:PHONE_1>/);
    expect(party.phones[1]).toMatch(/<PII:PHONE_2>/);
    expect(r.applied_kinds.sort()).toEqual(['email', 'phone']);
  });

  it('handles multiple instances of the same kind with monotonic counters', () => {
    const r = redactVariables({ a: 'alice@a.com', b: 'bob@b.com', c: 'charlie@c.com' }, policy());
    const tokens = [r.redacted.a, r.redacted.b, r.redacted.c] as string[];
    expect(tokens).toEqual(['<PII:EMAIL_1>', '<PII:EMAIL_2>', '<PII:EMAIL_3>']);
  });
});

describe('redactVariables — policy modes', () => {
  it('strict mode applies all redact_kinds', () => {
    const r = redactVariables(
      { msg: 'alice@a.com and 415-555-1234 and 1.2.3.4' },
      policy({ policy_kind: 'strict' }),
    );
    expect(r.applied_kinds.sort()).toEqual(['email', 'ip_address', 'phone']);
    expect(r.warnings).toEqual([]);
  });

  it('moderate mode applies redaction AND adds warning', () => {
    const r = redactVariables(
      { msg: 'alice@a.com' },
      policy({ policy_kind: 'moderate' }),
    );
    expect(r.applied_kinds).toContain('email');
    expect(r.warnings).toContain('pii_moderate_mode_used');
  });

  it('moderate mode does NOT add warning when nothing matched', () => {
    const r = redactVariables({ msg: 'no PII here' }, policy({ policy_kind: 'moderate' }));
    expect(r.warnings).toEqual([]);
  });

  it('pass_through with consent skips redaction', () => {
    const r = redactVariables(
      { msg: 'alice@a.com' },
      policy({ policy_kind: 'pass_through', pii_pass_through_consented_at: '2026-06-01T00:00:00Z' }),
    );
    expect(r.redacted).toEqual({ msg: 'alice@a.com' });
    expect(r.replacements).toEqual([]);
    expect(r.warnings).toContain('pii_pass_through_consented');
  });

  it('pass_through without consent throws PII_PASS_THROUGH_NOT_CONSENTED', () => {
    expect(() =>
      redactVariables({ msg: 'alice@a.com' }, policy({ policy_kind: 'pass_through', pii_pass_through_consented_at: null })),
    ).toThrow(PiiPolicyError);
  });

  it('custom mode adds custom_patterns alongside redact_kinds', () => {
    const r = redactVariables(
      { msg: 'order #ORD-12345 from alice@a.com' },
      policy({
        policy_kind: 'custom',
        custom_patterns: [{ name: 'order_id', pattern: 'ORD-\\d{5}', flags: 'g' }],
      }),
    );
    expect(r.applied_kinds.sort()).toEqual(['email', 'order_id']);
    expect((r.redacted.msg as string)).toMatch(/<PII:ORDER_ID_1>/);
    expect((r.redacted.msg as string)).toMatch(/<PII:EMAIL_1>/);
  });

  it('custom mode rejects invalid regex with PII_PATTERN_INVALID', () => {
    expect(() =>
      redactVariables(
        { msg: 'x' },
        policy({
          policy_kind: 'custom',
          custom_patterns: [{ name: 'broken', pattern: '[invalid' }],
        }),
      ),
    ).toThrow(PiiPolicyError);
  });

  it('respects redact_kinds when subset of built-ins selected', () => {
    const r = redactVariables(
      { msg: 'alice@a.com and 415-555-1234' },
      policy({ redact_kinds: ['email'] }),
    );
    expect(r.applied_kinds).toEqual(['email']);
    // phone should NOT have been redacted
    expect((r.redacted.msg as string)).toMatch(/415-555-1234/);
  });
});

describe('unredactText', () => {
  it('swaps tokens back to plaintext in order', () => {
    const text = 'Reach <PII:EMAIL_1> or call <PII:PHONE_1>.';
    const out = unredactText(text, [
      { token: '<PII:EMAIL_1>', original: 'alice@example.com', kind: 'email' },
      { token: '<PII:PHONE_1>', original: '415-555-1234', kind: 'phone' },
    ]);
    expect(out).toBe('Reach alice@example.com or call 415-555-1234.');
  });

  it('handles tokens with overlapping numeric suffixes (longer-first)', () => {
    const text = 'A=<PII:EMAIL_10>, B=<PII:EMAIL_1>';
    const out = unredactText(text, [
      { token: '<PII:EMAIL_1>', original: 'one@x.com', kind: 'email' },
      { token: '<PII:EMAIL_10>', original: 'ten@x.com', kind: 'email' },
    ]);
    expect(out).toBe('A=ten@x.com, B=one@x.com');
  });

  it('empty input returns unchanged', () => {
    expect(unredactText('', [{ token: '<PII:EMAIL_1>', original: 'x@y.com', kind: 'email' }])).toBe('');
  });

  it('empty replacements returns input unchanged', () => {
    expect(unredactText('hello', [])).toBe('hello');
  });
});

describe('listBuiltInKinds', () => {
  it('exposes the 6 built-in kinds', () => {
    expect(listBuiltInKinds().sort()).toEqual(
      ['api_key', 'credit_card', 'email', 'ip_address', 'phone', 'ssn'],
    );
  });
});
