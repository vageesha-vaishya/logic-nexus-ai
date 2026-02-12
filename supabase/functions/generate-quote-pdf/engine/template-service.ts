import { SupabaseClient } from "@supabase/supabase-js";

interface TemplateCacheItem {
  content: any;
  timestamp: number;
}

const templateCache = new Map<string, TemplateCacheItem>();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export async function getTemplate(
  supabase: SupabaseClient,
  templateId?: string,
  logger?: any
): Promise<any> {
  if (!templateId) return null;

  // Check Cache
  const cached = templateCache.get(templateId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    if (logger) await logger.info(`[Cache] Hit for template ${templateId}`);
    return cached.content;
  }

  // Fetch from DB
  const { data, error } = await supabase
    .from("quote_templates")
    .select("content")
    .eq("id", templateId)
    .single();

  if (error) {
    if (logger) await logger.warn(`[Cache] Error fetching template ${templateId}: ${error.message}`);
    return null;
  }

  if (data) {
    if (logger) await logger.info(`[Cache] Miss for template ${templateId}. Caching...`);
    templateCache.set(templateId, {
      content: data.content,
      timestamp: Date.now()
    });
    return data.content;
  }

  return null;
}
