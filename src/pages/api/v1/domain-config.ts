import type { NextApiRequest, NextApiResponse } from 'next';

const CONFIGS: Map<string, any> = new Map();

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'PUT'].includes(req.method || '')) {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const correlationId = String(req.headers['x-correlation-id'] || 'dev');

  // GET - List domain configs
  if (req.method === 'GET') {
    const configs = Array.from(CONFIGS.values());

    return res.status(200).json({
      version: 'v1',
      correlationId,
      data: configs,
    });
  }

  // PUT - Create/update domain config
  if (req.method === 'PUT') {
    const body = req.body;
    const now = new Date().toISOString();
    const id = String(body?.id || crypto.randomUUID());
    const record = {
      id,
      ...body,
      updated_at: now,
    };

    CONFIGS.set(`domain-config:${id}`, record);

    return res.status(200).json({
      version: 'v1',
      correlationId,
      data: record,
    });
  }
}
