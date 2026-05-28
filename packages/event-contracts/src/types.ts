/**
 * Universal event envelope. Every event on every Kafka topic uses this shape.
 * See master design doc §5.1.
 */
export interface EventEnvelope<TPayload = unknown> {
  /** ULID, globally unique. */
  id: string;
  tenant_id: string;
  module: ModuleName;
  /** Entity name, singular lowercase, no schema prefix. e.g. 'opportunity', 'shipment', 'work_order' */
  entity_type: string;
  /** Verb, past tense. e.g. 'created', 'won', 'delivered' */
  event_type: string;
  entity_id: string;
  /** ISO 8601 timestamp */
  occurred_at: string;
  /** Event-schema version; additive changes don't bump this. */
  version: number;
  payload: TPayload;
  metadata: EventMetadata;
}

export interface EventMetadata {
  actor_user_id: string | null;
  actor_kind: ActorKind;
  /** Root event's ULID — propagates across the whole saga. */
  correlation_id: string;
  /** ULID of the immediately-upstream event, or null if root. */
  causation_id: string | null;
  /** W3C trace context (master §8.1.1). Optional during Phase 0. */
  tracing?: {
    traceparent: string;
    tracestate?: string;
  };
}

export type ActorKind = "user" | "service" | "integration" | "system";

export type ModuleName =
  | "core"
  | "crm"
  | "sales"
  | "quotation"
  | "logistics"
  | "finance"
  | "compliance"
  | "comms"
  | "amro"
  | "uim"
  | "markets";

/**
 * Polymorphic subject reference. ALWAYS schema-qualified, singular, lowercase.
 * Per master §2.4. Examples: 'core.party', 'sales.lead', 'quotation.quote',
 * 'logistics.shipment', 'amro.work_order', 'finance.invoice'.
 */
export type SchemaQualifiedSubject = `${ModuleName}.${string}`;
