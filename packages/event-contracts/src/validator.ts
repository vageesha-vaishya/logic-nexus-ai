import type { EventEnvelope } from "./types.js";
import type { KnownTopic, TopicPayloadMap } from "./payloads.js";

export type ValidationResult<TPayload = unknown> =
  | { ok: true; envelope: EventEnvelope<TPayload> }
  | { ok: false; errors: string[] };

/**
 * Lightweight runtime validation of the universal event envelope. Checks the
 * envelope shape only — payload contents are validated per-topic by
 * `validatePayload()` (or, in the eventual full implementation, by a JSON-Schema
 * validator over the schemas in ./schemas/).
 */
export function validateEnvelope<TPayload = unknown>(input: unknown): ValidationResult<TPayload> {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["envelope must be a non-null object"] };
  }
  const e = input as Record<string, unknown>;
  const requiredStrings = [
    "id",
    "tenant_id",
    "module",
    "entity_type",
    "event_type",
    "entity_id",
    "occurred_at",
  ];
  for (const k of requiredStrings) {
    if (typeof e[k] !== "string" || (e[k] as string).length === 0) {
      errors.push(`field "${k}" must be a non-empty string`);
    }
  }
  if (typeof e.version !== "number" || !Number.isInteger(e.version) || e.version < 1) {
    errors.push('field "version" must be a positive integer');
  }
  if (typeof e.payload === "undefined") {
    errors.push('field "payload" is required (may be null)');
  }
  if (typeof e.metadata !== "object" || e.metadata === null) {
    errors.push('field "metadata" must be a non-null object');
  } else {
    const m = e.metadata as Record<string, unknown>;
    if (typeof m.correlation_id !== "string") {
      errors.push('metadata.correlation_id must be a string');
    }
    if (typeof m.actor_kind !== "string") {
      errors.push('metadata.actor_kind must be a string');
    }
  }
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, envelope: input as unknown as EventEnvelope<TPayload> };
}

/**
 * Compose a topic name from envelope fields and check it matches the expected
 * `<module>.<entity_type>.<event_type>` shape.
 */
export function topicFromEnvelope(envelope: EventEnvelope): string {
  return `${envelope.module}.${envelope.entity_type}.${envelope.event_type}`;
}

/**
 * Per-topic payload validators. Each entry is a small TypeScript function that
 * checks the payload-specific required fields. JSON Schemas in ./schemas/ are
 * the authoritative contract; these runtime checks enforce the must-haves
 * without pulling in a JSON-Schema-validator dependency in Phase 0.
 *
 * When adding a topic: extend TopicPayloadMap + add a function here +
 * add a test case in validator.test.ts.
 */
