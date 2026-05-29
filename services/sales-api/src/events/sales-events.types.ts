// Phase 4 Sales Step 4 — per-domain event contract for sales-api.
// Deliberately separate from CrmEventType in services/crm-api so each
// service owns its event vocabulary. Topics live under sales.* (Kafka
// topic naming convention: <domain>.<aggregate>).

export enum SalesEventType {
  LEAD_CREATED = 'sales.lead.created',
  LEAD_UPDATED = 'sales.lead.updated',
  LEAD_DELETED = 'sales.lead.deleted',
  LEAD_QUALIFIED = 'sales.lead.qualified',
  LEAD_CONVERTED = 'sales.lead.converted',
}

export interface SalesLeadEvent {
  event_type: SalesEventType;
  event_id: string;
  timestamp: string;
  tenant_id: string;
  franchise_id?: string | null;
  user_id: string;
  idempotency_key: string;
  data: Record<string, unknown>;
}
