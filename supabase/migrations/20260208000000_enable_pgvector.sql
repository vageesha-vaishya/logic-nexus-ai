CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE public.master_hts ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS idx_master_hts_embedding ON public.master_hts USING hnsw (embedding vector_cosine_ops);
