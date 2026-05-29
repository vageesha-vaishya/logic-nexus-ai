export enum FinanceEventType {
  INVOICE_FINALIZED = 'finance.invoice.finalized'
}

export interface InvoiceFinalizedEvent {
  event_type: FinanceEventType.INVOICE_FINALIZED;
  event_id: string;
  timestamp: string;
  tenant_id: string;
  franchise_id: string | null;
  user_id: string;
  idempotency_key: string;
  data: {
    invoice_id: string;
  };
}
