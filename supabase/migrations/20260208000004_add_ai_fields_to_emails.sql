CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_emails_embedding
  ON public.emails USING hnsw (embedding vector_cosine_ops);
