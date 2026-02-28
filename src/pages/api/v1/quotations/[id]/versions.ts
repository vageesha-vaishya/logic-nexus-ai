
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { QuotationVersionService } from '@/services/quotation/QuotationVersionService';

// Initialize Supabase client (assuming env vars are set)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const versionService = new QuotationVersionService(supabase);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: quoteId } = req.query;
  const quoteIdStr = Array.isArray(quoteId) ? quoteId[0] : quoteId;

  if (!quoteIdStr) {
    return res.status(400).json({ error: 'Missing quote ID' });
  }

  // TODO: Add proper auth middleware to get user and tenant context
  // Mocking context for now
  const tenantId = req.headers['x-tenant-id'] as string || 'default-tenant';
  const userId = req.headers['x-user-id'] as string || 'system';

  try {
    switch (req.method) {
      case 'GET':
        // List versions
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const result = await versionService.listVersions(quoteIdStr, page, limit);
        return res.status(200).json(result);

      case 'POST':
        // Save new version
        const { data, type, reason } = req.body;
        if (!data) return res.status(400).json({ error: 'Missing payload data' });
        
        const newVersion = await versionService.saveVersion(
          quoteIdStr,
          tenantId,
          data,
          type || 'minor',
          userId,
          reason
        );
        return res.status(201).json(newVersion);

      case 'DELETE':
        // Purge old versions (Admin only)
        // Usually this endpoint might be different, e.g. /api/admin/purge-versions
        // But for resource-specific, maybe we delete a specific version?
        // Let's support deleting a specific version if versionId is in body
        const { versionId } = req.body;
        if (versionId) {
            await versionService.deleteVersion(versionId, userId);
            return res.status(204).end();
        }
        return res.status(400).json({ error: 'Missing version ID for delete' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Version API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
