export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'converted';

export interface LeadRecord {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  first_name: string;
  last_name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: string;
  description: string | null;
  notes: string | null;
  estimated_value: number | null;
  expected_close_date: string | null;
  lead_score: number | null;
  qualification_status: string | null;
  custom_fields: Record<string, unknown> | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLeadRequest {
  first_name: string;
  last_name: string;
  company?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  status: LeadStatus;
  source: string;
  description?: string | null;
  notes?: string | null;
  estimated_value?: number | null;
  expected_close_date?: string | null;
  qualification_status?: string | null;
  custom_fields?: Record<string, unknown> | null;
  owner_id?: string | null;
}

export type UpdateLeadRequest = Partial<CreateLeadRequest>;

export interface DeleteLeadsRequest {
  ids: string[];
}

export interface DeleteLeadsResponse {
  deletedCount: number;
}

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
