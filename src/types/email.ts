
export interface EmailAttachment {
  id?: string;
  name: string;
  path: string;
  url?: string;
  type?: string;
  size?: number;
  content_type?: string;
}

export interface Email {
  id: string;
  subject: string;
  from_email: string;
  from_name: string;
  to_emails: string[];
  cc_emails?: string[];
  bcc_emails?: string[];
  reply_to?: string;
  
  snippet?: string;
  body_text?: string;
  body_html?: string;
  
  received_at: string;
  sent_at?: string;
  created_at?: string;
  
  folder: string;
  labels?: string[];
  
  is_read: boolean;
  is_starred: boolean;
  is_archived?: boolean;
  
  has_attachments: boolean;
  attachments?: EmailAttachment[];
  
  thread_id?: string;
  conversation_id?: string;
  importance?: 'high' | 'normal' | 'low';
  priority?: string;
  
  // AI / Routing
  queue?: string;
  category?: string;
  intent?: string;
  ai_sentiment?: string;
  ai_urgency?: string;
}

export interface EmailAccount {
  id: string;
  provider: string;
  email_address: string;
  display_name: string;
  is_primary: boolean;
  is_active: boolean;
  last_sync_at: string;
  created_at: string;
  user_id: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  imap_host?: string;
  imap_port?: number;
  imap_username?: string;
}
