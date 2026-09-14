export const STATUS_TONES = ['success', 'warning', 'danger', 'info', 'neutral', 'special'] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

export interface StatusConfigEntry { label: string; tone: StatusTone }

export const statusConfig: Record<string, StatusConfigEntry> = {
  draft: { label: 'Draft', tone: 'neutral' },
  internal_review: { label: 'In Review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  sent: { label: 'Sent', tone: 'info' },
  rejected: { label: 'Rejected', tone: 'danger' },
  accepted: { label: 'Accepted', tone: 'success' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
