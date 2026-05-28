import type { ModuleName } from "./types.js";

/**
 * Compose a canonical topic name. Per master §5.1, every Kafka topic is
 * `<module>.<entity_type>.<event_type>`.
 */
export function topicName(
  module: ModuleName,
  entity_type: string,
  event_type: string,
): string {
  return `${module}.${entity_type}.${event_type}`;
}

/**
 * Phase 0 reserved topic names. Populated incrementally as modules ship their
 * outbox publishers. Full registry lives in `docs/architecture/kafka-topic-registry.md`.
 */
export const RESERVED_TOPICS = [
  // core
  "core.tenant.created",
  "core.user.created",
  "core.user.invited",
  "core.party.created",
  "core.party.updated",
  "core.party.merged",
  "core.party.deleted",
  "core.membership.granted",
  "core.membership.revoked",
] as const;

export type ReservedTopic = (typeof RESERVED_TOPICS)[number];
