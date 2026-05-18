export type NotificationCategory =
  | 'alert'
  | 'order_fill'
  | 'sip'
  | 'risk'
  | 'rebalance'
  | 'system';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface NotificationRow {
  id: string;
  user_id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  data: Record<string, unknown>;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}
