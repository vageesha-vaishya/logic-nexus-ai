// Built-in PII regex patterns. Order matters within strings: patterns
// run sequentially; an earlier match consumes characters so a later
// pattern can't double-match. Sort here from most-specific to least.

import type { BuiltInPiiKind } from './types.js';

interface PatternEntry {
  kind: BuiltInPiiKind;
  build: () => RegExp;
}

// Functions instead of cached RegExps because /g state is stateful;
// each redaction pass gets a fresh instance.

export const BUILT_IN_PATTERNS: PatternEntry[] = [
  // api_key: vendor prefixes first so a longer match wins.
  {
    kind: 'api_key',
    build: () =>
      /(sk-ant-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9_-]{16,}|lngw_[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35,})/g,
  },

  // credit_card: 13-19 digits, optional separators. Loose; production
  // would add Luhn check.
  {
    kind: 'credit_card',
    build: () => /\b(?:\d[ -]?){13,19}\b/g,
  },

  // ssn (US): NNN-NN-NNNN with hyphens only (avoid false-positives
  // on plain 9-digit numbers like part numbers).
  {
    kind: 'ssn',
    build: () => /\b\d{3}-\d{2}-\d{4}\b/g,
  },

  // email — common shape; intentionally loose on TLD.
  {
    kind: 'email',
    build: () => /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g,
  },

  // phone — North-American + international shapes; require at least
  // 7 digits to avoid catching arbitrary numbers.
  {
    kind: 'phone',
    build: () =>
      /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?){2}\d{3,4}\b/g,
  },

  // ip_address — IPv4 only; IPv6 deferred.
  {
    kind: 'ip_address',
    build: () =>
      /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  },
];

export function patternsFor(kinds: readonly BuiltInPiiKind[]): PatternEntry[] {
  const allow = new Set(kinds);
  return BUILT_IN_PATTERNS.filter((p) => allow.has(p.kind));
}
