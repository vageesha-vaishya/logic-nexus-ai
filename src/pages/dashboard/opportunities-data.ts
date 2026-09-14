export type OpportunityStage = 
  | 'prospecting'
  | 'qualification'
  | 'needs_analysis'
  | 'value_proposition'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export interface Opportunity {
  id: string;
  name: string;
  stage: OpportunityStage;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  expected_revenue: number | null;
  created_at: string;
  account_id: string | null;
  contact_id: string | null;
  owner_id: string | null;
  franchise_id: string | null;
  tenant_id?: string;
  accounts?: { name: string } | null;
  contacts?: { first_name: string; last_name: string; email: string } | null;
  leads?: { first_name: string; last_name: string; email: string } | null;
  salesforce_sync_status?: string | null;
  salesforce_last_synced?: string | null;
  salesforce_error?: string | null;
  lead_source?: string | null;
  type?: string | null;
  description?: string | null;
  next_step?: string | null;
  competitors?: string | null;
  updated_at?: string;
  closed_at?: string | null;
}

export interface OpportunityHistory {
  id: string;
  opportunity_id: string;
  old_probability: number | null;
  new_probability: number | null;
  old_stage: OpportunityStage | null;
  new_stage: OpportunityStage | null;
  changed_by: string | null;
  changed_at: string;
  changer?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export const stageColors: Record<OpportunityStage, string> = {
  prospecting: 'bg-status-neutral text-status-neutral-foreground',
  qualification: 'bg-status-info text-status-info-foreground',
  needs_analysis: 'bg-status-info text-status-info-foreground',
  value_proposition: 'bg-status-info text-status-info-foreground',
  proposal: 'bg-status-special text-status-special-foreground',
  negotiation: 'bg-status-warning text-status-warning-foreground',
  closed_won: 'bg-status-success text-status-success-foreground',
  closed_lost: 'bg-status-danger text-status-danger-foreground',
};

export const stageLabels: Record<OpportunityStage, string> = {
  prospecting: '🆕 New Opportunity',
  qualification: '💰 Quote Requested',
  needs_analysis: '📋 Requirements Gathering',
  proposal: '📄 Quote Submitted',
  negotiation: '🤝 Negotiation',
  value_proposition: '📝 Contract Review',
  closed_won: '✅ Won',
  closed_lost: '❌ Lost',
};

export const stages: OpportunityStage[] = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'value_proposition',
  'needs_analysis',
  'closed_won',
  'closed_lost'
];

export const stageProbabilityMap: Record<OpportunityStage, number> = {
  prospecting: 10,
  qualification: 20,
  needs_analysis: 30,
  value_proposition: 40,
  proposal: 60,
  negotiation: 80,
  closed_won: 100,
  closed_lost: 0,
};

import type { Lead, LeadStatus } from './leads-data';
import { logger } from "@/lib/logger";

export const leadToOpportunityStageMap: Record<LeadStatus, OpportunityStage> = {
  new: 'prospecting',
  contacted: 'qualification',
  qualified: 'needs_analysis',
  proposal: 'proposal',
  negotiation: 'negotiation',
  won: 'closed_won',
  lost: 'closed_lost',
  converted: 'prospecting',
};

export const getOpportunityStageFromLead = (leadStatus: LeadStatus): OpportunityStage => {
  if (!Object.prototype.hasOwnProperty.call(leadToOpportunityStageMap, leadStatus)) {
    logger.warn(`Unknown lead status: ${leadStatus}, defaulting to prospecting`);
    return 'prospecting';
  }
  return leadToOpportunityStageMap[leadStatus];
};

export function buildOpportunityFromLead(params: {
  lead: Lead;
  name?: string | null;
  tenant_id: string;
  franchise_id: string | null;
  account_id?: string | null;
  contact_id?: string | null;
}) {
  const { lead, name, tenant_id, franchise_id, account_id, contact_id } = params;
  return {
    name: name || `${lead.first_name} ${lead.last_name} Opportunity`,
    account_id: account_id || null,
    contact_id: contact_id || null,
    stage: 'prospecting' as OpportunityStage,
    amount: lead.estimated_value != null ? Number(lead.estimated_value) : null,
    close_date: lead.expected_close_date,
    tenant_id,
    franchise_id,
    lead_source: lead.source,
    lead_id: lead.id,
  };
}
