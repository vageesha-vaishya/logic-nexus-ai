export type QuoteStatus =
  | 'draft'
  | 'pricing_review'
  | 'approved'
  | 'sent'
  | 'customer_reviewing'
  | 'revision_requested'
  | 'accepted'
  | 'rejected'
  | 'expired';

export interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: QuoteStatus;
  sell_price: number | null;
  cost_price: number | null;
  margin_amount: number | null;
  margin_percentage: number | null;
  valid_until: string | null;
  created_at: string;
  updated_at?: string;
  account_id: string | null;
  opportunity_id: string | null;
  franchise_id: string | null;
  contact_id: string | null;
  carrier_id: string | null;
  service_type_id: string | null;
  accounts?: { name: string } | null;
  opportunities?: { name: string } | null;
  contacts?: { first_name: string; last_name: string } | null;
  carriers?: { carrier_name: string } | null;
  service_types?: { name: string } | null;
  franchises?: { name: string } | null;
  quotation_versions?: {
    version_number: number;
    created_at: string;
    aes_hts_codes?: {
      hts_code: string;
      description: string;
    } | null;
  }[] | null;
  priority?: 'high' | 'medium' | 'low';
}

export const statusConfig: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: "✏️ Draft", color: "bg-status-neutral text-status-neutral-foreground" },
  pricing_review: { label: "🔍 Pricing Review", color: "bg-status-info text-status-info-foreground" },
  approved: { label: "✅ Approved", color: "bg-status-success text-status-success-foreground" },
  sent: { label: "📧 Sent to Customer", color: "bg-status-info text-status-info-foreground" },
  customer_reviewing: { label: "👀 Customer Reviewing", color: "bg-status-info text-status-info-foreground" },
  revision_requested: { label: "🔄 Revision Requested", color: "bg-status-warning text-status-warning-foreground" },
  accepted: { label: "✅ Accepted", color: "bg-status-success text-status-success-foreground" },
  rejected: { label: "❌ Rejected", color: "bg-status-danger text-status-danger-foreground" },
  expired: { label: "⏰ Expired", color: "bg-status-warning text-status-warning-foreground" },
};

export const stages: QuoteStatus[] = [
  'draft',
  'pricing_review',
  'approved',
  'sent',
  'customer_reviewing',
  'revision_requested',
  'accepted',
  'rejected',
  'expired',
];
