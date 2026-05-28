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
 * Reserved topic names. Phase 0 ships the 9 core topics; business-module
 * topics get appended as each module's outbox publisher goes live.
 *
 * The full registry (with descriptions, retention, schemas) is documented at
 * `docs/architecture/kafka-topic-registry.md`.
 */
export const RESERVED_TOPICS = [
  // core (Phase 0)
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

/**
 * Dead-letter topic naming: failures on `<original>` go to `dlq.<original>`.
 */
export function dlqTopicFor(originalTopic: string): string {
  return `dlq.${originalTopic}`;
}
