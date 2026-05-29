// Pure helpers extracted from LeadWorkspaceSections.tsx (Phase 4 Sales Step 6 split).
import { EMAIL_PATTERN, PHONE_PATTERN } from './types';

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value);
}

export function normalizeWebsite(value: string): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function isValidWebsite(value: string): boolean {
  try {
    const parsed = new URL(normalizeWebsite(value));
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function normalizeComparableValue(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}
