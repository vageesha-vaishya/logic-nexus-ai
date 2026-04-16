import type { NextApiRequest, NextApiResponse } from 'next';

type DomainRecord = {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
};

const DOMAINS: DomainRecord[] = [
  { id: '849b380e-3603-4530-94d3-e028126e2a2c', code: 'LOGISTICS', name: 'Logistics & Supply Chain', description: 'Transportation, warehousing, and freight', is_active: true },
  { id: '123e4567-e89b-12d3-a456-426614174000', code: 'BANKING', name: 'Banking & Finance', description: 'Financial services and lending', is_active: true },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', code: 'ECOMMERCE', name: 'E-Commerce', description: 'Online retail and order management', is_active: true },
  { id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', code: 'TELECOM', name: 'Telecommunications', description: 'Network services and connectivity', is_active: true },
  { id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', code: 'INSURANCE', name: 'Insurance', description: 'Risk management and coverage', is_active: true },
  { id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', code: 'CUSTOMS', name: 'Customs & Compliance', description: 'Regulatory compliance and border clearance', is_active: true },
  { id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', code: 'TRADING', name: 'Trading & Procurement', description: 'Sourcing and trade execution', is_active: true },
  { id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', code: 'REAL_ESTATE', name: 'Real Estate', description: 'Property management and sales', is_active: true },
  { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', code: 'AMRO', name: 'Aircraft Maintenance & Repair Operations', description: 'Aviation maintenance, repair, and overhaul management', is_active: true },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  return res.status(200).json({
    version: 'v1',
    correlationId: req.headers['x-correlation-id'] || 'dev',
    data: DOMAINS,
    tenantDomainCount: DOMAINS.length,
  });
}
