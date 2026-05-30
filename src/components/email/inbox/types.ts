export interface Email {
  id: string;
  subject: string;
  from_email: string;
  from_name: string;
  snippet: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  folder: string;
  labels: any;
  priority?: string;
  importance?: string;
  ai_sentiment?: string;
  ai_urgency?: string;
  security_status?: 'pending' | 'scanning' | 'clean' | 'suspicious' | 'malicious';
  quarantine_reason?: string;
}

export interface EmailAccount {
  id: string;
  email_address: string;
  provider: string;
  is_primary: boolean;
}

export interface ThreadGroup {
  id: string;
  count: number;
  latestEmail: Email;
}

export type SortField = 'received_at' | 'from_email' | 'subject' | 'priority';
export type SortDirection = 'asc' | 'desc';
export type DuplicateMap = Record<string, { count: number; leadIds: string[] }>;