const TOPIC_PAYLOAD_VALIDATORS: {
  [K in KnownTopic]: (payload: unknown) => string[];
} = {
  "core.tenant.created": (p) => {
    const errors: string[] = [];
    const o = asObject(p, errors);
    if (!o) return errors;
    requireString(o, "name", errors);
    requireOneOf(o, "status", ["trial", "active"], errors);
    requireString(o, "created_by_user_id", errors);
    return errors;
  },
  "core.user.created": (p) => {
    const errors: string[] = [];
    const o = asObject(p, errors);
    if (!o) return errors;
    requireString(o, "email", errors);
    requireString(o, "display_name", errors);
    requireOneOf(
      o,
      "provisioning_kind",
      ["self_signup", "invited", "sso_jit", "admin_created"],
      errors,
    );
    return errors;
  },
  "core.user.invited": (p) => {
    const errors: string[] = [];
    const o = asObject(p, errors);
    if (!o) return errors;
    requireString(o, "email", errors);
    requireString(o, "invited_by_user_id", errors);
    requireString(o, "expires_at", errors);
    return errors;
  },
  "core.party.created": (p) => {
    const errors: string[] = [];
    const o = asObject(p, errors);
    if (!o) return errors;
    requireOneOf(o, "party_type", ["person", "organization"], errors);
    requireString(o, "display_name", errors);
    requireString(o, "source_kind", errors);
    return errors;
  },
  "core.party.updated": (p) => {
    const errors: string[] = [];
    const o = asObject(p, errors);
    if (!o) return errors;
    const changes = o["changes"];
    if (typeof changes !== "object" || changes === null) {
      errors.push("changes must be an object");
    } else if (Object.keys(changes).length === 0) {
      errors.push("changes must contain at least one field");
    }
    return errors;
  },
  "core.party.merged": (p) => {
    const errors: string[] = [];
    const o = asObject(p, errors);
    if (!o) return errors;
    requireString(o, "merged_into_party_id", errors);
    const ids = o["deprecated_party_ids"];
    if (!Array.isArray(ids) || ids.length === 0) {
      errors.push("deprecated_party_ids must be a non-empty array");
    }
    requireOneOf(
      o,
      "merge_kind",
      ["manual_human", "ai_suggested_human_approved", "import_dedup"],
      errors,
    );
    return errors;
  },
  "core.party.deleted": (p) => {
    const errors: string[] = [];
    const o = asObject(p, errors);
    if (!o) return errors;
    requireString(o, "soft_delete_at", errors);
    requireString(o, "hard_delete_eligible_at", errors);
    requireOneOf(
      o,
      "reason",
      ["user_request", "tenant_admin_purge", "compliance_purge", "merge_consolidation"],
      errors,
    );
    return errors;
  },
  "core.membership.granted": (p) => {
    const errors: string[] = [];
    const o = asObject(p, errors);
    if (!o) return errors;
    requireString(o, "user_id", errors);
    const codes = o["module_codes"];
    if (!Array.isArray(codes) || codes.length === 0) {
      errors.push("module_codes must be a non-empty array");
    }
    requireString(o, "granted_by_user_id", errors);
    return errors;
  },
  "core.membership.revoked": (p) => {
    const errors: string[] = [];
    const o = asObject(p, errors);
    if (!o) return errors;
    requireString(o, "user_id", errors);
    const codes = o["module_codes"];
    if (!Array.isArray(codes) || codes.length === 0) {
      errors.push("module_codes must be a non-empty array");
    }
    requireString(o, "revoked_by_user_id", errors);
    requireString(o, "reason", errors);
    return errors;
  },
};

/**
 * End-to-end validation: envelope shape + per-topic payload checks.
 * Returns a typed envelope on success.
 */
export function validateEvent<T extends KnownTopic>(
  topic: T,
  input: unknown,
): ValidationResult<TopicPayloadMap[T]> {
  const envelopeResult = validateEnvelope<TopicPayloadMap[T]>(input);
  if (!envelopeResult.ok) return envelopeResult;

  const actualTopic = topicFromEnvelope(envelopeResult.envelope);
  if (actualTopic !== topic) {
    return {
      ok: false,
      errors: [`envelope topic "${actualTopic}" does not match expected "${topic}"`],
    };
  }

  const payloadValidator = TOPIC_PAYLOAD_VALIDATORS[topic];
  if (!payloadValidator) {
    return {
      ok: false,
      errors: [`no payload validator registered for topic "${topic}"`],
    };
  }
  const payloadErrors = payloadValidator(envelopeResult.envelope.payload);
  if (payloadErrors.length > 0) {
    return { ok: false, errors: payloadErrors.map((e) => `payload: ${e}`) };
  }

  return envelopeResult;
}

// ---- internal helpers ----

function asObject(input: unknown, errors: string[]): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null) {
    errors.push("payload must be a non-null object");
    return null;
  }
  return input as Record<string, unknown>;
}

function requireString(
  obj: Record<string, unknown>,
  key: string,
  errors: string[],
): void {
  if (typeof obj[key] !== "string" || (obj[key] as string).length === 0) {
    errors.push(`"${key}" must be a non-empty string`);
  }
}

function requireOneOf(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
  errors: string[],
): void {
  const value = obj[key];
  if (typeof value !== "string") {
    errors.push(`"${key}" must be a string`);
    return;
  }
  if (!allowed.includes(value)) {
    errors.push(`"${key}" must be one of: ${allowed.join(", ")} (got "${value}")`);
  }
}
