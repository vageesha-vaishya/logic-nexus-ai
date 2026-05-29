// Phase 5 finance-api extraction — types lifted from services/crm-api/src/types/crm.types.ts.
// Per the same duplicate-then-reconcile pattern as sales-api: ErrorResponse is duplicated
// rather than shared so each service owns its type identity.

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partial' | 'void' | 'overdue' | 'cancelled';

export interface InvoiceRecord {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BillingDocument {
  format: string;
  templateVersion: string;
  summary: {
    invoiceNumber: string;
    status: InvoiceStatus;
    issueDate: string | null;
    dueDate: string | null;
  };
  sections: Array<{
    title: string;
    fields: Record<string, string | number | boolean | null>;
  }>;
}

export interface FinalizeInvoiceResponse {
  invoice: InvoiceRecord;
  statusChanged: boolean;
  glSync: {
    queued: true;
    mode: 'in_process' | 'kafka';
    jobId: string;
  };
  idempotency: {
    key: string | null;
    replayed: boolean;
  };
  billing?: BillingDocument;
}

export interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  path?: string;
  requestId?: string | null;
}

export interface TaxNexusAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface TaxCalculationItem {
  id?: string;
  amount: number;
  taxCode?: string;
}

export interface TaxCalculationRequest {
  origin: TaxNexusAddress;
  destination: TaxNexusAddress;
  items: TaxCalculationItem[];
  customerId?: string;
}

export interface TaxCalculationBreakdown {
  level: string;
  rate: number;
  amount: number;
}

export interface TaxCalculationLineItem {
  id?: string;
  taxAmount: number;
  taxRate: number;
}

export interface TaxCalculationResponse {
  hasNexus: boolean;
  jurisdictions: string[];
  jurisdictionCode?: string;
  totalTax: number;
  breakdown: TaxCalculationBreakdown[];
  lineItems: TaxCalculationLineItem[];
  exemptionApplied?: {
    accountId: string;
    certificateNumber: string;
    expirationDate: string;
    exemptionType: string;
  };
}

export interface TaxExemptionCertificate {
  certificateNumber: string;
  issuingAuthority: string;
  exemptionType: string;
  expirationDate: string;
  documentUrl?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface TaxExemptionCertificateUploadRequest {
  accountId: string;
  certificateNumber: string;
  issuingAuthority: string;
  exemptionType: string;
  expirationDate: string;
  documentUrl?: string;
}
