// Phase 4 Sales Step 4 — sales domain types. Lead types lifted out of
// crm-api/src/types/crm.types.ts since leads are a sales-domain concept
// post-Phase 4 (see [[platform-modules-redesign]] §7.4). ErrorResponse
// duplicated here rather than shared so the type identity stays with each
// service; if a third service needs it we extract to @sos/api-common then.

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

export interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  path?: string;
  requestId?: string | null;
}
