export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'converted';

/** Matches the DB `lead_source` enum exactly -- keep in sync with supabase/types.ts. */
export const leadSources = ['website', 'referral', 'email', 'phone', 'social', 'event', 'other'] as const;
export type LeadSource = (typeof leadSources)[number];

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: string;
  estimated_value: number | null;
  created_at: string;
  lead_score: number | null;
  qualification_status: string | null;
  owner_id?: string | null;
  title: string | null;
  expected_close_date: string | null;
  description: string | null;
  notes: string | null;
  updated_at: string;
  last_activity_date: string | null;
  converted_at: string | null;
  custom_fields: Record<string, unknown> | null;
  tenant_id: string;
  franchise_id: string | null;
}

export const stages: LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
  'converted',
];

export const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: 'New Lead', color: 'bg-status-info text-status-info-foreground' },
  contacted: { label: 'Contacted', color: 'bg-status-special text-status-special-foreground' },
  qualified: { label: 'Qualified', color: 'bg-status-success text-status-success-foreground' },
  proposal: { label: 'Proposal Sent', color: 'bg-status-warning text-status-warning-foreground' },
  negotiation: { label: 'Negotiation', color: 'bg-status-warning text-status-warning-foreground' },
  won: { label: 'Won', color: 'bg-status-success text-status-success-foreground' },
  lost: { label: 'Lost', color: 'bg-status-danger text-status-danger-foreground' },
  converted: { label: 'Converted', color: 'bg-status-info text-status-info-foreground' },
};
