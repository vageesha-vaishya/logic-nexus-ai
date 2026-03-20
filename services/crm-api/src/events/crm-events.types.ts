export enum CrmEventType {
  LEAD_CREATED = 'crm.lead.created',
  LEAD_UPDATED = 'crm.lead.updated',
  LEAD_QUALIFIED = 'crm.lead.qualified'
}

export interface CrmLeadEvent {
  event_type: CrmEventType;
  event_id: string;
  timestamp: string;
  tenant_id: string;
  franchise_id?: string | null;
  user_id: string;
  idempotency_key: string;
  data: Record<string, unknown>;
}
