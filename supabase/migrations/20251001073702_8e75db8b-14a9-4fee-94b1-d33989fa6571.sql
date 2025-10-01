-- Create email accounts table
CREATE TABLE public.email_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  provider TEXT NOT NULL CHECK (provider IN ('office365', 'gmail', 'smtp_imap', 'other')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- OAuth tokens for Office365/Gmail
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- SMTP/IMAP settings for generic providers
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_use_tls BOOLEAN DEFAULT true,
  imap_host TEXT,
  imap_port INTEGER,
  imap_username TEXT,
  imap_password TEXT,
  imap_use_ssl BOOLEAN DEFAULT true,
  
  -- Sync settings
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_frequency INTEGER DEFAULT 5, -- minutes
  auto_sync_enabled BOOLEAN DEFAULT true,
  
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, email_address)
);

-- Create emails table
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  
  -- Email metadata
  message_id TEXT NOT NULL, -- Provider's message ID
  thread_id TEXT,
  subject TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {email, name}
  cc_emails JSONB DEFAULT '[]'::jsonb,
  bcc_emails JSONB DEFAULT '[]'::jsonb,
  reply_to TEXT,
  
  -- Content
  body_text TEXT,
  body_html TEXT,
  snippet TEXT, -- Preview/summary
  
  -- Attachments
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb, -- Array of {name, size, type, url}
  
  -- Status and flags
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT DEFAULT 'received' CHECK (status IN ('draft', 'sending', 'sent', 'received', 'failed', 'bounced')),
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  
  -- Categorization
  folder TEXT DEFAULT 'inbox', -- inbox, sent, drafts, trash, spam, archive
  labels JSONB DEFAULT '[]'::jsonb, -- Array of label names
  category TEXT, -- primary, social, promotions, updates, forums
  
  -- Associations
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  account_id_crm UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(account_id, message_id)
);

-- Create email filters table
CREATE TABLE public.email_filters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0, -- Higher priority filters run first
  is_active BOOLEAN DEFAULT true,
  
  -- Filter conditions (all must match)
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {field, operator, value}
  -- field: from, to, subject, body, has_attachment, etc.
  -- operator: contains, equals, starts_with, ends_with, matches, etc.
  
  -- Actions to perform
  actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {action, value}
  -- action: move_to_folder, add_label, mark_as_read, mark_as_starred, forward_to, delete, etc.
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  created_by UUID,
  
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  
  -- Template variables
  variables JSONB DEFAULT '[]'::jsonb, -- Array of variable names that can be replaced
  
  category TEXT, -- sales, support, marketing, etc.
  is_shared BOOLEAN DEFAULT false, -- Available to all users in tenant
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_email_accounts_user_id ON public.email_accounts(user_id);
CREATE INDEX idx_email_accounts_tenant_id ON public.email_accounts(tenant_id);
CREATE INDEX idx_email_accounts_franchise_id ON public.email_accounts(franchise_id);

CREATE INDEX idx_emails_account_id ON public.emails(account_id);
CREATE INDEX idx_emails_tenant_id ON public.emails(tenant_id);
CREATE INDEX idx_emails_franchise_id ON public.emails(franchise_id);
CREATE INDEX idx_emails_thread_id ON public.emails(thread_id);
CREATE INDEX idx_emails_message_id ON public.emails(message_id);
CREATE INDEX idx_emails_direction ON public.emails(direction);
CREATE INDEX idx_emails_folder ON public.emails(folder);
CREATE INDEX idx_emails_lead_id ON public.emails(lead_id);
CREATE INDEX idx_emails_contact_id ON public.emails(contact_id);
CREATE INDEX idx_emails_received_at ON public.emails(received_at DESC);

CREATE INDEX idx_email_filters_user_id ON public.email_filters(user_id);
CREATE INDEX idx_email_filters_account_id ON public.email_filters(account_id);
CREATE INDEX idx_email_filters_priority ON public.email_filters(priority DESC);

CREATE INDEX idx_email_templates_tenant_id ON public.email_templates(tenant_id);
CREATE INDEX idx_email_templates_franchise_id ON public.email_templates(franchise_id);

-- Enable RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_accounts
CREATE POLICY "Users can view own email accounts"
  ON public.email_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own email accounts"
  ON public.email_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own email accounts"
  ON public.email_accounts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own email accounts"
  ON public.email_accounts FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins can manage all email accounts"
  ON public.email_accounts FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS Policies for emails
CREATE POLICY "Users can view emails from their accounts"
  ON public.emails FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create emails"
  ON public.emails FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their emails"
  ON public.emails FOR UPDATE
  USING (
    account_id IN (
      SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can manage all emails"
  ON public.emails FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS Policies for email_filters
CREATE POLICY "Users can manage own email filters"
  ON public.email_filters FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins can manage all email filters"
  ON public.email_filters FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS Policies for email_templates
CREATE POLICY "Users can view tenant templates"
  ON public.email_templates FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) AND
    (is_shared = true OR created_by = auth.uid())
  );

CREATE POLICY "Users can create templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid()) AND
    created_by = auth.uid()
  );

CREATE POLICY "Users can update own templates"
  ON public.email_templates FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own templates"
  ON public.email_templates FOR DELETE
  USING (created_by = auth.uid());

CREATE POLICY "Platform admins can manage all templates"
  ON public.email_templates FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Create updated_at triggers
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_emails_updated_at
  BEFORE UPDATE ON public.emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_filters_updated_at
  BEFORE UPDATE ON public.email_filters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();