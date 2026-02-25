CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'master_hts'
  ) THEN
    ALTER TABLE public.master_hts 
      ADD COLUMN IF NOT EXISTS embedding vector(1536);
    CREATE INDEX IF NOT EXISTS idx_master_hts_embedding 
      ON public.master_hts USING hnsw (embedding vector_cosine_ops);
  END IF;
END $$;
