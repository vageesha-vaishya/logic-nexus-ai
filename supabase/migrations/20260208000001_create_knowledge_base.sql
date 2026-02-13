CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_knowledge_base
  ON public.knowledge_base FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY insert_knowledge_base
  ON public.knowledge_base FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR tenant_id IS NULL);

CREATE POLICY update_knowledge_base
  ON public.knowledge_base FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding ON public.knowledge_base USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant ON public.knowledge_base (tenant_id);
