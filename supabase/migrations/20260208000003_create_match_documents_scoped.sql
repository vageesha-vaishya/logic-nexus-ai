CREATE OR REPLACE FUNCTION public.match_documents_scoped(
  query_embedding vector(1536),
  p_tenant_id uuid,
  p_threshold float,
  p_limit int
) RETURNS TABLE (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
) LANGUAGE sql STABLE AS $$
  SELECT kb.id, kb.title, kb.content, kb.metadata,
         1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base kb
  WHERE kb.embedding IS NOT NULL
    AND (kb.tenant_id = p_tenant_id OR kb.tenant_id IS NULL)
    AND (1 - (kb.embedding <=> query_embedding)) >= p_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT p_limit;
$$;
