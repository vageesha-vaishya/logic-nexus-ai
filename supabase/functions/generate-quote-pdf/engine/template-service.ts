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
    .select("*")
    .eq("id", templateId)
    .single();

  if (error) {
    if (logger) await logger.warn(`[Cache] Error fetching template ${templateId}: ${error.message}`);
    return null;
  }

  if (data) {
    if (logger) await logger.info(`[Cache] Miss for template ${templateId}. Caching...`);
    
    let content = data.content as any;
    if (typeof content === "string") {
      try {
        content = JSON.parse(content);
      } catch {
        content = {};
      }
    }
    if (!content || typeof content !== "object") {
      content = {};
    }

    // Merge metadata into content
    const fullTemplate = {
      ...content,
      id: data.id,
      name: data.template_name || data.name, // Support both new and old column names
      tenant_id: data.tenant_id,
      is_active: data.is_active,
      // Enhanced fields
      rate_options: data.rate_options,
      transport_modes: data.transport_modes,
      legs_config: data.legs_config,
      carrier_selections: data.carrier_selections
    };

    templateCache.set(templateId, {
      content: fullTemplate,
      timestamp: Date.now()
    });
    return fullTemplate;
  }

  return null;
}
