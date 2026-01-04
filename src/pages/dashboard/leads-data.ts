export type LeadStatus = 
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'converted';

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
  new: { label: 'New Lead', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  contacted: { label: 'Contacted', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300' },
  qualified: { label: 'Qualified', color: 'bg-teal-500/10 text-teal-700 dark:text-teal-300' },
  proposal: { label: 'Proposal Sent', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300' },
  negotiation: { label: 'Negotiation', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300' },
  won: { label: 'Won', color: 'bg-green-500/10 text-green-700 dark:text-green-300' },
  lost: { label: 'Lost', color: 'bg-red-500/10 text-red-700 dark:text-red-300' },
  converted: { label: 'Converted', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
};
