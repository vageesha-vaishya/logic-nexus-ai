import type { NextApiRequest, NextApiResponse } from 'next';

interface AssignmentRecord {
  id: string;
  tenant_id: string;
  domain_id: string;
  is_active: boolean;
  subscription_status: string;
  batch_id: string;
  actor_user_id: string;
  created_at: string;
}

const ASSIGNMENTS: Map<string, AssignmentRecord> = new Map();

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const correlationId = String(req.headers['x-correlation-id'] || 'dev');

  // GET - List assignment audit history
  if (req.method === 'GET') {
    const records = Array.from(ASSIGNMENTS.values())
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return res.status(200).json({
      version: 'v1',
      correlationId,
      data: records,
    });
  }

  // POST - Bulk assign domain to tenants
  if (req.method === 'POST') {
    const body = req.body;
    const domainId = String(body?.domainId || '').trim();
    const tenantIds = Array.isArray(body?.tenantIds) ? body.tenantIds : [];
    const batchId = String(body?.batchId || crypto.randomUUID()).trim();

    if (!domainId || tenantIds.length === 0) {
      return res.status(400).json({ error: 'domainId and tenantIds are required', code: 'INVALID_PAYLOAD' });
    }

    const now = new Date().toISOString();
    const records: AssignmentRecord[] = [];

    for (const tenantId of tenantIds) {
      const id = crypto.randomUUID();
      const record: AssignmentRecord = {
        id,
        tenant_id: String(tenantId),
        domain_id: domainId,
        is_active: true,
        subscription_status: 'active',
        batch_id: batchId,
        actor_user_id: String(req.headers['x-user-id'] || 'system'),
        created_at: now,
      };
      ASSIGNMENTS.set(`domain-assignment:${id}`, record);
      records.push(record);
    }

    return res.status(200).json({
      version: 'v1',
      correlationId,
      data: {
        batchId,
        assignedCount: records.length,
        records,
      },
    });
  }

  // DELETE - Bulk revoke domain from tenants
  if (req.method === 'DELETE') {
    const body = req.body;
    const domainId = String(body?.domainId || '').trim();
    const tenantIds = Array.isArray(body?.tenantIds) ? body.tenantIds : [];
    const batchId = String(body?.batchId || crypto.randomUUID()).trim();

    if (!domainId || tenantIds.length === 0) {
      return res.status(400).json({ error: 'domainId and tenantIds are required', code: 'INVALID_PAYLOAD' });
    }

    let revokedCount = 0;
    for (const [key, record] of ASSIGNMENTS.entries()) {
      if (
        key.startsWith('domain-assignment:') &&
        record.domain_id === domainId &&
        tenantIds.includes(record.tenant_id)
      ) {
        ASSIGNMENTS.delete(key);
        revokedCount++;
      }
    }

    return res.status(200).json({
      version: 'v1',
      correlationId,
      data: {
        batchId,
        revokedCount,
      },
    });
  }
}
