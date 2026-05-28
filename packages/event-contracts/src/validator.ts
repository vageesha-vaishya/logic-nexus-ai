import type { EventEnvelope } from "./types.js";

export type ValidationResult<TPayload = unknown> =
  | { ok: true; envelope: EventEnvelope<TPayload> }
  | { ok: false; errors: string[] };

/**
 * Lightweight runtime validation. Phase 0 placeholder — Phase 0.3 swaps to a
 * proper JSON Schema validator with per-topic payload schemas.
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
