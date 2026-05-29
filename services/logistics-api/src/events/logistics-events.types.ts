// Phase 5 logistics-api — per-domain event contract.
// Topics live under logistics.* (Kafka topic naming convention:
// <domain>.<aggregate>). The shipment.delivered emission for
// cross-module chaining is handled at the DB level by
// core.emit_shipment_delivered() — these enums are for direct
// logistics-only emissions (creation, cancellation) and future
// consumers within the logistics domain.

export enum LogisticsEventType {
  SHIPMENT_CREATED = 'logistics.shipment.created',
  SHIPMENT_UPDATED = 'logistics.shipment.updated',
  SHIPMENT_DELIVERED = 'logistics.shipment.delivered',
  SHIPMENT_CANCELLED = 'logistics.shipment.cancelled',
}

export interface LogisticsShipmentEvent {
  event_type: LogisticsEventType;
  event_id: string;
  timestamp: string;
  tenant_id: string;
  franchise_id?: string | null;
  user_id: string;
  idempotency_key: string;
  data: Record<string, unknown>;
}
