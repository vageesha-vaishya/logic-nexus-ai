
import { createClient } from '@supabase/supabase-js';
import { QuotationVersionService } from '@/services/quotation/QuotationVersionService';

interface ApiRequest {
  method?: string;
  query: Record<string, unknown>;
  body?: unknown;
  headers: Record<string, string | undefined>;
}

interface ApiResponse {
  status: (code: number) => { json: (data: unknown) => void; end: (text?: string) => void };
  setHeader: (name: string, value: string | string[]) => void;
}

// Initialize Supabase client (assuming env vars are set)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const versionService = new QuotationVersionService(supabase);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveQuoteId(quoteRef: string, tenantId: string): Promise<string | null> {
  const normalizedQuoteRef = String(quoteRef || '').trim();
  if (!normalizedQuoteRef) return null;

  const quoteRefIsUuid = UUID_REGEX.test(normalizedQuoteRef);
  let primaryQuery = supabase
    .from('quotes')
    .select('id')
    .eq('tenant_id', tenantId);

  if (quoteRefIsUuid) {
    primaryQuery = primaryQuery.or(`id.eq.${normalizedQuoteRef},quote_number.eq.${normalizedQuoteRef}`);
  } else {
    primaryQuery = primaryQuery.eq('quote_number', normalizedQuoteRef);
  }

  const primaryResult = await primaryQuery
    .limit(1)
    .maybeSingle();

  if (primaryResult.error) {
    throw new Error(primaryResult.error.message);
  }

  let resolvedQuote = primaryResult.data as { id?: string } | null;

  if (!resolvedQuote && !quoteRefIsUuid) {
    const fallbackResult = await supabase
      .from('quotes')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', normalizedQuoteRef)
      .limit(1)
      .maybeSingle();

    if (fallbackResult.error) {
      throw new Error(fallbackResult.error.message);
    }
    resolvedQuote = fallbackResult.data as { id?: string } | null;
  }

  return resolvedQuote?.id ? String(resolvedQuote.id) : null;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const rawId = req.query['id'];
  const quoteIdStr = Array.isArray(rawId) ? String(rawId[0]) : (rawId as string | undefined);

  if (!quoteIdStr) {
    return res.status(400).json({ error: 'Missing quote ID' });
  }

  // TODO: Add proper auth middleware to get user and tenant context
  // Mocking context for now
  const tenantId = (req.headers['x-tenant-id'] as string) || 'default-tenant';
  const userId = (req.headers['x-user-id'] as string) || 'system';

  try {
    const resolvedQuoteId = await resolveQuoteId(quoteIdStr, tenantId);
    if (!resolvedQuoteId) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    switch (req.method) {
      case 'GET': {
        // List versions
        const pageRaw = req.query['page'];
        const limitRaw = req.query['limit'];
        const page =
          typeof pageRaw === 'string'
            ? parseInt(pageRaw)
            : Array.isArray(pageRaw)
            ? parseInt(String(pageRaw[0]))
            : 1;
        const limit =
          typeof limitRaw === 'string'
            ? parseInt(limitRaw)
            : Array.isArray(limitRaw)
            ? parseInt(String(limitRaw[0]))
            : 10;
        const result = await versionService.listVersions(resolvedQuoteId, page, limit);
        return res.status(200).json(result);
      }

      case 'POST': {
        // Save new version
        const body = req.body as Record<string, unknown> | undefined;
        const data = body?.['data'];
        const type = body?.['type'] as string | undefined;
        const reason = body?.['reason'] as string | undefined;
        if (!data) return res.status(400).json({ error: 'Missing payload data' });
        
        const kind = type === 'major' || type === 'minor' || type === 'draft' ? type : 'minor';
        const newVersion = await versionService.saveVersion(
          resolvedQuoteId,
          tenantId,
          data as Record<string, unknown>,
          kind,
          userId,
          reason
        );
        return res.status(201).json(newVersion);
      }

      case 'DELETE': {
        // Purge old versions (Admin only)
        // Usually this endpoint might be different, e.g. /api/admin/purge-versions
        // But for resource-specific, maybe we delete a specific version?
        // Let's support deleting a specific version if versionId is in body
        const body = req.body as Record<string, unknown> | undefined;
        const versionId = body?.['versionId'] as string | undefined;
        if (versionId) {
            await versionService.deleteVersion(versionId, userId);
            return res.status(204).end();
        }
        return res.status(400).json({ error: 'Missing version ID for delete' });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return res.status(500).json({ error: message });
  }
}
