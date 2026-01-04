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
}

export const statusConfig: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: "✏️ Draft", color: "bg-gray-500/10 text-gray-700 dark:text-gray-300" },
  pricing_review: { label: "🔍 Pricing Review", color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  approved: { label: "✅ Approved", color: "bg-green-500/10 text-green-700 dark:text-green-300" },
  sent: { label: "📧 Sent to Customer", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  customer_reviewing: { label: "👀 Customer Reviewing", color: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
  revision_requested: { label: "🔄 Revision Requested", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  accepted: { label: "✅ Accepted", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "❌ Rejected", color: "bg-red-500/10 text-red-700 dark:text-red-300" },
  expired: { label: "⏰ Expired", color: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
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
