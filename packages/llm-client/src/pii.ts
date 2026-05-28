/**
 * PII redaction pipeline. Applied to BOTH inbound prompts (before
 * sending to providers) and outbound responses (before logging or
 * caching). Master §6.12.
 *
 * Phase 0 ships interfaces + a regex-based redactor that handles the
 * common cases (emails, E.164 phone numbers). Phase 9 may upgrade to
 * a model-based PII detector.
 */

export type PiiHandling = "pass_through" | "redact_emails_phones" | "redact_all";

export interface PiiRedactor {
  /**
   * Returns the redacted text plus a placeholder map so the original
   * values can be restored in the response if needed (some prompts
   * want the model to see redacted but reply with real values — that's
   * a per-prompt safety decision).
   */
  redact(text: string, mode: PiiHandling): RedactionResult;

  /** Inverse of redact(). */
  restore(text: string, placeholders: Record<string, string>): string;
}

export interface RedactionResult {
  redacted: string;
  placeholders: Record<string, string>;
  /** Count per category for telemetry. */
  counts: Record<string, number>;
}

/**
 * Pass-through redactor: never redacts. Used when the prompt's
 * frontmatter declares `pii_handling: pass_through` (rare; only when
 * the prompt MUST see real values — e.g. compliance screening
 * inputs that are sanctions checks).
 */
export class NullPiiRedactor implements PiiRedactor {
  redact(text: string): RedactionResult {
    return { redacted: text, placeholders: {}, counts: {} };
  }
  restore(text: string): string {
    return text;
  }
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
// E.164-ish: + followed by 7-15 digits, optional spaces/hyphens
const PHONE_RE = /\+\d[\d\s\-()]{6,18}\d/g;

/**
 * Regex-based redactor. Replaces emails and phones with placeholder
 * tokens like `<EMAIL_1>`, `<PHONE_2>`. The `redact_all` mode also
 * scrubs anything that looks like a long alphanumeric token (10+
 * chars) on the assumption that it might be a tax ID or government ID.
 */
export class RegexPiiRedactor implements PiiRedactor {
  redact(text: string, mode: PiiHandling): RedactionResult {
    if (mode === "pass_through") {
      return { redacted: text, placeholders: {}, counts: {} };
    }
    const placeholders: Record<string, string> = {};
    const counts: Record<string, number> = {};
    let next = 0;

    let redacted = text.replace(EMAIL_RE, (match) => {
      next++;
      const token = `<EMAIL_${next}>`;
      placeholders[token] = match;
      counts.email = (counts.email ?? 0) + 1;
      return token;
    });

    let phoneCounter = 0;
    redacted = redacted.replace(PHONE_RE, (match) => {
      phoneCounter++;
      const token = `<PHONE_${phoneCounter}>`;
      placeholders[token] = match;
      counts.phone = (counts.phone ?? 0) + 1;
      return token;
    });

    if (mode === "redact_all") {
      // Conservative ID-like-token redaction: 10+ chars containing both letters and digits
      let idCounter = 0;
      redacted = redacted.replace(/\b(?=\w*\d)(?=\w*[A-Za-z])\w{10,}\b/g, (match) => {
        // Skip placeholders we've already inserted
        if (match.startsWith("EMAIL_") || match.startsWith("PHONE_")) return match;
        idCounter++;
        const token = `<ID_${idCounter}>`;
        placeholders[token] = match;
        counts.id_like = (counts.id_like ?? 0) + 1;
        return token;
      });
    }

    return { redacted, placeholders, counts };
  }

  restore(text: string, placeholders: Record<string, string>): string {
    let result = text;
    for (const [token, original] of Object.entries(placeholders)) {
      result = result.split(token).join(original);
    }
    return result;
  }
}
