CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES public.franchises(id),
    channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp','x','telegram','linkedin','web','sms','voice','other')),
    direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    from_contact_id UUID REFERENCES public.contacts(id),
    to_contact_ids UUID[] DEFAULT '{}',
    related_lead_id UUID REFERENCES public.leads(id),
    related_account_id UUID REFERENCES public.accounts(id),
    subject TEXT,
    body_text TEXT NOT NULL,
    body_html TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    raw_headers JSONB,
    ai_sentiment TEXT,
    ai_intent TEXT,
    ai_urgency TEXT,
    thread_id UUID,
    queue TEXT,
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    has_attachments BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created ON public.messages(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_queue ON public.messages(queue);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view messages in their queues" ON public.messages;
CREATE POLICY "Users can view messages in their queues"
ON public.messages
FOR SELECT
TO authenticated
USING (
  queue IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.queues q
      JOIN public.queue_members qm ON q.id = qm.queue_id
      WHERE q.name = messages.queue
      AND q.tenant_id = messages.tenant_id
      AND qm.user_id = auth.uid()
    )
    OR
    (
      public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
      AND messages.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  )
);
DROP POLICY IF EXISTS "Tenant admins view tenant messages" ON public.messages;
CREATE POLICY "Tenant admins view tenant messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
  AND messages.tenant_id = public.get_user_tenant_id(auth.uid())
);
CREATE TABLE IF NOT EXISTS public.message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON public.message_attachments(message_id);
CREATE TABLE IF NOT EXISTS public.channel_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('whatsapp','x','telegram','linkedin','web')),
    credentials JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.channel_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant admins can manage channel accounts" ON public.channel_accounts;
CREATE POLICY "Tenant admins can manage channel accounts"
ON public.channel_accounts
FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
    AND public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
);
CREATE OR REPLACE FUNCTION public.process_message_queue_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.queue_rules WHERE tenant_id = NEW.tenant_id AND is_active = true ORDER BY priority DESC LOOP
    IF (r.criteria ? 'channel') AND (r.criteria->>'channel' <> NEW.channel) THEN
      CONTINUE;
    END IF;
    IF (r.criteria ? 'subject_contains') AND (NEW.subject IS NULL OR position(lower(r.criteria->>'subject_contains') in lower(NEW.subject)) = 0) THEN
      CONTINUE;
    END IF;
    IF (r.criteria ? 'from_email') AND (NEW.metadata->>'from_email' IS NULL OR lower(NEW.metadata->>'from_email') <> lower(r.criteria->>'from_email')) THEN
      CONTINUE;
    END IF;
    IF (r.criteria ? 'body_contains') AND (position(lower(r.criteria->>'body_contains') in lower(coalesce(NEW.body_text,''))) = 0) THEN
      CONTINUE;
    END IF;
    IF (r.criteria ? 'header_contains') THEN
      IF NEW.raw_headers IS NULL THEN CONTINUE; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_each_text(r.criteria->'header_contains') AS kv(key,value)
        WHERE lower(NEW.raw_headers->>kv.key) LIKE ('%'||lower(kv.value)||'%')
      ) THEN
        CONTINUE;
      END IF;
    END IF;
    NEW.queue := r.target_queue_name;
    EXIT;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_messages_queue_assignment ON public.messages;
CREATE TRIGGER trg_messages_queue_assignment
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.process_message_queue_assignment();
